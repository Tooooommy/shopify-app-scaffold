import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../lib/shopify.server";

/**
 * OAuth 回调路由（/auth/*）：安装、HMAC 校验、会话落库
 * 全部由官方适配包完成，失败时适配包负责重定向到登录页。
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
