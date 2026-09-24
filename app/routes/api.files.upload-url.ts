import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../lib/shopify.server";
import { buildFileKey, createUploadUrl } from "../lib/s3.server";
import { uploadRequestSchema, type UploadUrlResponse } from "../lib/file-contract";
import { parseJsonOr400 } from "../lib/http.server";

/**
 * 申请预签名 PUT 直传 URL（POST /api/files/upload-url，常量见 FILE_ENDPOINTS.uploadUrl）。
 * 校验通过后返回 { key, uploadUrl }；key 由服务端生成，前端不能自传。
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const body = await parseJsonOr400(request, uploadRequestSchema, "文件参数不合法");
  if (body instanceof Response) return body;

  const key = buildFileKey(session.shop, body.filename);
  const uploadUrl = await createUploadUrl(key, body.mimeType);

  return Response.json({ key, uploadUrl } satisfies UploadUrlResponse);
};
