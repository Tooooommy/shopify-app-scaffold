# 使用指南

从零开始到上线的**按顺序操作路径**。背景与原理见 [README](README.md)，领域术语见 [CONTEXT.md](CONTEXT.md)。

---

## 1. 前置准备清单

| 项 | 要求 | 说明 |
|----|------|------|
| Node.js | `>=20.19 <22 \|\| >=22.12` | React Router 7 官方支持区间 |
| pnpm | 12.x | 无需全局安装，用 `corepack pnpm ...` 调用 |
| Shopify Partners 账号 | [partners.shopify.com](https://partners.shopify.com) | 免费，注册即建组织 |
| Development store | Partners Dashboard → Stores → Add store | 用于安装测试，需能登录其 admin |
| PostgreSQL | 本地实例或 Railway 托管 | 会话与业务数据存储 |
| S3 兼容桶 | Cloudflare R2 / Backblaze B2 / AWS S3 | 建议新建专用桶 + 专用 AccessKey |
| （部署时）Railway 账号 | [railway.com](https://railway.com) | 本指南按 Railway 部署展开 |

---

## 2. 获取 Shopify 应用凭证

两种方式任选其一：

**方式 A（推荐）：完全走 CLI**——跳过本节，直接做 §3，CLI 引导中会创建应用并自动写入凭证。

**方式 B：手动创建**——Partners Dashboard → Apps → **Create an app** → 记下 **Client ID**（即 `SHOPIFY_API_KEY`）与 **Client secret**（即 `SHOPIFY_API_SECRET`），填入 `.env` 与 `shopify.app.toml` 的 `client_id`。

> 命名红线：应用名与对外 URL 不得包含 "Shopify" / "Example" 字样（含错拼也不行），API 联系邮箱同理——审核硬性要求。

---

## 3. 首次本地启动

```bash
git clone <仓库地址> && cd shopify-app-scaffold
corepack pnpm install

cp .env.example .env        # Windows 下手动复制
```

填写 `.env`（逐项说明见 README「环境变量」）：

| 变量 | 首次本地启动 | 说明 |
|------|:---:|------|
| `DATABASE_URL` | **必填** | 本地 Postgres：`postgresql://user:pass@localhost:5432/dbname` |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | 走 CLI 可暂空 | CLI 链接应用后自动注入 |
| `SHOPIFY_APP_URL` | 走 CLI 可暂空 | CLI dev 模式自动使用隧道地址 |
| `S3_*` 五项 | **必填** | 桶名、Endpoint、AccessKey；R2/B2 将 `S3_FORCE_PATH_STYLE=true` |
| `SCOPES` | 留空 | 脚手架零 scope（最小权限） |
| `FILE_RETENTION_DAYS` / `CRON_SECRET` | 默认/自定 | 保留期 30 天；Cron 密钥自定 |

初始化数据库并启动：

```bash
corepack pnpm db:migrate      # 应用 drizzle/ 下迁移（幂等）
```

**方式 A：完整 Shopify 流程（推荐）**

```bash
corepack pnpm dev:shopify     # = shopify app dev
```

1. 首次运行自动弹出浏览器 → 登录 Partners 账号 → 授权 CLI
2. CLI 引导选择组织 → **Create new app**（或链接已有应用）→ 自动把 `client_id` 写入 `shopify.app.toml`，并把凭证写入/更新 `.env`
3. CLI 自动建立公网隧道并输出安装地址；选择 development store 后浏览器直接进入安装确认页
4. 点击 **Install** → 自动跳进内嵌应用（admin iframe 内）

**方式 B：纯本地跑通（不接 Shopify）**

```bash
corepack pnpm dev             # 仅 React Router dev，无需隧道
```

适合先验证数据库、S3 与测试套件；OAuth 相关流程不可用。

---

## 4. 安装后的验证清单

在 development store 的 admin 中逐项确认：

- [ ] 应用首页（`/app`）显示店铺名——Admin GraphQL `shop` 查询走通
- [ ] 文件页（`/app/files`）上传一个文件：签名 → 直传 → 登记三步完成，对象存储中出现 `shops/<店铺>/…` 对象
- [ ] 下载：拿到 5 分钟短时效链接并成功下载
- [ ] 卸载应用 → `files` 记录、S3 对象、session 被清理（重装后列表为空）

命令行侧验证（需 `dev:shopify` 处于运行状态）：

```bash
shopify app config validate   # 校验 toml 结构与扩展配置

# 向本地 /webhooks 投递合法签名的示例载荷（幂等表要写库，需 DATABASE_URL 可用；
# --address 本地测试须为完整 URL，端口以 dev 启动输出为准）：
shopify app webhook trigger --topic app/uninstalled \
  --address "http://localhost:<dev端口>/webhooks"
```

健康检查：`curl http://localhost:<dev端口>/health` → `ok`（`shopify app dev` 可用 `--localhost-port` 指定端口，`pnpm dev` 以启动输出为准）。

---

## 5. 部署到 Railway

1. **建项目**：Railway → New Project → 部署本仓库（GitHub 连接，推送自动部署）
2. **加数据库**：项目内 **Add PostgreSQL**（自动注入 `DATABASE_URL`）
3. **配 Variables**：按 `.env.example` 逐项填入（密钥只放 Variables，不进代码库）；`SHOPIFY_APP_URL` 填 Railway 分配的域名，如 `https://your-app.up.railway.app`
4. **首次部署**：`railway.toml` 已配置 `preDeployCommand = ["pnpm run db:migrate"]`（迁移失败会中止部署，旧版本继续服务）与 healthcheck `/health`，无需额外操作
5. **回填 Shopify 配置**：把 Railway 域名填入 `shopify.app.toml` 的 `application_url` 与 `redirect_urls`（保持 `/auth/callback` 路径不变），确认 `client_id` 已填 → 执行 `shopify app deploy`
6. **重装应用**：若改过 `access_scopes`，必须由商家（开发时即你自己）在 admin 中**重新安装**应用，新 scope 才生效——OAuth 在安装时授权
7. **配清理任务**：Railway 不允许 web 服务跑 `cron_schedule`，用外部定时（GitHub Actions / Cloudflare Workers Cron）每日请求 `POST https://<域名>/cron/cleanup`，携带 `Authorization: Bearer <CRON_SECRET>`；同时在桶上配置与 `FILE_RETENTION_DAYS` 一致的 lifecycle 过期规则兜底对象侧

---

## 6. 日常开发任务

### 6.1 新增页面

新建 `app/routes/app.<name>.tsx`（自动获得 `/app/<name>` 路由与布局鉴权）：

```tsx
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  // admin.graphql(...) 查询、db 查询
  return { /* 数据 */ };
};

export default function Page() {
  return <s-page heading="…"><s-section heading="…">{/* s-* 组件 */}</s-section></s-page>;
}
```

在 `app/routes/app.tsx` 的 `<NavMenu>` 里加导航项。

### 6.2 新增自有 API

按「file 契约」模式三步走（现有范本：`file-contract.ts` → `api.files.*.ts` → `file-api-client.ts`）：

1. `app/lib/file-contract.ts`（或新建同类 seam 文件）：定义 Zod 请求/响应 schema + endpoint 常量
2. `app/routes/api.<name>.ts`：`authenticate.admin(request)` → `parseJsonOr400` → 业务逻辑
3. 前端在 `file-api-client.ts` 加调用函数（统一走 `callFileApi` 自动携带 session token）

### 6.3 新增数据库表

```bash
# 1. 编辑 app/db/schema.server.ts
corepack pnpm db:generate     # 2. 生成纯 SQL 迁移到 drizzle/
corepack pnpm db:migrate      # 3. 本地应用；Railway 部署时 preDeployCommand 自动执行
```

迁移文件需提交进仓库。

### 6.4 新增 scope

1. `shopify.app.toml` 的 `[access_scopes]` 追加，**同时**更新 `.env` / Railway Variables 的 `SCOPES`（两处保持一致）
2. `shopify app deploy`
3. **商家重新安装**应用（新 scope 在安装时授权，跳过这步不生效）

### 6.5 新增 webhook topic

1. `shopify.app.toml` 的 `[[webhooks.subscriptions]]` 加 topic
2. `app/lib/webhooks.server.ts` 的 `webhookRegistry` 登记 handler（normalized topic 键）
3. `shopify app deploy`

两处都改完才生效；handler 必须幂等且毫秒级返回（重活入队）。

### 6.6 查询 Admin GraphQL

loader/action 内 `const { admin } = await authenticate.admin(request)` → `const res = await admin.graphql(\`#graphql query …\`)`。查询增多后建议接入官方 codegen（`@shopify/api-codegen-preset` + `.graphqlrc.ts`）获得类型，当前脚手架未内置。

---

## 7. 测试

```bash
corepack pnpm typecheck       # react-router typegen + tsc --noEmit
corepack pnpm test            # vitest run（单元 + route action 级）
corepack pnpm test:coverage
corepack pnpm build
```

新增测试的约定：路由语义锁定放 `tests/routes/<name>.test.ts`（mock `shopify.server`，断言 action 行为，范本 `tests/routes/webhooks.test.ts`）；纯函数/契约测试放 `tests/` 顶层。

---

## 8. 故障排查

| 症状 | 原因与处理 |
|------|-----------|
| 启动即报「环境变量校验失败，拒绝启动」 | `config.server.ts` fail-fast 生效：按报错清单补齐 `.env`（拼错/缺失在启动期暴露） |
| iframe 内页面空白 / 被拒绝加载 | CSP `frame-ancestors` 异常：确认 `entry.server.tsx` 调用了 `addDocumentResponseHeaders`，且请求带 `?shop=` 参数 |
| 自有 API 返回 `401` + `X-Shopify-Retry-Invalid-Session-Request: 1` | 前端 fetch 未携带 session token：所有自有接口必须走 `callFileApi`（自动注入 `Authorization: Bearer`） |
| 请求返回 `410 Gone` | 官方库 bot 防护（`isbot` 命中 User-Agent）：浏览器/Shopify 客户端不受影响，curl 测试需带浏览器 UA |
| 改了 scope 不生效 | `shopify app deploy` + **商家重装**（缺一不可） |
| webhook 收不到 / handler 没执行 | 检查 toml 订阅 + `webhookRegistry` 登记两处都改了；已 `deploy`；`DATABASE_URL` 可用（幂等表要写库） |
| `POST /webhooks` 返回 401 | HMAC 校验失败：签名密钥与 `SHOPIFY_API_SECRET` 不一致，或 body 被中间件改动 |
| `POST /webhooks` 返回 400 | 缺 Shopify 必带请求头（`X-Shopify-Webhook-Id` / `Topic` / `Shop-Domain` / `API-Version`）：模拟请求须带全，真实投递不受影响 |
| `POST /cron/cleanup` 返回 401 | `CRON_SECRET` 未配置或 Bearer 不匹配；密钥为空时端点拒绝一切（安全默认） |
| React Router 升级后内嵌导航白屏 | 不要升 React Router 8（适配包 peer `^7.6.2`）；版本由 `pnpm-workspace.yaml` overrides 锁定，详见 README「版本与依赖锁定」 |
| 部署健康检查失败 | `/health` 不可达：检查 Railway 域名、`SHOPIFY_APP_URL` 与启动日志中 config 校验报错 |

---

## 9. 上架（App Store）前的额外工作

脚手架 ≠ 可直接提审的 App。提审前至少完成：

1. 替换全部占位符（`client_id`、Railway 域名），URL 不含 "Shopify"/"Example"
2. **实装 GDPR handler**：`customers/data_request` / `customers/redact` 当前为占位（仅审计日志），一旦业务接入客户/订单数据必须实现真实导出与删除（30 天期限）
3. 若需收费：接入 Billing API（订阅/用量/一次性），官方模板有计费示例可参考
4. App Store listing 要求（图标 1200×1200、隐私政策、支持邮箱、紧急联系人）在 Partners Dashboard 配置；完整清单运行 `/shopify-app-store-review` 自检
