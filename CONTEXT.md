# CONTEXT.md — 领域词汇表

架构与代码讨论中使用的领域术语，新增深化模块时在此登记。

| 术语 | 含义 |
|------|------|
| 文件直传三步 | 签发预签名 PUT（sign）→ 浏览器直传对象存储（direct-upload）→ HeadObject 核验后登记 files 表（register）。服务器只签名，不中转内容。 |
| file 契约（file-contract） | 文件 API 的请求/响应 schema、FileMeta DTO、endpoint 常量的单一出处。seam 两侧：前端 `file-api-client` 与后端 `api.files.*` actions 共同依赖；服务端 `satisfies`、客户端 schema 解析双向夹紧。 |
| config module | `app/lib/config.server.ts`：启动期一次性 Zod 校验全部环境变量并 fail-fast。运行期唯一 `process.env` 读取点（构建期配置除外）。 |
| webhook 注册表 | normalized topic → handler 的单表（`webhookRegistry`）。route action 只做幂等编排：check → dispatch → mark。新增 topic = `shopify.app.toml` 订阅 + 注册表登记。 |
| 幂等标记 | `webhook_events` 表按 `X-Shopify-Webhook-Id` 去重；处理**成功后**才落标记，失败可重投重试（at-least-once + handler 幂等）。 |
| 租户前缀 | 对象 key 形如 `shops/{shop}/…`，由服务端生成（前端不能自传 key），是文件归属校验的根：登记时核前缀、查询时带 `session.shop`。 |
| 保留期 | `files.expiresAt` = 上传时间 + `FILE_RETENTION_DAYS`。清理双腿：Cron 清 DB 行与对象，Bucket 生命周期规则兜底对象侧。 |
