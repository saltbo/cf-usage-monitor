import type { ProductName } from "./metrics";
import type {
  CostLineItem,
  CostOverview,
  CostPoint,
  ProductCostData,
} from "./shared/dashboard";

const API_BASE = "https://api.cloudflare.com/client/v4";
const CACHE_TTL_SECONDS = 15 * 60;
const CACHE_VERSION = "billing-cost-records-v1";

const PRODUCT_BY_SERVICE_FAMILY: Record<string, ProductName> = {
  Workers: "workers",
  D1: "d1",
  "Workers KV": "kv",
  R2: "r2",
  "Durable Objects": "durable_objects",
  Queues: "queues",
  "Workers AI": "workers_ai",
  Containers: "containers",
};

interface CostEnv {
  STATE: KVNamespace;
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
}

interface BillingCostRecord {
  billingCurrency: string;
  chargePeriodEnd: string;
  chargePeriodStart: string;
  consumedQuantity: number;
  consumedUnit: string;
  contractedCost: number;
  pricingQuantity: number;
  serviceFamilyName: string;
  serviceName: string;
}

export interface BillingCosts {
  overview: CostOverview;
  products: Partial<Record<ProductName, ProductCostData>>;
}

export async function loadBillingCosts(
  env: CostEnv,
  cycle: { start: string; end: string },
): Promise<BillingCosts> {
  const records = await loadBillingCostRecords(env);
  const currencies = new Set(records.map((record) => record.billingCurrency));
  if (currencies.size !== 1) {
    throw new Error("Cloudflare Billing returned mixed or missing currencies");
  }
  const currency = currencies.values().next().value;
  if (!currency) {
    throw new Error("Cloudflare Billing returned no currency");
  }
  const cycleStart = Date.parse(cycle.start);
  const cycleEnd = Date.parse(cycle.end);
  const cycleRecords = records.filter((record) => {
    const timestamp = Date.parse(record.chargePeriodStart);
    return timestamp >= cycleStart && timestamp < cycleEnd;
  });
  const latestPostedThrough = records.reduce(
    (latest, record) =>
      record.chargePeriodEnd > latest ? record.chargePeriodEnd : latest,
    "",
  );
  const byProduct = new Map<ProductName, BillingCostRecord[]>();
  for (const record of cycleRecords) {
    const product = PRODUCT_BY_SERVICE_FAMILY[record.serviceFamilyName];
    if (!product) {
      continue;
    }
    const bucket = byProduct.get(product) ?? [];
    bucket.push(record);
    byProduct.set(product, bucket);
  }
  return {
    overview: summarizeCosts(
      cycleRecords,
      currency,
      latestPostedThrough,
    ),
    products: Object.fromEntries(
      [...byProduct].map(([product, productRecords]) => [
        product,
        {
          ...summarizeCosts(productRecords, currency),
          daily: aggregateDailyCosts(productRecords),
          lineItems: aggregateLineItems(productRecords),
        },
      ]),
    ),
  };
}

export function productCost(
  costs: BillingCosts,
  product: ProductName,
): ProductCostData {
  return costs.products[product] ?? {
    currency: costs.overview.currency,
    totalCost: 0,
    recentCost: 0,
    postedThrough: costs.overview.postedThrough,
    daily: [],
    lineItems: [],
  };
}

async function loadBillingCostRecords(
  env: CostEnv,
): Promise<BillingCostRecord[]> {
  const cacheKey = `${CACHE_VERSION}:${env.CF_ACCOUNT_ID}`;
  const cached = await env.STATE.get<unknown>(cacheKey, "json");
  if (cached !== null) {
    return parseBillingCostRecords(cached);
  }
  const response = await fetch(
    `${API_BASE}/accounts/${env.CF_ACCOUNT_ID}/paygo-usage`,
    {
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
    },
  );
  const payload: unknown = await response.json();
  const root = readRecord(payload, "Cloudflare Billing response");
  if (!response.ok || root.success !== true) {
    throw new Error(
      `Cloudflare Billing cost request failed with HTTP ${response.status}: ${readApiError(root)}`,
    );
  }
  const records = parseBillingCostRecords(root.result);
  await env.STATE.put(cacheKey, JSON.stringify(root.result), {
    expirationTtl: CACHE_TTL_SECONDS,
  });
  return records;
}

