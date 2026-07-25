# CF Usage Monitor

一个运行在 Cloudflare Workers 上的账户用量仪表盘和额度风险告警服务。系统每 10 分钟采集 Billing 与 GraphQL Analytics 数据，通过邮件和 Webhook 持续告警，并提供可钻取到资源实例的 React 仪表盘。

## 技术架构

- Vite + React + React Router：仪表盘、产品详情和实例钻取。
- i18next + react-i18next：中英文界面、浏览器语言识别、语言偏好持久化以及日期、数字、货币和计量单位本地化。
- Hono：Worker HTTP 中间件、API 路由、认证和错误边界。
- Cloudflare Workers Static Assets：发布 Vite 构建产物并支持 SPA fallback。
- Cloudflare Cron Triggers：每 10 分钟运行账户采集和风险检测。
- Workers KV：保存告警生命周期和最近可信监控状态。
- Send Email binding + HTTP Webhook：投递风险、恢复和监控错误事件。
- Vitest：Worker 运行时测试和 jsdom React 组件测试。

```text
src/client/        React 页面、组件、数据访问和样式
src/server/        Hono 应用、API、配置和 scheduled 服务
src/shared/        浏览器与 Worker 共用的 DTO
src/*.ts           采集、额度检测、通知等领域模块
worker/index.ts    Worker fetch/scheduled 组合入口
test/              Worker 运行时与领域测试
```

Vite 开发服务器使用 Cloudflare 官方插件，因此本地开发、生产构建和 Workers 绑定使用同一套运行时配置。

## 页面与 API

仪表盘使用 HTTP Basic Auth，用户名固定为 `monitor`，密码来自 `DASHBOARD_PASSWORD`。

- `/`：账户产品额度总览。
- `/usage/:product`：产品与计费指标详情，实例归因与成本明细通过 Tabs 切换。
- `/usage/:product/instances/:instance`：资源实例趋势。
- `/api/overview`：列表页专用的实时轻量摘要，只返回产品成本总额，不返回每日成本、计费项、趋势、实例贡献者或完整告警状态。
- `/api/products/:product`：只查询指定产品的实时额度、趋势、每日实际成本和计费项。
- `/api/instance-usage`：指定实例的小时和每日趋势。
- `/health`：公开存活检查。

React Router 负责浏览器页面路由，Hono 负责 `/api/*` 和 `/health`。首页通过独立接口实时查询卡片所需的轻量数据，不依赖 Cron 或 KV 快照；进入产品页后才查询对应产品的完整趋势和贡献实例，实例趋势在用户钻取时再查询。其他请求经认证后交给 Workers Static Assets；未知页面由 `index.html` 接管，浏览器刷新嵌套路由不会返回 404。

## 数据与告警

- Billing API 读取真实订阅计费周期。
- Billing Cost API 读取 usage-based 实际费用，并严格裁剪到当前计费周期；不包含固定套餐、税费或未出账费用。
- GraphQL Analytics 查询当前周期、最近一小时、小时和每日趋势。
- 资源维度用于定位 Worker、D1、KV、R2、Queue 等贡献者。
- 采集失败的指标保留最近可信状态，不会以零用量触发错误恢复。
- 通知成功后才提交新的告警状态，投递失败会在后续周期重试。

监控指标包括 Workers、D1、Workers KV、R2 操作与存储、Durable Objects、Queues、Workers AI 和 Containers。额度定义位于 `src/metrics.ts`。

风险等级：

- `warning`：已用或期末预测达到额度的 80%。
- `critical`：按近期速度预测会在周期结束前超过额度。
- `exceeded`：当前周期已超过额度。

`USAGE_ALERT_POLICIES` 可以将指定指标设为 `track_only`，继续展示但不发送额度告警。

## 本地开发

需要 Node.js 24.15 或更新版本。

```sh
npm install
npm run dev
```

未提交的 `.dev.vars.local` 需要提供：

```text
CF_API_TOKEN
ALERT_WEBHOOK_URL
ALERT_EMAIL_FROM
ALERT_EMAIL_TO
DASHBOARD_PASSWORD
```

`ALERT_WEBHOOK_URL` 使用 Bark App 复制的推送 URL。发送时会保留 URL 上的
`volume` 等参数，并通过 JSON POST 推送告警标题、正文和
`cf-usage-monitor` 分组。通知等级由事件决定：严重或超限告警使用
`critical`，普通风险使用 `timeSensitive`，监控错误使用 `active`，恢复通知使用
`passive`。

`npm run dev` 会显式选择 Cloudflare `local` 环境。`npm run preview` 会先生成带本地预览变量的构建；常规 `npm run build` 不加载或复制 `.dev.vars.local`，生产 Secret 仍由 Cloudflare 管理。

本地触发 Cron：

```sh
curl "http://localhost:5173/cdn-cgi/handler/scheduled?cron=5,15,25,35,45,55+*+*+*+*"
```

## 本地质量检查

```sh
npm run typecheck
npm test
npm run build
```

或运行完整的纯本地检查：

```sh
npm run check
```

`npm run check` 只生成绑定类型、执行类型检查和测试并构建产物，不部署。

## Cloudflare 权限

`CF_API_TOKEN` 需要当前账户的：

- `Account Analytics Read`
- `Billing Read`
- `D1 Read`
- `Workers KV Storage Read`
- `Workers Scripts Read`
- `Containers Read`

资源范围应限制为被监控账户。生产 Secret 使用 `wrangler secret put` 管理，不写入配置或源码。

账户名称以及 D1、KV、Durable Objects、Queues 和 Containers 的资源名称会从 Cloudflare API 实时获取，并在 `STATE` KV 中缓存 15 分钟。Workers、R2 和 Workers AI 的 Analytics 维度已经直接包含可展示名称，不需要额外资源映射。

Billing Cost API 的原始计费记录同样在 `STATE` KV 中缓存 15 分钟。账户总览包含 Cloudflare 返回的全部 usage-based 费用；产品卡片和详情按 Workers、D1、Workers KV、R2、Durable Objects、Queues、Workers AI、Containers 的服务族归类。

## 部署

部署是显式操作，不包含在默认检查中：

```sh
npm run deploy
```

定时任务在每小时的 `05/15/25/35/45/55` 分运行，查询结束于 5 分钟前的数据，为 Analytics 聚合预留时间。
