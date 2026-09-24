import { describe, expect, it } from "vitest";

import {
  completeUploadSchema,
  downloadRequestSchema,
  MAX_FILE_SIZE,
  uploadRequestSchema,
} from "../app/lib/file-contract";

const validUpload = {
  filename: "报表.pdf",
  mimeType: "application/pdf",
  size: 1024,
};

describe("uploadRequestSchema", () => {
  it("接受合法请求", () => {
    expect(uploadRequestSchema.safeParse(validUpload).success).toBe(true);
  });

  it("拒绝空文件名与超长文件名", () => {
    expect(uploadRequestSchema.safeParse({ ...validUpload, filename: "  " }).success).toBe(false);
    expect(
      uploadRequestSchema.safeParse({ ...validUpload, filename: "a".repeat(256) }).success,
    ).toBe(false);
  });

  it("拒绝非法 mimeType 与非正整数 size", () => {
    expect(uploadRequestSchema.safeParse({ ...validUpload, mimeType: "" }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...validUpload, size: 0 }).success).toBe(false);
    expect(uploadRequestSchema.safeParse({ ...validUpload, size: 1.5 }).success).toBe(false);
  });

  it("拒绝超过上限的 size", () => {
    expect(uploadRequestSchema.safeParse({ ...validUpload, size: MAX_FILE_SIZE + 1 }).success).toBe(
      false,
    );
    expect(uploadRequestSchema.safeParse({ ...validUpload, size: MAX_FILE_SIZE }).success).toBe(true);
  });
});

describe("completeUploadSchema", () => {
  it("要求携带非空对象 key", () => {
    const input = {
      filename: "a.txt",
      mimeType: "text/plain",
      size: 1,
      key: "shops/demo.myshopify.com/a.txt",
    };
    expect(completeUploadSchema.safeParse(input).success).toBe(true);
    expect(completeUploadSchema.safeParse({ ...input, key: "" }).success).toBe(false);
  });
});

describe("downloadRequestSchema", () => {
  it("只接受合法 uuid", () => {
    expect(
      downloadRequestSchema.safeParse({ fileId: "5f2a1c3e-9d1a-4c2b-8f0e-1234567890ab" }).success,
    ).toBe(true);
    expect(downloadRequestSchema.safeParse({ fileId: "not-a-uuid" }).success).toBe(false);
  });
});