function parseBillingCostRecords(value: unknown): BillingCostRecord[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Cloudflare Billing returned no cost records");
  }
  return value.map((item, index) => {
    const record = readRecord(item, `Billing cost record ${index}`);
    return {
      billingCurrency: readString(record.BillingCurrency, "BillingCurrency"),
      chargePeriodEnd: readTimestamp(
        record.ChargePeriodEnd,
        "ChargePeriodEnd",
      ),
      chargePeriodStart: readTimestamp(
        record.ChargePeriodStart,
        "ChargePeriodStart",
      ),
      consumedQuantity: readNumber(
        record.ConsumedQuantity,
        "ConsumedQuantity",
      ),
      consumedUnit: readOptionalString(
        record.ConsumedUnit,
        "ConsumedUnit",
      ),
      contractedCost: readNumber(record.ContractedCost, "ContractedCost"),
      pricingQuantity: readNumber(record.PricingQuantity, "PricingQuantity"),
      serviceFamilyName: readString(
        record.ServiceFamilyName,
        "ServiceFamilyName",
      ),
      serviceName: readString(record.ServiceName, "ServiceName"),
    };
  });
}

function summarizeCosts(
  records: readonly BillingCostRecord[],
  currency: string,
  fallbackPostedThrough = "",
): CostOverview {
  const latestStart = records.reduce(
    (latest, record) =>
      record.chargePeriodStart > latest ? record.chargePeriodStart : latest,
    "",
  );
  const postedThrough = records.reduce(
    (latest, record) =>
      record.chargePeriodEnd > latest ? record.chargePeriodEnd : latest,
    fallbackPostedThrough,
  );
  return {
    currency,
    totalCost: sum(records.map((record) => record.contractedCost)),
    recentCost: sum(
      records
        .filter((record) => record.chargePeriodStart === latestStart)
        .map((record) => record.contractedCost),
    ),
    postedThrough,
  };
}

function aggregateDailyCosts(
  records: readonly BillingCostRecord[],
): CostPoint[] {
  const byTimestamp = new Map<string, number>();
  for (const record of records) {
    byTimestamp.set(
      record.chargePeriodStart,
      (byTimestamp.get(record.chargePeriodStart) ?? 0) +
        record.contractedCost,
    );
  }
  return [...byTimestamp]
    .map(([timestamp, cost]) => ({ timestamp, cost }))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function aggregateLineItems(
  records: readonly BillingCostRecord[],
): CostLineItem[] {
  const byService = new Map<string, CostLineItem>();
  for (const record of records) {
    const current = byService.get(record.serviceName);
    if (current && current.consumedUnit !== record.consumedUnit) {
      throw new Error(
        `Cloudflare Billing returned mixed units for ${record.serviceName}`,
      );
    }
    byService.set(record.serviceName, {
      serviceName: record.serviceName,
      consumedQuantity:
        (current?.consumedQuantity ?? 0) + record.consumedQuantity,
      consumedUnit: record.consumedUnit,
      pricingQuantity:
        (current?.pricingQuantity ?? 0) + record.pricingQuantity,
      cost: (current?.cost ?? 0) + record.contractedCost,
    });
  }
  return [...byService.values()].sort(
    (left, right) =>
      right.cost - left.cost ||
      right.pricingQuantity - left.pricingQuantity ||
      left.serviceName.localeCompare(right.serviceName),
  );
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function readRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function readOptionalString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new Error(`${name} must be a string`);
  }
  return value;
}

function readTimestamp(value: unknown, name: string): string {
  const timestamp = readString(value, name);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`${name} must be a valid timestamp`);
  }
  return timestamp;
}

function readNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return value;
}

function readApiError(root: Record<string, unknown>): string {
  if (!Array.isArray(root.errors) || root.errors.length === 0) {
    return "unknown error";
  }
  const error = root.errors[0];
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    return String(error);
  }
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : "unknown error";
}
