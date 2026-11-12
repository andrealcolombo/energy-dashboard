// ---------- tabs and controls (listen + set attributes only) ----------
(function () {
  const tabs = document.querySelectorAll('.ed .tab');
  const show = (id) => {
    document.querySelectorAll('.ed [data-section]').forEach((s) => { s.hidden = s.id !== id; });
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === id)));
    dash.setLink(id);
  };
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
  const h = (location.hash || '').slice(1);
  if (h && document.getElementById(h) && document.getElementById(h).hasAttribute('data-section')) show(h);

  document.querySelectorAll('.ed [data-range]').forEach((b) => b.addEventListener('click', () => {
    EDS.range = +b.dataset.range;
    document.querySelectorAll('.ed [data-range]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    dash.draw('price-daily');
  }));
})();

// ---------- shared lookups ----------
window.EDL = {
  row: (id, key, val) => { const k = dash.data(id); return k.status === 'ok' && Array.isArray(k.data) ? k.data.find((r) => r[key] === val) : null; },
  period: (p) => (p ? (p.endsWith('S1') ? 'H1 ' : 'H2 ') + p.slice(0, 4) : ''),
  label: (a) => (a.includes('_') && a !== 'IE_SEM' ? a.replace('_', ' ') : ED.name(a === 'IE_SEM' ? 'IE' : a)),
  countries: () => { const d = dash.data('prices_daily'); const cs = d.status === 'ok' ? Array.from(new Set(d.data.filter((r) => r.level !== 'zone').map((r) => r.area))) : ['EU27']; return cs.sort((a, b) => (a === 'EU27' ? -1 : b === 'EU27' ? 1 : ED.name(a).localeCompare(ED.name(b), 'en'))); },
};

// ---------- headline and ticker ----------
(function () {
  const {f, chgSpan} = ED, {row} = EDL;
  const C = () => EDS.country;
  const fk = () => (C() === 'EU27' ? 'EU' : C());
  const TICK = ['t-whole', 't-whole-date', 't-whole-chg', 't-relec', 't-relec-per', 't-relec-chg', 't-rgas', 't-rgas-per', 't-rgas-chg', 't-dsl', 't-dsl-per', 't-dsl-chg'];
  const MIX = ['mix-country', 'ytd-period', 'pie-cur-title', 'pie-2021-title', 'pie-cur', 'pie-2021', 'mix-change', 'mix-stack', 'load-chart', 'wk-period', 'week-pie', 'week-note'];

  dash.draw('country-select', (sel) => {
    sel.replaceChildren(...EDL.countries().map((c) => new Option(ED.name(c), c)));
    sel.value = EDS.country;
    sel.onchange = () => { EDS.country = sel.value; TICK.concat(MIX).forEach((n) => dash.draw(n)); };
  });

  dash.draw('headline', (el) => {
    const r = row('kpi_power', 'area', 'EU27'), n = row('nl_latest', 'indicator', 'gas_ttf');
    if (!r || r.avg7 === null) { el.textContent = '—'; return; }
    let s = `Over the last 7 days, day-ahead electricity in the EU27 averaged ${f.n0(r.avg7)} €/MWh`;
    if (Number.isFinite(r.chg_pct)) s += ` (${f.p1(r.chg_pct)}% on the week before)`;
    s += '.';
    if (n) s += ` TTF gas was at ${f.n0(+n.value)} €/MWh in the week to ${ED.dayFmt(ED.parseDay(n.week_end))}.`;
    el.textContent = s;
  });

  const kp = () => row('kpi_power', 'area', C());
  dash.draw('t-whole', (el) => { el.dataset.where = 'area=' + C(); const r = kp(); el.textContent = r && r.last_day !== null ? f.n1(r.last_day) : '—'; });
  dash.draw('t-whole-date', (el) => { const r = kp(); el.textContent = r ? ED.dayShort(ED.parseDay(r.last_date)) : '—'; });
  dash.draw('t-whole-chg', (el) => { const r = kp(); chgSpan(el, r ? r.day_chg_pct : NaN, {suffix: 'd/d'}); el.classList.add('c'); });

  const rt = () => row('retail_latest', 'geo', C());
  dash.draw('t-relec', (el) => { el.dataset.where = 'geo=' + C(); const r = rt(); el.textContent = r && r.elec_eur_mwh !== null ? f.n0(r.elec_eur_mwh) : '—'; });
  dash.draw('t-relec-per', (el) => { const r = rt(); el.textContent = r ? EDL.period(r.elec_period) : '—'; });
  dash.draw('t-relec-chg', (el) => { const r = rt(); chgSpan(el, r ? r.elec_yoy_pct : NaN, {suffix: 'y/y', empty: 'n/a'}); el.classList.add('c'); });
  dash.draw('t-rgas', (el) => { el.dataset.where = 'geo=' + C(); const r = rt(); el.textContent = r && r.gas_eur_mwh !== null ? f.n0(r.gas_eur_mwh) : '—'; });
  dash.draw('t-rgas-per', (el) => { const r = rt(); el.textContent = r ? EDL.period(r.gas_period) : '—'; });
  dash.draw('t-rgas-chg', (el) => { const r = rt(); chgSpan(el, r ? r.gas_yoy_pct : NaN, {suffix: 'y/y', empty: 'n/a'}); el.classList.add('c'); });

  const fu = () => row('fuels_latest', 'country', fk());
  dash.draw('t-dsl', (el) => { el.dataset.where = 'country=' + fk(); const r = fu(); el.textContent = r && r.diesel !== null ? f.n2(r.diesel) : '—'; });
  dash.draw('t-dsl-per', (el) => { const r = fu(); el.textContent = r ? ED.dayShort(ED.parseDay(r.date)) : '—'; });
  dash.draw('t-dsl-chg', (el) => { const r = fu(); chgSpan(el, r ? r.diesel_wow_pct : NaN, {suffix: 'w/w'}); el.classList.add('c'); });

  const nl = (k) => row('nl_latest', 'indicator', k);
  const wk = (r) => (r ? 'w/e ' + ED.dayShort(ED.parseDay(r.week_end)) : '—');
  dash.draw('t-ttf', (el) => { const r = nl('gas_ttf'); el.textContent = r ? f.n0(+r.value) : '—'; });
  dash.draw('t-ttf-per', (el) => { el.textContent = wk(nl('gas_ttf')); });
  dash.draw('t-ttf-chg', (el) => { const r = nl('gas_ttf'); chgSpan(el, r ? ED.num(r.wow_pct) : NaN, {suffix: 'w/w'}); el.classList.add('c'); });
  dash.draw('t-sto', (el) => { const r = nl('gas_storage'); el.textContent = r ? f.n0(+r.value) : '—'; });
  dash.draw('t-sto-per', (el) => { el.textContent = wk(nl('gas_storage')); });
  dash.draw('t-sto-chg', (el) => { const r = nl('gas_storage'); chgSpan(el, r ? ED.num(r.wow_pct) : NaN, {unit: ' pp', suffix: 'w/w', upIsGood: true}); el.classList.add('c'); });
})();

