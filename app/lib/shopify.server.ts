import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { DrizzleSessionStoragePostgres } from "@shopify/shopify-app-session-storage-drizzle";

import { config } from "./config.server";
import { db } from "../db/db.server";
import { sessionTable } from "../db/schema.server";

const shopify = shopifyApp({
  apiKey: config.SHOPIFY_API_KEY,
  apiSecretKey: config.SHOPIFY_API_SECRET,
  apiVersion: ApiVersion.July26,
  scopes: config.SCOPES.split(",")
    .map((scope) => scope.trim())
    .filter(Boolean),
  appUrl: config.SHOPIFY_APP_URL,
  authPathPrefix: "/auth",
  sessionStorage: new DrizzleSessionStoragePostgres(db, sessionTable),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(config.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [config.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

// 对外 interface 只留实际被消费的项；新需求按需从 shopify 实例解构
export const authenticate = shopify.authenticate;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
// 登录页专用（app/routes/auth.login.tsx）：库要求登录路径必须调用 shopify.login()，
// 在登录路径上调用 authenticate.admin 会被库主动拒绝（500，见 validate-shop-and-host-params）
export const login = shopify.login;
