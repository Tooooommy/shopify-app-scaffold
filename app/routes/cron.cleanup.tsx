import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { deleteFiles, listExpiredFiles } from "../lib/files.server";
import { deleteObjects } from "../lib/s3.server";
import { config } from "../lib/config.server";
import { errorResponse } from "../lib/http.server";

/**
 * 清理任务端点（POST|GET /cron/cleanup）：
 * 由 Railway Cron / 外部定时调用，回收已过期文件的元数据与对象；
 * 对象侧另有 Bucket 生命周期规则兜底。
 * 密钥来自 config（启动期已校验）；为空时一律拒绝（默认安全）。
 * 编排顺序（action 级测试断言）：先删对象、后删 DB 行——对象删除失败
 * 有 lifecycle 兜底，而 DB 行先删会失去 key 线索。
 */
async function handleCleanup(request: Request) {
  const secret = config.CRON_SECRET;
  const authorization = request.headers.get("Authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return errorResponse(401, "未授权");
  }

  const expired = await listExpiredFiles(new Date());
  const keys = expired.map((file) => file.key);
  await deleteObjects(keys).catch(() => undefined);
  await deleteFiles(expired.map((file) => file.id));

  return Response.json({ removed: expired.length });
}

export const loader = async ({ request }: LoaderFunctionArgs) => handleCleanup(request);

export const action = async ({ request }: ActionFunctionArgs) => handleCleanup(request);