// ---------- Electricity prices ----------
(function () {
  const {label} = EDL;
  const colorFor = (a) => { const i = EDS.areas.indexOf(a); return dash.colors[i % dash.colors.length]; };
  const redraw = () => ['area-chips', 'price-daily', 'price-monthly', 'price-neg', 'retail-chart'].forEach((n) => dash.draw(n));

  dash.draw('area-chips', (el) => {
    el.replaceChildren();
    const d = dash.data('prices_daily');
    const rows = d.status === 'ok' ? d.data : [];
    EDS.areas.forEach((a) => {
      const b = document.createElement('button'); b.className = 'chip sel'; b.setAttribute('aria-pressed', 'true'); b.textContent = label(a); b.title = 'Remove ' + label(a);
      const sw = document.createElement('i'); sw.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${colorFor(a)}`; b.prepend(sw);
      b.onclick = () => { EDS.areas = EDS.areas.filter((x) => x !== a); redraw(); };
      el.append(b);
    });
    const zones = Array.from(new Set(rows.filter((r) => r.level === 'zone').map((r) => r.area))).sort();
    const mk = (title, list, lab) => { const sel = document.createElement('select'); sel.className = 'dash-select'; sel.setAttribute('aria-label', title); sel.append(new Option(title, '')); list.filter((a) => !EDS.areas.includes(a)).forEach((a) => sel.append(new Option(lab(a), a))); sel.onchange = () => { if (sel.value) { EDS.areas = EDS.areas.concat(sel.value).slice(-6); redraw(); } }; return sel; };
    el.append(mk('+ country', EDL.countries(), (a) => ED.name(a)), mk('+ bidding zone', zones, (a) => a.replace('_', ' ')));
  });

  dash.draw('price-daily', (el) => {
    const d = dash.data('prices_daily');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const last = d3.max(d.data, (r) => r.date); if (!last) { ED.placeholder(el, 'empty', 'No data'); return; }
    const from = new Date(Date.parse(last) - (EDS.range - 1) * 86400000).toISOString().slice(0, 10);
    const ser = EDS.areas.map((a) => ({label: label(a), color: colorFor(a), width: a === 'EU27' ? 2.2 : 1.4, values: d.data.filter((r) => r.area === a && r.date >= from).map((r) => ({x: ED.parseDay(r.date), y: +r.avg_eur_mwh}))}));
    ED.lineChart(el, ser, {unit: '€/MWh', legend: true, xTick: EDS.range <= 90 ? ED.dayShort : (x) => ED.mLabel(x), empty: 'Pick at least one area'});
  });

  dash.draw('price-monthly', (el) => {
    const d = dash.data('prices_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const ser = EDS.areas.map((a) => ({label: label(a), color: colorFor(a), width: a === 'EU27' ? 2.2 : 1.4, values: d.data.filter((r) => r.area === a).map((r) => ({x: ED.parseMonth(r.month), y: +r.avg_eur_mwh}))}));
    const ref = d3.mean(d.data.filter((r) => r.area === 'EU27' && r.month >= '2021-01' && r.month <= '2021-06'), (r) => +r.avg_eur_mwh);
    ED.lineChart(el, ser, {unit: '€/MWh', legend: true, refY: ref, tipX: (x) => ED.mLabel(x), empty: 'Pick at least one area'});
  });

  dash.draw('retail-chart', (el) => {
    const d = dash.data('retail_semiannual');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const toDate = (p) => new Date(Date.UTC(+p.slice(0, 4), p.endsWith('S1') ? 0 : 6, 1));
    const ser = EDS.areas.filter((a) => !a.includes('_')).map((a) => ({label: label(a), color: colorFor(a), width: a === 'EU27' ? 2.2 : 1.4, values: d.data.filter((r) => r.geo === a && r.product === 'electricity').map((r) => ({x: toDate(r.period), y: 1000 * Number(r.eur_per_kwh)})).sort((x, y) => x.x - y.x)}));
    ED.lineChart(el, ser, {height: 200, unit: '€/MWh', legend: true, tipX: (x) => (x.getUTCMonth() ? 'H2 ' : 'H1 ') + x.getUTCFullYear(), xTick: (x) => (x.getUTCMonth() === 0 ? String(x.getUTCFullYear()) : ''), empty: 'No country selected (bidding zones have no retail price)'});
  });

  dash.draw('price-neg', (el) => {
    const d = dash.data('prices_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const ser = EDS.areas.filter((a) => a !== 'EU27').map((a) => ({label: label(a), color: colorFor(a), values: d.data.filter((r) => r.area === a).map((r) => ({x: ED.parseMonth(r.month), y: +r.negative_hours}))}));
    ED.lineChart(el, ser, {height: 200, unit: 'h', legend: true, tipFmt: ED.f.n0, tipX: (x) => ED.mLabel(x), empty: 'Pick a country or a bidding zone (not computed for the EU27)'});
  });
})();

// ---------- Generation mix ----------
(function () {
  const C = () => EDS.country;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const ytdRows = () => { const a = dash.data('mix_ytd'); return a.status === 'ok' && Array.isArray(a.data) ? a.data.filter((r) => r.country === C()) : []; };
  const period = (r) => 'January–' + MONTHS[+r.last_month.slice(5) - 1];

  dash.draw('mix-country', (el) => { el.textContent = ED.name(C()); });
  dash.draw('mix-legend', (el) => {
    el.replaceChildren();
    ED.MIXORDER.forEach((g) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = ED.MIXC[g]; sp.append(i, document.createTextNode(g)); el.append(sp); });
  });
  dash.draw('ytd-period', (el) => { const r = ytdRows()[0]; el.textContent = r ? period(r) : '—'; });
  dash.draw('pie-cur-title', (el) => { const r = ytdRows()[0]; el.textContent = r ? period(r) + ' ' + r.cur_year : '—'; });
  dash.draw('pie-2021-title', (el) => { const r = ytdRows()[0]; el.textContent = r ? period(r) + ' 2021' : '—'; });
  const pieOf = (el, field) => {
    const a = dash.data('mix_ytd');
    if (a.status !== 'ok') { ED.placeholder(el, a.status); return; }
    const v = ytdRows(); const res = v.find((r) => r.group === 'Renewables (total)');
    ED.pie(el, ED.MIXORDER.map((g) => { const r = v.find((x) => x.group === g); return {label: g, value: r && r[field] !== null ? +r[field] : 0, color: ED.MIXC[g]}; }), {center: res && res[field] !== null ? 'renewables ' + ED.f.n0(res[field]) + '%' : '', empty: 'No data for this period'});
  };
  dash.draw('pie-cur', (el) => pieOf(el, 'ycur'));
  dash.draw('pie-2021', (el) => pieOf(el, 'y2021'));

  dash.draw('mix-change', (el) => {
    const a = dash.data('mix_ytd');
    if (a.status !== 'ok') { ED.placeholder(el, a.status); return; }
    const v = ytdRows().filter((r) => r.d_2021 !== null && ((r.ycur || 0) + (r.y2021 || 0)) > 0.3);
    const order = ['Renewables (total)'].concat(ED.MIXORDER);
    ED.divBars(el, v.sort((x, y) => order.indexOf(x.group) - order.indexOf(y.group)).map((r) => ({label: r.group, value: +r.d_2021, color: r.group.startsWith('Renewables') ? 'var(--color-fg)' : ED.MIXC[r.group]})), {unit: ' pp'});
  });

  dash.draw('mix-stack', (el) => {
    const d = dash.data('mix_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const v = d.data.filter((r) => r.country === C());
    const rows = Array.from(d3.group(v, (r) => r.month), ([m, g]) => { const tot = d3.sum(g, (r) => +r.gwh); const parts = {}; g.forEach((r) => { parts[r.group] = 100 * (+r.gwh) / tot; }); return {x: ED.parseMonth(m), parts, total: tot}; }).sort((a, b) => a.x - b.x);
    ED.stackChart(el, rows, ED.MIXORDER, ED.MIXC);
  });

  dash.draw('load-chart', (el) => {
    const d = dash.data('load_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const v = d.data.filter((r) => r.country === C()).sort((a, b) => (a.month < b.month ? -1 : 1));
    if (!v.length) { ED.placeholder(el, 'empty', 'No data for this country'); return; }
    const ser = [{label: 'Demand', color: dash.colors[0], width: 2, values: v.map((r) => ({x: ED.parseMonth(r.month), y: +r.gwh / 1000}))},
      {label: 'Same month, year before', color: 'var(--cds-chart-muted)', dash: '4 3', values: v.map((r) => { const py = (+r.month.slice(0, 4) - 1) + r.month.slice(4); const p = v.find((x) => x.month === py); return {x: ED.parseMonth(r.month), y: p ? +p.gwh / 1000 : NaN}; })}];
    ED.lineChart(el, ser, {height: 200, unit: 'TWh', zero: false, tipX: (x) => ED.mLabel(x)});
  });

  const wk = () => { const d = dash.data('mix_weekly'); return d.status === 'ok' ? d.data.filter((r) => r.country === C()) : []; };
  dash.draw('wk-period', (el) => { const r = wk().find((x) => x.period === 'last_7'); el.textContent = r ? '· ' + ED.dayShort(ED.parseDay(r.from)) + '–' + ED.dayFmt(ED.parseDay(r.to)) : ''; });
  dash.draw('week-pie', (el) => {
    const d = dash.data('mix_weekly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const v = wk().filter((r) => r.period === 'last_7');
    ED.pie(el, ED.MIXORDER.map((g) => { const r = v.find((x) => x.group === g); return {label: g, value: r ? +r.share_pct : 0, color: ED.MIXC[g]}; }), {center: 'last 7 days', empty: 'No recent data for this country'});
  });
  dash.draw('week-note', (el) => {
    const v = wk(); const sh = (p, gs) => d3.sum(v.filter((r) => r.period === p && gs.includes(r.group)), (r) => +r.share_pct);
    if (!v.length) { el.textContent = '—'; return; }
    const dr = sh('last_7', ED.RES) - sh('prev_28', ED.RES), dg = sh('last_7', ['Gas']) - sh('prev_28', ['Gas']);
    el.textContent = `Renewables ${ED.f.n0(sh('last_7', ED.RES))}% (${ED.f.p1(dr)} pp on the previous 4 weeks), gas ${ED.f.n0(sh('last_7', ['Gas']))}% (${ED.f.p1(dg)} pp). Less wind and sun and more gas usually explain a price rise.`;
  });
})();

// ---------- Country profile ----------
(function () {
  const IND = [
    {id: 'w7', label: 'Wholesale price, 7 days', unit: '€/MWh', fmt: ED.f.n1},
    {id: 'wytd', label: 'Wholesale price, year to date', unit: '€/MWh', fmt: ED.f.n1},
    {id: 'vol30', label: 'Wholesale volatility, 30 days', unit: '€/MWh (std. dev.)', fmt: ED.f.n1},
    {id: 'neg_ytd', label: 'Negative-price hours, YTD', unit: 'h', fmt: ED.f.n0},
    {id: 're_el', label: 'Household electricity', unit: '€/MWh', fmt: ED.f.n0},
    {id: 're_gas', label: 'Household gas', unit: '€/MWh', fmt: ED.f.n0},
    {id: 'diesel', label: 'Diesel', unit: '€/l', fmt: ED.f.n2},
    {id: 'petrol', label: 'Petrol 95', unit: '€/l', fmt: ED.f.n2},
    {id: 'res_1m', label: 'Renewables share, last month', unit: '%', fmt: ED.f.n1},
    {id: 'res_12m', label: 'Renewables share, 12 months', unit: '%', fmt: ED.f.n1},
    {id: 'solar_12m', label: 'Solar share, 12 months', unit: '%', fmt: ED.f.n1},
    {id: 'wind_12m', label: 'Wind share, 12 months', unit: '%', fmt: ED.f.n1},
    {id: 'hydro_12m', label: 'Hydro share, 12 months', unit: '%', fmt: ED.f.n1},
    {id: 'nuclear_12m', label: 'Nuclear share, 12 months', unit: '%', fmt: ED.f.n1},
    {id: 'gas_12m', label: 'Gas share, 12 months', unit: '%', fmt: ED.f.n1},
    {id: 'coal_12m', label: 'Coal share, 12 months', unit: '%', fmt: ED.f.n1},
  ];
  const P = () => EDS.profile;
  const val = (c, id) => { const r = EDL.row('profile', 'key', c + '|' + id); return r ? Number(r.value) : NaN; };
  const axes = () => IND.filter((i) => EDS.ind.includes(i.id)).map((i) => {
    const a = val(P(), i.id), e = val('EU27', i.id);
    const ratio = Number.isFinite(a) && Number.isFinite(e) && e !== 0 ? a / e : NaN;
    return {...i, a, e, ratio, text: `${i.label}: ${ED.name(P())} ${Number.isFinite(a) ? i.fmt(a) : 'n/a'} · EU27 ${Number.isFinite(e) ? i.fmt(e) : 'n/a'} ${i.unit}`};
  });
  const redraw = () => ['ind-chips', 'spider', 'spider-pick', 'profile-table', 'profile-head'].forEach((n) => dash.draw(n));

  dash.draw('profile-select', (sel) => {
    const cs = EDL.countries().filter((c) => c !== 'EU27');
    sel.replaceChildren(...cs.map((c) => new Option(ED.name(c), c)));
    sel.value = EDS.profile;
    sel.onchange = () => { EDS.profile = sel.value; EDS.picked = null; redraw(); };
  });

  dash.draw('ind-chips', (el) => {
    el.replaceChildren();
    IND.forEach((i) => {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = i.label; b.setAttribute('aria-pressed', String(EDS.ind.includes(i.id)));
      b.onclick = () => { EDS.ind = EDS.ind.includes(i.id) ? EDS.ind.filter((x) => x !== i.id) : EDS.ind.concat(i.id); redraw(); };
      el.append(b);
    });
  });

  dash.draw('spider', (el) => {
    const d = dash.data('profile');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    ED.spider(el, axes(), {color: dash.colors[1], onPick: (a) => { EDS.picked = a.id; dash.draw('spider-pick'); }});
  });

  dash.draw('spider-pick', (el) => {
    const a = axes().find((x) => x.id === EDS.picked);
    if (!a) { el.textContent = 'Click a point to see the values.'; return; }
    const diff = Number.isFinite(a.ratio) ? ` (${ED.f.p0(100 * (a.ratio - 1))}% vs EU27)` : '';
    el.textContent = `${a.label} — ${ED.name(P())}: ${Number.isFinite(a.a) ? a.fmt(a.a) : 'n/a'} ${a.unit} · EU27: ${Number.isFinite(a.e) ? a.fmt(a.e) : 'n/a'} ${a.unit}${diff}`;
  });

  dash.draw('profile-head', (el) => { el.textContent = ED.name(P()); });
  dash.draw('profile-table', (tb) => {
    tb.replaceChildren();
    axes().forEach((a) => {
      const tr = document.createElement('tr'); tr.dataset.key = P() + '|' + a.id;
      [a.label + ' (' + a.unit + ')', Number.isFinite(a.a) ? a.fmt(a.a) : '—', Number.isFinite(a.e) ? a.fmt(a.e) : '—', Number.isFinite(a.ratio) ? ED.f.n2(a.ratio) + '×' : '—'].forEach((t) => { const td = document.createElement('td'); td.textContent = t; tr.append(td); });
      tb.append(tr);
    });
  });
})();

// ---------- DG ENER weekly ----------
(function () {
  const pctCell = (v, pp) => (v === null || v === undefined || v === '' ? '—' : ED.f.p1(+v) + (pp ? ' pp' : '%'));
  dash.draw('note-edition', (el) => { const d = dash.data('dgener_notes'); const e = d.status === 'ok' && d.data.length ? d3.max(d.data, (r) => r.edition) : null; el.textContent = e ? 'edition of ' + ED.dayFmt(ED.parseDay(e)) : '—'; });
  dash.draw('notes', (el) => {
    el.replaceChildren();
    const d = dash.data('dgener_notes');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const e = d3.max(d.data, (r) => r.edition);
    d.data.filter((r) => r.edition === e).sort((a, b) => (+a.order) - (+b.order)).forEach((r) => { const p = document.createElement('p'); const b = document.createElement('b'); b.textContent = r.section + '. '; p.append(b, document.createTextNode(r.text)); el.append(p); });
  });
  dash.draw('nl-week', (el) => { const r = EDL.row('nl_latest', 'indicator', 'gas_ttf'); el.textContent = r ? ED.dayShort(ED.parseDay(r.week_start)) + '–' + ED.dayFmt(ED.parseDay(r.week_end)) : '—'; });
  dash.draw('nl-table', (tb) => {
    tb.replaceChildren();
    const n = dash.data('nl_latest'); if (n.status !== 'ok' || !Array.isArray(n.data)) return;
    n.data.slice().sort((a, b) => (+a.order) - (+b.order)).forEach((r) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.indicator;
      const pp = r.indicator === 'gas_storage';
      const fm = Math.abs(+r.value) < 10 ? ED.f.n2 : ED.f.n0;
      [r.label, fm(+r.value), r.unit, pctCell(r.wow_pct, pp), pctCell(r.mom_pct, pp), pctCell(r.yoy_pct, pp), r.ref_period].forEach((t) => { const td = document.createElement('td'); td.textContent = t; tr.append(td); });
      tb.append(tr);
    });
  });
  dash.draw('nl-chips', (el) => {
    el.replaceChildren();
    const d = dash.data('dgener_weekly'); if (d.status !== 'ok') return;
    const inds = Array.from(new Map(d.data.map((r) => [r.indicator, r])).values()).sort((a, b) => (+a.order) - (+b.order));
    inds.forEach((r) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = r.label; b.setAttribute('aria-pressed', String(r.indicator === EDS.nl)); b.onclick = () => { EDS.nl = r.indicator; ['nl-chips', 'nl-chart', 'nl-chart-note'].forEach((n) => dash.draw(n)); }; el.append(b); });
  });
  dash.draw('nl-chart', (el) => {
    const d = dash.data('dgener_weekly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const v = d.data.filter((r) => r.indicator === EDS.nl).sort((a, b) => (a.week_end < b.week_end ? -1 : 1));
    ED.lineChart(el, [{label: v.length ? v[0].label : '', color: dash.colors[0], width: 2, values: v.map((r) => ({x: ED.parseDay(r.week_end), y: +r.value}))}], {height: 200, unit: v.length ? v[0].unit : '', zero: false, tipFmt: Math.abs(+(v[0] || {}).value) < 10 ? ED.f.n2 : ED.f.n1});
  });
  dash.draw('nl-chart-note', (el) => {
    const d = dash.data('dgener_weekly');
    const n = d.status === 'ok' ? new Set(d.data.filter((r) => r.indicator === EDS.nl).map((r) => r.week_end)).size : 0;
    el.textContent = n < 6 ? `The series grows by one point a week: ${n} ${n === 1 ? 'week' : 'weeks'} so far.` : 'One point per week (end of the reference week).';
  });
})();
