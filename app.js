// ─── Data Sharing Dashboard ───
// Main application logic

const CHART_COLORS = [
  '#6366f1', '#3b82f6', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#14b8a6', '#eab308',
  '#ec4899', '#06b6d4', '#84cc16', '#f43f5e', '#8b5cf6', '#10b981', '#d946ef', '#0ea5e9',
];
const SURFACE_LABELS = {
  'storefront-renderer': 'Storefront',
  'checkout-one': 'Checkout',
  'customer-account': 'Customer Accounts',
  'shopify': 'Admin',
};

let charts = {};
let isAuthed = false;

// ─── Helpers ───

function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtFull(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString();
}

function extractVal(v) {
  if (v == null) return v;
  if (typeof v === 'object' && v.value !== undefined) return v.value;
  return v;
}

function pct(n, total) {
  if (!total) return '0.0%';
  return ((n / total) * 100).toFixed(1) + '%';
}

function getTheme() {
  return document.documentElement.getAttribute('data-theme');
}

function chartDefaults() {
  const isDark = getTheme() === 'dark';
  return {
    gridColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
    textColor: isDark ? '#8888a0' : '#666680',
    tooltipBg: isDark ? '#1c1c28' : '#ffffff',
    tooltipText: isDark ? '#eaeaf0' : '#111118',
    tooltipBorder: isDark ? '#2a2a3a' : '#e0e0e8',
  };
}

// ─── Theme ───

function initTheme() {
  const saved = localStorage.getItem('ds-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ds-theme', next);
    updateChartsTheme();
  });
}

function updateChartsTheme() {
  const cd = chartDefaults();
  Object.values(charts).forEach(chart => {
    if (!chart) return;
    // Update scales
    if (chart.options.scales) {
      Object.values(chart.options.scales).forEach(scale => {
        if (scale.grid) scale.grid.color = cd.gridColor;
        if (scale.ticks) scale.ticks.color = cd.textColor;
      });
    }
    // Update tooltip
    if (chart.options.plugins?.tooltip) {
      chart.options.plugins.tooltip.backgroundColor = cd.tooltipBg;
      chart.options.plugins.tooltip.titleColor = cd.tooltipText;
      chart.options.plugins.tooltip.bodyColor = cd.tooltipText;
      chart.options.plugins.tooltip.borderColor = cd.tooltipBorder;
    }
    // Update legend
    if (chart.options.plugins?.legend?.labels) {
      chart.options.plugins.legend.labels.color = cd.textColor;
    }
    chart.update('none');
  });
}

// ─── Auth ───

async function checkAuth() {
  try {
    const result = await quick.auth.requestScopes([
      'https://www.googleapis.com/auth/bigquery',
    ]);
    isAuthed = result.hasRequiredScopes;
  } catch {
    isAuthed = false;
  }

  document.getElementById('authBanner').style.display = isAuthed ? 'none' : 'block';
  return isAuthed;
}

// ─── Query Runner ───

function normalizeRows(rows) {
  return rows.map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = extractVal(v);
    }
    return out;
  });
}

async function runQuery(sql, label) {
  try {
    const result = await quick.dw.querySync(sql, null, { timeoutMs: 120000 });
    return normalizeRows(result.results || []);
  } catch (err) {
    console.error(`Query failed [${label}]:`, err);
    return [];
  }
}

// ─── Partner Multi-Select ───

let selectedPartnerIds = [...DEFAULT_PARTNER_IDS];

function getSelectedPartnerIds() {
  return selectedPartnerIds;
}

function updatePartnerLabel() {
  const label = document.getElementById('partnerLabel');
  const count = selectedPartnerIds.length;
  const total = KNOWN_PARTNERS.length;
  if (count === total) {
    label.textContent = 'All Partners';
  } else if (count === 0) {
    label.textContent = 'None selected';
  } else if (count <= 2) {
    label.textContent = selectedPartnerIds.map(id => {
      const p = KNOWN_PARTNERS.find(p => p.id === id);
      return p ? p.name : id;
    }).join(', ');
  } else {
    label.textContent = `${count} selected`;
  }
}

