/** 健康检查端点（railway.toml 的 healthcheckPath 指向此处） */
export function loader() {
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
