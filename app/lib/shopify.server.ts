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

// 对外 interface 只留实际被消费的两项；新需求按需从 shopify 实例解构
export const authenticate = shopify.authenticate;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
