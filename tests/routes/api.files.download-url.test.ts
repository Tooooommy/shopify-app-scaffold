import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

vi.mock("../../app/lib/shopify.server", () => ({
  authenticate: { admin: vi.fn() },
}));

vi.mock("../../app/lib/files.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/lib/files.server")>();
  return { ...actual, findFileForShop: vi.fn() };
});

vi.mock("../../app/lib/s3.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/lib/s3.server")>();
  return { ...actual, createDownloadUrl: vi.fn() };
});

import { action } from "../../app/routes/api.files.download-url";
import { authenticate } from "../../app/lib/shopify.server";
import { findFileForShop } from "../../app/lib/files.server";
import { createDownloadUrl } from "../../app/lib/s3.server";

const adminMock = vi.mocked(authenticate.admin);
const findFileForShopMock = vi.mocked(findFileForShop);
const createDownloadUrlMock = vi.mocked(createDownloadUrl);

const FILE_ID = "5f2a1c3e-9d1a-4c2b-8f0e-1234567890ab";

function run(fileId: unknown): Promise<Response> {
  const request = new Request("http://localhost/api/files/download-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileId }),
  });
  return action({ request } as unknown as ActionFunctionArgs);
}

beforeEach(() => {
  vi.clearAllMocks();
  adminMock.mockResolvedValue({ session: { shop: "demo.myshopify.com" } } as never);
});

describe("POST /api/files/download-url", () => {
  it("验 session 后把 session.shop 传给查询（租户谓词由 action 转发）", async () => {
    findFileForShopMock.mockResolvedValue({
      id: FILE_ID,
      shop: "demo.myshopify.com",
      key: "shops/demo.myshopify.com/u-1.txt",
      filename: "1.txt",
      mimeType: "text/plain",
      size: 1,
      createdAt: new Date(),
      expiresAt: new Date(),
    });
    createDownloadUrlMock.mockResolvedValue("https://signed.example/object");

    const response = await run(FILE_ID);
    expect(response.status).toBe(200);
    expect(findFileForShopMock).toHaveBeenCalledWith(FILE_ID, "demo.myshopify.com");
    const data = (await response.json()) as { downloadUrl: string; expiresInSeconds: number };
    expect(data.downloadUrl).toBe("https://signed.example/object");
    expect(data.expiresInSeconds).toBe(300);
  });

  it("文件不归属当前店铺（查询为空）时 404，不签发 URL", async () => {
    findFileForShopMock.mockResolvedValue(null);
    const response = await run(FILE_ID);
    expect(response.status).toBe(404);
    expect(createDownloadUrlMock).not.toHaveBeenCalled();
  });

  it("非法 fileId 返回 400", async () => {
    const response = await run("not-a-uuid");
    expect(response.status).toBe(400);
    expect(findFileForShopMock).not.toHaveBeenCalled();
  });
});
