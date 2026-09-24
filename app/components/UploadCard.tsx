import { useRef, type ChangeEvent } from "react";

import { formatBytes } from "../lib/format";

export interface UploadCardProps {
  busy: boolean;
  error: string | null;
  maxFileSize: number;
  onUpload: (file: File) => void | Promise<void>;
}

/** 上传卡片：选择文件后自动走「预签名 → 直传 → 登记」流程 */
export function UploadCard({ busy, error, maxFileSize, onUpload }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // 清空选择，允许重复选择同一文件再次上传
    event.target.value = "";
    if (file) await onUpload(file);
  }

  return (
    <s-section heading="上传文件">
      <s-paragraph>
        服务器只做签名，文件内容由浏览器直传对象存储；单文件最大
        {formatBytes(maxFileSize)}。
      </s-paragraph>
      <input ref={inputRef} type="file" disabled={busy} onChange={handleChange} />
      {busy ? (
        <s-banner tone="info" heading="上传中">
          正在直传对象存储，请稍候…
        </s-banner>
      ) : null}
      {error ? (
        <s-banner tone="critical" heading="上传失败">
          {error}
        </s-banner>
      ) : null}
    </s-section>
  );
}
