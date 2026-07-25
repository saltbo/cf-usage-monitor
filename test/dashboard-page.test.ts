import { describe, expect, it } from "vitest";
import { DASHBOARD_CSS, DASHBOARD_JS } from "../src/dashboard-page";

describe("dashboard page", () => {
  it("renders quota bars with a shared CSP-compatible meter", () => {
    expect(DASHBOARD_JS).toContain(
      "quotaMeter(metric,true)",
    );
    expect(DASHBOARD_JS).not.toContain("quotaMeter(metric,false)");
    expect(DASHBOARD_JS).toContain(
      "els.quotaTrack.innerHTML=quotaMeter(metric,true)",
    );
    expect(DASHBOARD_JS).not.toContain("quotaFill.style.width");
    expect(DASHBOARD_CSS).toContain(
      ".quota-progress::-webkit-progress-value",
    );
    expect(DASHBOARD_CSS).toContain(
      ".quota-meter-marker .quota-marker",
    );
  });

  it("shows only actual usage in overview and swaps forecast for the quota line after overage", () => {
    expect(DASHBOARD_JS).toContain(
      `'<span class="quota-numbers"><b>'+formatPercent(metric.usedRatio)+'</b>`,
    );
    expect(DASHBOARD_JS).not.toContain("蓝线为额度 100%");
    expect(DASHBOARD_JS).toContain("const marker=exceeded?");
  });
});
