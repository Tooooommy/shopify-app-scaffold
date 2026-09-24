import { eq } from "drizzle-orm";

import { db } from "../db/db.server";
import { sessionTable } from "../db/schema.server";
import { purgeShopFiles } from "./files.server";
import { deleteObjects } from "./s3.server";

/**
 * 合规 webhook 载荷结构（官方文档 "Privacy law compliance"）。
 * customers/data_request 与 customers/redact 结构一致：
 * `{ shop_id, shop_domain, orders_requested[], customer{...}, data_request:{ id } }`。
 * 注意：载荷中没有回传 URL 字段；义务是把数据整理后交付店主，30 天内完成。
 * customer 的 email / phone 属个人信息，禁止写入日志。
 */
export interface CompliancePayload {
  shop_id?: number;
  shop_domain?: string;
  orders_requested?: number[];
  customer?: {
    id?: number;
    email?: string;
    phone?: string;
  };
  data_request?: {
    id?: number;
  };
}

/** 注册表 handler 的统一入参：两种原始载荷在此归一，arity 不再分叉 */
export interface WebhookContext {
  shop: string;
  payload: unknown;
}

/**
 * Shopify 的 topic 有两种常见表示（`app/uninstalled` 与 `APP_UNINSTALLED`），
 * 统一归一化为大写下划线形式后匹配，避免因表示法差异漏处理。
 */
export function normalizeTopic(topic: string): string {
  return topic.trim().split(/[/:]+/).join("_").toUpperCase();
}

/** app/uninstalled：卸载后立即清理该店铺数据（webhook 可能重投，需幂等） */
export async function handleAppUninstalled(shop: string): Promise<void> {
  const keys = await purgeShopFiles(shop);
  // 对象删除失败不影响应答，Bucket 生命周期规则兜底
  await deleteObjects(keys).catch(() => undefined);
  await db.delete(sessionTable).where(eq(sessionTable.shop, shop));
}

/**
 * customers/data_request：GDPR 要求 30 天内把该客户的数据整理后交付店主。
 * 交付方式：导出本应用持有的、与 payload.customer / orders_requested 关联的数据，
 * 通过店主可用的渠道交付（邮件 / 应用内下载链接）。
 * 本脚手架只存 files（无客户个人信息），此处汇总为显式空集并记录审计；
 * 真实应用在此把各表查询结果合并进导出文件。合规载荷含个人信息，日志禁止记录。
 */
export async function handleCustomersDataRequest(
  shop: string,
  payload: CompliancePayload,
): Promise<void> {
  const customerId = payload.customer?.id ?? null;
  const requestId = payload.data_request?.id ?? null;
  const orderCount = payload.orders_requested?.length ?? 0;

  // 汇总本应用持有的该客户数据：脚手架不存储客户数据，结果恒为空集。
  const ownedRecords = { orders: 0, customerProfile: false };

  console.warn(
    `[webhooks] customers/data_request 已接收（shop=${shop} requestId=${requestId} ` +
      `customer=${customerId} ordersRequested=${orderCount} owned=${ownedRecords.orders}）` +
      `，须在 30 天内将数据交付店主`,
  );
}

/**
 * customers/redact：GDPR 要求 30 天内删除该客户的持久化数据。
 * 真实应用应按 payload.customer.id / orders_requested 定位并删除各表记录；
 * 本脚手架不存储客户个人信息，删除目标为空集，仅记录审计日志。
 * 注意：因法律原因必须保留的数据可不予删除，需在实现中显式判断。
 */
export async function handleCustomersRedact(
  shop: string,
  payload: CompliancePayload,
): Promise<void> {
  const customerId = payload.customer?.id ?? null;
  const requestId = payload.data_request?.id ?? null;
  console.warn(
    `[webhooks] customers/redact 已接收（shop=${shop} requestId=${requestId} customer=${customerId}）` +
      `，脚手架不持有客户数据，无删除项`,
  );
}

/**
 * webhook 注册表：normalized topic → handler 的单一出处。
 * shop/redact 是卸载约 48 小时后的幂等重放，直接复用卸载清理（不再包一层 alias）。
 * 新增 topic：在 shopify.app.toml 订阅 + 在本表登记，两处均改完才生效。
 */
export const webhookRegistry: Record<string, (ctx: WebhookContext) => Promise<void>> = {
  APP_UNINSTALLED: ({ shop }) => handleAppUninstalled(shop),
  SHOP_REDACT: ({ shop }) => handleAppUninstalled(shop),
  CUSTOMERS_DATA_REQUEST: ({ shop, payload }) =>
    handleCustomersDataRequest(shop, payload as CompliancePayload),
  CUSTOMERS_REDACT: ({ shop, payload }) => handleCustomersRedact(shop, payload as CompliancePayload),
};
