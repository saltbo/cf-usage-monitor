import { afterEach, describe, expect, it, vi } from "vitest";
import { collectInstanceUsage } from "../src/analytics";

describe("instance analytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("queries and returns hourly and daily usage for one D1 database", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            viewer: {
              accounts: [
                {
                  hourly: [
                    {
                      dimensions: {
                        datetimeHour: "2026-07-24T11:00:00.000Z",
                      },
                      sum: { rowsWritten: 120 },
                    },
                    {
                      dimensions: {
                        datetimeHour: "2026-07-24T12:00:00.000Z",
                      },
                      sum: { rowsWritten: 80 },
                    },
                  ],
                  daily: [
                    {
                      dimensions: { date: "2026-07-24" },
                      sum: { rowsWritten: 200 },
                    },
                  ],
                },
              ],
            },
          },
          errors: null,
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await collectInstanceUsage(
      "account",
      "token",
      "d1.rows_written",
      "database-id",
      "2026-07-01T00:00:00.000Z",
      "2026-07-24T12:30:00.000Z",
    );

    expect(result.hourly).toEqual([
      { timestamp: "2026-07-24T11:00:00.000Z", value: 120 },
      { timestamp: "2026-07-24T12:00:00.000Z", value: 80 },
    ]);
    expect(result.daily).toEqual([
      { timestamp: "2026-07-24T00:00:00.000Z", value: 200 },
    ]);
    const request = JSON.parse(
      String(fetchMock.mock.calls[0][1]?.body),
    ) as {
      query: string;
      variables: Record<string, string>;
    };
    expect(request.query).toContain("databaseId: $instanceId");
    expect(request.variables.instanceId).toBe("database-id");
  });
});
