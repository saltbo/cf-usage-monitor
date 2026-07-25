import type { CSSProperties } from "react";
import { Link } from "react-router";
import type { DashboardMetric } from "../../shared/dashboard";
import type { ProductName } from "../../metrics";
import { formatCompact, formatPercent, shortId } from "../lib/format";

export function ContributorTable({
  metric,
  productName,
}: {
  metric: DashboardMetric;
  productName: ProductName;
}) {
  const recent = new Map(
    metric.recentContributors.map((contributor) => [
      contributor.id,
      contributor.value,
    ]),
  );
  const remainingHours = Math.max(
    0,
    (Date.parse(metric.periodEnd) - Date.now()) / 3_600_000,
  );

  return (
    <div className="contributors-table-wrap">
      <table>
        <thead>
          <tr>
            <th>实例</th>
            <th>本期用量</th>
            <th>占比</th>
            <th>最近一小时</th>
            <th>简单期末预测</th>
          </tr>
        </thead>
        <tbody>
          {metric.contributors.length === 0 ? (
            <tr>
              <td className="empty-row" colSpan={5}>
                当前周期没有实例用量
              </td>
            </tr>
          ) : (
            metric.contributors.map((contributor) => {
              const recentValue = recent.get(contributor.id) ?? 0;
              const share = metric.used === 0 ? 0 : contributor.value / metric.used;
              const projected = contributor.value + recentValue * remainingHours;
              return (
                <tr key={contributor.id}>
                  <td>
                    <Link
                      className="instance-link"
                      to={{
                        pathname: `/usage/${productName}/instances/${encodeURIComponent(contributor.id)}`,
                        search: `?metric=${encodeURIComponent(metric.metric)}`,
                      }}
                    >
                      <strong>{contributor.name}</strong>
                      <small>{shortId(contributor.id)}</small>
                    </Link>
                  </td>
                  <td>{formatCompact(contributor.value)}</td>
                  <td>
                    <span className="instance-share">
                      <i
                        style={{
                          "--share": `${Math.min(100, share * 100)}%`,
                        } as CSSProperties}
                      />
                      {formatPercent(share)}
                    </span>
                  </td>
                  <td>{formatCompact(recentValue)}</td>
                  <td>{formatCompact(projected)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
