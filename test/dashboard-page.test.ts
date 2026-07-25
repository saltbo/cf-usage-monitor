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

  it("drills from a contributor into an on-demand instance trend", () => {
    expect(DASHBOARD_JS).toContain(
      "fetch('/api/instance-usage?'+params",
    );
    expect(DASHBOARD_JS).toContain(
      `data-instance="'+escapeHtml(item.id)`,
    );
    expect(DASHBOARD_JS).toContain(
      "'/instances/'+encodeURIComponent(instance.dataset.instance)",
    );
    expect(DASHBOARD_JS).toContain("function currentInstance()");
    expect(DASHBOARD_JS).not.toContain(
      "url.searchParams.delete('instance')",
    );
    expect(DASHBOARD_JS).toContain(
      "const showSafeInPlot=safe<=peak.value*2",
    );
    expect(DASHBOARD_JS).toContain(
      "function renderInstanceBenchmark",
    );
    expect(DASHBOARD_JS).toContain(
      `'<span class="quota-meter"><progress class="quota-progress '`,
    );
    expect(DASHBOARD_JS).toContain(
      "function instanceSafePerSlot",
    );
    expect(DASHBOARD_CSS).toContain(".instance-benchmark");
    expect(DASHBOARD_CSS).toContain(".instance-chart");
  });

  it("separates quota risk from alert policy and recovery state", () => {
    expect(DASHBOARD_JS).toContain(
      "if(metric.alertStatus==='track_only')",
    );
    expect(DASHBOARD_JS).toContain(
      "if(metric.alertStatus==='active')",
    );
    expect(DASHBOARD_JS).toContain(
      "if(metric.alertStatus==='recovered')",
    );
    expect(DASHBOARD_JS).toContain("仅观察");
    expect(DASHBOARD_JS).toContain("告警已恢复");
    expect(DASHBOARD_JS).toContain("alertStatusLabel(metric)");
    expect(DASHBOARD_CSS).toContain(".quota-label small.active");
  });
});
