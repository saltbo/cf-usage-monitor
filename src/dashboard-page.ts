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
      <nav class="breadcrumb" aria-label="面包屑">
        <a href="/" data-nav>账户额度</a><span>/</span><strong id="detail-product-name">—</strong>
      </nav>
      <div class="detail-heading">
        <div>
          <p class="eyebrow">产品详情</p>
          <h1 id="detail-title">—</h1>
          <p id="detail-description">—</p>
        </div>
        <span id="detail-status" class="status-pill">—</span>
      </div>

      <div id="metric-tabs" class="metric-tabs" role="tablist" aria-label="计费指标"></div>

      <section class="risk-panel" aria-labelledby="risk-title">
        <div class="risk-copy">
          <div>
            <p class="eyebrow">额度预测</p>
            <h2 id="risk-title">—</h2>
            <p id="risk-summary">—</p>
          </div>
          <div class="risk-facts">
            <span><small>本期已用</small><strong id="used-value">—</strong></span>
            <span><small>预计期末</small><strong id="projected-value">—</strong></span>
            <span><small>当前消耗速度</small><strong id="burn-value">—</strong></span>
            <span><small>预计耗尽</small><strong id="exhaust-value">—</strong></span>
          </div>
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
        <div class="trend-stats" aria-label="增长速度摘要">
          <span><small id="latest-label">最近完整小时</small><strong id="latest-rate">—</strong></span>
          <span><small id="average-label">48 小时平均</small><strong id="average-rate">—</strong></span>
          <span><small id="peak-label">48 小时峰值</small><strong id="peak-rate">—</strong></span>
        </div>
        <div class="chart-legend" aria-label="图例">
          <span><i class="increment"></i>新增用量</span>
          <span><i class="moving"></i><b id="moving-label">6 小时移动平均</b></span>
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
.page-heading,.detail-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:28px;margin-bottom:18px}
.eyebrow{margin:0 0 6px;color:var(--subtle);font-size:10px;font-weight:750;letter-spacing:.12em;text-transform:uppercase}
h1,h2,p{margin-top:0}.page-heading h1,.detail-heading h1{margin-bottom:7px;font-size:clamp(25px,4vw,38px);letter-spacing:-.04em}
.page-heading p:not(.eyebrow),.detail-heading p:not(.eyebrow){margin:0;color:var(--muted);font-size:12px}
.status-pill,.risk-chip{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;
  border-radius:5px;font-size:10px;font-weight:800;white-space:nowrap}
.risk-normal{color:var(--green);background:var(--green-soft)}.risk-warning{color:var(--amber);background:var(--amber-soft)}
.risk-critical,.risk-exceeded{color:#fecdd3;background:var(--red-soft)}
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-bottom:28px;
  overflow:hidden;border:1px solid var(--line);border-radius:var(--radius);background:var(--line)}
.summary-grid article{padding:15px 17px;background:var(--surface)}.summary-grid span{display:block;color:var(--subtle);font-size:10px}
.summary-grid strong{display:block;margin-top:8px;font-size:21px;font-variant-numeric:tabular-nums}
.section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin:0 0 10px}
.section-heading h2{margin:0;font-size:18px}.section-heading>p{margin:0;color:var(--subtle);font-size:10px}
.product-list{display:grid;gap:10px}.product-card{width:100%;padding:0;display:grid;
  grid-template-columns:minmax(190px,.8fr) minmax(0,2.2fr) auto;align-items:stretch;
  color:inherit;text-align:left;background:var(--surface);border:1px solid var(--line);
  border-radius:var(--radius);cursor:pointer;overflow:hidden;transition:border-color 160ms ease,background 160ms ease}
