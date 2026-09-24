import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const { listExpiredMock, deleteFilesMock, deleteObjectsMock } = vi.hoisted(() => ({
  listExpiredMock: vi.fn(),
  deleteFilesMock: vi.fn(),
  deleteObjectsMock: vi.fn(),
}));

vi.mock("../../app/lib/files.server", () => ({
  listExpiredFiles: listExpiredMock,
  deleteFiles: deleteFilesMock,
  purgeShopFiles: vi.fn(),
  createFile: vi.fn(),
  findFileForShop: vi.fn(),
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

import { action, loader } from "../../app/routes/cron.cleanup";

function run(authorization?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (authorization) headers.Authorization = authorization;
  const request = new Request("http://localhost/cron/cleanup", { method: "POST", headers });
  return action({ request } as unknown as ActionFunctionArgs);
}

beforeEach(() => {
  vi.clearAllMocks();
  listExpiredMock.mockResolvedValue([{ id: "f1", key: "shops/x/a" }]);
  deleteFilesMock.mockResolvedValue(undefined);
  deleteObjectsMock.mockResolvedValue(undefined);
});

describe("POST /cron/cleanup", () => {
  it("缺失 Authorization 头返回 401，不触达数据库", async () => {
    const response = await run();
    expect(response.status).toBe(401);
    expect(listExpiredMock).not.toHaveBeenCalled();
  });

  it("错误密钥返回 401", async () => {
    const response = await run("Bearer wrong-secret");
    expect(response.status).toBe(401);
    expect(listExpiredMock).not.toHaveBeenCalled();
  });

  it("正确密钥：回收过期文件并返回数量", async () => {
    const response = await run("Bearer test-cron-secret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ removed: 1 });
    expect(deleteObjectsMock).toHaveBeenCalledWith(["shops/x/a"]);
    expect(deleteFilesMock).toHaveBeenCalledWith(["f1"]);
  });

  it("编排顺序：先删 S3 对象、后删 DB 行（防 key 线索丢失）", async () => {
    await run("Bearer test-cron-secret");
    expect(deleteObjectsMock.mock.invocationCallOrder[0]).toBeLessThan(
      deleteFilesMock.mock.invocationCallOrder[0],
    );
  });

  it("loader 导出与 action 走同一处理（Cron 用 GET 也可触发）", async () => {
    const request = new Request("http://localhost/cron/cleanup", {
      method: "GET",
      headers: { Authorization: "Bearer test-cron-secret" },
    });
    const response = await loader({ request } as unknown as Parameters<typeof loader>[0]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ removed: 1 });
  });
});
