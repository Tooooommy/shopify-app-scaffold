import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type UserConfig } from "vite";

// Shopify CLI 会注入 HOST 环境变量，与 Vite 服务冲突；统一改用 SHOPIFY_APP_URL
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost").hostname;

const hmrConfig =
  host === "localhost"
    ? { protocol: "ws" as const, host: "localhost", port: 64999, clientPort: 64999 }
    : {
        protocol: "wss" as const,
        host,
        port: parseInt(process.env.FRONTEND_PORT ?? "", 10) || 8002,
        clientPort: 443,
      };

export default defineConfig({
  server: {
    allowedHosts: [host],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      allow: ["app", "node_modules"],
    },
  },
  plugins: [reactRouter()],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react"],
  },
}) satisfies UserConfig;
