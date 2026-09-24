# Shopify 内嵌应用脚手架

基于 **React Router 7** 的 Shopify 内嵌应用起始模板：后端逻辑全部收敛在 `loader` / `action`（不引入 Hono），
包含 OAuth 安装、Drizzle 会话存储、Webhook（含 GDPR 合规）、S3 预签名直传上传 / 短时效下载示例，
以及 Railway 部署配置。

## 技术栈

| 层 | 选型 |
|----|------|
| 语言 / 运行时 | TypeScript · Node.js 20+ · pnpm |
| 前端 | React 19 + React Router 7（Vite 构建，SSR） |
| UI / 内嵌通信 | Polaris Web Components（`s-*` 全局元素）+ App Bridge 4.x（CDN，`AppProvider` 自动注入脚本） |
| 表单校验 | Zod |
| 数据库 | PostgreSQL（Railway 托管）+ Drizzle ORM（`postgres` 驱动）+ Drizzle Kit（纯 SQL 迁移） |
| 会话存储 | `@shopify/shopify-app-session-storage-drizzle` |
| 文件存储 | 任意 S3 兼容服务（Cloudflare R2 / Backblaze B2 / AWS S3） |
| Shopify 集成 | `@shopify/shopify-app-react-router`（OAuth / Session Token / Webhook HMAC 全内置） |
| 部署 | Railway（GitHub 推送自动部署） |
| 测试 | Vitest |

## 目录结构

```
app/
  routes/            # React Router 路由（页面 / API / Webhook）
  db/                # Drizzle schema（session / files / webhook_events）与连接
  lib/               # config（env fail-fast）、file 契约、Shopify 认证、
                     # S3 预签名、webhook 注册表、HTTP 解析 seam、工具
  components/        # Polaris 组件封装（UploadCard / FileTable）
  entry.server.tsx   # 服务端入口：注入 Shopify CSP 响应头
drizzle/             # Drizzle Kit 生成的 SQL 迁移文件
tests/               # Vitest：单元测试 + route action 级测试（tests/routes/）
CONTEXT.md           # 领域词汇表
public/
railway.toml         # Railway 部署配置
shopify.app.toml     # Shopify App 声明式配置（scope / OAuth / webhook）
package.json         # 含 predeploy：drizzle-kit migrate
```

## 快速开始

### 环境要求

- Node.js `>=20.19 <22 || >=22.12`（React Router 7 官方支持区间）
- pnpm 12（用 `corepack pnpm ...` 调用即可，无需全局安装）
- PostgreSQL（本地实例或 Railway 项目内添加）
- Shopify Partners 账号与开发店（走 Shopify CLI 完整流程时）

### 本地开发

```bash
corepack pnpm install

# 配置环境变量（切勿提交 .env）
cp .env.example .env    # Windows 下手动复制并填写

# 初始化数据库
corepack pnpm db:migrate     # 应用 drizzle/ 下的 SQL 迁移

# 仅启动本地服务（React Router dev）
corepack pnpm dev

# 推荐：注入 Railway 环境变量 + Shopify CLI 隧道的完整流程
railway run corepack pnpm dev:shopify
```

### 验证命令

```bash
corepack pnpm typecheck   # react-router typegen + tsc --noEmit
corepack pnpm test        # vitest run
corepack pnpm test:coverage
corepack pnpm build       # react-router build
```

## 示例功能：文件上传 / 下载

上传（服务器只签名，不中转文件内容）：

| 步骤 | 调用 | 说明 |
|------|------|------|
| 1 | `POST /api/files/upload-url` | Zod 校验 `{ filename, mimeType, size }`，返回 `{ key, uploadUrl }`（预签名 PUT，5 分钟） |
| 2 | `PUT <uploadUrl>` | 浏览器直传 S3 兼容存储（Content-Type 已在签名中锁定） |
| 3 | `POST /api/files/complete` | 校验 key 归属店铺 → `HeadObject` 读取实际大小（超限对象删除并返回 413）→ 写入 `files` 表（含 `expiresAt`） |

下载（先验 session 再放行）：

| 步骤 | 调用 | 说明 |
|------|------|------|
| 1 | `POST /api/files/download-url` | 验证 Shopify session → 校验文件归属 → 返回 `{ downloadUrl, expiresInSeconds: 300 }`（预签名 GET，5 分钟） |

内嵌页面调用自有接口时通过 `shopify.idToken()` 携带 `Authorization: Bearer <session token>`（见 `app/routes/app.files.tsx`）。

## 环境变量