function renderPartnerOptions() {
  const container = document.getElementById('partnerOptions');
  container.innerHTML = KNOWN_PARTNERS.map(p => {
    const checked = selectedPartnerIds.includes(p.id) ? 'checked' : '';
    return `
      <label class="ms-option">
        <input type="checkbox" value="${p.id}" ${checked}>
        <span class="ms-checkbox"></span>
        <span class="ms-option-label">${p.name}</span>
      </label>
    `;
  }).join('');
}

function initPartnerMultiSelect() {
  const trigger = document.getElementById('partnerTrigger');
  const dropdown = document.getElementById('partnerDropdown');
  const multiSelect = document.getElementById('partnerMultiSelect');

  renderPartnerOptions();
  updatePartnerLabel();

  // Toggle dropdown
  trigger.addEventListener('click', () => {
    const isOpen = dropdown.style.display !== 'none';
    dropdown.style.display = isOpen ? 'none' : 'block';
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!multiSelect.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Select All
  document.getElementById('partnerSelectAll').addEventListener('click', () => {
    selectedPartnerIds = KNOWN_PARTNERS.map(p => p.id);
    renderPartnerOptions();
    updatePartnerLabel();
  });

  // Select None
  document.getElementById('partnerSelectNone').addEventListener('click', () => {
    selectedPartnerIds = [];
    renderPartnerOptions();
    updatePartnerLabel();
  });

  // Select Default 5
  document.getElementById('partnerSelectDefault').addEventListener('click', () => {
    selectedPartnerIds = [...DEFAULT_PARTNER_IDS];
    renderPartnerOptions();
    updatePartnerLabel();
  });

  // Apply button — read checkboxes, close dropdown, reload
  document.getElementById('partnerApply').addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('#partnerOptions input[type="checkbox"]');
    selectedPartnerIds = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    updatePartnerLabel();
    dropdown.style.display = 'none';
    loadData();
  });
}

// ─── Chart Factory ───

function makeTooltip() {
  const cd = chartDefaults();
  return {
    backgroundColor: cd.tooltipBg,
    titleColor: cd.tooltipText,
    bodyColor: cd.tooltipText,
    borderColor: cd.tooltipBorder,
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
    displayColors: true,
    callbacks: {
      label: ctx => {
        const label = ctx.dataset.label || ctx.label || '';
        const val = ctx.parsed?.y ?? ctx.parsed ?? ctx.raw;
        return `${label}: ${fmtFull(val)}`;
      },
    },
  };
}

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    charts[key] = null;
  }
}

// ─── Render Functions ───

function renderKPIs(data) {
  const { wpmTotals, spTotals, wpmDailyTrend, spDailyTrend } = data;

  const wpmTotal = Number(wpmTotals[0]?.total_blocked_events || 0);
  const spTotal = Number(spTotals[0]?.total_blocked_events || 0);
  const combined = wpmTotal + spTotal;

  const wpmDays = wpmDailyTrend.filter(d => Number(d.blocked_events) > 1000).length || 1;
  const spDays = spDailyTrend.filter(d => Number(d.blocked_events) > 1000).length || 1;
  const wpmDailyAvg = wpmTotal / wpmDays;
  const spDailyAvg = spTotal / spDays;
  const dailyRate = wpmDailyAvg + spDailyAvg;

  document.getElementById('kpiTotalBlocked').textContent = fmt(combined);
  document.getElementById('kpiTotalBlockedSub').textContent = `${fmtFull(combined)} total events`;
  document.getElementById('kpiWpmBlocked').textContent = fmt(wpmTotal);
  document.getElementById('kpiWpmBlockedSub').textContent = `${fmtFull(wpmTotal)} client-side`;
  document.getElementById('kpiSpBlocked').textContent = fmt(spTotal);
  document.getElementById('kpiSpBlockedSub').textContent = `${fmtFull(spTotal)} server-side`;
  document.getElementById('kpiDailyRate').textContent = fmt(dailyRate);
  document.getElementById('kpiShopsWpm').textContent = fmt(Number(wpmTotals[0]?.unique_shops || 0));
  document.getElementById('kpiShopsSp').textContent = fmt(Number(spTotals[0]?.unique_shops || 0));
}

