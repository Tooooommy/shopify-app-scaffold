import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, getSignedUrlMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  getSignedUrlMock: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class MockCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client: class {
      send = sendMock;
    },
    PutObjectCommand: MockCommand,
    GetObjectCommand: MockCommand,
    HeadObjectCommand: MockCommand,
    DeleteObjectsCommand: MockCommand,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: getSignedUrlMock,
}));

import {
  buildFileKey,
  createDownloadUrl,
  createUploadUrl,
  deleteObjects,
  DOWNLOAD_URL_EXPIRES_IN,
  getObjectSize,
  UPLOAD_URL_EXPIRES_IN,
} from "../app/lib/s3.server";

interface SignedCall {
  command: { input: Record<string, unknown> };
  options: { expiresIn: number };
}

function signedCall(index = 0): SignedCall {
  const [, command, options] = getSignedUrlMock.mock.calls[index] as [
    unknown,
    { input: Record<string, unknown> },
    { expiresIn: number },
  ];
  return { command, options };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSignedUrlMock.mockResolvedValue("https://signed.example/object");
});

describe("buildFileKey", () => {
  it("以店铺域名为前缀隔离，并去掉路径分隔符", () => {
    const prefix = "shops/demo.myshopify.com/";
    const key = buildFileKey("demo.myshopify.com", "../etc/passwd");
    expect(key.startsWith(prefix)).toBe(true);
    expect(key.slice(prefix.length)).not.toContain("/");
    expect(key.slice(prefix.length)).toContain(".._etc_passwd");
  });

  it("相同文件名两次生成的 key 不同", () => {
    const first = buildFileKey("demo.myshopify.com", "a.txt");
    const second = buildFileKey("demo.myshopify.com", "a.txt");
    expect(first).not.toBe(second);
  });
});

describe("createUploadUrl", () => {
  it("签发带 ContentType 的 PUT 预签名 URL", async () => {
    const url = await createUploadUrl("shops/x/a.pdf", "application/pdf");
    expect(url).toBe("https://signed.example/object");
    const { command, options } = signedCall();
    expect(command.input).toMatchObject({
      Bucket: "test-bucket",
      Key: "shops/x/a.pdf",
      ContentType: "application/pdf",
    });
    expect(options.expiresIn).toBe(UPLOAD_URL_EXPIRES_IN);
    expect(UPLOAD_URL_EXPIRES_IN).toBe(300);
  });
});

describe("createDownloadUrl", () => {
  it("签发 5 分钟短时效的 GET 预签名 URL", async () => {
    await createDownloadUrl("shops/x/a.pdf");
    const { command, options } = signedCall();
    expect(command.input).toMatchObject({ Bucket: "test-bucket", Key: "shops/x/a.pdf" });
    expect(options.expiresIn).toBe(DOWNLOAD_URL_EXPIRES_IN);
    expect(DOWNLOAD_URL_EXPIRES_IN).toBe(300);
  });
});

describe("getObjectSize", () => {
  it("HEAD 成功返回对象实际大小", async () => {
    sendMock.mockResolvedValueOnce({ ContentLength: 42 });
    await expect(getObjectSize("shops/x/a.pdf")).resolves.toBe(42);
  });

  it("对象不存在或 HEAD 失败返回 null", async () => {
    sendMock.mockResolvedValueOnce({});
    await expect(getObjectSize("shops/x/a.pdf")).resolves.toBe(null);

    sendMock.mockRejectedValueOnce(new Error("404"));
    await expect(getObjectSize("shops/x/a.pdf")).resolves.toBe(null);
  });
});

describe("deleteObjects", () => {
  it("空列表不发请求", async () => {
    await deleteObjects([]);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("非空列表批量删除对象", async () => {
    sendMock.mockResolvedValueOnce({});
    await deleteObjects(["a", "b"]);
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      Bucket: "test-bucket",
      Delete: { Objects: [{ Key: "a" }, { Key: "b" }] },
    });
  });
});
