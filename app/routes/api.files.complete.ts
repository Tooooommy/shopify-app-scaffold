import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../lib/shopify.server";
import { createFile, toFileMeta } from "../lib/files.server";
import { deleteObjects, getObjectSize } from "../lib/s3.server";
import { config } from "../lib/config.server";
import {
  completeUploadSchema,
  MAX_FILE_SIZE,
  type CompleteUploadResponse,
} from "../lib/file-contract";
import { errorResponse, parseJsonOr400 } from "../lib/http.server";

/**
 * 直传完成后登记元数据（POST /api/files/complete，常量见 FILE_ENDPOINTS.complete）。
 * 编排顺序（也是 action 级测试的断言面）：
 * key 归属校验 → HeadObject 读实际大小 → 超限删除并 413 → 写入 files 表。
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const body = await parseJsonOr400(request, completeUploadSchema, "文件参数不合法");
  if (body instanceof Response) return body;

  // key 必须归属当前店铺，防止越权登记他人对象
  const expectedPrefix = `shops/${session.shop}/`;
  if (!body.key.startsWith(expectedPrefix)) {
    return errorResponse(403, "对象 key 不合法");
  }

  // 确认直传确实完成，并读取对象实际大小
  const actualSize = await getObjectSize(body.key);
  if (actualSize === null) {
    return errorResponse(400, "对象尚未上传成功，请先完成直传");
  }

  // 纯 getSignedUrl 的 PUT 无法在服务端限长，这里以实际 ContentLength 兜底：
  // 超限对象立即删除并拒绝登记（彻底防线建议在 Bucket policy 配 content-length-range）
  if (actualSize > MAX_FILE_SIZE) {
    await deleteObjects([body.key]).catch(() => undefined);
    return errorResponse(413, "文件超过大小限制，已拒绝");
  }

  const expiresAt = new Date(Date.now() + config.FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const file = await createFile({
    shop: session.shop,
    key: body.key,
    filename: body.filename,
    mimeType: body.mimeType,
    // 以对象实际大小入库，不信任前端声明值
    size: actualSize,
    expiresAt,
  });

  return Response.json({ file: toFileMeta(file) } satisfies CompleteUploadResponse);
};
