import { describe, expect, it } from "vitest";
import {
  isDashboardAuthorized,
  unauthorizedResponse,
} from "../src/auth";

describe("dashboard authentication", () => {
  it("accepts the monitor username with the configured password", async () => {
    const request = authorizedRequest("monitor", "correct horse");
    await expect(
      isDashboardAuthorized(request, "correct horse"),
    ).resolves.toBe(true);
  });

  it("rejects missing, malformed, or incorrect credentials", async () => {
    await expect(
      isDashboardAuthorized(new Request("https://monitor.example"), "secret"),
    ).resolves.toBe(false);
    await expect(
      isDashboardAuthorized(
        authorizedRequest("monitor", "incorrect"),
        "secret",
      ),
    ).resolves.toBe(false);
    await expect(
      isDashboardAuthorized(
        authorizedRequest("someone", "secret"),
        "secret",
      ),
    ).resolves.toBe(false);
  });

  it("returns a browser-compatible Basic Auth challenge", () => {
    const response = unauthorizedResponse();
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Basic");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

function authorizedRequest(username: string, password: string): Request {
  return new Request("https://monitor.example", {
    headers: {
      Authorization: `Basic ${btoa(`${username}:${password}`)}`,
    },
  });
}

