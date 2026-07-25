import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBillingCosts, productCost } from "../src/costs";

describe("Cloudflare billing costs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("aggregates account and product costs and caches the API records", async () => {
    const state = fakeState();
    const fetchMock = vi.fn().mockResolvedValue(
      apiResponse([
        billingRecord({
          ChargePeriodStart: "2026-07-01T00:00:00.000Z",
          ChargePeriodEnd: "2026-07-02T00:00:00.000Z",
          ConsumedQuantity: 1_000,
          ContractedCost: 2,
          PricingQuantity: 1_000,
          ServiceName: "D1 Rows Written",
        }),
        billingRecord({
          ChargePeriodStart: "2026-07-02T00:00:00.000Z",
          ChargePeriodEnd: "2026-07-03T00:00:00.000Z",
          ConsumedQuantity: 2_000,
          ContractedCost: 3,
          PricingQuantity: 2_000,
          ServiceName: "D1 Rows Written",
        }),
        billingRecord({
          ChargePeriodStart: "2026-07-02T00:00:00.000Z",
          ChargePeriodEnd: "2026-07-03T00:00:00.000Z",
          ContractedCost: 0.5,
          ServiceFamilyName: "Email",
          ServiceName: "Email Routing",
        }),
        billingRecord({
          ChargePeriodStart: "2026-06-30T00:00:00.000Z",
          ChargePeriodEnd: "2026-07-01T00:00:00.000Z",
          ContractedCost: 99,
          ServiceFamilyName: "Workers",
          ServiceName: "Workers Requests",
        }),
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const env = {
      STATE: state.namespace,
      CF_ACCOUNT_ID: "account-id",
      CF_API_TOKEN: "token",
    };

    const cycle = {
      start: "2026-07-01T00:00:00.000Z",
      end: "2026-08-01T00:00:00.000Z",
    };
    const costs = await loadBillingCosts(env, cycle);
    const cached = await loadBillingCosts(env, cycle);

    expect(costs.overview).toEqual({
      currency: "USD",
      totalCost: 5.5,
      recentCost: 3.5,
      postedThrough: "2026-07-03T00:00:00.000Z",
    });
    expect(productCost(costs, "d1")).toEqual({
      currency: "USD",
      totalCost: 5,
      recentCost: 3,
      postedThrough: "2026-07-03T00:00:00.000Z",
      daily: [
        { timestamp: "2026-07-01T00:00:00.000Z", cost: 2 },
        { timestamp: "2026-07-02T00:00:00.000Z", cost: 3 },
      ],
      lineItems: [
        {
          serviceName: "D1 Rows Written",
          consumedQuantity: 3_000,
          consumedUnit: "rows",
          pricingQuantity: 3_000,
          cost: 5,
        },
      ],
    });
    expect(productCost(costs, "r2")).toMatchObject({
      currency: "USD",
      totalCost: 0,
      daily: [],
      lineItems: [],
    });
    expect(cached).toEqual(costs);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state.put).toHaveBeenCalledWith(
      "billing-cost-records-v1:account-id",
      expect.any(String),
      { expirationTtl: 900 },
    );
  });

  it("surfaces Cloudflare billing API failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            errors: [{ message: "missing permission" }],
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      loadBillingCosts({
        STATE: fakeState().namespace,
        CF_ACCOUNT_ID: "account-id",
        CF_API_TOKEN: "token",
      }, {
        start: "2026-07-01T00:00:00.000Z",
        end: "2026-08-01T00:00:00.000Z",
      }),
    ).rejects.toThrow(
      "Cloudflare Billing cost request failed with HTTP 403: missing permission",
    );
  });
});

function billingRecord(
  overrides: Partial<Record<string, string | number>>,
): Record<string, string | number> {
  return {
    BillingCurrency: "USD",
    ChargePeriodStart: "2026-07-01T00:00:00.000Z",
    ChargePeriodEnd: "2026-07-02T00:00:00.000Z",
    ConsumedQuantity: 0,
    ConsumedUnit: "rows",
    ContractedCost: 0,
    PricingQuantity: 0,
    ServiceFamilyName: "D1",
    ServiceName: "D1",
    ...overrides,
  };
}

function fakeState(): {
  namespace: KVNamespace;
  put: ReturnType<typeof vi.fn>;
} {
  const values = new Map<string, string>();
  const put = vi.fn(async (key: string, value: string) => {
    values.set(key, value);
  });
  return {
    namespace: {
      get: vi.fn(async (key: string, type?: string) => {
        const value = values.get(key);
        if (value === undefined) {
          return null;
        }
        return type === "json" ? JSON.parse(value) : value;
      }),
      put,
    } as unknown as KVNamespace,
    put,
  };
}

function apiResponse(result: unknown): Response {
  return new Response(JSON.stringify({ success: true, result }), {
    headers: { "Content-Type": "application/json" },
  });
}
