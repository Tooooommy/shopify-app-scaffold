import { randomUUID } from "node:crypto";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { config } from "./config.server";

/** 上传预签名 URL 有效期：5 分钟内完成直传 */
export const UPLOAD_URL_EXPIRES_IN = 300;
/** 下载预签名 URL 有效期：短时效 5 分钟 */
export const DOWNLOAD_URL_EXPIRES_IN = 300;

const s3 = new S3Client({
  region: config.S3_REGION,
  ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
  forcePathStyle: config.S3_FORCE_PATH_STYLE === "true",
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
  },
});

/**
 * 生成对象 key：以店铺域名为前缀做租户隔离，随机 UUID 防止覆盖与枚举，
 * 同时去掉路径分隔符避免路径穿越。展示用文件名另存于 files 表。
 */
export function buildFileKey(shop: string, filename: string): string {
  const safeName = filename.replace(/[/\\]+/g, "_").slice(-100);
  return `shops/${shop}/${randomUUID()}-${safeName}`;
}

/** 预签名 PUT 直传 URL（前端直接上传，服务器不中转文件内容） */
export async function createUploadUrl(key: string, mimeType: string): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: config.S3_BUCKET, Key: key, ContentType: mimeType }),
    { expiresIn: UPLOAD_URL_EXPIRES_IN },
  );
}

/** 预签名 GET 下载 URL（短时效，调用前必须先验证 Shopify session） */
export async function createDownloadUrl(key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.S3_BUCKET, Key: key }), {
    expiresIn: DOWNLOAD_URL_EXPIRES_IN,
  });
}

/**
 * 读取对象实际大小（字节），不存在时返回 null。
 * 纯 getSignedUrl 的 PUT 无法在服务端限制上传大小，
 * 登记元数据前用它核对实际 ContentLength，防止"声明小、直传大"。
 */
export async function getObjectSize(key: string): Promise<number | null> {
  try {
    const result = await s3.send(new HeadObjectCommand({ Bucket: config.S3_BUCKET, Key: key }));
    return result.ContentLength ?? null;
  } catch {
    return null;
  }
}

/** 批量删除对象；失败不抛出，由 Bucket 生命周期规则兜底 */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: config.S3_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}
