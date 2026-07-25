# CF Usage Monitor

一个独立的 Cloudflare Worker，每 10 分钟检查整个账户的包含额度、近期消耗速度和期末超额风险，并同时通过普通 HTTP Webhook 和邮件持续告警。

## 工作方式

- Billing API 自动读取真实订阅计费周期。
- GraphQL Analytics 查询当前周期账户总量和最近一小时用量。
- 按最近一小时速度预测周期结束用量和预计额度耗尽时间。
- GraphQL 资源维度用于定位具体 Worker、D1 数据库、KV Namespace、R2 Bucket、Queue 等贡献者。
- KV 只保存告警生命周期、通知次数和页面趋势点，不是图表用量的唯一来源。

页面打开时会直接查询 Cloudflare，不需要等待下一次 Cron 快照。

## 页面

仪表盘使用 HTTP Basic Auth，用户名固定为 `monitor`，密码来自 `DASHBOARD_PASSWORD`。

- `/`：账户产品额度总览，按风险排序。
- `/usage/:product`：产品详情、计费指标、累计额度预测图和实例贡献。
- `/api/usage`：受认证保护的实时页面数据。
- `/health`：公开存活检查。

告警中的产品和指标可以对应到详情路由。页面支持桌面和移动端，不需要从页面底部选择产品再跳回顶部查看图表。

## 监控额度

- Workers：Requests、CPU milliseconds
- D1：Rows read、Rows written
- Workers KV：Read、Write、Delete、List operations
- R2：Class A、Class B operations
- Durable Objects：Compute requests
- Queues：Billable operations
- Workers AI：Neurons（日额度）
- Containers：vCPU seconds

额度定义位于 `src/metrics.ts`，对应 Cloudflare 当前公开的 Workers Paid / PayGo 包含额度。

## 告警规则

每个指标计算：

```text
safe hourly rate = remaining quota / remaining period hours
projected usage = used + last hour usage × remaining period hours
```

- `warning`：已用或期末预测达到额度的 80%。
- `critical`：按最近一小时速度预测会在周期结束前超过额度。
- `exceeded`：当前周期已用量已经超过额度。
- Critical 连续 2 个十分钟样本后开启事件；Exceeded 立即开启。
- 风险持续期间每 60 分钟重复发送邮件和 Webhook。
- 连续 3 个样本不再预测超额后发送恢复通知。

事件类型：

- `cloudflare.quota_risk`
- `cloudflare.quota_recovered`
- `cloudflare.monitor_error`

## 权限

`CF_API_TOKEN` 需要当前账户的：

- `Account Analytics Read`
- `Billing Read`

Billing Read 仅用于读取 PayGo 订阅元数据和计费周期。所有资源范围应限制为被监控账户。

## 部署

```sh
npm install
npx wrangler login
npx wrangler secret put CF_API_TOKEN
npx wrangler secret put ALERT_WEBHOOK_URL
npx wrangler secret put ALERT_EMAIL_FROM
npx wrangler secret put ALERT_EMAIL_TO
npx wrangler secret put DASHBOARD_PASSWORD
npm run check
npm run deploy
```

定时任务在每小时的 `05/15/25/35/45/55` 分运行，查询结束于 5 分钟前的数据，为 Analytics 聚合预留时间。

## 本地运行

```sh
npm run dev
```

本地触发 Cron：

```sh
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=5,15,25,35,45,55+*+*+*+*"
```

真实查询需要在未提交的 `.dev.vars` 中提供生产 Secret。默认本地 Email binding 只模拟投递。
