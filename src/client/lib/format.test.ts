import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import {
  formatBillingThrough,
  formatCurrency,
  relativeTime,
  shortId,
} from "./format";

describe("presentation formatters", () => {
  it("formats relative update times deterministically", () => {
    const now = Date.parse("2026-07-25T12:00:00.000Z");
    expect(relativeTime("2026-07-25T11:42:00.000Z", now)).toBe("18分钟前");
    expect(relativeTime("2026-07-25T09:00:00.000Z", now)).toBe("3小时前");
  });

  it("shortens only long resource identifiers", () => {
    expect(shortId("short-id")).toBe("short-id");
    expect(shortId("012345678901234567890123456789")).toBe(
      "0123456789…56789",
    );
  });

  it("formats billing costs and exclusive period ends", () => {
    expect(formatCurrency(12.5, "USD")).toBe("US$12.50");
    expect(formatCurrency(0.0043, "USD")).toBe("US$0.0043");
    expect(formatBillingThrough("2026-07-25T00:00:00.000Z")).toBe(
      "7月24日",
    );
  });

  it("formats values using the active English locale", async () => {
    await i18n.changeLanguage("en");

    expect(formatCurrency(12.5, "USD")).toBe("$12.50");
    expect(formatBillingThrough("2026-07-25T00:00:00.000Z")).toBe("Jul 24");
    expect(
      relativeTime(
        "2026-07-25T11:42:00.000Z",
        Date.parse("2026-07-25T12:00:00.000Z"),
      ),
    ).toBe("18 minutes ago");
  });
});
