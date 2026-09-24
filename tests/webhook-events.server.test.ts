import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rows: [] as { id: string }[],
  inserted: [] as Record<string, unknown>[],
  conflictSkipped: false,
}));

vi.mock("../app/db/db.server", () => {
  const selectQuery = {
    from: () => selectQuery,
    where: () => selectQuery,
    limit: async () => state.rows,
  };
  const insertQuery = {
    values: (values: Record<string, unknown>) => {
      state.inserted.push(values);
      return insertQuery;
    },
    onConflictDoNothing: async () => {
      state.conflictSkipped = true;
    },
  };
  return {
    db: {
      select: () => selectQuery,
      insert: () => insertQuery,
    },
  };
});

import {
  isWebhookProcessed,
  markWebhookProcessed,
} from "../app/lib/webhook-events.server";

beforeEach(() => {
  state.rows = [];
  state.inserted = [];
  state.conflictSkipped = false;
});

describe("isWebhookProcessed", () => {
  it("幂等表无记录时返回 false", async () => {
    state.rows = [];
    await expect(isWebhookProcessed("whid-1")).resolves.toBe(false);
  });

  it("幂等表有记录时返回 true（重复投递将被跳过）", async () => {
    state.rows = [{ id: "whid-1" }];
    await expect(isWebhookProcessed("whid-1")).resolves.toBe(true);
  });
});

describe("markWebhookProcessed", () => {
  it("以 webhookId 为主键写入 topic 与 shop，并启用冲突跳过", async () => {
    await markWebhookProcessed("whid-1", "APP_UNINSTALLED", "demo.myshopify.com");
    expect(state.inserted).toEqual([
      { id: "whid-1", topic: "APP_UNINSTALLED", shop: "demo.myshopify.com" },
    ]);
    expect(state.conflictSkipped).toBe(true);
  });
});
