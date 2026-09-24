import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

vi.mock("../../app/lib/shopify.server", () => ({
  authenticate: { admin: vi.fn() },
}));

vi.mock("../../app/lib/files.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/lib/files.server")>();
  return { ...actual, createFile: vi.fn() };
});

vi.mock("../../app/lib/s3.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/lib/s3.server")>();
  return { ...actual, getObjectSize: vi.fn(), deleteObjects: vi.fn() };
});

import { action } from "../../app/routes/api.files.complete";
import { authenticate } from "../../app/lib/shopify.server";
import { createFile } from "../../app/lib/files.server";
import { deleteObjects, getObjectSize } from "../../app/lib/s3.server";
import { MAX_FILE_SIZE } from "../../app/lib/file-contract";

const adminMock = vi.mocked(authenticate.admin);
const createFileMock = vi.mocked(createFile);
const getObjectSizeMock = vi.mocked(getObjectSize);
const deleteObjectsMock = vi.mocked(deleteObjects);

const VALID_KEY = "shops/demo.myshopify.com/u-1.txt";

function run(body: unknown): Promise<Response> {
  const request = new Request("http://localhost/api/files/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return action({ request } as unknown as ActionFunctionArgs);
}

function validBody(overrides: Record<string, unknown> = {}) {
  return { key: VALID_KEY, filename: "1.txt", mimeType: "text/plain", size: 10, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  adminMock.mockResolvedValue({ session: { shop: "demo.myshopify.com" } } as never);
  deleteObjectsMock.mockResolvedValue(undefined);
  createFileMock.mockImplementation(async (input) => ({
    id: "file-1",
    createdAt: new Date(),
    ...input,
  })) as never;
});

describe("POST /api/files/complete", () => {
  it("key 前缀不属于当前店铺时 403，且不触达对象存储", async () => {
    const response = await run(validBody({ key: "shops/other.myshopify.com/u-1.txt" }));
    expect(response.status).toBe(403);
    expect((await response.json()).error).toContain("key");
    expect(getObjectSizeMock).not.toHaveBeenCalled();
    expect(createFileMock).not.toHaveBeenCalled();
  });

  it("对象不存在（直传未完成）时 400，不入库", async () => {
    getObjectSizeMock.mockResolvedValue(null);
    const response = await run(validBody());
    expect(response.status).toBe(400);
    expect(createFileMock).not.toHaveBeenCalled();
  });

  it("实际大小超限时删除对象并 413，不入库", async () => {
    getObjectSizeMock.mockResolvedValue(MAX_FILE_SIZE + 1);
    const response = await run(validBody());
    expect(response.status).toBe(413);
    expect(deleteObjectsMock).toHaveBeenCalledWith([VALID_KEY]);
    expect(createFileMock).not.toHaveBeenCalled();
  });

  it("以对象实际大小入库（不信任前端声明值），响应符合契约", async () => {
    getObjectSizeMock.mockResolvedValue(42);
    const response = await run(validBody({ size: 10 }));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { file: Record<string, unknown> };
    expect(data.file.size).toBe(42);
    expect(typeof data.file.expiresAt).toBe("string");
    expect(createFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        shop: "demo.myshopify.com",
        key: VALID_KEY,
        size: 42,
      }),
    );
  });

  it("非法 uuid / 缺字段返回 400 与 issues", async () => {
    const response = await run({ key: "", filename: "", mimeType: "", size: -1 });
    expect(response.status).toBe(400);
    expect((await response.json()).issues).toBeDefined();
  });
});
