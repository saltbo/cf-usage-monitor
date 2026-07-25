import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import {
  formatUnit,
  metricLabel,
  productDescription,
} from "./localization";

describe("domain localization", () => {
  it("localizes metrics, product descriptions, and units in Chinese", () => {
    expect(metricLabel("d1.rows_read")).toBe("读取行数");
    expect(productDescription("r2")).toBe("存储与 Class A/B 操作");
    expect(formatUnit("rows")).toBe("行");
    expect(formatUnit("GB-months")).toBe("GB·月");
    expect(
      [
        "requests",
        "CPU ms",
        "rows",
        "operations",
        "GB-month",
        "neurons",
        "vCPU seconds",
        "GB-seconds",
        "Gigabytes",
        "vCPU-seconds",
      ].map(formatUnit),
    ).toEqual([
      "次请求",
      "CPU 毫秒",
      "行",
      "次操作",
      "GB·月",
      "神经元",
      "vCPU 秒",
      "GB·秒",
      "GB",
      "vCPU 秒",
    ]);
  });

  it("localizes metrics, product descriptions, and units in English", async () => {
    await i18n.changeLanguage("en");

    expect(metricLabel("d1.rows_read")).toBe("Rows read");
    expect(productDescription("r2")).toBe(
      "Storage and Class A/B operations",
    );
    expect(formatUnit("rows")).toBe("rows");
    expect(formatUnit("GB-months")).toBe("GB-month");
  });
});
