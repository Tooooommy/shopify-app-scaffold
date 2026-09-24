import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

vi.mock("../../app/lib/shopify.server", () => ({
  authenticate: { webhook: vi.fn() },
}));

vi.mock("../../app/lib/webhook-events.server", () => ({
  isWebhookProcessed: vi.fn(),
  markWebhookProcessed: vi.fn(),
}));

const { purgeShopFilesMock, deleteObjectsMock, dbDeleteMock } = vi.hoisted(() => ({
  purgeShopFilesMock: vi.fn(),
  deleteObjectsMock: vi.fn(),
  dbDeleteMock: vi.fn(),
}));

vi.mock("../../app/lib/files.server", () => ({
  purgeShopFiles: purgeShopFilesMock,
  createFile: vi.fn(),
  deleteFiles: vi.fn(),
  findFileForShop: vi.fn(),
  listExpiredFiles: vi.fn(),
  listFiles: vi.fn(),
  toFileMeta: vi.fn(),
}));

vi.mock("../../app/lib/s3.server", () => ({
  deleteObjects: deleteObjectsMock,
  buildFileKey: vi.fn(),
  createDownloadUrl: vi.fn(),
  createUploadUrl: vi.fn(),
  getObjectSize: vi.fn(),
  UPLOAD_URL_EXPIRES_IN: 300,
  DOWNLOAD_URL_EXPIRES_IN: 300,
}));

vi.mock("../../app/db/db.server", () => ({
  db: { delete: dbDeleteMock },
}));

import { action } from "../../app/routes/webhooks";
import { authenticate } from "../../app/lib/shopify.server";
import { isWebhookProcessed, markWebhookProcessed } from "../../app/lib/webhook-events.server";

const webhookMock = vi.mocked(authenticate.webhook);
const isProcessedMock = vi.mocked(isWebhookProcessed);
const markMock = vi.mocked(markWebhookProcessed);

function run(topic: string, webhookId: string | null): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (webhookId) headers["X-Shopify-Webhook-Id"] = webhookId;
  const request = new Request("http://localhost/webhooks", { method: "POST", headers });
  return action({ request } as unknown as ActionFunctionArgs);
}

beforeEach(() => {
  vi.clearAllMocks();
  isProcessedMock.mockResolvedValue(false);
  purgeShopFilesMock.mockResolvedValue(["shops/x/a"]);
  deleteObjectsMock.mockResolvedValue(undefined);
  dbDeleteMock.mockReturnValue({ where: vi.fn() });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("POST /webhooks 幂等编排", () => {
  it("重复投递（同 webhookId 已处理）直接 200，不再执行 handler", async () => {
    webhookMock.mockResolvedValue({ topic: "app/uninstalled", shop: "demo.myshopify.com", payload: {} } as never);
    isProcessedMock.mockResolvedValue(true);

    const response = await run("app/uninstalled", "wh-1");
    expect(response.status).toBe(200);
    expect(purgeShopFilesMock).not.toHaveBeenCalled();
    expect(markMock).not.toHaveBeenCalled();
  });

  it("首次投递：执行 handler 后才落幂等标记（at-least-once）", async () => {
    webhookMock.mockResolvedValue({ topic: "app/uninstalled", shop: "demo.myshopify.com", payload: {} } as never);

    const response = await run("app/uninstalled", "wh-1");
    expect(response.status).toBe(200);
    expect(purgeShopFilesMock).toHaveBeenCalledWith("demo.myshopify.com");
    expect(dbDeleteMock).toHaveBeenCalledTimes(1);
    expect(markMock).toHaveBeenCalledWith("wh-1", "app/uninstalled", "demo.myshopify.com");
    // 先 handler 后 mark：handler 的 mock 先于 mark 被调用
    expect(purgeShopFilesMock.mock.invocationCallOrder[0]).toBeLessThan(
      markMock.mock.invocationCallOrder[0],
    );
  });

  it("未订阅 topic 返回 200（避免反复重投），但仍记幂等标记", async () => {
    webhookMock.mockResolvedValue({ topic: "orders/create", shop: "demo.myshopify.com", payload: {} } as never);

    const response = await run("orders/create", "wh-2");
    expect(response.status).toBe(200);
    expect(purgeShopFilesMock).not.toHaveBeenCalled();
    expect(markMock).toHaveBeenCalledWith("wh-2", "orders/create", "demo.myshopify.com");
  });

  it("handler 抛错时异常向上传播（5xx 可重投），且不落标记", async () => {
    webhookMock.mockResolvedValue({ topic: "app/uninstalled", shop: "demo.myshopify.com", payload: {} } as never);
    purgeShopFilesMock.mockRejectedValue(new Error("db down"));

    await expect(run("app/uninstalled", "wh-3")).rejects.toThrow("db down");
    expect(markMock).not.toHaveBeenCalled();
  });

  it("无 X-Shopify-Webhook-Id 头时正常处理且不落标记", async () => {
    webhookMock.mockResolvedValue({ topic: "app/uninstalled", shop: "demo.myshopify.com", payload: {} } as never);

    const response = await run("app/uninstalled", null);
    expect(response.status).toBe(200);
    expect(purgeShopFilesMock).toHaveBeenCalled();
    expect(markMock).not.toHaveBeenCalled();
  });
});
