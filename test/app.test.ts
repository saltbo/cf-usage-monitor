import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import app from "../src/server/app";

describe("Hono application", () => {
  it("keeps the health endpoint public", async () => {
    const response = await app.request("/health", undefined, env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "cf-usage-monitor",
    });
  });

  it("protects API routes with dashboard authentication", async () => {
    const response = await app.request("/api/overview", undefined, env);
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
  });

  it("rejects unsupported products before querying Cloudflare", async () => {
    const response = await app.request(
      "/api/products/unsupported",
      {
        headers: {
          Authorization: `Basic ${btoa(`monitor:${env.DASHBOARD_PASSWORD}`)}`,
        },
      },
      env,
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "product is not supported",
    });
  });

  it("validates instance usage query parameters before upstream calls", async () => {
    const response = await app.request(
      "/api/instance-usage?metric=unsupported",
      {
        headers: {
          Authorization: `Basic ${btoa(`monitor:${env.DASHBOARD_PASSWORD}`)}`,
        },
      },
      env,
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "metric must be a supported quota metric",
    });
  });
});
