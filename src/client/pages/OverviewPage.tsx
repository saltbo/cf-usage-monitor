import { FailurePanel } from "../components/FailurePanel";
import { ProductCard } from "../components/ProductCard";
import { useDashboard } from "../data/dashboard-context";
import { formatDate } from "../lib/format";

export function OverviewPage() {
  const { data, error, loading, refresh, refreshing } = useDashboard();
  if (loading) {
    return <div className="loading-state">正在查询 Cloudflare 用量…</div>;
  }
  if (!data) {
    return (
      <section className="error-state">
        <h1>暂时无法加载用量</h1>
        <p>{error}</p>
        <button
          disabled={refreshing}
          onClick={() => void refresh()}
          type="button"
        >
          {refreshing ? "查询中" : "重试"}
        </button>
      </section>
    );
  }

  const statusRisk =
    data.status === "degraded"
      ? "warning"
      : data.status === "healthy"
        ? "normal"
        : data.status;
  const statusLabel =
    data.status === "degraded"
      ? "数据不完整"
      : data.status === "critical"
        ? "存在超额风险"
        : data.status === "warning"
          ? "需要关注"
          : "额度安全";

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">账户额度总览</p>
          <h1>哪些产品有超额风险？</h1>
          <p>
            当前计费周期 {formatDate(data.cycle.start)} —{" "}
            {formatDate(data.cycle.end)}
          </p>
        </div>
        <span className={`status-pill risk-${statusRisk}`}>
          账户{statusLabel}
        </span>
      </div>
      <div aria-label="风险摘要" className="summary-grid">
        <SummaryCard
          label="高风险产品"
          tone="critical"
          value={data.summary.critical}
        />
        <SummaryCard
          label="需要关注"
          tone="warning"
          value={data.summary.warning}
        />
        <SummaryCard label="监控产品" value={data.summary.products} />
        <SummaryCard label="预测窗口" value="最近 1 小时" />
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">按风险排序</p>
          <h2>产品额度</h2>
        </div>
        <p>产品状态由风险最高的计费指标决定</p>
      </div>
      <FailurePanel failures={data.failures} />
      <div className="product-list">
        {data.products.map((product) => (
          <ProductCard key={product.name} product={product} />
        ))}
      </div>
      {error ? <div className="toast">{error}</div> : null}
    </>
  );
}

function SummaryCard({
  label,
  tone = "normal",
  value,
}: {
  label: string;
  tone?: "normal" | "warning" | "critical";
  value: number | string;
}) {
  return (
    <article className={`summary-card tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
