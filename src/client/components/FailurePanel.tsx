import type { DashboardData } from "../../shared/dashboard";

export function FailurePanel({
  failures,
}: {
  failures: DashboardData["failures"];
}) {
  if (failures.length === 0) return null;
  return (
    <section className="failure-panel">
      <strong>部分数据查询失败</strong>
      <ul>
        {failures.map((failure) => (
          <li key={failure.collector}>
            <strong>{failure.collector}</strong> · {failure.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
