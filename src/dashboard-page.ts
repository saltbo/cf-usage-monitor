export const DASHBOARD_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>CF Usage Monitor</title>
  <meta name="description" content="Cloudflare 账户额度与超额风险监控">
  <link rel="stylesheet" href="/dashboard.css">
</head>
<body>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/" data-nav>
        <span class="brand-mark" aria-hidden="true"><i></i><i></i></span>
        <span><strong>CF Usage Monitor</strong><small>Quota & burn rate</small></span>
      </a>
      <div class="header-meta">
        <span id="account-name">账户 · —</span>
        <span id="last-updated">正在查询</span>
        <button id="refresh-button" type="button">刷新</button>
      </div>
    </div>
  </header>

  <main id="main" class="page-shell">
    <div id="loading" class="loading-state" aria-live="polite">正在直接查询 Cloudflare 用量…</div>

    <section id="overview" hidden>
      <div class="page-heading">
        <div>
          <p class="eyebrow">账户额度总览</p>
          <h1>哪些产品有超额风险？</h1>
          <p id="cycle-copy">—</p>
        </div>
        <span id="account-status" class="status-pill">—</span>
      </div>

      <div class="summary-grid" aria-label="风险摘要">
        <article><span>高风险产品</span><strong id="critical-count">0</strong></article>
        <article><span>需要关注</span><strong id="warning-count">0</strong></article>
        <article><span>监控产品</span><strong id="product-count">0</strong></article>
        <article><span>预测窗口</span><strong>最近 1 小时</strong></article>
      </div>

      <div class="section-heading">
        <div><p class="eyebrow">按风险排序</p><h2>产品额度</h2></div>
        <p>产品状态由风险最高的计费指标决定</p>
      </div>
      <div id="product-list" class="product-list"></div>
    </section>

    <section id="detail" hidden>
      <div class="detail-heading">
        <div class="detail-heading-main">
          <a class="detail-back" href="/" data-nav aria-label="返回账户额度">←</a>
          <h1 id="detail-title">—</h1>
        </div>
        <div id="metric-tabs" class="metric-tabs" role="tablist" aria-label="计费指标"></div>
      </div>

      <section class="risk-panel" aria-labelledby="risk-title">
        <div class="detail-quota" aria-label="额度使用进度">
          <div class="detail-quota-heading">
            <div><small id="risk-title">额度使用进度</small><strong id="detail-quota-percent">—</strong></div>
            <div class="detail-quota-meta">
              <span id="detail-quota-forecast">—</span>
              <b id="detail-quota-values">—</b>
            </div>
          </div>
          <div id="detail-quota-track" class="detail-quota-track" role="progressbar"
            aria-label="本期额度使用比例" aria-valuemin="0"></div>
          <div class="detail-quota-foot">
            <span>0%</span><strong id="detail-quota-balance">—</strong><span id="detail-quota-scale">额度 100%</span>
          </div>
          <p id="risk-summary" class="detail-quota-summary">—</p>
        </div>
        <div class="trend-heading">
          <div>
            <p class="eyebrow">增长速度</p>
            <h3 id="trend-title">每小时新增用量</h3>
            <p id="trend-subtitle">最近 48 个完整小时</p>
          </div>
          <div id="trend-tabs" class="trend-tabs" role="tablist" aria-label="趋势粒度">
            <button type="button" role="tab" data-grain="hourly" aria-selected="true">小时</button>
            <button type="button" role="tab" data-grain="daily" aria-selected="false">天</button>
          </div>
        </div>
        <div class="chart-legend" aria-label="图例">
          <span><i class="increment"></i>实际用量</span>
          <span><i class="forecast-bars"></i>预测用量</span>
          <span><i class="trend-line"></i>历史趋势</span>
          <span><i class="forecast-line"></i>预测趋势</span>
          <span><i class="forecast-risk"></i>预测超出安全线</span>
          <span><i class="safe"></i><b id="safe-label">安全线</b></span>
        </div>
        <div id="quota-chart" class="quota-chart" role="img"></div>
      </section>

      <section class="contributors-section" aria-labelledby="contributors-title">
        <div class="section-heading">
          <div><p class="eyebrow">实例归因</p><h2 id="contributors-title">谁消耗得最多？</h2></div>
          <p>按当前计费周期用量排序</p>
        </div>
        <div class="contributors-table-wrap">
          <table>
            <thead><tr><th>实例</th><th>本期用量</th><th>占比</th><th>最近 1 小时</th><th>按当前速度预计</th></tr></thead>
            <tbody id="contributors-body"></tbody>
          </table>
        </div>
      </section>
    </section>

    <section id="issues-panel" class="issues-panel" hidden>
      <strong>部分数据查询失败</strong>
      <ul id="issues-list"></ul>
    </section>

    <footer>
      <span id="source-label">Cloudflare GraphQL Analytics</span>
      <span>每 10 分钟复核 · 告警持续至风险解除</span>
    </footer>
  </main>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  <script src="/dashboard.js" defer></script>