function renderDailyTrend(data) {
  const cd = chartDefaults();
  destroyChart('dailyTrend');

  // Merge WPM and SP daily trends by date
  const dateMap = {};
  data.wpmDailyTrend.forEach(r => {
    dateMap[r.day] = dateMap[r.day] || { wpm: 0, sp: 0 };
    dateMap[r.day].wpm = Number(r.blocked_events);
  });
  data.spDailyTrend.forEach(r => {
    dateMap[r.day] = dateMap[r.day] || { wpm: 0, sp: 0 };
    dateMap[r.day].sp = Number(r.blocked_events);
  });

  const dates = Object.keys(dateMap).sort();
  const wpmVals = dates.map(d => dateMap[d].wpm);
  const spVals = dates.map(d => dateMap[d].sp);

  const sourceFilter = document.getElementById('sourceFilter').value;
  const datasets = [];

  if (sourceFilter === 'all' || sourceFilter === 'wpm') {
    datasets.push({
      label: 'WPM Blocked',
      data: wpmVals,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
    });
  }
  if (sourceFilter === 'all' || sourceFilter === 'sp') {
    datasets.push({
      label: 'SP Blocked',
      data: spVals,
      borderColor: '#a855f7',
      backgroundColor: 'rgba(168, 85, 247, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      pointHoverRadius: 5,
    });
  }

  charts.dailyTrend = new Chart(document.getElementById('dailyTrendChart'), {
    type: 'line',
    data: { labels: dates, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        tooltip: makeTooltip(),
        legend: { labels: { color: cd.textColor, usePointStyle: true, padding: 16 } },
      },
      scales: {
        x: {
          grid: { color: cd.gridColor },
          ticks: { color: cd.textColor, maxRotation: 45, autoSkip: true, maxTicksLimit: 15 },
        },
        y: {
          grid: { color: cd.gridColor },
          ticks: { color: cd.textColor, callback: v => fmt(v) },
        },
      },
    },
  });
}

function renderPartnerBar(data) {
  const cd = chartDefaults();
  destroyChart('partnerBar');

  // Merge WPM + SP by partner
  const merged = {};
  data.wpmByPartner.forEach(r => {
    const name = partnerIdToName(r.api_client_id);
    merged[name] = merged[name] || { wpm: 0, sp: 0 };
    merged[name].wpm = Number(r.blocked_events);
  });
  data.spByPartner.forEach(r => {
    const name = partnerIdToName(r.api_client_id);
    merged[name] = merged[name] || { wpm: 0, sp: 0 };
    merged[name].sp = Number(r.blocked_events);
  });

  const partners = Object.keys(merged).sort((a, b) =>
    (merged[b].wpm + merged[b].sp) - (merged[a].wpm + merged[a].sp)
  );

  const sourceFilter = document.getElementById('sourceFilter').value;
  const datasets = [];

  if (sourceFilter === 'all' || sourceFilter === 'wpm') {
    datasets.push({
      label: 'WPM',
      data: partners.map(p => merged[p].wpm),
      backgroundColor: '#3b82f6',
      borderRadius: 4,
    });
  }
  if (sourceFilter === 'all' || sourceFilter === 'sp') {
    datasets.push({
      label: 'SP',
      data: partners.map(p => merged[p].sp),
      backgroundColor: '#a855f7',
      borderRadius: 4,
    });
  }

  charts.partnerBar = new Chart(document.getElementById('partnerBarChart'), {
    type: 'bar',
    data: { labels: partners, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: makeTooltip(),
        legend: { labels: { color: cd.textColor, usePointStyle: true, padding: 16 } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: cd.textColor } },
        y: { grid: { color: cd.gridColor }, ticks: { color: cd.textColor, callback: v => fmt(v) } },
      },
    },
  });
}