见 `.env.example`，分组如下。所有变量由 `app/lib/config.server.ts` 在**启动期**
用 Zod 一次性校验，缺失或拼错直接拒绝启动（fail-fast），不会等到第一次业务请求才暴露：

| 变量 | 说明 |
|------|------|
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Partners Dashboard → App setup 的 Client ID / Secret |
| `SHOPIFY_APP_URL` | 应用对外地址（Railway 域名） |
| `SCOPES` | 逗号分隔 scope；脚手架示例留空（最小权限），按需追加 |
| `SHOP_CUSTOM_DOMAIN` | 可选，Shopify 自定义域名 |
| `DATABASE_URL` | PostgreSQL 连接串（Railway 添加 PostgreSQL 自动注入） |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` | 对象存储端点与桶 |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | 对象存储凭证（Railway Variables 配置） |
| `S3_FORCE_PATH_STYLE` | R2 / B2 建议 `true` |
| `FILE_RETENTION_DAYS` | 文件保留天数（默认 30） |
| `CRON_SECRET` | 清理任务鉴权密钥（Railway Cron 请求携带） |

## 数据库与迁移

```bash
corepack pnpm db:generate   # 修改 app/db/schema.server.ts 后生成纯 SQL 迁移到 drizzle/
corepack pnpm db:migrate    # 应用迁移（幂等）
corepack pnpm db:studio     # 可视化
```

`package.json` 的 `predeploy` 脚本执行 `drizzle-kit migrate`，供自定义发布流程在部署前自动迁移；
Railway 上迁移由 `railway.toml` 的 `preDeployCommand` 在**新实例启动前、旧实例仍在服务**的窗口内执行——
迁移失败会中止本次部署，旧版本继续运行（幂等，可安全重复运行）。

> 诚实说明：npm 生命周期的 `pre*` 钩子只在存在同名主脚本（此处为 `deploy`）时才自动触发，
> 本仓库没有 `deploy` 脚本，因此 `predeploy` 是需求指定的声明性钩子；
> **实际迁移执行点是 Railway 的 `preDeployCommand`**。

## Webhook 与 GDPR 合规

`shopify.app.toml` 声明式订阅（改配置后需 `shopify app deploy`，商家重新安装才生效）：

- `app/uninstalled` —— 卸载清理（文件记录 / S3 对象 / 会话）
- `customers/data_request`、`customers/redact`、`shop/redact` —— GDPR 合规（上架必接）

处理逻辑在 `app/lib/webhooks.server.ts`（幂等，5 秒内返回 200）。要点：

- **独立顶级路由** `POST /webhooks`：不嵌套在 app 布局下——布局的 `authenticate.admin()` 走
  session token，而 Shopify webhook 请求只带 HMAC，两者不可混用。
- **topic → handler 注册表**：`webhookRegistry` 单表分发，route action 只做幂等编排
  （check → dispatch → mark）；新增 topic = `shopify.app.toml` 订阅 + 注册表登记，两处都改才生效。
- **幂等表** `webhook_events`：以 `X-Shopify-Webhook-Id` 去重，**处理成功后**才标记；
  处理失败返回 5xx，Shopify 重投后重新执行（handler 均幂等，重复执行无副作用）。
  该语义由 `tests/routes/webhooks.test.ts` 的 action 级测试锁定。
- **data_request 的真实义务**：官方载荷为
  `{ shop_id, shop_domain, orders_requested[], customer{...}, data_request:{id} }`（**没有回传 URL**），
  须把该客户的数据整理后**交付店主**，30 天内完成。本脚手架不持有客户数据，实现汇总为空集并留审计点。
- 注意：合规载荷含个人信息，日志中不得记录 email / phone 等字段内容。
- 当前 handler 均为毫秒级同步操作；数据规模变大后应改为入队异步处理再统一应答。

## 文件清理策略

- `files.expiresAt` = 上传时间 + `FILE_RETENTION_DAYS`
- **Railway Cron**：定时请求 `POST /cron/cleanup`（携带 `Authorization: Bearer <CRON_SECRET>`），回收过期元数据与对象
- **Bucket 生命周期规则**：为桶配置与 `FILE_RETENTION_DAYS` 一致的对象过期规则，作为对象侧兜底

## 部署到 Railway

1. Railway 新建项目并 **添加 PostgreSQL**（自动注入 `DATABASE_URL`）
2. 连接 GitHub 仓库（推送自动部署，配置见 `railway.toml`：Nixpacks 构建、`preDeployCommand` 迁移、健康检查 `/health`）
3. 在 Railway **Variables** 面板配置 `.env.example` 中的各项（密钥一律放 Variables，不进代码库）
4. 配置 Cron：按需创建指向 `https://<域名>/cron/cleanup` 的定时任务（携带 `CRON_SECRET`）
5. 填写 `shopify.app.toml` 的 `client_id` / `application_url` / `redirect_urls` 后执行 `shopify app deploy`

