import { bigint, boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Shopify 会话表。列结构与列名必须与
 * `@shopify/shopify-app-session-storage-drizzle` 的 `PostgresSessionTable`
 * 完全一致（适配器按字段名映射 Session 对象，含离线 token 续期字段）。
 */
export const sessionTable = pgTable("session", {
  id: text("id").primaryKey(),
  shop: text("shop").notNull(),
  state: text("state").notNull(),
  isOnline: boolean("isOnline").default(false).notNull(),
  scope: text("scope"),
  expires: timestamp("expires", { mode: "date" }),
  accessToken: text("accessToken").notNull(),
  userId: bigint("userId", { mode: "number" }),
  firstName: text("firstName"),
  lastName: text("lastName"),
  email: text("email"),
  accountOwner: boolean("accountOwner"),
  locale: text("locale"),
  collaborator: boolean("collaborator"),
  emailVerified: boolean("emailVerified"),
  refreshToken: text("refreshToken"),
  refreshTokenExpires: timestamp("refreshTokenExpires", { mode: "date" }),
});

/**
 * 文件元数据表。对象本体存 S3 兼容对象存储，这里只存索引与生命周期信息；
 * `expiresAt` 由上传时间 + FILE_RETENTION_DAYS 计算，过期后由清理任务回收。
 */
export const filesTable = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  shop: text("shop").notNull(),
  key: text("key").notNull().unique(),
  filename: text("filename").notNull(),
  mimeType: text("mimeType").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
  expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
});

/**
 * Webhook 幂等表。主键为 Shopify 投递头 `X-Shopify-Webhook-Id`：
 * Shopify 对非 2xx 响应会重投同一 ID，处理成功后落库，重复投递直接跳过。
 * 采用"处理成功后标记"顺序：处理失败时不落库，重投可重新执行（各 handler 均幂等）。
 */
export const webhookEventsTable = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  shop: text("shop").notNull(),
  processedAt: timestamp("processedAt", { mode: "date" }).defaultNow().notNull(),
});

export type FileRow = typeof filesTable.$inferSelect;