</body>
</html>`;

export const DASHBOARD_CSS = `:root {
  --canvas:#070b12;--surface:#0d1420;--surface-2:#111b2a;--line:#243144;
  --line-strong:#3a4b62;--text:#f8fafc;--muted:#9aa8ba;--subtle:#68778b;
  --teal:#5eead4;--teal-soft:rgba(94,234,212,.12);--blue:#60a5fa;
  --amber:#fbbf24;--amber-soft:rgba(251,191,36,.12);--red:#fb7185;
  --red-soft:rgba(251,113,133,.12);--green:#86efac;--green-soft:rgba(134,239,172,.11);
  --radius:10px;--shadow:0 18px 50px rgba(0,0,0,.24);
  color:var(--text);background:var(--canvas);
  font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}
*{box-sizing:border-box}html{min-width:320px;background:var(--canvas)}
body{margin:0;min-height:100dvh;background:var(--canvas)}button{font:inherit}
a{color:inherit}.skip-link{position:fixed;top:8px;left:8px;z-index:99;padding:8px 12px;
  background:var(--text);color:var(--canvas);transform:translateY(-160%)}.skip-link:focus{transform:none}
.site-header{position:sticky;top:0;z-index:20;border-bottom:1px solid var(--line);
  background:rgba(7,11,18,.94);backdrop-filter:blur(14px)}
.header-inner,.page-shell{width:min(1240px,calc(100% - 40px));margin:0 auto}
.header-inner{height:62px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.brand{display:flex;align-items:center;gap:11px;text-decoration:none}.brand strong{display:block;font-size:15px}
.brand small{display:block;margin-top:2px;color:var(--subtle);font:10px ui-monospace,monospace}
.brand-mark{position:relative;width:28px;height:22px}.brand-mark i{position:absolute;bottom:2px;border-radius:9px 9px 3px 3px;background:#f6821f}
.brand-mark i:first-child{left:0;width:18px;height:11px}.brand-mark i:last-child{right:0;width:16px;height:17px;background:#d9670d}
.header-meta{display:flex;align-items:center;gap:14px;color:var(--muted);font-size:11px}
#refresh-button{min-height:36px;padding:0 13px;color:var(--text);background:var(--surface);
  border:1px solid var(--line-strong);border-radius:7px;cursor:pointer}
#refresh-button:hover{border-color:var(--teal)}#refresh-button:disabled{opacity:.55;cursor:wait}
button:focus-visible,a:focus-visible{outline:3px solid rgba(94,234,212,.38);outline-offset:3px}
.page-shell{padding:26px 0 44px}.loading-state{min-height:320px;display:grid;place-items:center;
  color:var(--muted);border:1px dashed var(--line-strong);border-radius:var(--radius)}
.loading-state[hidden]{display:none}
.page-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:28px;margin-bottom:18px}
.eyebrow{margin:0 0 6px;color:var(--subtle);font-size:10px;font-weight:750;letter-spacing:.12em;text-transform:uppercase}
h1,h2,p{margin-top:0}.page-heading h1{margin-bottom:7px;font-size:clamp(25px,4vw,38px);letter-spacing:-.04em}
.page-heading p:not(.eyebrow){margin:0;color:var(--muted);font-size:12px}
.status-pill,.risk-chip{display:inline-flex;align-items:center;min-height:30px;padding:0 11px;
  border-radius:5px;font-size:11px;font-weight:800;white-space:nowrap}
.risk-normal{color:var(--green);background:var(--green-soft)}.risk-warning{color:var(--amber);background:var(--amber-soft)}
.risk-critical,.risk-exceeded{color:#fecdd3;background:var(--red-soft)}
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-bottom:28px;
  overflow:hidden;border:1px solid var(--line);border-radius:var(--radius);background:var(--line)}
.summary-grid article{padding:16px 18px;background:var(--surface)}.summary-grid span{display:block;color:var(--muted);font-size:11px}
.summary-grid strong{display:block;margin-top:8px;font-size:24px;font-variant-numeric:tabular-nums}
.section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:0 0 10px}
.section-heading h2{margin:0;font-size:19px}.section-heading>p{margin:0;color:var(--muted);font-size:12px}
.product-list{display:grid;gap:10px}.product-card{width:100%;padding:0;display:grid;
  grid-template-columns:minmax(190px,.8fr) minmax(0,2.2fr) auto;align-items:stretch;
  color:inherit;text-align:left;background:var(--surface);border:1px solid var(--line);
  border-radius:var(--radius);cursor:pointer;overflow:hidden;transition:border-color 160ms ease,background 160ms ease}
