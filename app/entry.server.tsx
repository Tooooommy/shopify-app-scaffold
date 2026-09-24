import { PassThrough } from "node:stream";
import type { AppLoadContext, EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { ServerRouter } from "react-router";
import { renderToPipeableStream } from "react-dom/server";

import { addDocumentResponseHeaders } from "./lib/shopify.server";

export const streamTimeout = 5000;

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  // 内嵌应用必需：注入 Shopify CSP / frame-ancestors 等文档响应头
  addDocumentResponseHeaders(request, responseHeaders);

  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const userAgent = request.headers.get("User-Agent");
    // 爬虫等客户端等待全部内容就绪，普通浏览器首屏可流式渲染
    const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        [callbackName]() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) console.error(error);
        },
      },
    );

    // 超时后中止渲染，让已 flush 的错误边界内容先行返回
    setTimeout(abort, streamTimeout + 1000);
  });
}
