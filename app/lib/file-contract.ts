import { z } from "zod";

/**
 * 文件 API 契约：seam 两侧（前端 file-api-client 与后端 api.files.* actions）
 * 共同依赖的单一出处——请求/响应 schema、FileMeta DTO、endpoint 常量。
 * 服务端响应以 `satisfies` 对照本契约，客户端以 schema 解析响应，
 * 任一侧改动导致字段漂移时，编译期或运行期立即暴露。
 */

/** 单文件大小上限：20 MB */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

const filenameSchema = z.string().trim().min(1).max(255);
const mimeTypeSchema = z.string().trim().min(1).max(255);

/** 申请预签名上传 URL 的请求体 */
export const uploadRequestSchema = z.object({
  filename: filenameSchema,
  mimeType: mimeTypeSchema,
  size: z.number().int().positive().max(MAX_FILE_SIZE),
});

/** 直传完成后登记元数据的请求体 */
export const completeUploadSchema = uploadRequestSchema.extend({
  key: z.string().min(1).max(1024),
});

/** 申请预签名下载 URL 的请求体 */
export const downloadRequestSchema = z.object({
  fileId: z.uuid(),
});

/** 文件元数据的 wire 形状（files 表记录 → 前端展示的 DTO） */
export const fileMetaSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

/** 各 endpoint 的响应契约 */
export const uploadUrlResponseSchema = z.object({
  key: z.string(),
  uploadUrl: z.string(),
});
export const completeUploadResponseSchema = z.object({
  file: fileMetaSchema,
});
export const downloadUrlResponseSchema = z.object({
  downloadUrl: z.string(),
  expiresInSeconds: z.number(),
});
/** 统一错误体：三个 action 与前端 readError 共同依赖，禁止漂移 */
export const errorResponseSchema = z.object({
  error: z.string(),
  issues: z.array(z.unknown()).optional(),
});

/** 路由端点常量（与 app/routes/api.files.* 的文件命名一一对应） */
export const FILE_ENDPOINTS = {
  uploadUrl: "/api/files/upload-url",
  complete: "/api/files/complete",
  downloadUrl: "/api/files/download-url",
} as const;

export type UploadRequest = z.infer<typeof uploadRequestSchema>;
export type CompleteUploadRequest = z.infer<typeof completeUploadSchema>;
export type DownloadRequest = z.infer<typeof downloadRequestSchema>;
export type FileMeta = z.infer<typeof fileMetaSchema>;
export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>;
export type CompleteUploadResponse = z.infer<typeof completeUploadResponseSchema>;
export type DownloadUrlResponse = z.infer<typeof downloadUrlResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