function renderPartnerDonut(data) {
  const cd = chartDefaults();
  destroyChart('partnerDonut');

  const merged = {};
  const sourceFilter = document.getElementById('sourceFilter').value;

  if (sourceFilter === 'all' || sourceFilter === 'wpm') {
    data.wpmByPartner.forEach(r => {
      const name = partnerIdToName(r.api_client_id);
      merged[name] = (merged[name] || 0) + Number(r.blocked_events);
    });
  }
  if (sourceFilter === 'all' || sourceFilter === 'sp') {
    data.spByPartner.forEach(r => {
      const name = partnerIdToName(r.api_client_id);
      merged[name] = (merged[name] || 0) + Number(r.blocked_events);
    });
  }

  const sorted = Object.entries(merged).sort((a, b) => b[1] - a[1]);

  charts.partnerDonut = new Chart(document.getElementById('partnerDonutChart'), {
    type: 'doughnut',
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [{
        data: sorted.map(([, v]) => v),
        backgroundColor: CHART_COLORS.slice(0, sorted.length),
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        tooltip: {
          ...makeTooltip(),
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              return `${ctx.label}: ${fmtFull(ctx.raw)} (${pct(ctx.raw, total)})`;
            },
          },
        },
        legend: {
          position: 'bottom',
          labels: { color: cd.textColor, usePointStyle: true, padding: 12, font: { size: 12 } },
        },
      },
    },
  });
}

function renderEventTypeChart(data) {
  const cd = chartDefaults();
  destroyChart('eventType');

  const rows = data.wpmByEventName.slice(0, 10);
  const labels = rows.map(r => r.event_name);
  const values = rows.map(r => Number(r.blocked_events));

  charts.eventType = new Chart(document.getElementById('eventTypeChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Blocked Events',
        data: values,
        backgroundColor: CHART_COLORS.slice(0, labels.length).map(c => c + '99'),
        borderColor: CHART_COLORS.slice(0, labels.length),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        tooltip: makeTooltip(),
        legend: { display: false },
      },
      scales: {
        x: { grid: { color: cd.gridColor }, ticks: { color: cd.textColor, callback: v => fmt(v) } },
        y: { grid: { display: false }, ticks: { color: cd.textColor } },
      },
    },
  });
}

function renderSpPctBlockedPartner(data) {
  const cd = chartDefaults();
  destroyChart('spPctBlockedPartner');

  // Build delivered lookup
  const deliveredMap = {};
  data.spDeliveredByPartner.forEach(r => {
    deliveredMap[String(r.api_client_id)] = Number(r.delivered_events);
  });

  // Build rows: partner name, blocked count, delivered count, % blocked
  const rows = [];
  data.spByPartner.forEach(r => {
    const id = String(r.api_client_id);
    const blocked = Number(r.blocked_events);
    const delivered = deliveredMap[id] || 0;
    const total = delivered + blocked;
    if (total === 0) return;
    rows.push({
      name: partnerIdToName(id),
      blocked,
      delivered,
      total,
      pctBlocked: (blocked / total) * 100,
    });
  });

  rows.sort((a, b) => b.pctBlocked - a.pctBlocked);

  charts.spPctBlockedPartner = new Chart(document.getElementById('spPctBlockedPartnerChart'), {
    type: 'bar',
    data: {
      labels: rows.map(r => r.name),
      datasets: [{
        label: '% Blocked',
        data: rows.map(r => r.pctBlocked),
        backgroundColor: rows.map(r => r.pctBlocked > 50 ? '#ef4444cc' : '#a855f7cc'),
        borderColor: rows.map(r => r.pctBlocked > 50 ? '#ef4444' : '#a855f7'),
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        tooltip: {
          ...makeTooltip(),
          callbacks: {
            label: ctx => {
              const r = rows[ctx.dataIndex];
              return `${r.pctBlocked.toFixed(1)}% blocked (${fmtFull(r.blocked)} / ${fmtFull(r.total)})`;
            },
          },
        },
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: cd.gridColor },
          ticks: { color: cd.textColor, callback: v => v + '%' },
          max: 100,
        },
        y: { grid: { display: false }, ticks: { color: cd.textColor } },
      },
    },
  });
}

