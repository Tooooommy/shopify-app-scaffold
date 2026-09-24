import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../lib/shopify.server";
import { findFileForShop } from "../lib/files.server";
import { createDownloadUrl, DOWNLOAD_URL_EXPIRES_IN } from "../lib/s3.server";
import {
  downloadRequestSchema,
  type DownloadUrlResponse,
} from "../lib/file-contract";
import { errorResponse, parseJsonOr400 } from "../lib/http.server";

/**
 * 申请预签名 GET 下载 URL（POST /api/files/download-url，常量见 FILE_ENDPOINTS.downloadUrl）。
 * 访问前验证 Shopify session，并强制把 session.shop 传给查询做归属校验；
 * 返回 5 分钟短时效 URL。
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const body = await parseJsonOr400(request, downloadRequestSchema, "fileId 不合法");
  if (body instanceof Response) return body;

  const file = await findFileForShop(body.fileId, session.shop);
  if (!file) {
    return errorResponse(404, "文件不存在");
  }

  const downloadUrl = await createDownloadUrl(file.key);
  return Response.json({
    downloadUrl,
    expiresInSeconds: DOWNLOAD_URL_EXPIRES_IN,
  } satisfies DownloadUrlResponse);
};
