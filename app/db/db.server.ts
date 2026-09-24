import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { config } from "../lib/config.server";
import * as schema from "./schema.server";

// prepare: false 使连接兼容连接池 / 代理场景（如通过公网代理连接 Railway PostgreSQL）
const client = postgres(config.DATABASE_URL, {
  max: 10,
  prepare: false,
});

export const db = drizzle(client, { schema });