.product-card:hover{border-color:var(--line-strong);background:var(--surface-2)}
.product-identity{padding:17px 18px;border-right:1px solid var(--line)}
.product-identity strong{display:block;margin-bottom:5px;font-size:15px}.product-identity small{color:var(--subtle);font-size:10px}
.product-metrics{display:grid;align-content:center;gap:11px;padding:14px 18px}
.quota-row{display:grid;grid-template-columns:minmax(130px,.9fr) minmax(150px,1.4fr) auto;align-items:center;gap:14px}
.quota-label{font-size:11px}.quota-progress{height:7px;overflow:hidden;background:#202c3d;border-radius:999px}
.quota-progress i{height:100%;display:block;background:var(--teal);border-radius:inherit}
.quota-progress i.warning{background:var(--amber)}.quota-progress i.critical{background:var(--red)}
.quota-numbers{min-width:145px;text-align:right;font:10px ui-monospace,monospace;color:var(--muted)}
.quota-numbers b{color:var(--text);font-weight:700}.product-action{min-width:112px;padding:16px;
  display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;border-left:1px solid var(--line)}
.product-action .arrow{font-size:20px;color:var(--subtle)}
.breadcrumb{display:flex;gap:8px;margin-bottom:16px;color:var(--subtle);font-size:11px}
.breadcrumb a{min-height:32px;display:inline-flex;align-items:center;color:var(--teal);text-decoration:none}
.breadcrumb span,.breadcrumb strong{display:inline-flex;align-items:center}.metric-tabs{display:flex;gap:8px;overflow-x:auto;margin-bottom:12px;padding-bottom:2px}
.metric-tab{min-height:48px;padding:8px 12px;display:flex;align-items:center;gap:9px;color:var(--muted);
  background:var(--surface);border:1px solid var(--line);border-radius:7px;cursor:pointer;white-space:nowrap}
.metric-tab[aria-selected=true]{color:var(--text);border-color:var(--teal);background:var(--teal-soft)}
.metric-tab small{font:9px ui-monospace,monospace}.risk-panel{padding:20px;background:var(--surface);
  border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
.risk-copy{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(0,1.6fr);gap:28px;align-items:start}
.risk-copy h2{margin-bottom:7px;font-size:20px}.risk-copy>div>p:not(.eyebrow){margin:0;color:var(--muted);font-size:11px;line-height:1.6}
.risk-facts{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:7px;overflow:hidden}
.risk-facts span{padding:12px;background:var(--surface-2)}.risk-facts small{display:block;margin-bottom:7px;color:var(--subtle);font-size:9px}
.risk-facts strong{display:block;font:12px ui-monospace,monospace;overflow-wrap:anywhere}
.trend-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:18px;margin-top:28px;padding-top:20px;border-top:1px solid var(--line)}
.trend-heading h3{margin:0 0 5px;font-size:17px}.trend-heading>div>p:last-child{margin:0;color:var(--muted);font-size:10px}
.trend-tabs{display:flex;padding:3px;background:var(--canvas);border:1px solid var(--line);border-radius:7px}
.trend-tabs button{min-width:54px;min-height:30px;color:var(--muted);background:transparent;border:0;border-radius:5px;cursor:pointer;font-size:10px}
.trend-tabs button[aria-selected=true]{color:var(--text);background:var(--surface-2)}
.trend-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-top:13px;overflow:hidden;background:var(--line);border:1px solid var(--line);border-radius:7px}
.trend-stats span{padding:10px 12px;background:var(--surface-2)}.trend-stats small{display:block;margin-bottom:5px;color:var(--subtle);font-size:9px}
.trend-stats strong{font:12px ui-monospace,monospace}
.chart-legend{display:flex;gap:16px;flex-wrap:wrap;margin:14px 0 4px;color:var(--muted);font-size:9px}
.chart-legend span{display:inline-flex;align-items:center;gap:6px}.chart-legend i{width:18px;height:0;border-top:2px solid}
.chart-legend b{font-weight:400}.chart-legend .increment{height:8px;border:0;background:var(--teal)}
.chart-legend .moving{border-color:var(--amber)}.chart-legend .safe{border-color:var(--blue);border-style:dashed}
.quota-chart{min-height:340px}.quota-chart svg{width:100%;height:auto;display:block}.contributors-section{margin-top:24px}
.contributors-table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
table{width:100%;border-collapse:collapse;min-width:760px}th,td{padding:13px 15px;text-align:right;border-bottom:1px solid var(--line);font-size:11px}
th{color:var(--subtle);font-size:9px;text-transform:uppercase;letter-spacing:.06em}th:first-child,td:first-child{text-align:left}
tbody tr:last-child td{border-bottom:0}.instance-name strong{display:block}.instance-name small{display:block;margin-top:4px;color:var(--subtle);font:9px ui-monospace,monospace}
.instance-share{display:inline-flex;align-items:center;gap:8px}.instance-share i{width:54px;height:5px;background:#202c3d;border-radius:9px;overflow:hidden}
.instance-share i:after{content:"";display:block;width:var(--share);height:100%;background:var(--teal)}
.empty-row{text-align:center!important;color:var(--subtle);padding:30px!important}.issues-panel{margin-top:18px;padding:16px 18px;
  color:#fecdd3;background:var(--red-soft);border:1px solid rgba(251,113,133,.3);border-radius:var(--radius);font-size:11px}
.issues-panel ul{margin:10px 0 0;padding-left:18px;color:var(--muted)}footer{padding-top:22px;display:flex;justify-content:space-between;
  gap:20px;color:var(--subtle);font-size:9px}.toast{position:fixed;right:18px;bottom:18px;z-index:40;max-width:360px;
  padding:12px 14px;background:var(--surface-2);border:1px solid var(--line-strong);border-radius:8px;font-size:11px}
@media(max-width:900px){.product-card{grid-template-columns:180px 1fr}.product-action{display:none}
  .risk-copy{grid-template-columns:1fr}.risk-facts{grid-template-columns:repeat(2,1fr)}}
@media(max-width:650px){.header-inner,.page-shell{width:min(100% - 22px,1240px)}.header-meta>span{display:none}
  .page-shell{padding-top:18px}.page-heading,.detail-heading{align-items:flex-start}.summary-grid{grid-template-columns:repeat(2,1fr)}
  .section-heading{align-items:flex-start;display:block}.section-heading>p{margin-top:5px}.product-card{display:block}
  .product-identity{border-right:0;border-bottom:1px solid var(--line)}.product-metrics{padding:13px}.quota-row{grid-template-columns:1fr auto;gap:7px}
  .quota-progress{grid-column:1/-1;grid-row:2}.quota-numbers{min-width:0}.risk-panel{padding:14px}.risk-facts{grid-template-columns:1fr 1fr}
  .trend-heading{align-items:flex-start}.trend-stats{grid-template-columns:1fr}.quota-chart{min-height:250px}.brand small{display:none}footer{display:grid}}
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
    detailName:$('detail-product-name'),detailTitle:$('detail-title'),detailDescription:$('detail-description'),
    detailStatus:$('detail-status'),tabs:$('metric-tabs'),riskTitle:$('risk-title'),riskSummary:$('risk-summary'),
    used:$('used-value'),projected:$('projected-value'),burn:$('burn-value'),exhaust:$('exhaust-value'),
    chart:$('quota-chart'),contributors:$('contributors-body'),issues:$('issues-panel'),
    issueList:$('issues-list'),source:$('source-label'),toast:$('toast'),trendTabs:$('trend-tabs'),
    trendTitle:$('trend-title'),trendSubtitle:$('trend-subtitle'),latestLabel:$('latest-label'),
    latestRate:$('latest-rate'),averageLabel:$('average-label'),averageRate:$('average-rate'),
    peakLabel:$('peak-label'),peakRate:$('peak-rate'),movingLabel:$('moving-label'),safeLabel:$('safe-label')};

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
      const percent=Math.min(100,Math.max(0,metric.usedRatio*100));
      const barClass=metric.risk==='normal'?'':metric.risk==='warning'?'warning':'critical';
      return '<div class="quota-row"><span class="quota-label">'+escapeHtml(metric.label)+'</span>'+
        '<span class="quota-progress"><i class="'+barClass+'" style="width:'+percent.toFixed(2)+'%"></i></span>'+
        '<span class="quota-numbers"><b>'+formatCompact(metric.used)+'</b> / '+formatCompact(metric.quota)+
        ' · 预计 '+formatPercent(metric.projectedRatio)+'</span></div>';
    }).join('');
    return '<button class="product-card" type="button" data-product="'+escapeHtml(product.name)+'">'+
      '<span class="product-identity"><strong>'+escapeHtml(product.label)+'</strong><small>'+
      escapeHtml(product.description)+'</small></span><span class="product-metrics">'+metrics+'</span>'+
      '<span class="product-action"><span class="risk-chip risk-'+product.risk+'">'+riskLabel[product.risk]+
      '</span><span class="arrow" aria-hidden="true">→</span></span></button>';
  }

  function renderDetail(product){
    els.overview.hidden=true;els.detail.hidden=false;
    els.detailName.textContent=product.label;els.detailTitle.textContent=product.label+' 额度风险';
    els.detailDescription.textContent=product.description+' · 当前计费指标按超额风险排序';
    setRisk(els.detailStatus,product.risk,riskLabel[product.risk]);
    const requested=new URL(location.href).searchParams.get('metric');
    if(!selectedMetric||!product.metrics.some((metric)=>metric.metric===selectedMetric)){
      selectedMetric=product.metrics.some((metric)=>metric.metric===requested)?requested:product.topMetric;
    }
    els.tabs.innerHTML=product.metrics.map((metric)=>'<button class="metric-tab" type="button" role="tab" data-metric="'+
      escapeHtml(metric.metric)+'" aria-selected="'+String(metric.metric===selectedMetric)+'"><span>'+
      escapeHtml(metric.label)+'</span><small>'+formatPercent(metric.projectedRatio)+' 期末</small></button>').join('');
    const metric=product.metrics.find((item)=>item.metric===selectedMetric)||product.metrics[0];
    renderMetric(product,metric);
  }

  function renderMetric(product,metric){
    els.riskTitle.textContent=product.label+' · '+metric.label;
    els.riskSummary.textContent=summaryText(metric);
    els.used.textContent=formatCompact(metric.used)+' / '+formatCompact(metric.quota)+' '+metric.unit;
    els.projected.textContent=formatCompact(metric.projectedUsage)+' · '+formatPercent(metric.projectedRatio);
    els.burn.textContent=metric.burnRate===null?'包含额度已用尽':metric.burnRate.toFixed(2)+'× 剩余安全速度';
    els.exhaust.textContent=metric.exhaustsAt?formatDateTime(metric.exhaustsAt):'按当前速度不会耗尽';
    renderChart(metric);renderContributors(metric);
  }

  function summaryText(metric){
    if(metric.risk==='exceeded')return '本期用量已经超过包含额度，超额计费可能已经产生。';
    if(metric.risk==='critical')return '按最近一小时的消耗速度继续运行，预计将在本期结束前超过额度。';
    if(metric.risk==='warning')return '额度或期末预测已达到 80%，建议持续关注增长速度。';
    return '按最近一小时的消耗速度预测，本期不会超过包含额度。';
  }

  function renderChart(metric){
    const hourly=selectedGrain==='hourly',samples=normalizedTrend(metric,hourly);
    const movingWindow=hourly?6:3,moving=movingAverage(samples,movingWindow);
    const periodHours=Math.max(1,(Date.parse(metric.periodEnd)-Date.parse(metric.periodStart))/3600000);
    const quotaPace=metric.quota/periodHours*(hourly?1:24);
    const latest=samples.at(-1)?.value||0;
    const average=samples.length?samples.reduce((sum,item)=>sum+item.value,0)/samples.length:0;
    const peak=samples.reduce((highest,item)=>item.value>highest.value?item:highest,{timestamp:'',value:0});
    els.trendTitle.textContent=hourly?'每小时新增用量':'每日新增用量';
    els.trendSubtitle.textContent=hourly?'最近 48 个完整 UTC 小时':'当前账单周期；今天的数据仍在增长';
    els.latestLabel.textContent=hourly?'最近完整小时':'今天（截至目前）';
    els.averageLabel.textContent=hourly?'48 小时平均':'本期日均';
    els.peakLabel.textContent=hourly?'48 小时峰值':'本期单日峰值';
    els.latestRate.textContent=formatCompact(latest)+' '+metric.unit;
    els.averageRate.textContent=formatCompact(average)+' '+metric.unit;
    els.peakRate.textContent=formatCompact(peak.value)+' · '+(peak.timestamp?formatTrendTime(peak.timestamp,hourly):'—');
    els.movingLabel.textContent=(hourly?'6 小时':'3 天')+'移动平均';
    [...els.trendTabs.querySelectorAll('[data-grain]')].forEach((tab)=>
      tab.setAttribute('aria-selected',String(tab.dataset.grain===selectedGrain)));
    if(samples.length===0){
      els.safeLabel.textContent='安全线 '+formatCompact(quotaPace);
      els.chart.innerHTML='<div class="empty-row">Cloudflare 暂无这个时间范围的趋势数据</div>';
      els.chart.setAttribute('aria-label',metric.label+'暂无趋势数据');return;
    }
    const width=1040,height=350,m={top:24,right:30,bottom:48,left:72};
    const innerW=width-m.left-m.right,innerH=height-m.top-m.bottom;
    const observedMax=Math.max(...samples.map((item)=>item.value),...moving,1);
    const max=observedMax*1.12,clippedPace=quotaPace>max;
    els.safeLabel.textContent='安全线 '+formatCompact(quotaPace)+
      (clippedPace?'（高于图表范围）':'');
    const step=innerW/samples.length,barWidth=Math.max(3,step*.66);
    const x=(index)=>m.left+step*index+step/2;
    const y=(value)=>m.top+innerH-(value/max)*innerH;
    let svg='<svg viewBox="0 0 '+width+' '+height+'" aria-hidden="true">';
    [0,.25,.5,.75,1].forEach((part)=>{const value=max*part,py=y(value);svg+='<line x1="'+m.left+'" y1="'+py+
      '" x2="'+(width-m.right)+'" y2="'+py+'" stroke="#243144"/><text x="'+(m.left-10)+'" y="'+(py+4)+
      '" text-anchor="end" fill="#9aa8ba" font-size="10">'+escapeHtml(formatCompact(value))+'</text>'});
    const paceY=clippedPace?m.top+2:y(quotaPace);
    const paceLabelY=clippedPace?paceY+12:Math.max(m.top+10,paceY-7);
    samples.forEach((item,index)=>{const partial=!hourly&&index===samples.length-1&&
      sameUtcDay(item.timestamp,data.lastUpdated);const isPeak=item.timestamp===peak.timestamp&&item.value>0;
      const top=y(item.value),heightValue=Math.max(1,m.top+innerH-top);
      svg+='<rect x="'+(x(index)-barWidth/2).toFixed(1)+'" y="'+top.toFixed(1)+'" width="'+barWidth.toFixed(1)+
        '" height="'+heightValue.toFixed(1)+'" rx="2" fill="'+(partial?'#fbbf24':'#5eead4')+'" opacity="'+
        (isPeak?'1':'.72')+'"><title>'+escapeHtml(formatTrendTime(item.timestamp,hourly)+' · '+formatCompact(item.value)+
        ' '+metric.unit+(partial?'（进行中）':''))+'</title></rect>'});
    if(moving.length>1){const points=moving.map((value,index)=>x(index).toFixed(1)+','+y(value).toFixed(1)).join(' ');
      svg+='<polyline points="'+points+'" fill="none" stroke="#fbbf24" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'}
    svg+='<line x1="'+m.left+'" y1="'+paceY+'" x2="'+(width-m.right)+'" y2="'+paceY+
      '" stroke="#60a5fa" stroke-width="1.5" stroke-dasharray="6 5"/>'+
      '<rect x="'+(m.left+2)+'" y="'+(paceLabelY-11)+'" width="128" height="16" rx="3" fill="#0d1420" stroke="#60a5fa"/>'+
      '<text x="'+(m.left+8)+'" y="'+paceLabelY+'" text-anchor="start" fill="#dbeafe" font-size="9">'+
      (clippedPace?'↑ ':'')+'安全线 '+escapeHtml(formatCompact(quotaPace))+'</text>';
    const tickEvery=Math.max(1,Math.ceil(samples.length/6));
    samples.forEach((item,index)=>{if(index%tickEvery!==0&&index!==samples.length-1)return;
      svg+='<text x="'+x(index)+'" y="'+(height-16)+'" text-anchor="middle" fill="#9aa8ba" font-size="9">'+
        escapeHtml(formatTrendTime(item.timestamp,hourly))+'</text>'});
    svg+='</svg>';els.chart.innerHTML=svg;
    els.chart.setAttribute('aria-label',metric.label+'：'+(hourly?'最近完整小时':'今天')+'新增 '+formatCompact(latest)+
      '，平均 '+formatCompact(average)+'，峰值 '+formatCompact(peak.value)+'，安全线 '+formatCompact(quotaPace));
  }

  function normalizedTrend(metric,hourly){
    const source=hourly?metric.hourly:metric.daily,byTime=new Map(source.map((item)=>[Date.parse(item.timestamp),item.value]));
    const unit=hourly?3600000:86400000,end=hourly
      ?Math.floor(Date.parse(data.lastUpdated)/unit)*unit
      :Math.floor(Date.parse(data.lastUpdated)/unit)*unit+unit;
    const start=hourly?end-48*unit:Date.parse(data.cycle.start);
    const points=[];for(let time=start;time<end;time+=unit){
      points.push({timestamp:new Date(time).toISOString(),value:byTime.get(time)||0});
    }return points;
  }
  function movingAverage(samples,size){return samples.map((_,index)=>{const window=samples.slice(Math.max(0,index-size+1),index+1);
    return window.reduce((sum,item)=>sum+item.value,0)/window.length})}
  function sameUtcDay(left,right){return String(left).slice(0,10)===String(right).slice(0,10)}
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
  function formatDateTime(value){return new Intl.DateTimeFormat('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
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
