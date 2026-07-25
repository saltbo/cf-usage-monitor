import { describe, expect, it } from "vitest";
import { relativeTime, shortId } from "./format";

describe("presentation formatters", () => {
  it("formats relative update times deterministically", () => {
    const now = Date.parse("2026-07-25T12:00:00.000Z");
    expect(relativeTime("2026-07-25T11:42:00.000Z", now)).toBe("18 分钟前");
    expect(relativeTime("2026-07-25T09:00:00.000Z", now)).toBe("3 小时前");
  });

  it("shortens only long resource identifiers", () => {
    expect(shortId("short-id")).toBe("short-id");
    expect(shortId("012345678901234567890123456789")).toBe(
      "0123456789…56789",
    );
  });
});
