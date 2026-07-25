import { Link, Outlet } from "react-router";
import { useDashboard } from "../data/dashboard-context";
import { relativeTime } from "../lib/format";

export function AppShell() {
  const { data, refresh, refreshing } = useDashboard();

  return (
    <>
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" to="/">
            <span aria-hidden="true" className="brand-mark">
              <i />
              <i />
            </span>
            <span>
              <strong>CF Usage Monitor</strong>
              <small>Quota &amp; burn rate</small>
            </span>
          </Link>
          <div className="header-meta">
            <span>账户 · {data?.accountName ?? "—"}</span>
            <span>{data ? `更新于 ${relativeTime(data.lastUpdated)}` : "正在查询"}</span>
            <button
              disabled={refreshing}
              id="refresh-button"
              onClick={() => void refresh()}
              type="button"
            >
              {refreshing ? "查询中" : "刷新"}
            </button>
          </div>
        </div>
      </header>
      <main className="page-shell" id="main">
        <Outlet />
        <footer>
          <span>数据源 · {data?.source ?? "Cloudflare GraphQL Analytics"}</span>
          <span>每 10 分钟复核 · 告警持续至风险解除</span>
        </footer>
      </main>
    </>
  );
}
