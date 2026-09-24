import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // config.server 在 import 期 fail-fast，所有测试先获得最小合法 env
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // 后端的定义是 loader/action（README 口径），coverage 边界必须与之一致
      include: ["app/lib/**", "app/db/**", "app/routes/**"],
      // 需要硬性门槛时打开，示例：
      // thresholds: { lines: 85, statements: 85, functions: 85, branches: 85 },
    },
  },
});