function renderSurfaceChart(data) {
  const cd = chartDefaults();
  destroyChart('surface');

  const rows = data.wpmBySurface;
  const labels = rows.map(r => SURFACE_LABELS[r.surface] || r.surface);
  const values = rows.map(r => Number(r.blocked_events));

  charts.surface = new Chart(document.getElementById('surfaceChart'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#3b82f6', '#f97316', '#22c55e', '#a855f7'],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        tooltip: {
          ...makeTooltip(),
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              return `${ctx.label}: ${fmtFull(ctx.raw)} (${pct(ctx.raw, total)})`;
            },
          },
        },
        legend: {
          position: 'bottom',
          labels: { color: cd.textColor, usePointStyle: true, padding: 12, font: { size: 12 } },
        },
      },
    },
  });
}

function renderPctBlockedChart(data) {
  const cd = chartDefaults();
  destroyChart('pctBlocked');

  // Map emitted and blocked by partner
  const emitMap = {};
  data.wpmEmittedByPartner.forEach(r => {
    emitMap[r.api_client_id] = Number(r.emitted_events);
  });
  const blockMap = {};
  data.wpmBlockedByPartnerForPct.forEach(r => {
    blockMap[r.api_client_id] = Number(r.blocked_events);
  });

  const activePartners = KNOWN_PARTNERS.filter(p => selectedPartnerIds.includes(p.id));
  const rows = activePartners
    .map(p => {
      const emitted = emitMap[p.id] || 0;
      const blocked = blockMap[p.id] || 0;
      const total = emitted + blocked;
      const pctBlocked = total > 0 ? (blocked / total) * 100 : 0;
      return { name: p.name, emitted, blocked, total, pctBlocked };
    })
    .filter(r => r.total > 0)
    .sort((a, b) => b.pctBlocked - a.pctBlocked);

  charts.pctBlocked = new Chart(document.getElementById('pctBlockedChart'), {
    type: 'bar',
    data: {
      labels: rows.map(r => r.name),
      datasets: [
        {
          label: 'Emitted (Allowed)',
          data: rows.map(r => r.emitted),
          backgroundColor: '#22c55e',
          borderRadius: 4,
        },
        {
          label: 'Blocked',
          data: rows.map(r => r.blocked),
          backgroundColor: '#ef4444',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          ...makeTooltip(),
          callbacks: {
            afterBody: items => {
              const idx = items[0].dataIndex;
              const r = rows[idx];
              return `\n% Blocked: ${r.pctBlocked.toFixed(1)}%\nTotal: ${fmtFull(r.total)}`;
            },
          },
        },
        legend: { labels: { color: cd.textColor, usePointStyle: true, padding: 16 } },
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { color: cd.textColor } },
        y: { stacked: true, grid: { color: cd.gridColor }, ticks: { color: cd.textColor, callback: v => fmt(v) } },
      },
    },
  });
}

function renderPartnerTable(data) {
  const tbody = document.getElementById('partnerTableBody');
  const days = parseInt(document.getElementById('dateRange').value);
  const durationLabel = days === 1 ? 'Last 24h' : `Last ${days}d`;

  // Build emitted lookup for WPM % blocked
  const emitMap = {};
  data.wpmEmittedByPartner.forEach(r => {
    emitMap[String(r.api_client_id)] = Number(r.emitted_events);
  });

  // Build delivered lookup for SP % blocked
  const spDeliveredMap = {};
  data.spDeliveredByPartner.forEach(r => {
    spDeliveredMap[String(r.api_client_id)] = Number(r.delivered_events);
  });

  // Merge WPM + SP partner data by ID (not name) to keep ID for emit lookup
  const merged = {};
  data.wpmByPartner.forEach(r => {
    const id = String(r.api_client_id);
    merged[id] = merged[id] || { wpm: 0, sp: 0, shops: 0, days: 0 };
    merged[id].wpm = Number(r.blocked_events);
    merged[id].shops = Number(r.unique_shops);
    merged[id].days = Number(r.active_days);
  });
  data.spByPartner.forEach(r => {
    const id = String(r.api_client_id);
    merged[id] = merged[id] || { wpm: 0, sp: 0, shops: 0, days: 0 };
    merged[id].sp = Number(r.blocked_events);
  });

  const sorted = Object.entries(merged).sort((a, b) => (b[1].wpm + b[1].sp) - (a[1].wpm + a[1].sp));

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No data available</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(([id, r]) => {
    const name = partnerIdToName(id);
    const emitted = emitMap[id] || 0;
    const wpmTotal = emitted + r.wpm;
    const wpmPct = wpmTotal > 0 ? ((r.wpm / wpmTotal) * 100).toFixed(1) : null;
    const wpmCell = wpmPct !== null
      ? `${fmtFull(r.wpm)} <span class="pct-inline ${Number(wpmPct) > 50 ? 'pct-inline-warn' : ''}">(${wpmPct}%)</span>`
      : fmtFull(r.wpm);
    const spDelivered = spDeliveredMap[id] || 0;
    const spTotal = spDelivered + r.sp;
    const spPct = spTotal > 0 ? ((r.sp / spTotal) * 100).toFixed(1) : null;
    const spCell = spPct !== null
      ? `${fmtFull(r.sp)} <span class="pct-inline ${Number(spPct) > 50 ? 'pct-inline-warn' : ''}">(${spPct}%)</span>`
      : fmtFull(r.sp);
    return `
      <tr>
        <td><strong>${name}</strong></td>
        <td class="num">${wpmCell}</td>
        <td class="num">${spCell}</td>
        <td class="num">${fmtFull(r.shops)}</td>
        <td class="num">${durationLabel}</td>
      </tr>
    `;
  }).join('');
}

