/**
 * 测试环境的最小合法 env。
 * config.server 在 import 期 fail-fast，任何测试（含 route action 级测试）
 * 触达真实模块链之前必须先获得完整配置；vitest.config.ts 的 setupFiles 指向本文件。
 */
process.env.SHOPIFY_API_KEY = "test-api-key";
process.env.SHOPIFY_API_SECRET = "test-api-secret";
process.env.SHOPIFY_APP_URL = "https://test-app.internal";
process.env.SCOPES = "";
process.env.DATABASE_URL = "postgresql://user:pass@127.0.0.1:5432/test";
process.env.S3_ENDPOINT = "https://test.r2.cloudflarestorage.com";
process.env.S3_REGION = "auto";
process.env.S3_BUCKET = "test-bucket";
process.env.S3_ACCESS_KEY_ID = "test-access-key";
process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
process.env.S3_FORCE_PATH_STYLE = "true";
process.env.CRON_SECRET = "test-cron-secret";