.product-card:hover{border-color:var(--line-strong);background:var(--surface-2)}
.product-identity{padding:17px 18px;border-right:1px solid var(--line)}
.product-identity strong{display:block;margin-bottom:5px;font-size:16px}.product-identity small{color:var(--muted);font-size:12px;line-height:1.45}
.product-metrics{display:grid;align-content:center;gap:11px;padding:14px 18px}
.quota-row{display:grid;grid-template-columns:minmax(130px,.9fr) minmax(150px,1.4fr) auto;align-items:center;gap:14px}
.quota-label{font-size:13px;font-weight:650}.quota-meter{position:relative;width:100%;height:9px;display:block}
.quota-progress{width:100%;height:100%;display:block;overflow:hidden;appearance:none;-webkit-appearance:none;
  border:0;background:#202c3d;border-radius:999px}
.quota-progress::-webkit-progress-bar{background:#202c3d;border-radius:999px}
.quota-progress::-webkit-progress-value{background:var(--teal);border-radius:999px}
.quota-progress::-moz-progress-bar{background:var(--teal);border-radius:999px}
.quota-progress.warning::-webkit-progress-value{background:var(--amber)}
.quota-progress.warning::-moz-progress-bar{background:var(--amber)}
.quota-progress.critical::-webkit-progress-value{background:var(--red)}
.quota-progress.critical::-moz-progress-bar{background:var(--red)}
.quota-meter-marker{position:absolute;inset:-4px 0;width:100%;height:calc(100% + 8px);overflow:visible;pointer-events:none}
.quota-meter-marker .forecast-marker{stroke:var(--amber);stroke-width:2;vector-effect:non-scaling-stroke}
.quota-meter-marker .quota-marker{stroke:var(--blue);stroke-width:2;vector-effect:non-scaling-stroke}
.quota-numbers{min-width:76px;text-align:right;font:12px ui-monospace,monospace;color:var(--muted)}
.quota-numbers b{color:var(--text);font-size:14px;font-weight:800}.product-action{min-width:112px;padding:16px;
  display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;border-left:1px solid var(--line)}
.product-action .arrow{font-size:20px;color:var(--subtle)}
.detail-heading{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:20px;margin-bottom:12px;padding:9px 10px;
  background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}
.detail-heading-main{min-width:0;display:flex;align-items:center;gap:14px}
.detail-heading h1{margin:0;font-size:21px;line-height:1.2;letter-spacing:-.025em;white-space:nowrap}
.detail-back{width:34px;height:34px;display:grid;place-items:center;color:var(--teal);background:var(--canvas);
  border:1px solid var(--line-strong);border-radius:7px;font-size:18px;font-weight:700;text-decoration:none}
.detail-back:hover{border-color:var(--teal)}
.metric-tabs{min-width:0;display:flex;justify-content:flex-end;gap:7px;overflow-x:auto;margin:0;padding:0}
.metric-tab{min-height:40px;padding:6px 10px;display:flex;align-items:center;gap:8px;color:var(--muted);
  background:var(--surface);border:1px solid var(--line);border-radius:7px;cursor:pointer;white-space:nowrap}
.metric-tab[aria-selected=true]{color:var(--text);border-color:var(--teal);background:var(--teal-soft)}
.metric-tab span{font-size:12px;font-weight:650}.risk-panel{padding:20px;background:var(--surface);
  border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
.detail-quota{padding-top:2px}
.detail-quota-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:13px}
.detail-quota-heading small{display:block;margin-bottom:5px;color:var(--muted);font-size:11px}
.detail-quota-heading>div>strong{display:block;font:750 25px ui-monospace,monospace}
.detail-quota-meta{text-align:right}.detail-quota-meta span{display:block;margin-bottom:5px;color:var(--teal);font-size:12px;font-weight:700}
.detail-quota-meta span.warning{color:var(--amber)}.detail-quota-meta span.critical{color:#fecdd3}
.detail-quota-meta b{display:block;font:13px ui-monospace,monospace}
.detail-quota-track{height:12px}.detail-quota-track .quota-meter{height:12px}
.detail-quota-foot{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;margin-top:9px;color:var(--muted);font-size:11px}
.detail-quota-foot strong{text-align:center;color:var(--text);font:12px ui-monospace,monospace}
.detail-quota-foot strong.warning{color:var(--amber)}.detail-quota-foot strong.critical{color:#fecdd3}
.detail-quota-summary{margin:14px 0 0;color:var(--muted);font-size:12px;line-height:1.55}
.trend-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-top:28px;padding-top:20px;border-top:1px solid var(--line)}
.trend-heading h3{margin:0 0 5px;font-size:18px}.trend-heading>div>p:last-child{margin:0;color:var(--muted);font-size:12px}
.trend-tabs{display:flex;padding:3px;background:var(--canvas);border:1px solid var(--line);border-radius:7px}
.trend-tabs button{min-width:56px;min-height:32px;color:var(--muted);background:transparent;border:0;border-radius:5px;cursor:pointer;font-size:11px}
.trend-tabs button[aria-selected=true]{color:var(--text);background:var(--surface-2)}
.chart-legend{display:flex;gap:16px;flex-wrap:wrap;margin:14px 0 4px;color:var(--muted);font-size:10px}
.chart-legend span{display:inline-flex;align-items:center;gap:6px}.chart-legend i{width:18px;height:0;border-top:2px solid}
.chart-legend b{font-weight:400}.chart-legend .increment{height:8px;border:0;background:var(--teal)}
.chart-legend .forecast-bars{height:8px;border:1px dashed var(--teal)}
.chart-legend .trend-line{border-color:var(--amber)}
.chart-legend .forecast-line{border-color:var(--amber);border-style:dashed}
.chart-legend .forecast-risk{border-color:var(--red);border-style:dashed}
.chart-legend .safe{border-color:var(--blue);border-style:dashed}
.quota-chart{min-height:340px}.quota-chart svg{width:100%;height:auto;display:block}.contributors-section{margin-top:24px}
.contributors-table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:14px 15px;text-align:right;border-bottom:1px solid var(--line);font-size:12px}
th{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em}th:first-child,td:first-child{text-align:left}
tbody tr:last-child td{border-bottom:0}.instance-name strong{display:block;font-size:13px}.instance-name small{display:block;margin-top:4px;color:var(--muted);font:10px ui-monospace,monospace}
.instance-share{display:inline-flex;align-items:center;gap:8px}.instance-share i{width:54px;height:5px;background:#202c3d;border-radius:9px;overflow:hidden}
.instance-share i:after{content:"";display:block;width:var(--share);height:100%;background:var(--teal)}
.empty-row{text-align:center!important;color:var(--subtle);padding:30px!important}.issues-panel{margin-top:18px;padding:16px 18px;
  color:#fecdd3;background:var(--red-soft);border:1px solid rgba(251,113,133,.3);border-radius:var(--radius);font-size:11px}
.issues-panel ul{margin:10px 0 0;padding-left:18px;color:var(--muted)}footer{padding-top:22px;display:flex;justify-content:space-between;
  gap:20px;color:var(--subtle);font-size:9px}.toast{position:fixed;right:18px;bottom:18px;z-index:40;max-width:360px;
  padding:12px 14px;background:var(--surface-2);border:1px solid var(--line-strong);border-radius:8px;font-size:11px}
@media(max-width:900px){.product-card{grid-template-columns:180px 1fr}.product-action{display:none}}
@media(max-width:650px){.header-inner,.page-shell{width:min(100% - 22px,1240px)}.header-meta>span{display:none}
  .page-shell{padding-top:18px}.page-heading{align-items:flex-start}.summary-grid{grid-template-columns:repeat(2,1fr)}
  .section-heading{align-items:flex-start;display:block}.section-heading>p{margin-top:5px}.product-card{display:block}
  .product-identity{border-right:0;border-bottom:1px solid var(--line)}.product-metrics{padding:13px}.quota-row{grid-template-columns:1fr auto;gap:7px}
  .quota-meter{grid-column:1/-1;grid-row:2}.quota-numbers{min-width:0}.risk-panel{padding:14px}
  .detail-heading{grid-template-columns:1fr;gap:8px;padding:9px}.detail-heading-main{gap:10px}.detail-heading h1{font-size:20px}
  .metric-tabs{justify-content:flex-start}
  .detail-quota-heading{align-items:flex-start;display:block}.detail-quota-meta{margin-top:12px;text-align:left}
  .detail-quota-foot{grid-template-columns:auto auto;justify-content:space-between}.detail-quota-foot strong{grid-column:1/-1;grid-row:2;text-align:left}
  .trend-heading{align-items:flex-start}.quota-chart{min-height:300px}.brand small{display:none}footer{display:grid}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}`;

export const DASHBOARD_JS = `(() => {
  'use strict';
  const riskLabel={normal:'正常',warning:'需关注',critical:'高风险',exceeded:'已超额'};
  const riskOrder={exceeded:3,critical:2,warning:1,normal:0};
  let data=null,selectedMetric=null,selectedGrain='hourly',toastTimer=null;
  const $=(id)=>document.getElementById(id);
  const els={loading:$('loading'),overview:$('overview'),detail:$('detail'),account:$('account-name'),
    updated:$('last-updated'),refresh:$('refresh-button'),cycle:$('cycle-copy'),status:$('account-status'),
    critical:$('critical-count'),warning:$('warning-count'),products:$('product-count'),list:$('product-list'),
    detailTitle:$('detail-title'),tabs:$('metric-tabs'),riskTitle:$('risk-title'),riskSummary:$('risk-summary'),
    chart:$('quota-chart'),contributors:$('contributors-body'),issues:$('issues-panel'),
    issueList:$('issues-list'),source:$('source-label'),toast:$('toast'),trendTabs:$('trend-tabs'),
    trendTitle:$('trend-title'),trendSubtitle:$('trend-subtitle'),safeLabel:$('safe-label'),
    quotaPercent:$('detail-quota-percent'),quotaForecast:$('detail-quota-forecast'),
    quotaValues:$('detail-quota-values'),quotaTrack:$('detail-quota-track'),
    quotaBalance:$('detail-quota-balance'),quotaScale:$('detail-quota-scale')};

  async function load(confirm){
    els.refresh.disabled=true;
    try{
      const response=await fetch('/api/usage',{credentials:'same-origin',headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('用量查询失败：HTTP '+response.status);
      data=await response.json();render();if(confirm)showToast('已查询最新 Cloudflare 用量');
    }catch(error){showToast(error instanceof Error?error.message:'用量查询失败');}
    finally{els.refresh.disabled=false;els.loading.hidden=true}
  }

  function render(){
    els.account.textContent='账户 · '+data.accountName;
    els.updated.textContent='更新于 '+relativeTime(data.lastUpdated);
    els.source.textContent='数据源 · '+data.source;
    renderIssues();
    const productName=currentProduct();
    if(productName){
      const product=data.products.find((item)=>item.name===productName);
      if(product){renderDetail(product);return}
      history.replaceState({},'', '/');
    }
    renderOverview();
  }

  function renderOverview(){
    els.overview.hidden=false;els.detail.hidden=true;
    els.cycle.textContent='当前计费周期 '+formatDate(data.cycle.start)+' — '+formatDate(data.cycle.end);
    setRisk(els.status,data.status==='degraded'?'warning':data.status==='critical'?'critical':data.status,'账户'+
      (data.status==='degraded'?'数据不完整':data.status==='critical'?'存在超额风险':data.status==='warning'?'需要关注':'额度安全'));
    els.critical.textContent=String(data.summary.critical);els.warning.textContent=String(data.summary.warning);
    els.products.textContent=String(data.summary.products);
    els.list.innerHTML=data.products.map(productCard).join('');
  }

  function productCard(product){
    const metrics=product.metrics.map((metric)=>{
      return '<div class="quota-row"><span class="quota-label">'+escapeHtml(metric.label)+'</span>'+
        quotaMeter(metric,true)+
        '<span class="quota-numbers"><b>'+formatPercent(metric.usedRatio)+'</b></span></div>';
    }).join('');
    return '<button class="product-card" type="button" data-product="'+escapeHtml(product.name)+'">'+
      '<span class="product-identity"><strong>'+escapeHtml(product.label)+'</strong><small>'+
      escapeHtml(product.description)+'</small></span><span class="product-metrics">'+metrics+'</span>'+
      '<span class="product-action"><span class="risk-chip risk-'+product.risk+'">'+riskLabel[product.risk]+
      '</span><span class="arrow" aria-hidden="true">→</span></span></button>';
  }

  function renderDetail(product){
    els.overview.hidden=true;els.detail.hidden=false;
    els.detailTitle.textContent=product.label;
    const requested=new URL(location.href).searchParams.get('metric');
    if(!selectedMetric||!product.metrics.some((metric)=>metric.metric===selectedMetric)){
      selectedMetric=product.metrics.some((metric)=>metric.metric===requested)?requested:product.topMetric;
    }
    els.tabs.innerHTML=product.metrics.map((metric)=>'<button class="metric-tab" type="button" role="tab" data-metric="'+
      escapeHtml(metric.metric)+'" aria-selected="'+String(metric.metric===selectedMetric)+'"><span>'+
      escapeHtml(metric.label)+'</span></button>').join('');
    const metric=product.metrics.find((item)=>item.metric===selectedMetric)||product.metrics[0];
    renderMetric(product,metric);
  }

  function renderMetric(product,metric){
    els.riskTitle.textContent=product.label+' · '+metric.label;
    els.riskSummary.textContent=summaryText(metric);
    renderQuotaProgress(metric);
    renderChart(metric);renderContributors(metric);
  }

  function renderQuotaProgress(metric){
    const usedPercent=Math.max(0,metric.usedRatio*100);
    const forecastLevel=metric.forecastProjectedRatio>=1?'critical':
      metric.forecastProjectedRatio>=.8?'warning':'';
    els.quotaPercent.textContent=formatPercent(metric.usedRatio);
    els.quotaValues.textContent=formatCompact(metric.used)+' / '+formatCompact(metric.quota)+' '+metric.unit;
    els.quotaTrack.innerHTML=quotaMeter(metric,true);
    const scale=quotaMeterScale(usedPercent);
    els.quotaTrack.setAttribute('aria-valuemax',String(scale));
    els.quotaTrack.setAttribute('aria-valuenow',String(Math.round(usedPercent)));
    els.quotaScale.textContent=usedPercent>100?formatPercent(scale/100):'额度 100%';
    els.quotaForecast.textContent='稳健预计 '+formatPercent(metric.forecastProjectedRatio);
    els.quotaForecast.className=forecastLevel;
    if(metric.used>metric.quota){
      els.quotaBalance.textContent='已超出 '+formatCompact(metric.used-metric.quota)+' '+metric.unit+
        ' · '+formatPercent(metric.usedRatio-1);
      els.quotaBalance.className='critical';return
    }
    if(metric.forecastProjectedUsage>metric.quota){
      els.quotaBalance.textContent='稳健预计将超出 '+formatCompact(metric.forecastProjectedUsage-metric.quota)+' '+
        metric.unit+' · '+formatPercent(metric.forecastProjectedRatio-1);
      els.quotaBalance.className='critical';return
    }
    els.quotaBalance.textContent='剩余 '+formatCompact(metric.quota-metric.used)+' '+metric.unit+
      ' · 稳健预计期末剩余 '+formatCompact(metric.quota-metric.forecastProjectedUsage)+' '+metric.unit;
    els.quotaBalance.className=forecastLevel;
  }

  function quotaMeter(metric,showForecast){
    const usedPercent=Math.max(0,metric.usedRatio*100);
    const scale=quotaMeterScale(usedPercent);
    const level=metric.usedRatio>=1?'critical':metric.usedRatio>=.8?'warning':'';
    const exceeded=usedPercent>100;
    const quotaPosition=100/scale*100;
    const forecastPosition=Math.min(100,Math.max(0,metric.forecastProjectedRatio*100));
    const marker=exceeded?
      '<svg class="quota-meter-marker" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true">'+
        '<line class="quota-marker" x1="'+quotaPosition.toFixed(2)+'" x2="'+quotaPosition.toFixed(2)+
        '" y1="0" y2="18"></line></svg>':
      showForecast?'<svg class="quota-meter-marker" viewBox="0 0 100 18" preserveAspectRatio="none" aria-hidden="true">'+
        '<line class="forecast-marker" x1="'+forecastPosition.toFixed(2)+'" x2="'+
        forecastPosition.toFixed(2)+'" y1="0" y2="18"></line></svg>':'';
    const label=exceeded?
      '当前使用 '+formatPercent(metric.usedRatio)+'；蓝线表示额度 100%':
      '当前使用 '+formatPercent(metric.usedRatio)+(showForecast?
        '；稳健预计 '+formatPercent(metric.forecastProjectedRatio):'');
    return '<span class="quota-meter"><progress class="quota-progress '+level+'" max="'+scale.toFixed(2)+
      '" value="'+usedPercent.toFixed(2)+'" aria-label="'+escapeHtml(label)+'"></progress>'+marker+'</span>';
  }

  function quotaMeterScale(usedPercent){
    if(usedPercent<=100)return 100;
    return Math.ceil(usedPercent*1.08/25)*25;
  }

  function summaryText(metric){
    if(metric.risk==='exceeded')return '本期用量已经超过包含额度，超额计费可能已经产生。';
    if(metric.risk==='critical')return '按最近一小时的消耗速度继续运行，预计将在本期结束前超过额度。';
    if(metric.risk==='warning')return '额度或期末预测已达到 80%，建议持续关注增长速度。';
    return '按最近一小时的消耗速度预测，本期不会超过包含额度。';
  }

  function renderChart(metric){
    const hourly=selectedGrain==='hourly',plan=buildTrendPlan(metric,hourly);
    const completed=plan.slots.filter((item)=>item.state==='complete');
    const moving=movingAverage(completed,hourly?6:3);
    const average=completed.length?completed.reduce((sum,item)=>sum+item.actual,0)/completed.length:0;
    const peak=completed.reduce((highest,item)=>item.actual>highest.actual?item:highest,
      {timestamp:'',actual:0});
    els.trendTitle.textContent=hourly?'每小时新增用量':'每日新增用量';
    const hourlyBasis=metric.forecastHourlySamples?
      '最近 '+metric.forecastHourlySamples+' 个完整小时加权':'最近滚动 1 小时回退';
    const dailyBasis=metric.forecastDailySamples>=3?
      '最近 '+metric.forecastDailySamples+' 个完整日平均':'完整日不足 3 天，按小时模型回退';
    els.trendSubtitle.textContent=hourly?'今天 00:00—24:00 UTC；未来小时按'+hourlyBasis+'预测':
      metric.period==='utc_day'?'最近 14 天；今天剩余时间按'+hourlyBasis+'预测':
      '完整账单周期 '+formatDate(metric.periodStart)+' — '+formatDate(metric.periodEnd)+'；未来日期按'+dailyBasis+'预测';
    [...els.trendTabs.querySelectorAll('[data-grain]')].forEach((tab)=>
      tab.setAttribute('aria-selected',String(tab.dataset.grain===selectedGrain)));
    if(plan.slots.length===0){
      els.safeLabel.textContent='安全线 '+formatCompact(plan.safePerSlot);
      els.chart.innerHTML='<div class="empty-row">Cloudflare 暂无这个时间范围的趋势数据</div>';
      els.chart.setAttribute('aria-label',metric.label+'暂无趋势数据');return;
    }
    const width=1040,height=360,m={right:36,left:72};
    const innerW=width-m.left-m.right,upperTop=24,upperH=272,bottomY=height-18;
    const actualAndForecast=plan.slots.map((item)=>item.actual+item.forecast);
    const observedMax=Math.max(...actualAndForecast,...moving.map((item)=>item.value),1);
    const upperMax=observedMax*1.12,clippedPace=plan.safePerSlot>upperMax;
    els.safeLabel.textContent='安全线 '+formatCompact(plan.safePerSlot)+
      (clippedPace?'（高于图表范围）':'');
    els.chart.style.minHeight='340px';
    const step=innerW/plan.slots.length,barWidth=Math.max(3,step*.62);
    const x=(index)=>m.left+step*index+step/2;
    const upperY=(value)=>upperTop+upperH-(value/upperMax)*upperH;
    let svg='<svg viewBox="0 0 '+width+' '+height+'" aria-hidden="true">';
    [0,.25,.5,.75,1].forEach((part)=>{const value=upperMax*part,py=upperY(value);svg+='<line x1="'+m.left+'" y1="'+py+
      '" x2="'+(width-m.right)+'" y2="'+py+'" stroke="#243144"/><text x="'+(m.left-10)+'" y="'+(py+4)+
      '" text-anchor="end" fill="#9aa8ba" font-size="10">'+escapeHtml(formatCompact(value))+'</text>'});
    const paceY=clippedPace?upperTop+2:upperY(plan.safePerSlot);
    const paceLabelY=clippedPace?paceY+12:Math.max(upperTop+10,paceY-7);
    plan.slots.forEach((item,index)=>{
      const actualTop=upperY(item.actual),baseY=upperY(0);
      if(item.forecast>0){const forecastValue=item.actual+item.forecast,forecastTop=upperY(forecastValue);
        svg+='<rect x="'+(x(index)-barWidth/2).toFixed(1)+'" y="'+forecastTop.toFixed(1)+
          '" width="'+barWidth.toFixed(1)+'" height="'+Math.max(1,baseY-forecastTop).toFixed(1)+
          '" rx="2" fill="none" stroke="#5eead4" stroke-width="1.2" stroke-dasharray="4 3" opacity=".72"><title>'+
          escapeHtml(formatTrendTime(item.timestamp,hourly)+' · 预测 '+formatCompact(forecastValue)+' '+metric.unit)+
          '</title></rect>'}
      if(item.actual>0){svg+='<rect x="'+(x(index)-barWidth/2).toFixed(1)+'" y="'+actualTop.toFixed(1)+
        '" width="'+barWidth.toFixed(1)+'" height="'+Math.max(1,baseY-actualTop).toFixed(1)+
        '" rx="2" fill="#5eead4" opacity="'+
        (item.timestamp===peak.timestamp?'1':item.state==='partial'?'.48':'.75')+'"><title>'+escapeHtml(formatTrendTime(item.timestamp,hourly)+
        ' · 实际 '+formatCompact(item.actual)+' '+metric.unit+(item.state==='partial'?'（进行中）':''))+'</title></rect>'}
      if(hourly&&item.state==='partial'){svg+='<text x="'+x(index).toFixed(1)+'" y="'+Math.max(upperTop+12,actualTop-7).toFixed(1)+
        '" text-anchor="middle" fill="#9aa8ba" font-size="9">进行中</text>'}
    });
    if(moving.length>1){svg+='<polyline points="'+moving.map((item)=>
      x(item.index).toFixed(1)+','+upperY(item.value).toFixed(1)).join(' ')+
      '" fill="none" stroke="#fbbf24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'}
    const forecastPoints=[];
    if(moving.length)forecastPoints.push({x:x(moving.at(-1).index),value:moving.at(-1).value});
    plan.slots.forEach((item,index)=>{if(item.state!=='complete')forecastPoints.push({
      x:x(index),value:item.actual+item.forecast,timestamp:item.timestamp})});
    const forecastSegment=(from,to,color)=>'<line x1="'+from.x.toFixed(1)+'" y1="'+upperY(from.value).toFixed(1)+
      '" x2="'+to.x.toFixed(1)+'" y2="'+upperY(to.value).toFixed(1)+'" stroke="'+color+
      '" stroke-width="2.2" stroke-dasharray="7 5" stroke-linecap="round"/>';
    for(let index=1;index<forecastPoints.length;index++){
      const from=forecastPoints[index-1],to=forecastPoints[index];
      const crosses=(from.value-plan.safePerSlot)*(to.value-plan.safePerSlot)<0;
      if(!crosses){svg+=forecastSegment(from,to,from.value>plan.safePerSlot||to.value>plan.safePerSlot?'#fb7185':'#fbbf24');continue}
      const ratio=(plan.safePerSlot-from.value)/(to.value-from.value);
      const crossing={x:from.x+(to.x-from.x)*ratio,value:plan.safePerSlot};
      svg+=forecastSegment(from,crossing,from.value>plan.safePerSlot?'#fb7185':'#fbbf24');
      svg+=forecastSegment(crossing,to,to.value>plan.safePerSlot?'#fb7185':'#fbbf24');
    }
    svg+='<line x1="'+m.left+'" y1="'+paceY+'" x2="'+(width-m.right)+'" y2="'+paceY+
      '" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="6 5"/>'+
      '<rect x="'+(m.left+2)+'" y="'+(paceLabelY-11)+'" width="128" height="16" rx="3" fill="#0d1420" stroke="#60a5fa"/>'+
      '<text x="'+(m.left+8)+'" y="'+paceLabelY+'" text-anchor="start" fill="#dbeafe" font-size="9">'+
      (clippedPace?'↑ ':'')+'安全线 '+escapeHtml(formatCompact(plan.safePerSlot))+'</text>';
    const nowX=m.left+Math.max(0,Math.min(1,(plan.now-plan.start)/(plan.end-plan.start)))*innerW;
    svg+='<line x1="'+nowX+'" y1="'+upperTop+'" x2="'+nowX+'" y2="'+(upperTop+upperH)+
      '" stroke="#f8fafc" stroke-width="1" stroke-dasharray="2 5" opacity=".5"/>'+
      '<text x="'+Math.min(width-m.right-24,nowX+5)+'" y="'+(upperTop+12)+'" fill="#f8fafc" font-size="9">现在</text>';
    const tickEvery=Math.max(1,Math.ceil(plan.slots.length/(hourly?6:7)));
    plan.slots.forEach((item,index)=>{if(index%tickEvery!==0&&index!==plan.slots.length-1)return;
      svg+='<text x="'+x(index)+'" y="'+bottomY+'" text-anchor="middle" fill="#9aa8ba" font-size="9">'+
        escapeHtml(formatTrendTime(item.timestamp,hourly))+'</text>'});
    svg+='</svg>';els.chart.innerHTML=svg;
    const plannedTotal=plan.slots.reduce((sum,item)=>sum+item.actual+item.forecast,0);
    els.chart.setAttribute('aria-label',metric.label+'：'+(hourly?'今天':'本期')+'完整时段平均 '+formatCompact(average)+
      '，峰值 '+formatCompact(peak.actual)+'，安全线 '+formatCompact(plan.safePerSlot)+
      '，图中预计总量 '+formatCompact(plannedTotal));
  }

  function buildTrendPlan(metric,hourly){
    const hour=3600000,day=24*hour,unit=hourly?hour:day,now=Date.parse(data.lastUpdated);
    const dayStart=Math.floor(now/day)*day;
    const repeatingDaily=!hourly&&metric.period==='utc_day';
    const start=hourly?dayStart:repeatingDaily?Math.max(Date.parse(data.cycle.start),dayStart-13*day):
      Date.parse(metric.periodStart);
    const end=hourly?dayStart+day:repeatingDaily?dayStart+day:Date.parse(metric.periodEnd);
    const source=hourly?metric.hourly:metric.daily;
    const byTime=new Map(source.map((item)=>[Date.parse(item.timestamp),item.value]));
    const periodHours=Math.max(1,(Date.parse(metric.periodEnd)-Date.parse(metric.periodStart))/hour);
    const safePerSlot=repeatingDaily?metric.quota:metric.quota*(unit/hour)/periodHours;
    const slots=[];for(let time=start,index=0;time<end;time+=unit,index++){
      const slotEnd=time+unit,state=slotEnd<=now?'complete':time<now?'partial':'future';
      const actual=time<now?(byTime.get(time)||0):0;
      const remainingHours=state==='partial'?Math.max(0,(slotEnd-now)/hour):state==='future'?unit/hour:0;
      const forecast=state==='partial'?metric.forecastHourlyUsage*remainingHours:
        state==='future'?hourly?metric.forecastHourlyUsage:metric.forecastDailyUsage:0;
      slots.push({index,timestamp:new Date(time).toISOString(),start:time,end:slotEnd,state,actual,
        forecast});
    }
    return {slots,start,end,now,safePerSlot};
  }
  function movingAverage(samples,size){return samples.map((item,index)=>{const window=samples.slice(Math.max(0,index-size+1),index+1);
    return {index:item.index,value:window.reduce((sum,sample)=>sum+sample.actual,0)/window.length}})}
  function formatTrendTime(value,hourly){return new Intl.DateTimeFormat('zh-CN',hourly?
    {month:'numeric',day:'numeric',hour:'2-digit',hour12:false,timeZone:'UTC'}:
    {month:'numeric',day:'numeric',timeZone:'UTC'}).format(new Date(value))}

  function renderContributors(metric){
    const recent=new Map(metric.recentContributors.map((item)=>[item.id,item]));
    const remainingHours=Math.max(0,(Date.parse(metric.periodEnd)-Date.parse(data.lastUpdated))/3600000);
    const rows=metric.contributors.map((item)=>{
      const hour=recent.get(item.id)?.value||0,share=metric.used===0?0:item.value/metric.used;
      const projected=item.value+hour*remainingHours;
      return '<tr><td class="instance-name"><strong>'+escapeHtml(item.name)+'</strong><small>'+escapeHtml(shortId(item.id))+
        '</small></td><td>'+formatCompact(item.value)+'</td><td><span class="instance-share"><i style="--share:'+
        Math.min(100,share*100).toFixed(1)+'%"></i>'+formatPercent(share)+'</span></td><td>'+formatCompact(hour)+
        '</td><td>'+formatCompact(projected)+'</td></tr>';
    });
    els.contributors.innerHTML=rows.length?rows.join(''):'<tr><td colspan="5" class="empty-row">当前周期没有实例用量</td></tr>';
  }

  function renderIssues(){
    els.issues.hidden=data.failures.length===0;
    els.issueList.innerHTML=data.failures.map((item)=>'<li><strong>'+escapeHtml(item.collector)+
      '</strong> · '+escapeHtml(item.message)+'</li>').join('');
  }
  function currentProduct(){const match=location.pathname.match(/^\\/usage\\/([^/]+)$/);return match?decodeURIComponent(match[1]):null}
  function navigate(url){history.pushState({},'',url);selectedMetric=null;render();scrollTo({top:0,behavior:'smooth'})}
  function setRisk(el,risk,label){el.className='status-pill risk-'+risk;el.textContent=label}
  function formatCompact(value){return new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:2}).format(value)}
  function formatPercent(value){return new Intl.NumberFormat('zh-CN',{style:'percent',maximumFractionDigits:1}).format(value)}
  function formatDate(value){return new Intl.DateTimeFormat('zh-CN',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(value))}
  function relativeTime(value){const minutes=Math.max(0,Math.round((Date.now()-Date.parse(value))/60000));return minutes<1?'刚刚':minutes<60?minutes+' 分钟前':Math.floor(minutes/60)+' 小时前'}
  function shortId(value){return value.length>22?value.slice(0,10)+'…'+value.slice(-5):value}
  function escapeHtml(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
  function showToast(message){clearTimeout(toastTimer);els.toast.textContent=message;els.toast.hidden=false;toastTimer=setTimeout(()=>{els.toast.hidden=true},4000)}

  document.addEventListener('click',(event)=>{
    const nav=event.target.closest('[data-nav]');if(nav){event.preventDefault();navigate(nav.getAttribute('href'));return}
    const product=event.target.closest('[data-product]');if(product){navigate('/usage/'+encodeURIComponent(product.dataset.product));return}
    const tab=event.target.closest('[data-metric]');if(tab){selectedMetric=tab.dataset.metric;
      const url=new URL(location.href);url.searchParams.set('metric',selectedMetric);history.replaceState({},'',url);render()}
    const grain=event.target.closest('[data-grain]');if(grain){selectedGrain=grain.dataset.grain;render()}
  });
  addEventListener('popstate',()=>{selectedMetric=null;render()});
  els.refresh.addEventListener('click',()=>load(true));
  load(false);setInterval(()=>load(false),5*60*1000);
})();`;
