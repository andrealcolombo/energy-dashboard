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
  document.querySelectorAll('.ed [data-country]').forEach((b) => b.addEventListener('click', () => {
    EDS.country = b.dataset.country;
    document.querySelectorAll('.ed [data-country]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    ['p-price', 'p-price-gap', 'p-res-month', 'p-res', 'p-res-chg', 'p-gas', 'p-gas-eu', 'p-dsl', 'p-dsl-eu', 'p-price-chart', 'p-mix-chart', 'p-res-chart'].forEach((n) => dash.draw(n));
  }));
})();
// ---------- drawings: Oggi ----------
(function () {
  const {f, chgSpan} = ED;
  const kp = (area) => { const k = dash.data('kpi_power'); return k.status === 'ok' && Array.isArray(k.data) ? k.data.find((r) => r.area === area) : null; };
  [['k-eu', 'EU27'], ['k-it', 'IT'], ['k-hu', 'HU']].forEach(([n, area]) => {
    dash.draw(n, (el) => { const r = kp(area); el.textContent = r && r.avg7 !== null ? f.n1(r.avg7) : '—'; });
    dash.draw(n + '-chg', (el) => { const r = kp(area); chgSpan(el, r ? r.chg_pct : NaN, {suffix: r && r.last_date ? 'al ' + ED.dayFmt(ED.parseDay(r.last_date)) : ''}); });
  });

  dash.draw('headline', (el) => {
    const r = kp('EU27'), n = dash.data('nl_latest');
    if (!r || r.avg7 === null) { el.textContent = '—'; return; }
    const ttf = n.status === 'ok' && Array.isArray(n.data) ? n.data.find((d) => d.indicator === 'gas_ttf') : null;
    let s = `Negli ultimi 7 giorni l'elettricità day-ahead è costata in media ${f.n0(r.avg7)} €/MWh nell'UE27`;
    if (isFinite(r.chg_pct)) s += ` (${f.p1(r.chg_pct)}% sulla settimana prima)`;
    s += '.';
    if (ttf) s += ` Il gas TTF era a ${f.n0(+ttf.value)} €/MWh nella settimana al ${ED.dayFmt(ED.parseDay(ttf.week_end))}.`;
    el.textContent = s;
  });

  const resRow = (c) => { const k = dash.data('res_share'); return k.status === 'ok' && Array.isArray(k.data) ? k.data.find((r) => r.country === c) : null; };
  dash.draw('k-res', (el) => { const r = resRow('EU27'); el.textContent = r && r.res_share !== null ? f.n1(r.res_share) : '—'; });
  dash.draw('k-res-month', (el) => { const r = resRow('EU27'); el.textContent = r ? ED.mLabel(ED.parseMonth(r.month)) : '—'; });
  dash.draw('k-res-chg', (el) => { const r = resRow('EU27'); chgSpan(el, r && r.res_share_py !== null ? r.res_share - r.res_share_py : NaN, {unit: ' pt', suffix: "sull'anno prima", upIsGood: true}); });

  const nl = (k) => { const n = dash.data('nl_latest'); return n.status === 'ok' && Array.isArray(n.data) ? n.data.find((d) => d.indicator === k) : null; };
  dash.draw('k-week', (el) => { const r = nl('gas_ttf'); el.textContent = r ? ED.dayFmt(ED.parseDay(r.week_start)) + '–' + ED.dayFmt(ED.parseDay(r.week_end)) : '—'; });
  [['k-ttf', 'gas_ttf', f.n0, false], ['k-eua', 'eua', f.n0, false], ['k-sto', 'gas_storage', f.n0, true], ['k-dsl', 'diesel', f.n2, false], ['k-brent', 'brent_future', f.n0, false]].forEach(([n, k, fm, upGood]) => {
    dash.draw(n, (el) => { const r = nl(k); el.textContent = r ? fm(+r.value) : '—'; });
    dash.draw(n + '-chg', (el) => { const r = nl(k); chgSpan(el, r ? ED.num(r.wow_pct) : NaN, {unit: k === 'gas_storage' ? ' pt' : '%', suffix: 'sett.', upIsGood: upGood}); });
  });
  dash.draw('k-css', (el) => { const s = dash.data('spark'); el.textContent = s.status === 'ok' && s.data && s.data.length ? f.n0(s.data[0].clean_spark) : '—'; });

  dash.draw('wk-period', (el) => { const m = dash.data('mix_week'); const r = m.status === 'ok' && Array.isArray(m.data) ? m.data[0] : null; el.textContent = r ? ED.dayFmt(ED.parseDay(r.from)) + '–' + ED.dayFmt(ED.parseDay(r.to)) : '—'; });
  dash.draw('mix-week', (tb) => {
    tb.replaceChildren();
    const m = dash.data('mix_week'); if (m.status !== 'ok' || !Array.isArray(m.data)) return;
    m.data.forEach((r) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.country; if (['EU27', 'IT', 'HU'].includes(r.country)) tr.style.fontWeight = '600';
      const cell = (t, cls) => { const td = document.createElement('td'); td.textContent = t; if (cls) td.className = cls; tr.append(td); };
      cell(ED.name(r.country)); cell(ED.f.n1(r.res7)); cell(ED.f.p1(r.res_d) + ' pt', r.res_d > 0.5 ? 'down' : r.res_d < -0.5 ? 'up' : 'flat');
      cell(ED.f.n1(r.wind7)); cell(ED.f.n1(r.solar7)); cell(ED.f.n1(r.gas7)); cell(ED.f.p1(r.gas_d) + ' pt', r.gas_d > 0.5 ? 'up' : r.gas_d < -0.5 ? 'down' : 'flat'); cell(ED.f.n1(r.coal7));
      tb.append(tr);
    });
  });

  dash.draw('today-line', (el) => {
    const d = dash.data('prices_daily');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const last = d3.max(d.data, (r) => r.date); if (!last) { ED.placeholder(el, 'empty', 'Nessun dato'); return; }
    const from = new Date(Date.parse(last) - 89 * 86400000).toISOString().slice(0, 10);
    const ser = [['EU27', dash.colors[0]], ['IT', dash.colors[1]], ['HU', dash.colors[2]]].map(([a, c]) => ({label: ED.name(a), color: c, width: a === 'EU27' ? 2.2 : 1.5, values: d.data.filter((r) => r.area === a && r.date >= from).map((r) => ({x: ED.parseDay(r.date), y: +r.avg_eur_mwh}))}));
    ED.lineChart(el, ser, {unit: '€/MWh', xTick: d3.utcFormat('%d/%m')});
  });

  dash.draw('today-bars', (el) => {
    const d = dash.data('prices_daily');
    el.replaceChildren();
    if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Caricamento non riuscito' : '—'; return; }
    const last = d3.max(d.data, (r) => r.date); if (!last) return;
    const from = new Date(Date.parse(last) - 6 * 86400000).toISOString().slice(0, 10);
    const rows = Array.from(d3.rollup(d.data.filter((r) => (r.level === 'paese' || r.level === 'UE') && r.date >= from), (v) => d3.mean(v, (r) => +r.avg_eur_mwh), (r) => r.area), ([a, v]) => ({a, v})).filter((r) => isFinite(r.v)).sort((a, b) => b.v - a.v);
    const mx = d3.max(rows, (r) => r.v) || 1;
    rows.forEach((r) => {
      const c = document.createElement('div'); c.textContent = r.a === 'EU27' ? 'UE' : r.a; c.title = ED.name(r.a);
      const w = document.createElement('div'); const b = document.createElement('div'); b.className = 'b';
      b.style.width = Math.max(1, 100 * r.v / mx) + '%';
      b.style.background = r.a === 'EU27' ? 'var(--color-fg)' : (r.a === 'IT' || r.a === 'HU') ? dash.colors[r.a === 'IT' ? 1 : 2] : 'var(--cds-chart-muted)';
      w.append(b);
      const v = document.createElement('div'); v.className = 'v'; v.textContent = ED.f.n0(r.v);
      el.append(c, w, v);
    });
  });
})();
// ---------- drawings: Prezzi ----------
(function () {
  const AREAS_QUICK = ['EU27', 'IT', 'HU', 'DE', 'FR', 'ES', 'AT', 'PL', 'RO', 'SK', 'CZ', 'SI', 'HR', 'GR', 'NL', 'BE'];
  const colorFor = (a) => { const i = EDS.areas.indexOf(a); return dash.colors[i % dash.colors.length]; };

  dash.draw('area-chips', (el) => {
    el.replaceChildren();
    const d = dash.data('prices_daily');
    const avail = new Set(d.status === 'ok' ? d.data.map((r) => r.area) : AREAS_QUICK);
    AREAS_QUICK.filter((a) => avail.has(a)).forEach((a) => {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = a === 'EU27' ? 'UE27' : a; b.title = ED.name(a);
      b.setAttribute('aria-pressed', String(EDS.areas.includes(a)));
      b.onclick = () => { EDS.areas = EDS.areas.includes(a) ? EDS.areas.filter((x) => x !== a) : EDS.areas.concat(a).slice(-6); ['area-chips', 'price-daily', 'price-monthly', 'price-neg'].forEach((n) => dash.draw(n)); };
      el.append(b);
    });
    const sel = document.createElement('select'); sel.className = 'dash-select'; sel.setAttribute('aria-label', 'Aggiungi zona di offerta');
    sel.append(new Option('+ zona di offerta…', ''));
    Array.from(avail).filter((a) => a.includes('_')).sort().forEach((a) => sel.append(new Option(a.replace('_', ' '), a)));
    sel.onchange = () => { if (sel.value && !EDS.areas.includes(sel.value)) { EDS.areas = EDS.areas.concat(sel.value).slice(-6); ['area-chips', 'price-daily', 'price-monthly', 'price-neg'].forEach((n) => dash.draw(n)); } };
    el.append(sel);
  });

  dash.draw('price-daily', (el) => {
    const d = dash.data('prices_daily');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const last = d3.max(d.data, (r) => r.date); if (!last) { ED.placeholder(el, 'empty', 'Nessun dato'); return; }
    const from = new Date(Date.parse(last) - (EDS.range - 1) * 86400000).toISOString().slice(0, 10);
    const ser = EDS.areas.map((a) => ({label: ED.name(a), color: colorFor(a), width: a === 'EU27' ? 2.2 : 1.4, values: d.data.filter((r) => r.area === a && r.date >= from).map((r) => ({x: ED.parseDay(r.date), y: +r.avg_eur_mwh}))}));
    ED.lineChart(el, ser, {unit: '€/MWh', legend: true, xTick: EDS.range <= 90 ? d3.utcFormat('%d/%m') : (x) => ED.mLabel(x)});
  });

  dash.draw('price-monthly', (el) => {
    const d = dash.data('prices_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const ser = EDS.areas.map((a) => ({label: ED.name(a), color: colorFor(a), width: a === 'EU27' ? 2.2 : 1.4, values: d.data.filter((r) => r.area === a).map((r) => ({x: ED.parseMonth(r.month), y: +r.avg_eur_mwh}))}));
    const ref = d3.mean(d.data.filter((r) => r.area === 'EU27' && r.month >= '2021-01' && r.month <= '2021-06'), (r) => +r.avg_eur_mwh);
    ED.lineChart(el, ser, {unit: '€/MWh', legend: true, refY: ref, tipX: (x) => ED.mLabel(x)});
  });

  dash.draw('price-neg', (el) => {
    const d = dash.data('prices_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const ser = EDS.areas.filter((a) => a !== 'EU27').map((a) => ({label: ED.name(a), color: colorFor(a), values: d.data.filter((r) => r.area === a).map((r) => ({x: ED.parseMonth(r.month), y: +r.negative_hours}))}));
    ED.lineChart(el, ser, {height: 200, unit: 'ore', legend: true, tipFmt: ED.f.n0, tipX: (x) => ED.mLabel(x)});
  });

  dash.draw('zones-it', (tb) => {
    tb.replaceChildren();
    const z = dash.data('zones_it'); if (z.status !== 'ok' || !Array.isArray(z.data)) return;
    const NM = {IT_NORD: 'Nord', IT_CNOR: 'Centro-Nord', IT_CSUD: 'Centro-Sud', IT_SUD: 'Sud', IT_CALA: 'Calabria', IT_SICI: 'Sicilia', IT_SARD: 'Sardegna'};
    z.data.forEach((r) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.area;
      [NM[r.area] || r.area, ED.f.n1(r.avg30), ED.f.n1(r.min30), ED.f.n1(r.max30), ED.f.n1(r.neg30), r.area === 'IT_NORD' ? '—' : ED.f.p1(r.spread_nord)].forEach((t) => { const td = document.createElement('td'); td.textContent = t; tr.append(td); });
      tb.append(tr);
    });
  });
})();
// ---------- drawings: Mix ----------
(function () {
  dash.draw('mix-select', (sel) => {
    const d = dash.data('mix_monthly');
    const cs = d.status === 'ok' ? Array.from(new Set(d.data.map((r) => r.country))) : ['EU27'];
    cs.sort((a, b) => (a === 'EU27' ? -1 : b === 'EU27' ? 1 : ED.name(a).localeCompare(ED.name(b), 'it')));
    sel.replaceChildren(...cs.map((c) => new Option(ED.name(c), c)));
    sel.value = EDS.mixCountry;
    sel.onchange = () => { EDS.mixCountry = sel.value; ['mix-stack', 'mix-annual', 'load-chart', 'mix-ytd', 'ytd-period', 'ytd-py-head', 'ytd-cur-head'].forEach((n) => dash.draw(n)); };
  });

  dash.draw('mix-legend', (el) => {
    el.replaceChildren();
    ED.MIXORDER.forEach((g) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = ED.MIXC[g]; sp.append(i, document.createTextNode(g)); el.append(sp); });
  });

  dash.draw('mix-stack', (el) => {
    const d = dash.data('mix_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const v = d.data.filter((r) => r.country === EDS.mixCountry);
    const rows = Array.from(d3.group(v, (r) => r.month), ([m, g]) => { const tot = d3.sum(g, (r) => +r.gwh); const parts = {}; g.forEach((r) => { parts[r.group] = 100 * (+r.gwh) / tot; }); return {x: ED.parseMonth(m), parts, total: tot}; }).sort((a, b) => a.x - b.x);
    ED.stackChart(el, rows, ED.MIXORDER, ED.MIXC);
  });

  const ytdRows = () => { const a = dash.data('mix_ytd'); return a.status === 'ok' && Array.isArray(a.data) ? a.data.filter((r) => r.country === EDS.mixCountry) : []; };
  dash.draw('ytd-period', (el) => { const r = ytdRows()[0]; el.textContent = r ? 'gennaio–' + ED.mLabel(ED.parseMonth(r.last_month)).split(' ')[0] : '—'; });
  dash.draw('ytd-py-head', (el) => { const r = ytdRows()[0]; el.textContent = r ? r.prev_year : ''; });
  dash.draw('ytd-cur-head', (el) => { const r = ytdRows()[0]; el.textContent = r ? r.cur_year : ''; });
  dash.draw('mix-ytd', (tb) => {
    tb.replaceChildren();
    const order = ['Rinnovabili (totale)'].concat(ED.MIXORDER);
    ytdRows().filter((r) => (r.ycur || 0) + (r.ypy || 0) + (r.y2021 || 0) > 0.2).sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group)).forEach((r) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.key; if (r.group.startsWith('Rinnovabili')) tr.style.fontWeight = '600';
      [r.group, r.y2021, r.ypy, r.ycur].forEach((t, i) => { const td = document.createElement('td'); td.textContent = i === 0 ? t : (t === null ? '—' : ED.f.n1(t)); tr.append(td); });
      const td = document.createElement('td'); td.textContent = r.d_py === null ? '—' : ED.f.p1(r.d_py); tr.append(td);
      tb.append(tr);
    });
  });

  dash.draw('mix-annual', (tb) => {
    tb.replaceChildren();
    const a = dash.data('mix_annual'); if (a.status !== 'ok' || !Array.isArray(a.data)) return;
    a.data.filter((r) => r.country === EDS.mixCountry).sort((x, y) => (x.year < y.year ? 1 : -1)).forEach((r) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.key;
      [r.year + (r.months < 12 ? ` (${r.months} mesi)` : ''), r.res, r['Solare'], r['Eolico'], r['Idroelettrico'], r['Gas'], r['Carbone e lignite'], r['Nucleare']].forEach((t, i) => { const td = document.createElement('td'); td.textContent = i === 0 ? t : ED.f.n1(t); tr.append(td); });
      const td = document.createElement('td'); td.textContent = ED.f.n1(r.twh); tr.append(td);
      tb.append(tr);
    });
  });

  dash.draw('load-chart', (el) => {
    const d = dash.data('load_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const v = d.data.filter((r) => r.country === EDS.mixCountry).sort((a, b) => (a.month < b.month ? -1 : 1));
    if (!v.length) { ED.placeholder(el, 'empty', 'Nessun dato'); return; }
    const ser = [{label: 'Domanda', color: dash.colors[0], width: 2, values: v.map((r) => ({x: ED.parseMonth(r.month), y: +r.gwh / 1000}))},
      {label: "Stesso mese, anno prima", color: 'var(--cds-chart-muted)', dash: '4 3', values: v.map((r) => { const py = (+r.month.slice(0, 4) - 1) + r.month.slice(4); const p = v.find((x) => x.month === py); return {x: ED.parseMonth(r.month), y: p ? +p.gwh / 1000 : NaN}; })}];
    ED.lineChart(el, ser, {height: 200, unit: 'TWh', zero: false, tipX: (x) => ED.mLabel(x)});
  });
})();
// ---------- drawings: Gas, CO2, carburanti ----------
(function () {
  const pctCell = (v, pp) => (v === null || v === undefined || v === '' ? '—' : ED.f.p1(+v) + (pp ? ' pt' : '%'));
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
    const unit = v.length ? v[0].unit : '';
    ED.lineChart(el, [{label: v.length ? v[0].label : '', color: dash.colors[0], width: 2, values: v.map((r) => ({x: ED.parseDay(r.week_end), y: +r.value}))}], {unit, zero: false, tipFmt: Math.abs(+(v[0] || {}).value) < 10 ? ED.f.n2 : ED.f.n1});
  });
  dash.draw('nl-chart-note', (el) => {
    const d = dash.data('dgener_weekly');
    const n = d.status === 'ok' ? new Set(d.data.filter((r) => r.indicator === EDS.nl).map((r) => r.week_end)).size : 0;
    el.textContent = n < 6 ? `La serie si allunga di un punto ogni settimana: per ora ${n} ${n === 1 ? 'settimana' : 'settimane'}.` : 'Un punto per settimana (fine settimana di riferimento).';
  });

  dash.draw('spark-chart', (el) => {
    const s = dash.data('spark');
    if (s.status !== 'ok' || !Array.isArray(s.data)) { ED.placeholder(el, s.status); return; }
    ED.lineChart(el, [{label: 'Clean spark spread', color: dash.colors[0], width: 2, values: s.data.map((r) => ({x: ED.parseDay(r.week_end), y: +r.clean_spark}))}], {height: 200, unit: '€/MWh'});
  });

  dash.draw('fuel-chips', (el) => {
    el.replaceChildren();
    const d = dash.data('fuels_weekly'); if (d.status !== 'ok') return;
    Array.from(new Set(d.data.map((r) => r.country))).sort((a, b) => (a === 'EU' ? -1 : b === 'EU' ? 1 : a.localeCompare(b))).forEach((c) => {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = ED.name(c); b.setAttribute('aria-pressed', String(EDS.fuels.includes(c)));
      b.onclick = () => { EDS.fuels = EDS.fuels.includes(c) ? EDS.fuels.filter((x) => x !== c) : EDS.fuels.concat(c); ['fuel-chips', 'fuel-chart'].forEach((n) => dash.draw(n)); };
      el.append(b);
    });
  });
  dash.draw('fuel-chart', (el) => {
    const d = dash.data('fuels_weekly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status, d.status === 'missing' ? 'Dati del Weekly Oil Bulletin non ancora disponibili' : ''); return; }
    const ser = EDS.fuels.map((c, i) => ({label: ED.name(c), color: dash.colors[i % dash.colors.length], width: c === 'EU' ? 2.2 : 1.5, values: d.data.filter((r) => r.country === c && r.product === 'diesel').map((r) => ({x: ED.parseDay(r.date), y: +r.eur_per_litre}))}));
    ED.lineChart(el, ser, {unit: '€/l', legend: true, zero: false, yFmt: ED.f.n2, tipFmt: ED.f.n3});
  });
})();
// ---------- drawings: Italia · Ungheria ----------
(function () {
  const {f, chgSpan} = ED;
  const kp = (a) => { const k = dash.data('kpi_power'); return k.status === 'ok' && Array.isArray(k.data) ? k.data.find((r) => r.area === a) : null; };
  const rs = (c) => { const k = dash.data('res_share'); return k.status === 'ok' && Array.isArray(k.data) ? k.data.find((r) => r.country === c) : null; };
  const fuel = (c) => { const d = dash.data('fuels_weekly'); if (d.status !== 'ok') return null; const v = d.data.filter((r) => r.country === c && r.product === 'diesel'); return v.length ? v.reduce((a, b) => (a.date > b.date ? a : b)) : null; };

  dash.draw('p-price', (el) => { el.dataset.where = 'area=' + EDS.country; const r = kp(EDS.country); el.textContent = r && r.avg7 !== null ? f.n1(r.avg7) : '—'; });
  dash.draw('p-price-gap', (el) => { const r = kp(EDS.country), e = kp('EU27'); chgSpan(el, r && e && e.avg7 ? 100 * (r.avg7 / e.avg7 - 1) : NaN, {suffix: 'rispetto a UE27'}); });
  dash.draw('p-res-month', (el) => { const r = rs(EDS.country); el.textContent = r ? ED.mLabel(ED.parseMonth(r.month)) : '—'; });
  dash.draw('p-res', (el) => { el.dataset.where = 'country=' + EDS.country; const r = rs(EDS.country); el.textContent = r && r.res_share !== null ? f.n1(r.res_share) : '—'; });
  dash.draw('p-res-chg', (el) => { const r = rs(EDS.country); chgSpan(el, r && r.res_share_py !== null ? r.res_share - r.res_share_py : NaN, {unit: ' pt', suffix: "sull'anno prima", upIsGood: true}); });
  dash.draw('p-gas', (el) => { el.dataset.where = 'country=' + EDS.country; const r = rs(EDS.country); el.textContent = r ? f.n1(r.gas_share_12m) : '—'; });
  dash.draw('p-gas-eu', (el) => { const e = rs('EU27'); el.className = 'chg flat'; el.textContent = e ? 'UE27: ' + f.n1(e.gas_share_12m) + '%' : '—'; });
  dash.draw('p-dsl', (el) => { const r = fuel(EDS.country); el.textContent = r ? f.n3(+r.eur_per_litre) : '—'; });
  dash.draw('p-dsl-eu', (el) => { const r = fuel(EDS.country), e = fuel('EU'); chgSpan(el, r && e ? 100 * (+r.eur_per_litre / +e.eur_per_litre - 1) : NaN, {suffix: 'rispetto a UE', empty: 'Weekly Oil Bulletin non ancora disponibile'}); });

  dash.draw('p-price-chart', (el) => {
    const d = dash.data('prices_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const ser = [[EDS.country, dash.colors[1]], ['EU27', 'var(--cds-chart-muted)']].map(([a, c]) => ({label: ED.name(a), color: c, width: a === 'EU27' ? 1.5 : 2.2, values: d.data.filter((r) => r.area === a).map((r) => ({x: ED.parseMonth(r.month), y: +r.avg_eur_mwh}))}));
    ED.lineChart(el, ser, {unit: '€/MWh', tipX: (x) => ED.mLabel(x)});
  });

  dash.draw('p-mix-chart', (el) => {
    const d = dash.data('mix_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const share = (c) => { const v = d.data.filter((r) => r.country === c); const ms = Array.from(new Set(v.map((r) => r.month))).sort().slice(-12); const w = v.filter((r) => ms.includes(r.month)); const tot = d3.sum(w, (r) => +r.gwh); const o = {}; w.forEach((r) => { o[r.group] = (o[r.group] || 0) + 100 * (+r.gwh) / tot; }); return o; };
    const a = share(EDS.country), b = share('EU27');
    ED.pairBars(el, ED.MIXORDER.filter((g) => (a[g] || 0) + (b[g] || 0) > 0.3).map((g) => ({cat: g, a: a[g], b: b[g]})), ED.name(EDS.country), 'UE27', dash.colors[1], 'var(--cds-chart-muted)');
  });

  dash.draw('p-res-chart', (el) => {
    const d = dash.data('mix_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const roll = (c) => { const by = Array.from(d3.rollup(d.data.filter((r) => r.country === c), (v) => ({res: d3.sum(v, (r) => (String(r.renewable) === 'True' ? +r.gwh : 0)), tot: d3.sum(v, (r) => +r.gwh)}), (r) => r.month)).sort((x, y) => (x[0] < y[0] ? -1 : 1)); return by.map((m, i) => { if (i < 11) return null; const w = by.slice(i - 11, i + 1); return {x: ED.parseMonth(m[0]), y: 100 * d3.sum(w, (z) => z[1].res) / d3.sum(w, (z) => z[1].tot)}; }).filter(Boolean); };
    ED.lineChart(el, [{label: ED.name(EDS.country), color: dash.colors[1], width: 2.2, values: roll(EDS.country)}, {label: 'UE27', color: 'var(--cds-chart-muted)', values: roll('EU27')}], {height: 200, unit: '%', tipX: (x) => ED.mLabel(x)});
  });
})();
// ---------- drawings: Note ----------
(function () {
  dash.draw('note-edition', (el) => { const d = dash.data('dgener_notes'); const e = d.status === 'ok' && d.data.length ? d3.max(d.data, (r) => r.edition) : null; el.textContent = e ? 'edizione del ' + ED.dayFmt(ED.parseDay(e)) : '—'; });
  dash.draw('notes', (el) => {
    el.replaceChildren();
    const d = dash.data('dgener_notes');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const e = d3.max(d.data, (r) => r.edition);
    d.data.filter((r) => r.edition === e).sort((a, b) => (+a.order) - (+b.order)).forEach((r) => { const p = document.createElement('p'); const b = document.createElement('b'); b.textContent = r.section + '. '; p.append(b, document.createTextNode(r.text)); el.append(p); });
  });
})();