## Shopify App 规范注意点

- scope 最小化：只申请实际用到的权限（本脚手架默认零 scope）
- webhook 处理需 5 秒内返回 2xx，重活异步化
- 卸载即清理商户数据；`shop/redact` 时清理残留
- 应用 URL 不得包含 "Shopify" / "Example" 字样（审核要求）
- **Direct API Access 需手动开启**：`embedded_app_direct_api_access = true`
  必须在 Partner Dashboard / App Home 中手动启用，否则前端直连 Admin API 会 401。
- **审核中的 session token 检查**：后端请求必须带 `Authorization: Bearer <session token>`；
  官方适配包在 loader/action 内自动处理，**手写的前端 `fetch` 必须自己携带**
  （见 `app/lib/file-api-client.ts` 的 `authHeaders`）。

## 版本与依赖锁定

- **React Router 锁定 7.x**：`pnpm-workspace.yaml` 的 `overrides` 将 `react-router` 全族
  钉在 `7.18.4`（pnpm 12 起 overrides 只认此文件，`package.json` 的 `pnpm.overrides` 已失效）。
  React Router 8 与 `@shopify/shopify-app-react-router`（peer `^7.6.2`）不兼容，
  且 v8 的请求管道变更会导致内嵌 iframe 内导航失效（`.data` 请求被顶层跳转，
  撞 `apps.shopify.com` 的 X-Frame-Options 白屏）。升级前必须先确认适配包支持范围，
  升级后用 `pnpm why react-router` 确认全树单版本。
- **Polaris Web Components 走 CDN，不装 `@shopify/polaris`**：React 版 Polaris 的 peer 是
  React 18，与本项目 React 19 冲突；`s-*` 元素运行时由 `AppProvider` 注入
  `https://cdn.shopify.com/shopifycloud/polaris.js`，类型用 `@shopify/polaris-types`。
  取舍：组件随管理后台 evergreen 更新、省约 1MB 打包体积，但**无法 pin 版本**——
  Shopify 侧的 breaking change 会直接影响页面，属 CDN 方案的固有风险。

## Railway 注意事项

- **Config as Code 已弃用（官方警报）**：`railway.toml` 现仅对遗留服务保留到
  **2026-12-01**，之后须迁移到 Infrastructure as Code
  （`docs.railway.com/infrastructure-as-code#migrating-from-config-as-code`）。
  本脚手架按技术栈要求保留 `railway.toml`，请在迁移窗口关闭前完成转换。
- **`preDeployCommand` 为数组字段**（官方示例 `["npm run db:migrate"]`，可填多条顺序执行）；
  `healthcheckTimeout` 单位为秒（默认即 300）；`restartPolicyType` 取值
  `ON_FAILURE | ALWAYS | NEVER`。
- **不要给 web 服务配置 `cron_schedule`**：官方 Cron 文档要求 cron 服务执行完即退出、
  明确"不适用于 web server 这类长驻进程"，且上一次执行未结束会跳过下一次
  （最短间隔 5 分钟、按 UTC 计）。清理任务（`/cron/cleanup`）请拆独立服务，
  或改用外部定时（GitHub Actions / Cloudflare Workers Cron Trigger）发起 HTTP 调用。
- 密钥一律放 Variables，不进代码库；迁移在 `preDeployCommand` 阶段执行
  （新实例启动前、旧实例仍在服务的窗口内；迁移失败则中止本次部署）。

## 对象存储安全建议

- key 由**服务端**生成（`shops/{shop}/{uuid}-{name}`），前端不能自传 key（防覆盖与路径穿越）。
- 预签名 PUT 锁定 Content-Type，有效期 5 分钟；`getSignedUrl` 的 PUT **无法在服务端限长**，
  当前以 complete 阶段 `HeadObject` 实际大小兜底（超限删除并 413）。
  彻底防线请在 Bucket policy 配置 `content-length-range`（或改用 `createPresignedPost`）。
- 与 Bucket 生命周期规则的分工：`files.expiresAt` 控制业务可访问性（下载签名前校验），
  lifecycle 规则兜底删对象（可按对象 tag 过滤），Railway Cron 每日清 DB 行——两条腿走路，
  只靠 Cron 会漏删、只靠 lifecycle 会留 DB 脏数据。
