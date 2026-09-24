import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * config module 的核心行为是启动期 fail-fast，必须直接验证错误分支本身，
 * 而不只是验证"env 齐全时能通过"。
 */
afterEach(() => {
  vi.resetModules();
});

describe("config.server", () => {
  it("完整 env 正常解析，导出已校验的值", async () => {
    const { config } = await import("../app/lib/config.server");
    expect(config.S3_BUCKET).toBe("test-bucket");
    expect(config.CRON_SECRET).toBe("test-cron-secret");
    expect(config.FILE_RETENTION_DAYS).toBe(30);
    expect(config.S3_FORCE_PATH_STYLE).toBe("true");
  });

  it("缺失必填变量时 import 即抛出校验错误（拒绝启动）", async () => {
    vi.resetModules();
    const saved = process.env.SHOPIFY_API_SECRET;
    delete process.env.SHOPIFY_API_SECRET;
    try {
      await expect(import("../app/lib/config.server")).rejects.toThrow("环境变量校验失败");
    } finally {
      process.env.SHOPIFY_API_SECRET = saved;
      vi.resetModules();
    }
  });

  it("非法值（非数字保留期）同样拒绝启动", async () => {
    vi.resetModules();
    const saved = process.env.FILE_RETENTION_DAYS;
    process.env.FILE_RETENTION_DAYS = "forever";
    try {
      await expect(import("../app/lib/config.server")).rejects.toThrow("环境变量校验失败");
    } finally {
      if (saved === undefined) delete process.env.FILE_RETENTION_DAYS;
      else process.env.FILE_RETENTION_DAYS = saved;
      vi.resetModules();
    }
  });
});
