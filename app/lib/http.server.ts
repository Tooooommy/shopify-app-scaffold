import type { z } from "zod";

/**
 * action 层共享的请求解析 seam：读 JSON + Zod 校验 + 错误体映射只写一遍。
 * 失败返回 Response（调用方直接透传），成功返回已校验数据。
 */
export function errorResponse(status: number, error: string, issues?: unknown): Response {
  return Response.json(
    issues === undefined ? { error } : { error, issues },
    { status },
  );
}

export async function parseJsonOr400<S extends z.ZodType>(
  request: Request,
  schema: S,
  errorMessage: string,
): Promise<z.infer<S> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "请求体必须是 JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, errorMessage, parsed.error.issues);
  }
  return parsed.data;
}
