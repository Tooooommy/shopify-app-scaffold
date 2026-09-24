import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../lib/shopify.server";
import { normalizeTopic, webhookRegistry } from "../lib/webhooks.server";
import { isWebhookProcessed, markWebhookProcessed } from "../lib/webhook-events.server";

/**
 * 统一 webhook 端点（POST /webhooks）：顶级独立路由，不嵌套在 app 布局下——
 * 布局的 authenticate.admin() 走 session token，而 Shopify webhook 只带 HMAC。
 * HMAC 校验与 topic 解析由官方适配包完成（shopify.app.toml 声明式订阅）。
 *
 * 幂等与重试语义（action 级测试的断言面）：
 * - 以 X-Shopify-Webhook-Id 去重，重复投递直接应答 200；
 * - 处理成功后才落幂等标记，处理中抛错则返回 5xx，Shopify 重投后重新执行
 *   （各 handler 均幂等，重复执行无副作用）；
 * - 分发查表（webhookRegistry），本路由只负责幂等编排；
 * - 合规要求 5 秒内返回 2xx，当前 handler 均为毫秒级操作；
 *   数据规模变大后应改为入队异步处理，再统一应答。
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  const webhookId = request.headers.get("X-Shopify-Webhook-Id");

  if (webhookId && (await isWebhookProcessed(webhookId))) {
    return new Response(null, { status: 200 });
  }

  const handler = webhookRegistry[normalizeTopic(topic)];
  if (handler) {
    await handler({ shop, payload });
  } else {
    // 未订阅/未登记的 topic：记录并返回 200，避免 Shopify 反复重投
    console.warn(`[webhooks] 未处理的 topic=${topic} shop=${shop}`);
  }

  if (webhookId) {
    await markWebhookProcessed(webhookId, topic, shop);
  }

  return new Response(null, { status: 200 });
};