// ─── Main Data Load ───

async function loadData() {
  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const refreshBtn = document.getElementById('refreshBtn');

  overlay.style.display = 'flex';
  refreshBtn.classList.add('loading');

  const days = parseInt(document.getElementById('dateRange').value);
  const partnerIds = getSelectedPartnerIds();
  if (partnerIds.length === 0) {
    overlay.style.display = 'none';
    refreshBtn.classList.remove('loading');
    return;
  }
  const queries = buildQueries(days, partnerIds);

  try {
    // Run queries in parallel batches to avoid overload
    loadingText.textContent = 'Querying totals...';
    const [wpmTotals, spTotalsRaw, wpmDailyTrend, spDailyTrend] = await Promise.all([
      runQuery(queries.wpmTotals, 'wpmTotals'),
      runQuery(queries.spTotals, 'spTotals'),
      runQuery(queries.wpmDailyTrend, 'wpmDailyTrend'),
      runQuery(queries.spDailyTrend, 'spDailyTrend'),
    ]);

    loadingText.textContent = 'Querying partner breakdowns...';
    const [wpmByPartner, spByPartner, wpmByEventName, wpmBySurface] = await Promise.all([
      runQuery(queries.wpmByPartner, 'wpmByPartner'),
      runQuery(queries.spByPartner, 'spByPartner'),
      runQuery(queries.wpmByEventName, 'wpmByEventName'),
      runQuery(queries.wpmBySurface, 'wpmBySurface'),
    ]);

    loadingText.textContent = 'Querying emit vs blocked...';
    const [wpmEmittedByPartner, wpmBlockedByPartnerForPct, spDeliveredByPartner] = await Promise.all([
      runQuery(queries.wpmEmittedByPartner, 'wpmEmittedByPartner'),
      runQuery(queries.wpmBlockedByPartnerForPct, 'wpmBlockedByPartnerForPct'),
      runQuery(queries.spDeliveredByPartner, 'spDeliveredByPartner'),
    ]);

    const allData = {
      wpmTotals,
      spTotals: spTotalsRaw,
      wpmDailyTrend,
      spDailyTrend,
      wpmByPartner,
      spByPartner,
      wpmByEventName,
      wpmBySurface,
      wpmEmittedByPartner,
      wpmBlockedByPartnerForPct,
      spDeliveredByPartner,
    };

    // Render everything
    loadingText.textContent = 'Rendering charts...';
    renderKPIs(allData);
    renderDailyTrend(allData);
    renderPartnerBar(allData);
    renderPartnerDonut(allData);
    renderEventTypeChart(allData);
    renderSpPctBlockedPartner(allData);
    renderSurfaceChart(allData);
    renderPctBlockedChart(allData);
    renderPartnerTable(allData);

    // Update timestamp
    const now = new Date();
    document.getElementById('lastUpdated').textContent =
      `Last updated: ${now.toLocaleTimeString()} on ${now.toLocaleDateString()}`;

  } catch (err) {
    console.error('Dashboard load failed:', err);
    loadingText.textContent = 'Error loading data. Check console.';
    await new Promise(r => setTimeout(r, 2000));
  } finally {
    overlay.style.display = 'none';
    refreshBtn.classList.remove('loading');
  }
}

