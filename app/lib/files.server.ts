import { and, desc, eq, inArray, lt } from "drizzle-orm";

import { db } from "../db/db.server";
import { filesTable, type FileRow } from "../db/schema.server";
import type { FileMeta } from "./file-contract";

interface CreateFileInput {
  shop: string;
  key: string;
  filename: string;
  mimeType: string;
  size: number;
  expiresAt: Date;
}

/** 行记录 → 契约 DTO（FileMeta 的唯一形状定义在 file-contract） */
export function toFileMeta(row: FileRow): FileMeta {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function createFile(input: CreateFileInput): Promise<FileRow> {
  const [row] = await db.insert(filesTable).values(input).returning();
  return row;
}

export async function listFiles(shop: string): Promise<FileRow[]> {
  return db
    .select()
    .from(filesTable)
    .where(eq(filesTable.shop, shop))
    .orderBy(desc(filesTable.createdAt));
}

/** 按 id 查询且强制校验归属店铺，防止越权访问他人文件 */
export async function findFileForShop(id: string, shop: string): Promise<FileRow | null> {
  const [row] = await db
    .select()
    .from(filesTable)
    .where(and(eq(filesTable.id, id), eq(filesTable.shop, shop)))
    .limit(1);
  return row ?? null;
}

export async function listExpiredFiles(now: Date): Promise<FileRow[]> {
  return db.select().from(filesTable).where(lt(filesTable.expiresAt, now));
}

export async function deleteFiles(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.delete(filesTable).where(inArray(filesTable.id, ids));
}

/** 清理某店铺全部文件记录，返回对象 key 供调用方删除 S3 对象（可重复调用） */
export async function purgeShopFiles(shop: string): Promise<string[]> {
  const rows = await db
    .select({ key: filesTable.key })
    .from(filesTable)
    .where(eq(filesTable.shop, shop));
  await db.delete(filesTable).where(eq(filesTable.shop, shop));
  return rows.map((row) => row.key);
}
