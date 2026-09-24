import type { FileMeta } from "../lib/file-contract";
import { formatBytes, formatDate } from "../lib/format";

export interface FileTableProps {
  files: FileMeta[];
  busy: boolean;
  onDownload: (fileId: string) => void | Promise<void>;
}

/** 文件列表（Polaris 表格封装） */
export function FileTable({ files, busy, onDownload }: FileTableProps) {
  return (
    <s-section heading={`文件列表（${files.length}）`}>
      {files.length === 0 ? (
        <s-paragraph>还没有文件，先在上方上传一个吧。</s-paragraph>
      ) : (
        <s-table variant="auto">
          <s-table-header-row>
            <s-table-header listSlot="primary">文件名</s-table-header>
            <s-table-header>类型</s-table-header>
            <s-table-header>大小</s-table-header>
            <s-table-header>过期时间</s-table-header>
            <s-table-header>操作</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {files.map((file) => (
              <s-table-row key={file.id}>
                <s-table-cell>{file.filename}</s-table-cell>
                <s-table-cell>{file.mimeType}</s-table-cell>
                <s-table-cell>{formatBytes(file.size)}</s-table-cell>
                <s-table-cell>{formatDate(file.expiresAt)}</s-table-cell>
                <s-table-cell>
                  <s-button
                    variant="tertiary"
                    disabled={busy}
                    onClick={() => onDownload(file.id)}
                  >
                    下载
                  </s-button>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      )}
    </s-section>
  );
}