// ─── SQL Modal ───

const QUERY_LABELS = {
  wpmTotals: 'WPM: Total Blocked Events',
  spTotals: 'SP: Total Blocked Events',
  spTotalsFiltered: 'SP: Total Blocked Events (Filtered)',
  wpmByPartner: 'WPM: Blocked by Partner',
  spByPartner: 'SP: Blocked by Partner',
  wpmDailyTrend: 'WPM: Daily Trend',
  spDailyTrend: 'SP: Daily Trend',
  wpmByEventName: 'WPM: Blocked by Event Name',
  wpmBySurface: 'WPM: Blocked by Surface',
  wpmEmittedByPartner: 'WPM: Emitted Events per Partner',
  wpmBlockedByPartnerForPct: 'WPM: Blocked per Partner (for % calc)',
  spDeliveredByPartner: 'SP: Delivered Events per Partner (for % calc)',
};

function formatSql(sql) {
  return sql.replace(/^\s+/gm, '').replace(/^\n+/, '').replace(/\n+$/, '');
}

function openSqlModal(queryKeys) {
  const days = parseInt(document.getElementById('dateRange').value);
  const partnerIds = getSelectedPartnerIds();
  const queries = buildQueries(days, partnerIds);
  const modal = document.getElementById('sqlModal');
  const body = document.getElementById('sqlModalBody');

  const blocks = queryKeys
    .map(key => {
      const sql = queries[key];
      if (!sql) return '';
      const label = QUERY_LABELS[key] || key;
      return `
        <div class="sql-block">
          <div class="sql-block-header">
            <span class="sql-block-label">${label}</span>
            <button class="btn-copy-sm" data-sql-key="${key}">Copy</button>
          </div>
          <pre>${escapeHtml(formatSql(sql))}</pre>
        </div>
      `;
    })
    .filter(Boolean)
    .join('');

  body.innerHTML = blocks;
  modal.style.display = 'flex';

  // Per-block copy buttons
  body.querySelectorAll('.btn-copy-sm').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-sql-key');
      const sql = formatSql(queries[key]);
      navigator.clipboard.writeText(sql).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
      });
    });
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function initSqlModal() {
  const modal = document.getElementById('sqlModal');

  // Close handlers
  document.getElementById('sqlModalClose').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.style.display = 'none';
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      modal.style.display = 'none';
    }
  });

  // Copy All
  document.getElementById('sqlCopyAll').addEventListener('click', () => {
    const allSql = Array.from(document.querySelectorAll('#sqlModalBody pre'))
      .map(pre => pre.textContent)
      .join('\n\n-- ───────────────────\n\n');
    navigator.clipboard.writeText(allSql).then(() => {
      const btn = document.getElementById('sqlCopyAll');
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = 'Copy All'; btn.classList.remove('copied'); }, 1500);
    });
  });

  // Attach to all SQL buttons
  document.querySelectorAll('.btn-sql').forEach(btn => {
    btn.addEventListener('click', () => {
      const keys = btn.getAttribute('data-queries').split(',');
      openSqlModal(keys);
    });
  });
}

// ─── Init ───

async function init() {
  initTheme();
  initPartnerMultiSelect();
  initSqlModal();

  // Auth check
  const authed = await checkAuth();

  document.getElementById('authBtn')?.addEventListener('click', async () => {
    await checkAuth();
    if (isAuthed) loadData();
  });

  // Controls
  document.getElementById('refreshBtn').addEventListener('click', loadData);
  document.getElementById('dateRange').addEventListener('change', loadData);
  document.getElementById('sourceFilter').addEventListener('change', loadData);

  if (authed) {
    loadData();
  }
}

init();
