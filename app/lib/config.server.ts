import { z } from "zod";

/**
 * 启动期 config module：一次性校验全部环境变量并 fail-fast。
 * 拼错变量名、缺失凭证在进程启动时立即报错，而不是等到第一次业务请求。
 * 运行期代码只读已校验的 `config.*`，禁止再散读 process.env
 * （vite.config.ts / drizzle.config.ts 属构建期，例外留在原地）。
 */
const emptyToUndefined = (value: unknown): unknown => (value === "" ? undefined : value);

const envSchema = z.object({
  // Shopify 凭证：OAuth 与会话签名的根基，缺失必须拒绝启动
  SHOPIFY_API_KEY: z.string().min(1),
  SHOPIFY_API_SECRET: z.string().min(1),
  SHOPIFY_APP_URL: z.string().url(),
  SCOPES: z.string().default(""),
  SHOP_CUSTOM_DOMAIN: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  // PostgreSQL（Railway 添加数据库自动注入）
  DATABASE_URL: z.string().min(1),

  // S3 兼容对象存储
  S3_ENDPOINT: z.preprocess(emptyToUndefined, z.string().url().optional()),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),

  // 文件生命周期。CRON_SECRET 允许缺省：缺失时清理端点保持拒绝一切（安全默认）
  FILE_RETENTION_DAYS: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().default(30),
  ),
  CRON_SECRET: z.string().default(""),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`环境变量校验失败，拒绝启动：\n${issues}\n参考 .env.example 补齐后重试`);
  }
  return parsed.data;
}

export const config: Config = loadConfig();
