import { afterEach, describe, expect, it, vi } from "vitest";
import {
  collectInstanceUsage,
  collectQuotaUsage,
} from "../src/analytics";

describe("R2 storage analytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts daily bucket peaks into billing-cycle GB-month usage", async () => {
    const fetchMock = vi.fn().mockImplementation(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body)) as { query: string };
        const account = request.query.includes("R2StorageUsage")
          ? storageAccount()
          : { cycle: [], recent: [], hourly: [], daily: [] };
        return graphqlResponse(account);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await collectQuotaUsage(
      "account",
      "token",
      {
        start: "2026-07-01T00:00:00.000Z",
        end: "2026-08-01T00:00:00.000Z",
      },
      "2026-07-24T12:30:00.000Z",
      {},
      true,
    );

    const storage = snapshot.values.find(
      (value) => value.name === "r2.storage_gb_month",
    );
    expect(storage?.value).toBeCloseTo(6.2 / 30);
    expect(storage?.contributors).toEqual([
      expect.objectContaining({ id: "assets", value: 5.2 / 30 }),
      expect.objectContaining({ id: "backups", value: 1 / 30 }),
    ]);

    const recent = snapshot.recentValues.find(
      (value) => value.name === "r2.storage_gb_month",
    );
    expect(recent?.value).toBeCloseTo(4.1 / 720);
    const hourly = snapshot.hourlySeries.find(
      (series) => series.name === "r2.storage_gb_month",
    )?.points;
    expect(hourly?.[0]?.timestamp).toBe("2026-07-24T11:00:00.000Z");
    expect(hourly?.[0]?.value).toBeCloseTo(4.1 / 720);
    const daily = snapshot.dailySeries.find(
      (series) => series.name === "r2.storage_gb_month",
    )?.points;
    expect(daily?.map((point) => point.timestamp)).toEqual([
      "2026-07-23T00:00:00.000Z",
      "2026-07-24T00:00:00.000Z",
    ]);
    expect(daily?.[0]?.value).toBeCloseTo(3.1 / 30);
    expect(daily?.[1]?.value).toBeCloseTo(3.1 / 30);

    const query = fetchMock.mock.calls
      .map((call) => JSON.parse(String(call[1]?.body)) as { query: string })
      .find((request) => request.query.includes("R2StorageUsage"))?.query;
    expect(query).toContain("r2StorageAdaptiveGroups");
    expect(query).toContain("max { payloadSize metadataSize }");
    expect(snapshot.failures).toEqual([]);
  });

  it("returns one bucket's hourly and daily storage accrual trend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      graphqlResponse({
        hourly: [
          {
            dimensions: { datetimeHour: "2026-07-24T11:00:00.000Z" },
            max: { payloadSize: 3_000_000_000, metadataSize: 100_000_000 },
          },
        ],
        daily: [
          {
            dimensions: { date: "2026-07-24" },
            max: { payloadSize: 3_000_000_000, metadataSize: 100_000_000 },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await collectInstanceUsage(
      "account",
      "token",
      "r2.storage_gb_month",
      "assets",
      "2026-07-01T00:00:00.000Z",
      "2026-07-24T12:30:00.000Z",
    );

    expect(result.hourly).toEqual([
      {
        timestamp: "2026-07-24T11:00:00.000Z",
        value: 3.1 / 720,
      },
    ]);
    expect(result.daily).toEqual([
      {
        timestamp: "2026-07-24T00:00:00.000Z",
        value: 3.1 / 30,
      },
    ]);
    const request = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body),
    ) as { query: string };
    expect(request.query).toContain("bucketName: $instanceId");
    expect(request.query).toContain("max { payloadSize metadataSize }");
  });
});

function storageAccount(): Record<string, unknown> {
  return {
    cycle: [
      storageRow("2026-07-23", "assets", 2_000_000_000, 100_000_000),
      storageRow("2026-07-24", "assets", 3_000_000_000, 100_000_000),
      storageRow("2026-07-23", "backups", 1_000_000_000, 0),
    ],
    recent: [
      {
        dimensions: {
          datetime: "2026-07-24T12:15:00.000Z",
          bucketName: "assets",
        },
        max: { payloadSize: 3_000_000_000, metadataSize: 100_000_000 },
      },
      {
        dimensions: {
          datetime: "2026-07-24T12:15:00.000Z",
          bucketName: "backups",
        },
        max: { payloadSize: 1_000_000_000, metadataSize: 0 },
      },
    ],
    hourly: [
      {
        dimensions: {
          datetimeHour: "2026-07-24T11:00:00.000Z",
          bucketName: "assets",
        },
        max: { payloadSize: 3_000_000_000, metadataSize: 100_000_000 },
      },
      {
        dimensions: {
          datetimeHour: "2026-07-24T11:00:00.000Z",
          bucketName: "backups",
        },
        max: { payloadSize: 1_000_000_000, metadataSize: 0 },
      },
    ],
    daily: [
      storageRow("2026-07-23", "assets", 2_000_000_000, 100_000_000),
      storageRow("2026-07-23", "backups", 1_000_000_000, 0),
      storageRow("2026-07-24", "assets", 3_000_000_000, 100_000_000),
    ],
  };
}

function storageRow(
  date: string,
  bucketName: string,
  payloadSize: number,
  metadataSize: number,
): Record<string, unknown> {
  return {
    dimensions: { date, bucketName },
    max: { payloadSize, metadataSize },
  };
}

function graphqlResponse(account: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({
      data: { viewer: { accounts: [account] } },
      errors: null,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
