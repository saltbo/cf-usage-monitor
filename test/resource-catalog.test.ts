import { afterEach, describe, expect, it, vi } from "vitest";
import { collectQuotaUsage } from "../src/analytics";
import {
  loadAccountName,
  loadResourceNames,
} from "../src/server/resource-catalog";

describe("Cloudflare resource catalog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads account and resource names from Cloudflare and caches them", async () => {
    const state = fakeState();
    const env = {
      STATE: state.namespace,
      CF_ACCOUNT_ID: "account-id",
      CF_API_TOKEN: "token",
    };
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/accounts/account-id")) {
        return apiResponse({ id: "account-id", name: "Example Account" });
      }
      if (url.includes("/d1/database?")) {
        return apiResponse([{ uuid: "database-id", name: "app-db" }]);
      }
      if (url.includes("/storage/kv/namespaces?")) {
        return apiResponse([{ id: "namespace-id", title: "CACHE" }]);
      }
      if (url.includes("/workers/durable_objects/namespaces?")) {
        return apiResponse([{ id: "do-id", name: "app_Session" }]);
      }
      if (url.includes("/queues?")) {
        return apiResponse([{ queue_id: "queue-id", queue_name: "jobs" }]);
      }
      if (url.includes("/containers/applications?")) {
        return apiResponse([{ id: "application-id", name: "sandbox" }]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const products = [
      "workers",
      "d1",
      "kv",
      "r2",
      "durable_objects",
      "queues",
      "workers_ai",
      "containers",
    ] as const;
    const [accountName, names] = await Promise.all([
      loadAccountName(env),
      loadResourceNames(env, products),
    ]);
    const [cachedAccountName, cachedNames] = await Promise.all([
      loadAccountName(env),
      loadResourceNames(env, products),
    ]);

    expect(accountName).toBe("Example Account");
    expect(names).toEqual({
      d1: { "database-id": "app-db" },
      kv: { "namespace-id": "CACHE" },
      durable_objects: { "do-id": "app_Session" },
      queues: { "queue-id": "jobs" },
      containers: { "application-id": "sandbox" },
    });
    expect(cachedAccountName).toBe(accountName);
    expect(cachedNames).toEqual(names);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(state.put).toHaveBeenCalledTimes(6);
    expect(state.put).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { expirationTtl: 900 },
    );
  });

  it("uses catalog names for analytics contributors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              viewer: {
                accounts: [
                  {
                    cycle: [
                      {
                        dimensions: {
                          namespaceId: "namespace-id",
                          actionType: "read",
                        },
                        sum: { requests: 12 },
                      },
                    ],
                    recent: [],
                  },
                ],
              },
            },
            errors: null,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const snapshot = await collectQuotaUsage(
      "account-id",
      "token",
      {
        start: "2026-07-01T00:00:00.000Z",
        end: "2026-08-01T00:00:00.000Z",
      },
      "2026-07-24T12:30:00.000Z",
      { kv: { "namespace-id": "CACHE" } },
      false,
      "kv",
    );

    expect(
      snapshot.values.find((value) => value.name === "kv.reads")?.contributors,
    ).toEqual([
      {
        id: "namespace-id",
        name: "CACHE",
        value: 12,
      },
    ]);
  });

  it("surfaces Cloudflare API failures instead of hiding them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            errors: [{ message: "permission denied" }],
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(
      loadResourceNames(
        {
          STATE: fakeState().namespace,
          CF_ACCOUNT_ID: "account-id",
          CF_API_TOKEN: "token",
        },
        ["d1"],
      ),
    ).rejects.toThrow(
      "Cloudflare API /accounts/account-id/d1/database",
    );
  });
});

function fakeState(): {
  namespace: KVNamespace;
  put: ReturnType<typeof vi.fn>;
} {
  const values = new Map<string, string>();
  const put = vi.fn(
    async (key: string, value: string) => {
      values.set(key, value);
    },
  );
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
