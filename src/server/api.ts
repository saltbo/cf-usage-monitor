import { Hono, type Context } from "hono";
import { collectInstanceUsage } from "../analytics";
import { loadBillingCycle } from "../billing";
import { buildOverviewData } from "../dashboard-data";
import type { MonitorState } from "../detection";
import { loadLatestDashboard } from "../live-dashboard";
import {
  METRIC_NAMES,
  PRODUCT_NAMES,
  type MetricName,
  type ProductName,
} from "../metrics";
import { readDetectionConfig } from "./config";
import { loadProductDashboard } from "./product-dashboard";
import { loadAccountName } from "./resource-catalog";

const STATE_KEY = "monitor-state-v2";
const ANALYTICS_DELAY_MS = 5 * 60 * 1_000;

export const api = new Hono<{ Bindings: Env }>();

api.get("/overview", async (context) => {
  const state = (await context.env.STATE.get<MonitorState>(STATE_KEY, "json")) ?? {
    metrics: {},
  };
  const dashboard = await loadLatestDashboard({
    state,
    config: readDetectionConfig(context.env),
    accountId: context.env.CF_ACCOUNT_ID,
    accountName: await loadAccountName(context.env),
    apiToken: context.env.CF_API_TOKEN,
    includeContributors: false,
    includeTrends: false,
  });
  context.header("Cache-Control", "no-store");
  return context.json(buildOverviewData(dashboard));
});

api.get("/products/:productName", async (context) => {
  return loadProductResponse(context);
});

async function loadProductResponse(
  context: Context<{ Bindings: Env }>,
) {
  const productName = context.req.param("productName");
  if (!PRODUCT_NAMES.includes(productName as ProductName)) {
    return context.json({ error: "product is not supported" }, 404);
  }
  const state = (await context.env.STATE.get<MonitorState>(STATE_KEY, "json")) ?? {
    metrics: {},
  };
  const dashboard = await loadProductDashboard(
    productName as ProductName,
    state,
    context.env,
  );
  context.header("Cache-Control", "no-store");
  return context.json(dashboard);
}

api.get("/instance-usage", async (context) => {
  const metric = context.req.query("metric");
  const instanceId = context.req.query("instance");
  if (!metric || !METRIC_NAMES.includes(metric as MetricName)) {
    return context.json(
      { error: "metric must be a supported quota metric" },
      400,
    );
  }
  if (!instanceId) {
    return context.json(
      { error: "instance must be a non-empty resource identifier" },
      400,
    );
  }

  const measuredAt = new Date(Date.now() - ANALYTICS_DELAY_MS).toISOString();
  const cycle = await loadBillingCycle(
    context.env.CF_ACCOUNT_ID,
    context.env.CF_API_TOKEN,
    Date.parse(measuredAt),
  );
  const trends = await collectInstanceUsage(
    context.env.CF_ACCOUNT_ID,
    context.env.CF_API_TOKEN,
    metric as MetricName,
    instanceId,
    cycle.start,
    measuredAt,
  );
  context.header("Cache-Control", "no-store");
  return context.json(trends);
});

api.notFound((context) => context.json({ error: "Not found" }, 404));
