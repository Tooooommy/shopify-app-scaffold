import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { purgeShopFilesMock, deleteObjectsMock, dbDeleteMock } = vi.hoisted(() => ({
  purgeShopFilesMock: vi.fn(),
  deleteObjectsMock: vi.fn(),
  dbDeleteMock: vi.fn(),
}));

vi.mock("../app/lib/files.server", () => ({
  purgeShopFiles: purgeShopFilesMock,
  createFile: vi.fn(),
  deleteFiles: vi.fn(),
  findFileForShop: vi.fn(),
  listExpiredFiles: vi.fn(),
  listFiles: vi.fn(),
  toFileMeta: vi.fn(),
}));

vi.mock("../app/lib/s3.server", () => ({
  deleteObjects: deleteObjectsMock,
  buildFileKey: vi.fn(),
  createDownloadUrl: vi.fn(),
  createUploadUrl: vi.fn(),
  getObjectSize: vi.fn(),
  UPLOAD_URL_EXPIRES_IN: 300,
  DOWNLOAD_URL_EXPIRES_IN: 300,
}));

vi.mock("../app/db/db.server", () => ({
  db: { delete: dbDeleteMock },
}));

import {
  handleAppUninstalled,
  handleCustomersDataRequest,
  handleCustomersRedact,
  normalizeTopic,
  webhookRegistry,
} from "../app/lib/webhooks.server";

beforeEach(() => {
  vi.clearAllMocks();
  dbDeleteMock.mockReturnValue({ where: vi.fn() });
  purgeShopFilesMock.mockResolvedValue(["shops/x/a", "shops/x/b"]);
  deleteObjectsMock.mockResolvedValue(undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizeTopic", () => {
  it("两种 topic 表示法归一化为同一形式", () => {
    expect(normalizeTopic("app/uninstalled")).toBe("APP_UNINSTALLED");
    expect(normalizeTopic("APP_UNINSTALLED")).toBe("APP_UNINSTALLED");
    expect(normalizeTopic("customers/data_request")).toBe("CUSTOMERS_DATA_REQUEST");
    expect(normalizeTopic("customers/redact")).toBe("CUSTOMERS_REDACT");
    expect(normalizeTopic("shop/redact")).toBe("SHOP_REDACT");
  });
});

describe("webhookRegistry", () => {
  it("登记了全部四个必需 topic，键为归一化大写形式", () => {
    expect(Object.keys(webhookRegistry).sort()).toEqual([
      "APP_UNINSTALLED",
      "CUSTOMERS_DATA_REQUEST",
      "CUSTOMERS_REDACT",
      "SHOP_REDACT",
    ]);
  });

  it("SHOP_REDACT 幂等地复用卸载清理", async () => {
    await webhookRegistry.SHOP_REDACT({ shop: "demo.myshopify.com", payload: {} });
    expect(purgeShopFilesMock).toHaveBeenCalledWith("demo.myshopify.com");
    expect(dbDeleteMock).toHaveBeenCalledTimes(1);
  });

  it("handler 统一 (ctx) 入参，未知 topic 不在表内即走默认分支", () => {
    expect(webhookRegistry["ORDERS_CREATE"]).toBeUndefined();
  });

  it("GDPR 两个条目经注册表转发载荷，且不触发店铺级清理", async () => {
    const ctx = {
      shop: "demo.myshopify.com",
      payload: { customer: { id: 7 }, data_request: { id: 1 } },
    };
    await webhookRegistry.CUSTOMERS_DATA_REQUEST(ctx);
    await webhookRegistry.CUSTOMERS_REDACT(ctx);
    expect(purgeShopFilesMock).not.toHaveBeenCalled();
    expect(dbDeleteMock).not.toHaveBeenCalled();
  });
});

describe("handleAppUninstalled", () => {
  it("清理文件记录、S3 对象与会话", async () => {
    await handleAppUninstalled("demo.myshopify.com");
    expect(purgeShopFilesMock).toHaveBeenCalledWith("demo.myshopify.com");
    expect(deleteObjectsMock).toHaveBeenCalledWith(["shops/x/a", "shops/x/b"]);
    expect(dbDeleteMock).toHaveBeenCalledTimes(1);
  });

  it("S3 删除失败不影响清理会话", async () => {
    deleteObjectsMock.mockRejectedValue(new Error("s3 down"));
    await expect(handleAppUninstalled("demo.myshopify.com")).resolves.toBeUndefined();
    expect(dbDeleteMock).toHaveBeenCalledTimes(1);
  });
});

describe("GDPR 客户数据处理", () => {
  const payload = {
    shop_id: 1,
    shop_domain: "demo.myshopify.com",
    orders_requested: [1, 2],
    customer: { id: 9, email: "hidden@example.com", phone: "555-0100" },
    data_request: { id: 99 },
  };

  it("脚手架不持有客户数据：应答成功且不删除店铺数据", async () => {
    await expect(
      handleCustomersDataRequest("demo.myshopify.com", payload),
    ).resolves.toBeUndefined();
    await expect(handleCustomersRedact("demo.myshopify.com", payload)).resolves.toBeUndefined();
    expect(purgeShopFilesMock).not.toHaveBeenCalled();
    expect(dbDeleteMock).not.toHaveBeenCalled();
  });

  it("审计日志不输出客户个人信息（email / phone）", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await handleCustomersDataRequest("demo.myshopify.com", payload);
    const logged = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).not.toContain("hidden@example.com");
    expect(logged).not.toContain("555-0100");
    expect(logged).toContain("customer=9");
    expect(logged).toContain("30 天");
  });
});
