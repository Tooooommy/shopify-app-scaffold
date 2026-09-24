import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

vi.mock("../../app/lib/shopify.server", () => ({
  authenticate: { admin: vi.fn() },
}));

import { action } from "../../app/routes/api.files.upload-url";
import { authenticate } from "../../app/lib/shopify.server";
import { MAX_FILE_SIZE } from "../../app/lib/file-contract";

const adminMock = vi.mocked(authenticate.admin);

function run(body: BodyInit): Promise<Response> {
  const request = new Request("http://localhost/api/files/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return action({ request } as unknown as ActionFunctionArgs);
}

beforeEach(() => {
  vi.clearAllMocks();
  adminMock.mockResolvedValue({ session: { shop: "demo.myshopify.com" } } as never);
});

describe("POST /api/files/upload-url", () => {
  it("签发归属当前店铺的 key 与预签名 PUT URL", async () => {
    const response = await run(
      JSON.stringify({ filename: "报表.pdf", mimeType: "application/pdf", size: 1024 }),
    );
    expect(response.status).toBe(200);
    const data = (await response.json()) as { key: string; uploadUrl: string };
    const prefix = "shops/demo.myshopify.com/";
    expect(data.key.startsWith(prefix)).toBe(true);
    // 随机段不含路径分隔符（防路径穿越）
    expect(data.key.slice(prefix.length)).not.toContain("/");
    expect(data.uploadUrl).toContain("test-bucket");
  });

  it("key 由服务端生成：同名文件两次申请得到不同 key", async () => {
    const body = JSON.stringify({ filename: "a.txt", mimeType: "text/plain", size: 1 });
    const first = (await (await run(body)).json()) as { key: string };
    const second = (await (await run(body)).json()) as { key: string };
    expect(first.key).not.toBe(second.key);
  });

  it("超过大小上限的声明被 Zod 拒绝，返回 400 与 issues", async () => {
    const response = await run(
      JSON.stringify({ filename: "big.bin", mimeType: "application/octet-stream", size: MAX_FILE_SIZE + 1 }),
    );
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string; issues?: unknown[] };
    expect(data.error).toBe("文件参数不合法");
    expect(Array.isArray(data.issues)).toBe(true);
  });

  it("非 JSON 请求体返回统一错误契约", async () => {
    const response = await run("{not json");
    expect(response.status).toBe(400);
    const data = (await response.json()) as { error: string };
    expect(data.error).toBe("请求体必须是 JSON");
  });
});
