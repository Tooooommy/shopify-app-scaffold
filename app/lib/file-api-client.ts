import type { z } from "zod";

import {
  completeUploadResponseSchema,
  downloadUrlResponseSchema,
  errorResponseSchema,
  FILE_ENDPOINTS,
  uploadUrlResponseSchema,
  type CompleteUploadRequest,
  type DownloadRequest,
  type DownloadUrlResponse,
  type FileMeta,
  type UploadRequest,
  type UploadUrlResponse,
} from "./file-contract";

/**
 * 文件 API 客户端：端点、请求/响应形状全部来自 file-contract（seam 单源）。
 * 认证统一携带 Bearer session token（审核要求后端请求带 session token）。
 */
async function callFileApi<S extends z.ZodType>(
  token: string,
  endpoint: string,
  options: { body?: unknown; response: S },
): Promise<z.infer<S>> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const parsedError = errorResponseSchema.safeParse(
      await response.json().catch(() => null),
    );
    throw new Error(
      parsedError.success ? parsedError.data.error : `请求失败（HTTP ${response.status}）`,
    );
  }

  return options.response.parse(await response.json());
}

/** 1）申请预签名 PUT 直传 URL */
export async function requestUploadUrl(
  token: string,
  input: UploadRequest,
): Promise<UploadUrlResponse> {
  return callFileApi(token, FILE_ENDPOINTS.uploadUrl, {
    body: input,
    response: uploadUrlResponseSchema,
  });
}

/** 2）前端直传对象存储（服务器不中转内容，不经过本应用契约） */
export async function uploadToObjectStorage(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`对象存储直传失败（HTTP ${response.status}）`);
  }
}

/** 3）直传完成后登记元数据 */
export async function completeUpload(
  token: string,
  input: CompleteUploadRequest,
): Promise<FileMeta> {
  const body = await callFileApi(token, FILE_ENDPOINTS.complete, {
    body: input,
    response: completeUploadResponseSchema,
  });
  return body.file;
}

/** 申请预签名 GET 下载 URL（5 分钟短时效） */
export async function requestDownloadUrl(
  token: string,
  fileId: DownloadRequest["fileId"],
): Promise<DownloadUrlResponse> {
  return callFileApi(token, FILE_ENDPOINTS.downloadUrl, {
    body: { fileId },
    response: downloadUrlResponseSchema,
  });
}
