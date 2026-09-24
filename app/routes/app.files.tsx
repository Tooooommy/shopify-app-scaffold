import { useCallback, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

import { authenticate } from "../lib/shopify.server";
import { listFiles, toFileMeta } from "../lib/files.server";
import { MAX_FILE_SIZE } from "../lib/file-contract";
import {
  completeUpload,
  requestDownloadUrl,
  requestUploadUrl,
  uploadToObjectStorage,
} from "../lib/file-api-client";
import { UploadCard } from "../components/UploadCard";
import { FileTable } from "../components/FileTable";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const files = await listFiles(session.shop);

  return {
    files: files.map((file) => toFileMeta(file)),
    maxFileSize: MAX_FILE_SIZE,
  };
};

export default function FilesPage() {
  const { files, maxFileSize } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      try {
        // 内嵌环境调用自有接口需携带 App Bridge 签发的 session token
        const token = await shopify.idToken();
        // 1) 申请预签名 PUT URL（服务器只签名，不中转内容）
        const { key, uploadUrl } = await requestUploadUrl(token, {
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        });
        // 2) 前端直传对象存储
        await uploadToObjectStorage(uploadUrl, file);
        // 3) 直传成功后登记 files 元数据
        await completeUpload(token, {
          key,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        });
        shopify.toast.show("上传成功");
        revalidator.revalidate();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "上传失败，请稍后重试");
      } finally {
        setBusy(false);
      }
    },
    [shopify, revalidator],
  );

  const handleDownload = useCallback(
    async (fileId: string) => {
      setError(null);
      try {
        const token = await shopify.idToken();
        const { downloadUrl } = await requestDownloadUrl(token, fileId);
        // 预签名 GET URL 短时效（5 分钟），立即触发下载
        window.location.assign(downloadUrl);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "获取下载链接失败");
      }
    },
    [shopify],
  );

  return (
    <s-page heading="文件">
      <UploadCard
        busy={busy}
        error={error}
        maxFileSize={maxFileSize}
        onUpload={handleUpload}
      />
      <FileTable files={files} busy={busy} onDownload={handleDownload} />
    </s-page>
  );
}
