import { eq } from "drizzle-orm";

import { db } from "../db/db.server";
import { webhookEventsTable } from "../db/schema.server";

/**
 * Webhook 投递幂等：以 `X-Shopify-Webhook-Id` 为键去重。
 * Shopify 对非 2xx 响应会重投同一 ID；配合"处理成功后标记"的调用顺序，
 * 既保证失败可重试（at-least-once），又保证成功后重复投递不再执行。
 */
export async function isWebhookProcessed(webhookId: string): Promise<boolean> {
  const rows = await db
    .select({ id: webhookEventsTable.id })
    .from(webhookEventsTable)
    .where(eq(webhookEventsTable.id, webhookId))
    .limit(1);
  return rows.length > 0;
}

export async function markWebhookProcessed(
  webhookId: string,
  topic: string,
  shop: string,
): Promise<void> {
  // onConflictDoNothing：并发重投时后到者静默跳过，不抛主键冲突
  await db
    .insert(webhookEventsTable)
    .values({ id: webhookId, topic, shop })
    .onConflictDoNothing();
}
