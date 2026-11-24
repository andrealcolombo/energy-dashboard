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
  const TICK = ['t-whole', 't-whole-date', 't-whole-chg', 't-w7', 't-w7-per', 't-w7-chg', 't-relec', 't-relec-per', 't-relec-chg', 't-rgas', 't-rgas-per', 't-rgas-chg', 't-dsl', 't-dsl-per', 't-dsl-chg', 't-pet', 't-pet-per', 't-pet-chg', 'wk-period', 'week-pie', 'week-note', 'wk-legend', 'news-list'];

  dash.draw('country-select', (sel) => {
    sel.replaceChildren(...EDL.countries().map((c) => new Option(ED.name(c), c)));
    sel.value = EDS.country;
    sel.onchange = () => { EDS.country = sel.value; TICK.forEach((n) => dash.draw(n)); };
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
  dash.draw('t-w7', (el) => { el.dataset.where = 'area=' + C(); const r = kp(); el.textContent = r && r.avg7 !== null ? f.n1(r.avg7) : '—'; });
  dash.draw('t-w7-per', (el) => { const r = kp(); el.textContent = r ? 'to ' + ED.dayShort(ED.parseDay(r.last_date)) : '—'; });
  dash.draw('t-w7-chg', (el) => { const r = kp(); chgSpan(el, r ? r.chg_pct : NaN, {suffix: 'w/w'}); el.classList.add('c'); });

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
  dash.draw('t-pet', (el) => { el.dataset.where = 'country=' + fk(); const r = fu(); el.textContent = r && r.petrol_95 !== null ? f.n2(r.petrol_95) : '—'; });
  dash.draw('t-pet-per', (el) => { const r = fu(); el.textContent = r ? ED.dayShort(ED.parseDay(r.date)) : '—'; });
  dash.draw('t-pet-chg', (el) => { const r = fu(); chgSpan(el, r ? r.petrol_wow_pct : NaN, {suffix: 'w/w'}); el.classList.add('c'); });

  const nl = (k) => row('nl_latest', 'indicator', k);
  const wk = (r) => (r ? 'w/e ' + ED.dayShort(ED.parseDay(r.week_end)) : '—');
  dash.draw('t-ttf', (el) => { const r = nl('gas_ttf'); el.textContent = r ? f.n0(+r.value) : '—'; });
  dash.draw('t-ttf-per', (el) => { el.textContent = wk(nl('gas_ttf')); });
  dash.draw('t-ttf-chg', (el) => { const r = nl('gas_ttf'); chgSpan(el, r ? ED.num(r.wow_pct) : NaN, {suffix: 'w/w'}); el.classList.add('c'); });
  dash.draw('t-sto', (el) => { const r = nl('gas_storage'); el.textContent = r ? f.n0(+r.value) : '—'; });
  dash.draw('t-sto-per', (el) => { el.textContent = wk(nl('gas_storage')); });
  dash.draw('t-sto-chg', (el) => { const r = nl('gas_storage'); chgSpan(el, r ? ED.num(r.wow_pct) : NaN, {unit: ' pp', suffix: 'w/w', upIsGood: true}); el.classList.add('c'); });
  const wkm = () => { const d = dash.data('mix_weekly'); return d.status === 'ok' ? d.data.filter((r) => r.country === EDS.country) : []; };
  dash.draw('wk-period', (el) => { const r = wkm().find((x) => x.period === 'last_7'); el.textContent = r ? '· ' + ED.dayShort(ED.parseDay(r.from)) + '–' + ED.dayFmt(ED.parseDay(r.to)) : ''; });
  dash.draw('week-pie', (el) => {
    const d = dash.data('mix_weekly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const v = wkm().filter((r) => r.period === 'last_7');
    ED.pie(el, ED.MIXORDER.map((g) => { const r = v.find((x) => x.group === g); return {label: g, value: r ? +r.share_pct : 0, color: ED.MIXC[g]}; }), {center: 'last 7 days', empty: 'No recent data for this country'});
  });
  dash.draw('week-note', (el) => {
    const v = wkm(); const sh = (p, gs) => d3.sum(v.filter((r) => r.period === p && gs.includes(r.group)), (r) => +r.share_pct);
    if (!v.length) { el.textContent = '—'; return; }
    const dr = sh('last_7', ED.RES) - sh('prev_28', ED.RES), dg = sh('last_7', ['Gas']) - sh('prev_28', ['Gas']);
    el.textContent = `Renewables ${ED.f.n0(sh('last_7', ED.RES))}% (${ED.f.p1(dr)} pp on the previous 4 weeks), gas ${ED.f.n0(sh('last_7', ['Gas']))}% (${ED.f.p1(dg)} pp). Less wind and sun and more gas usually explain a price rise.`;
  });
  dash.draw('news-list', (el) => {
    el.replaceChildren();
    const d = dash.data('news');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const c = EDS.country;
    const tags = (r) => String(r.countries || '').split(';').map((x) => x.trim());
    const own = c === 'EU27' ? [] : d.data.filter((r) => tags(r).includes(c));
    const eu = d.data.filter((r) => tags(r).includes('EU') && !own.includes(r));
    const byDate = (a, b) => (a.date < b.date ? 1 : -1);
    const list = own.sort(byDate).concat(eu.sort(byDate)).slice(0, 6);
    if (!list.length) { ED.placeholder(el, 'empty', 'No news selected yet.'); return; }
    list.forEach((r) => {
      const a = document.createElement('article');
      const m = document.createElement('p'); m.className = 'meta';
      const scope = document.createElement('span'); scope.className = 'tag'; scope.textContent = own.includes(r) ? ED.name(c) : 'EU-wide';
      const topic = document.createElement('span'); topic.className = 'tag'; topic.textContent = r.topic;
      m.append(scope, topic, document.createTextNode(r.date_label + ' · ' + r.source));
      const h = document.createElement('h4'); const l = document.createElement('a'); l.href = r.url; l.target = '_blank'; l.rel = 'noopener noreferrer'; l.textContent = r.title; h.append(l);
      const p = document.createElement('p'); p.textContent = r.summary;
      a.append(m, h, p); el.append(a);
    });
  });
  dash.draw('wk-legend', (el) => {
    el.replaceChildren();
    const v = wkm().filter((r) => r.period === 'last_7');
    ED.MIXORDER.forEach((g) => { const r = v.find((x) => x.group === g); if (!r || !(+r.share_pct > 0)) return; const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = ED.MIXC[g]; sp.append(i, document.createTextNode(g)); el.append(sp); });
  });
})();

// ---------- Electricity prices ----------
(function () {
  const {label} = EDL;
  const colorFor = (a) => { const i = EDS.areas.indexOf(a); return dash.colors[i % dash.colors.length]; };
  const redraw = () => ['area-chips', 'price-daily', 'price-monthly', 'price-neg'].forEach((n) => dash.draw(n));

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

  dash.draw('price-neg', (el) => {
    const d = dash.data('prices_monthly');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const ser = EDS.areas.filter((a) => a !== 'EU27').map((a) => ({label: label(a), color: colorFor(a), values: d.data.filter((r) => r.area === a).map((r) => ({x: ED.parseMonth(r.month), y: +r.negative_hours}))}));
    ED.lineChart(el, ser, {height: 200, unit: 'h', legend: true, tipFmt: ED.f.n0, tipX: (x) => ED.mLabel(x), empty: 'Pick a country or a bidding zone (not computed for the EU27)'});
  });
})();

// ---------- Generation mix ----------
(function () {
  const C = () => EDS.mix;
  const MIX = ['mix-country', 'ytd-period', 'pie-cur-title', 'pie-2021-title', 'pie-cur', 'pie-2021', 'mix-stack', 'load-chart'];
  dash.draw('mix-select', (sel) => {
    const d = dash.data('mix_monthly');
    const cs = d.status === 'ok' ? Array.from(new Set(d.data.map((r) => r.country))) : ['EU27'];
    cs.sort((a, b) => (a === 'EU27' ? -1 : b === 'EU27' ? 1 : ED.name(a).localeCompare(ED.name(b), 'en')));
    sel.replaceChildren(...cs.map((c) => new Option(ED.name(c), c)));
    sel.value = EDS.mix;
    sel.onchange = () => { EDS.mix = sel.value; MIX.forEach((n) => dash.draw(n)); };
  });
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

})();

// ---------- Country profile ----------
(function () {
  const IND = [
    {id: 'w7', label: 'Wholesale price, 7 days', unit: '€/MWh', fmt: ED.f.n1, def: 'Average day-ahead wholesale electricity price over the last 7 days (ENTSO-E). For the EU27, country prices weighted by demand.'},
    {id: 'wytd', label: 'Wholesale price, year to date', unit: '€/MWh', fmt: ED.f.n1, def: 'Average day-ahead wholesale electricity price from January to the last complete month.'},
    {id: 'vol30', label: 'Wholesale volatility, 30 days', unit: '€/MWh', fmt: ED.f.n1, def: 'Standard deviation of daily average wholesale prices over the last 30 days: how much the price swings from one day to the next.'},
    {id: 'neg_ytd', label: 'Negative-price hours, YTD', unit: 'hours', fmt: ED.f.n0, def: 'Hours since January with a negative day-ahead price, a sign of surplus renewable output. For countries with several zones, the average of the zones; for the EU27, the average of countries.'},
    {id: 're_el', label: 'Household electricity', unit: '€/MWh', fmt: ED.f.n0, def: 'Price paid by households using 2,500–4,999 kWh a year, all taxes and levies included, latest half-year (Eurostat).'},
    {id: 're_gas', label: 'Household gas', unit: '€/MWh', fmt: ED.f.n0, def: 'Price paid by households using 20–200 GJ of gas a year, all taxes and levies included, latest half-year (Eurostat).'},
    {id: 'diesel', label: 'Diesel', unit: '€/l', fmt: ED.f.n2, def: 'Diesel pump price with taxes, latest week (European Commission Weekly Oil Bulletin).'},
    {id: 'petrol', label: 'Petrol 95', unit: '€/l', fmt: ED.f.n2, def: 'Euro-super 95 pump price with taxes, latest week (Weekly Oil Bulletin).'},
    {id: 'res_1m', label: 'Renewables share, last month', unit: '% of generation', fmt: ED.f.n1, def: 'Share of solar, wind, hydro and bioenergy in electricity generation in the last complete month (ENTSO-E).'},
    {id: 'res_12m', label: 'Renewables share, 12 months', unit: '% of generation', fmt: ED.f.n1, def: 'Same as above over the last 12 complete months, which removes seasonal swings.'},
    {id: 'solar_12m', label: 'Solar share, 12 months', unit: '% of generation', fmt: ED.f.n1, def: 'Share of solar in electricity generation over the last 12 complete months.'},
    {id: 'wind_12m', label: 'Wind share, 12 months', unit: '% of generation', fmt: ED.f.n1, def: 'Share of onshore and offshore wind in generation over the last 12 complete months.'},
    {id: 'hydro_12m', label: 'Hydro share, 12 months', unit: '% of generation', fmt: ED.f.n1, def: 'Share of run-of-river and reservoir hydro in generation over the last 12 complete months (pumped storage excluded).'},
    {id: 'nuclear_12m', label: 'Nuclear share, 12 months', unit: '% of generation', fmt: ED.f.n1, def: 'Share of nuclear in generation over the last 12 complete months.'},
    {id: 'gas_12m', label: 'Gas share, 12 months', unit: '% of generation', fmt: ED.f.n1, def: 'Share of gas-fired plants in generation over the last 12 complete months. A high share ties power prices to the gas price.'},
    {id: 'coal_12m', label: 'Coal share, 12 months', unit: '% of generation', fmt: ED.f.n1, def: 'Share of hard coal and lignite in generation over the last 12 complete months.'},
    {id: 'swing_12m', label: 'Daily price swing, 12 months', unit: '% of day average', fmt: ED.f.n0, def: 'On the average day of the last 12 complete months: price of the most expensive hour minus the cheapest, as a share of the day\'s average price. Higher means a more uneven day, with more value in shifting power across hours.'},
    {id: 'eve_12m', label: 'Evening price, 12 months', unit: '% of day average', fmt: ED.f.n0, def: 'Average price from 17:00 to 21:00 (Brussels time) as a share of the day\'s average, last 12 complete months. 150 means evenings cost 50% more than the average hour.'},
    {id: 'mid_12m', label: 'Midday price, 12 months', unit: '% of day average', fmt: ED.f.n0, def: 'Average price from 11:00 to 15:00 as a share of the day\'s average, last 12 complete months. Low values mean solar pushes midday prices down.'},
    {id: 'sto_eve_12m', label: 'Storage in the evening, 12 months', unit: '% of demand', fmt: ED.f.n1, def: 'Output of pumped hydro and batteries from 17:00 to 21:00 as a share of demand in those hours, last 12 complete months. Batteries count only where reported to ENTSO-E (from 2025, and only some countries), so this understates storage where batteries are not reported.'},
    {id: 'bat_3m', label: 'Battery storage, 3 months', unit: '% of generation', fmt: ED.f.n2, def: 'Electricity discharged from storage reported to ENTSO-E as "energy storage" (mostly batteries), as a share of generation over the last 3 complete months. Many countries do not report it: shown as n/a. The EU27 value counts reporting countries only, so it understates the real total.'},
  ];
  const P = () => EDS.profile;
  const R = () => EDS.ref || 'EU27';
  const val = (c, id) => { const r = EDL.row('profile', 'key', c + '|' + id); return r ? Number(r.value) : NaN; };
  const axes = () => IND.filter((i) => EDS.ind.includes(i.id)).map((i) => {
    const a = val(P(), i.id), e = val(R(), i.id);
    const ratio = Number.isFinite(a) && Number.isFinite(e) && e !== 0 ? a / e : NaN;
    return {...i, a, e, ratio, text: `${i.label}: ${ED.name(P())} ${Number.isFinite(a) ? i.fmt(a) : 'n/a'} · ${ED.name(R())} ${Number.isFinite(e) ? i.fmt(e) : 'n/a'} ${i.unit}`};
  });
  const redraw = () => ['ref-select', 'ref-note', 'ind-chips', 'spider', 'spider-pick', 'ind-legend'].forEach((n) => dash.draw(n));

  dash.draw('profile-select', (sel) => {
    const cs = EDL.countries().filter((c) => c !== 'EU27');
    sel.replaceChildren(...cs.map((c) => new Option(ED.name(c), c)));
    sel.value = EDS.profile;
    sel.onchange = () => { EDS.profile = sel.value; if (R() === sel.value) EDS.ref = 'EU27'; EDS.picked = null; redraw(); };
  });

  dash.draw('ref-select', (sel) => {
    const cs = EDL.countries().filter((c) => c !== P());
    sel.replaceChildren(...cs.map((c) => new Option(c === 'EU27' ? 'EU27 average' : ED.name(c), c)));
    sel.value = R();
    sel.onchange = () => { EDS.ref = sel.value; EDS.picked = null; redraw(); };
  });

  dash.draw('ref-note', (el) => { el.textContent = '(grey shape = ' + (R() === 'EU27' ? 'EU27 average' : ED.name(R())) + ')'; });

  dash.draw('ind-chips', (el) => {
    el.replaceChildren();
    IND.forEach((i) => {
      const b = document.createElement('button'); b.className = 'chip'; b.textContent = i.label; b.title = i.def; b.setAttribute('aria-pressed', String(EDS.ind.includes(i.id)));
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
    const diff = Number.isFinite(a.ratio) ? ` (${ED.f.p0(100 * (a.ratio - 1))}% vs ${ED.name(R())})` : '';
    el.textContent = `${a.label} — ${ED.name(P())}: ${Number.isFinite(a.a) ? a.fmt(a.a) : 'n/a'} ${a.unit} · ${ED.name(R())}: ${Number.isFinite(a.e) ? a.fmt(a.e) : 'n/a'} ${a.unit}${diff}`;
  });

  dash.draw('ind-legend', (el) => {
    el.replaceChildren();
    axes().forEach((a) => {
      const dt = document.createElement('dt'); dt.textContent = a.label + ' (' + a.unit + ')';
      const dd = document.createElement('dd'); dd.textContent = a.def + ' ' + ED.name(P()) + ': ' + (Number.isFinite(a.a) ? a.fmt(a.a) : 'n/a') + ' · ' + ED.name(R()) + ': ' + (Number.isFinite(a.e) ? a.fmt(a.e) : 'n/a') + '.';
      const w = document.createElement('div'); w.append(dt, dd); el.append(w);
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

// ---------- Prices through the day ----------
(function () {
  const {f} = ED;
  const SEASONS = [['year', 'Whole year', null], ['spring', 'Spring', [3, 4, 5]], ['summer', 'Summer', [6, 7, 8]], ['autumn', 'Autumn', [9, 10, 11]], ['winter', 'Winter', [12, 1, 2]]];
  const SNAME = Object.fromEntries(SEASONS.map(([k, l]) => [k, l]));
  const COLS = ['price', 'load', 'solar', 'wind', 'gas', 'coal', 'nuclear', 'hydro', 'other', 'pumped_out', 'pumped_in', 'battery_out', 'battery_in'];
  const PEAK = [['gas', 'Gas'], ['pumped_out', 'Pumped storage'], ['battery_out', 'Battery storage']];
  const MODES = [['years', 'Years'], ['countries', 'Countries'], ['seasons', 'Seasons']];
  const ALL = ['dp-select', 'dp-season', 'dp-unit', 'dp-mode', 'dp-price-title', 'dp-years', 'dp-countries', 'dp-price', 'dp-note', 'dp-swing-title', 'dp-swing',
    'dp-peak-years', 'dp-peak-legend', 'dp-peak-a-title', 'dp-peak-a', 'dp-peak-b-title', 'dp-peak-b', 'dp-peak-warn'];
  const redraw = () => ALL.forEach((n) => dash.draw(n));
  const hourDate = (h) => new Date(Date.UTC(2000, 0, 1, h));
  const mode = () => EDS.dpMode || 'years';
  const labelFor = (season, y) => (season === 'winter' ? (y - 1) + '/' + String(y).slice(2) : String(y));

  // Average days of one area and season: [{label, full, rows:[{h, v}]}], computed in src/build_dashboard_files.py.
  const memo = new Map();
  function prof(area, season) {
    const d = dash.data('day_profile');
    if (d.status !== 'ok') return [];
    const key = area + '|' + season + '|' + d.data.length;
    if (memo.has(key)) return memo.get(key);
    const by = d3.group(d.data.filter((r) => r.area === area && r.season === season), (r) => r.period);
    const out = Array.from(by, ([label, rs]) => ({label, full: label + (rs[0].span ? ' (' + rs[0].span + ')' : ''),
      rows: d3.range(24).map((h) => { const r = rs.find((z) => +z.hour === h) || {}; const v = {}; COLS.forEach((c) => { v[c] = ED.num(r[c]); }); return {h, v}; })}))
      .sort((a, b) => (a.label < b.label ? -1 : 1));
    memo.set(key, out);
    return out;
  }
  const periods = () => prof(EDS.dp, EDS.dpSeason);
  const calYears = () => prof(EDS.dp, 'year').map((p) => +p.label);
  const year = () => { const ys = calYears(); return ys.includes(+EDS.dpYear) ? +EDS.dpYear : ys[ys.length - 1]; };
  const shown = () => { const ps = periods(); const sel = EDS.dpYears || ps.slice(-4).map((p) => p.label); return ps.filter((p) => sel.includes(p.label)); };
  const colorOf = (p) => { const ps = periods(); const i = ps.findIndex((z) => z.label === p.label); return dash.colors[(ps.length - 1 - i) % dash.colors.length]; };

  // The lines of the price chart, in the selected comparison mode: [{label, color, width, rows}]
  function lines(all) {
    if (mode() === 'countries') {
      const y = year();
      return [EDS.dp].concat((EDS.dpCmp || []).filter((c) => c !== EDS.dp)).map((a, i) => {
        const p = prof(a, EDS.dpSeason).find((z) => z.label === labelFor(EDS.dpSeason, y));
        return p && {label: ED.name(a), color: dash.colors[i % dash.colors.length], width: i === 0 ? 2.6 : 1.6, rows: p.rows};
      }).filter(Boolean);
    }
    if (mode() === 'seasons') {
      const y = year();
      return SEASONS.map(([k, lab], i) => { const p = prof(EDS.dp, k).find((z) => z.label === labelFor(k, y)); return p && {label: lab + (k === 'winter' ? ' ' + p.label : '') + (p.full.includes('(') ? ' ' + p.full.slice(p.full.indexOf('(')) : ''), color: k === 'year' ? 'var(--color-fg)' : dash.colors[(i - 1) % dash.colors.length], width: k === 'year' ? 2.6 : 1.6, dash: k === 'year' ? '6 4' : null, rows: p.rows}; }).filter(Boolean);
    }
    const last = periods().slice(-1)[0];
    return (all ? periods() : shown()).map((p) => ({label: p.full, color: colorOf(p), width: last && p.label === last.label ? 2.6 : 1.5, rows: p.rows, on: shown().includes(p)}));
  }

  const chip = (text, on, click, sw) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = text; b.setAttribute('aria-pressed', String(on)); if (sw) { const i = document.createElement('i'); i.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${sw}`; b.prepend(i); } b.onclick = click; return b; };
  const lab = (text) => { const s = document.createElement('span'); s.className = 'muted'; s.textContent = text; s.style.marginRight = '4px'; return s; };
  const areas = () => { const d = dash.data('day_profile'); const cs = d.status === 'ok' ? Array.from(new Set(d.data.map((r) => r.area))) : ['EU27'];
    return cs.sort((a, b) => (a === 'EU27' ? -1 : b === 'EU27' ? 1 : ED.name(a).localeCompare(ED.name(b), 'en'))); };

  dash.draw('dp-select', (sel) => {
    sel.replaceChildren(...areas().map((c) => new Option(ED.name(c), c)));
    sel.value = EDS.dp;
    sel.onchange = () => { EDS.dp = sel.value; EDS.dpYears = null; EDS.dpPeak = null; redraw(); };
  });
  dash.draw('dp-season', (el) => { el.replaceChildren(...SEASONS.map(([k, l]) => chip(l, EDS.dpSeason === k, () => { EDS.dpSeason = k; EDS.dpYears = null; EDS.dpPeak = null; redraw(); }))); });
  dash.draw('dp-unit', (el) => { el.replaceChildren(chip('€/MWh', !EDS.dpRel, () => { EDS.dpRel = false; redraw(); }), chip('% of day average', EDS.dpRel, () => { EDS.dpRel = true; redraw(); })); });
  dash.draw('dp-mode', (el) => { el.replaceChildren(lab('Compare'), ...MODES.map(([k, l]) => chip(l, mode() === k, () => { EDS.dpMode = k; redraw(); }))); });

  dash.draw('dp-price-title', (el) => {
    const u = EDS.dpRel ? ' (day average = 100)' : ' (€/MWh)';
    const m = mode(), y = year();
    el.textContent = 'Average price by hour · ' + (m === 'years' ? ED.name(EDS.dp) + ', ' + SNAME[EDS.dpSeason].toLowerCase() + ', by year'
      : m === 'countries' ? SNAME[EDS.dpSeason] + ' ' + (y ? labelFor(EDS.dpSeason, y) : '') + ', by country'
      : ED.name(EDS.dp) + ', ' + (y || '') + ', by season') + u;
  });

  dash.draw('dp-years', (el) => {
    el.replaceChildren();
    if (mode() === 'years') {
      const ps = periods(), on = shown().map((p) => p.label);
      ps.forEach((p) => el.append(chip(p.full, on.includes(p.label), () => {
        EDS.dpYears = on.includes(p.label) ? on.filter((x) => x !== p.label) : on.concat(p.label);
        ['dp-years', 'dp-price', 'dp-swing'].forEach((n) => dash.draw(n));
      }, on.includes(p.label) ? colorOf(p) : null)));
      return;
    }
    el.append(lab('Year'));
    calYears().forEach((y) => el.append(chip(String(y), y === year(), () => { EDS.dpYear = y; ['dp-years', 'dp-price-title', 'dp-price', 'dp-note', 'dp-swing-title', 'dp-swing'].forEach((n) => dash.draw(n)); })));
  });

  dash.draw('dp-countries', (el) => {
    el.replaceChildren(); el.style.display = mode() !== 'countries' ? 'none' : '';
    if (mode() !== 'countries') return;
    const cmp = (EDS.dpCmp || []).filter((c) => c !== EDS.dp);
    el.append(lab('Compare ' + ED.name(EDS.dp) + ' with'));
    cmp.forEach((c, i) => { const b = chip(ED.name(c) + ' ×', true, () => { EDS.dpCmp = cmp.filter((x) => x !== c); redraw(); }, dash.colors[(i + 1) % dash.colors.length]); b.title = 'Remove ' + ED.name(c); el.append(b); });
    const sel = document.createElement('select'); sel.className = 'dash-select'; sel.setAttribute('aria-label', 'Add a country to compare');
    sel.append(new Option('+ add a country', ''), ...areas().filter((c) => c !== EDS.dp && !cmp.includes(c)).map((c) => new Option(ED.name(c), c)));
    sel.onchange = () => { if (sel.value) { EDS.dpCmp = cmp.concat(sel.value); redraw(); } };
    el.append(sel);
  });

  dash.draw('dp-price', (el) => {
    const d = dash.data('day_profile');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const ser = lines().map((l) => {
      const avg = d3.mean(l.rows, (r) => r.v.price);
      return {label: l.label, color: l.color, width: l.width, dash: l.dash, values: l.rows.map((r) => ({x: hourDate(r.h), y: EDS.dpRel ? 100 * r.v.price / avg : r.v.price}))};
    }).filter((s) => s.values.some((v) => Number.isFinite(v.y)));
    ED.lineChart(el, ser, {height: 280, legend: mode() !== 'years', unit: EDS.dpRel ? '' : '€/MWh', refY: EDS.dpRel ? 100 : undefined, zero: !EDS.dpRel,
      xDomain: [hourDate(0), hourDate(23)], xTick: d3.utcFormat('%H:00'), tipX: (x) => d3.utcFormat('%H:00')(x) + '–' + String(x.getUTCHours() + 1).padStart(2, '0') + ':00', tipFmt: EDS.dpRel ? f.n0 : f.n1,
      empty: mode() === 'years' && periods().length ? 'Pick at least one year' : 'No hourly price data for this choice'});
  });

  dash.draw('dp-note', (el) => {
    if (!periods().length && !prof('EU27', 'year').length) { el.textContent = ''; return; }
    const m = mode();
    el.textContent = (m === 'years' ? 'Click the years to compare them. ' : m === 'countries' ? 'Pick the year above and add countries to compare. The season buttons apply. ' : 'One line per season of the chosen year; the black dashed line is the whole year. Winter runs from December of the year before to February. Seasons not yet complete are left out. ') +
      'Hours in Brussels time; each point is the average of that hour over all days of the period.' +
      (EDS.dpRel ? ' "% of day average" removes the effect of the price level (gas, CO2), so only the shape of the day is compared.' : ' Switch to "% of day average" to compare shapes when price levels differ a lot.') +
      (EDS.dp === 'EU27' || (m === 'countries' && (EDS.dpCmp || []).includes('EU27')) ? ' EU27: country prices weighted by each country\'s demand in that hour.' : '');
  });

  dash.draw('dp-swing-title', (el) => { el.textContent = 'Daily price swing · highest hour minus lowest hour, % of the day\'s average' + (mode() === 'years' ? '' : mode() === 'countries' ? ' · by country' : ' · by season'); });
  dash.draw('dp-swing', (el) => {
    const data = lines(true).map((l) => { const v = l.rows.map((r) => r.v.price).filter(Number.isFinite); const avg = d3.mean(v); return {label: l.label, value: v.length && avg > 0 ? 100 * (d3.max(v) - d3.min(v)) / avg : NaN, color: l.on === false ? 'var(--cds-chart-muted)' : l.color}; }).filter((x) => Number.isFinite(x.value));
    ED.divBars(el, data, {unit: '%', noSign: true, fmt: f.n0});
  });

  const legend = (el, items, demand) => {
    el.replaceChildren();
    items.forEach((k) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = k.color; if (k.neg) i.style.opacity = 0.55; sp.append(i, document.createTextNode(k.label)); el.append(sp); });
    if (demand) { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.cssText = 'background:none;border-top:2px dashed var(--color-fg);height:0;margin-top:6px'; sp.append(i, document.createTextNode('Demand')); el.append(sp); }
  };

  // ---- Who covers the evening peak: gas and storage, two periods side by side ----
  const peakPair = () => {
    const ps = periods(); const lab2 = EDS.dpPeak || [];
    const a = ps.find((p) => p.label === lab2[0]) || ps[ps.length - 2] || ps[0];
    const b = ps.find((p) => p.label === lab2[1]) || ps[ps.length - 1];
    return [a, b];
  };
  const peakKeys = () => PEAK.map(([key, label]) => ({key, label, color: ED.MIXC[label]}));
  dash.draw('dp-peak-years', (el) => {
    el.replaceChildren();
    const ps = periods(), [a, b] = peakPair();
    if (!ps.length) return;
    const mk = (cur, i) => { const s = document.createElement('select'); s.className = 'dash-select'; s.setAttribute('aria-label', i ? 'Second period' : 'First period');
      s.append(...ps.map((p) => new Option(p.full, p.label))); s.value = cur ? cur.label : ''; s.onchange = () => { const v = peakPair().map((p) => p && p.label); v[i] = s.value; EDS.dpPeak = v; ['dp-peak-years', 'dp-peak-a-title', 'dp-peak-a', 'dp-peak-b-title', 'dp-peak-b', 'dp-peak-warn'].forEach((n) => dash.draw(n)); }; return s; };
    el.append(lab(ED.name(EDS.dp) + ', ' + SNAME[EDS.dpSeason].toLowerCase() + ':'), mk(a, 0), lab('compared with'), mk(b, 1));
  });
  const SOLAR = {key: 'solar', label: 'Solar', color: ED.MIXC['Solar']};
  dash.draw('dp-peak-legend', (el) => {
    legend(el, peakKeys(), false);
    const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = SOLAR.color; i.style.opacity = 0.3;
    sp.append(i, document.createTextNode('Solar (shape only, not to scale; hover for MW)')); el.append(sp);
  });
  const solarMax = () => d3.max(peakPair().filter(Boolean), (p) => d3.max(p.rows, (r) => r.v.solar)) || 1;
  const peakMax = () => d3.max(peakPair().filter(Boolean), (p) => d3.max(p.rows, (r) => d3.sum(PEAK, ([k]) => Math.max(0, r.v[k] || 0)))) || 1;
  const peakDraw = (i) => (el) => {
    const d = dash.data('day_profile');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const p = peakPair()[i];
    ED.hourStack(el, p ? p.rows : [], p ? peakKeys() : [], [], {height: 240, yMax: peakMax(), shade: {...SOLAR, max: solarMax()}, empty: 'No data for this period'});
  };
  dash.draw('dp-peak-a-title', (el) => { const p = peakPair()[0]; el.textContent = p ? p.full : '—'; });
  dash.draw('dp-peak-b-title', (el) => { const p = peakPair()[1]; el.textContent = p ? p.full : '—'; });
  dash.draw('dp-peak-a', peakDraw(0));
  dash.draw('dp-peak-b', peakDraw(1));
  dash.draw('dp-peak-warn', (el) => {
    const [a, b] = peakPair(); el.replaceChildren(); el.style.display = 'none';
    if (!a || !b) return;
    const has = (p, k) => p.rows.some((r) => Number.isFinite(r.v[k]));
    const msg = [];
    if (EDS.dp === 'EU27') {
      const rep = areas().filter((c) => c !== 'EU27' && prof(c, EDS.dpSeason).some((p) => p.label === b.label && has(p, 'battery_out')));
      msg.push('EU27 batteries are the sum of the ' + rep.length + ' countries (out of ' + (areas().length - 1) + ') that report them to ENTSO-E' + (rep.length ? ': ' + rep.map(ED.name).join(', ') : '') + '. Countries that do not report batteries are not counted, so the EU27 total is understated.');
    } else if (!has(a, 'battery_out') && !has(b, 'battery_out')) {
      msg.push(ED.name(EDS.dp) + ' does not report batteries to ENTSO-E. The chart shows only gas and pumped storage: any batteries in the country are invisible here.');
    } else if (!has(a, 'battery_out')) {
      msg.push(ED.name(EDS.dp) + ' reports batteries only from ' + b.label + ' on, not in ' + a.label + ': part of the increase may reflect the start of reporting, not new batteries.');
    } else {
      msg.push(ED.name(EDS.dp) + ' reports batteries to ENTSO-E. Reporting may still be incomplete: compare with national sources before quoting the numbers.');
    }
    if (!has(a, 'pumped_out') && !has(b, 'pumped_out')) msg.push('No pumped storage reported.');
    const b0 = document.createElement('strong'); b0.textContent = 'Data coverage: ';
    el.append(b0, document.createTextNode(msg.join(' '))); el.style.display = '';
  });
})();

// ---------- Cross-border flows ----------
(function () {
  const {f} = ED;
  const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
  const NM = {GB: 'United Kingdom', NO: 'Norway', CH: 'Switzerland', RS: 'Serbia', BA: 'Bosnia and Herzegovina', ME: 'Montenegro', MK: 'North Macedonia', AL: 'Albania',
    UA: 'Ukraine', MD: 'Moldova', BY: 'Belarus', RU: 'Russia', TR: 'Türkiye', MA: 'Morocco', AD: 'Andorra', NIE: 'Northern Ireland (UK)'};
  const nm = (c) => NM[c] || ED.name(c);
  const PERS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']];
  const ALL = ['fl-select', 'fl-per', 'fl-period', 'fl-kpis', 'fl-legend', 'fl-map', 'fl-warn', 'fl-th-imp', 'fl-th-exp', 'fl-th-net', 'fl-table', 'fl-hours-title', 'fl-hours', 'fl-hours-note',
    'fl-when-name', 'fl-when-season', 'fl-when-month', 'fl-when-years', 'fl-when', 'fl-when-note'];
  const redraw = () => ALL.forEach((n) => dash.draw(n));
  const IMP = () => dash.colors[0], EXP = () => dash.colors[1];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = (s) => new Date(s + 'T00:00:00Z');
  const iso = (d) => d.toISOString().slice(0, 10);
  const short = (d) => d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
  const ok = (id) => { const d = dash.data(id); return d.status === 'ok' ? d.data : null; };
  const per = () => EDS.flPer || 'month';
  const big = () => per() === 'year';
  const fmt = (gwh) => (big() ? f.n1(gwh / 1000) : gwh >= 100 ? f.n0(gwh) : f.n1(gwh));
  const unit = () => (big() ? 'TWh' : 'GWh');

  // Last day with data, and the periods available for the selected period type: [{key, label, start, end}]
  const lastDay = () => { const d = ok('flows_daily'); return d && d.length ? d3.max(d, (r) => r.date) : null; };
  function periods() {
    const d = ok('flows_daily'), m = ok('flows_monthly'), last = lastDay();
    if (!d || !m || !last) return [];
    const L = day(last);
    if (per() === 'day') return Array.from(new Set(d.map((r) => r.date))).sort().reverse().slice(0, 120)
      .map((k) => ({key: k, label: d3.utcFormat('%a %-d %b %Y')(day(k)), start: k, end: k}));
    if (per() === 'week') {
      const out = []; let mon = d3.utcMonday.floor(L); if (iso(d3.utcDay.offset(mon, 6)) > last) mon = d3.utcDay.offset(mon, -7);
      const first = d3.min(d, (r) => r.date);
      while (iso(mon) >= first && out.length < 52) { const sun = d3.utcDay.offset(mon, 6); out.push({key: iso(mon), label: short(mon) + ' – ' + short(sun) + ' ' + sun.getUTCFullYear(), start: iso(mon), end: iso(sun)}); mon = d3.utcDay.offset(mon, -7); }
      return out;
    }
    if (per() === 'month') return Array.from(new Set(m.map((r) => r.month))).sort().reverse().map((k) => {
      const s0 = day(k + '-01'), e0 = d3.utcDay.offset(d3.utcMonth.offset(s0, 1), -1), e = e0 > L ? L : e0;
      return {key: k, label: MON[s0.getUTCMonth()] + ' ' + s0.getUTCFullYear() + (e0 > L ? ' (to ' + short(L) + ')' : ''), start: iso(s0), end: iso(e)};
    });
    return Array.from(new Set(m.map((r) => r.month.slice(0, 4)))).sort().reverse().map((k) => {
      const e0 = day(k + '-12-31'), e = e0 > L ? L : e0;
      return {key: k, label: k + (e0 > L ? ' (to ' + short(L) + ')' : ''), start: k + '-01-01', end: iso(e)};
    });
  }
  const period = () => { const ps = periods(); return ps.find((p) => p.key === EDS.flSel) || ps[0]; };

  // Flows of the selected country with each partner in the selected period
  function view() {
    const p = period(), X = EDS.fl || 'EU27';
    if (!p) return null;
    const inside = (c) => (X === 'EU27' ? EU.includes(c) : c === X);
    let rows;
    if (per() === 'month' || per() === 'year') rows = (ok('flows_monthly') || []).filter((r) => r.month.startsWith(p.key)).map((r) => ({a: r.from, b: r.to, gwh: +r.gwh, days: +r.days}));
    else rows = (ok('flows_daily') || []).filter((r) => r.date >= p.start && r.date <= p.end).map((r) => ({a: r.from, b: r.to, gwh: +r.gwh, days: 1}));
    const need = d3.utcDay.count(day(p.start), day(p.end)) + 1;
    const by = new Map(), via = new Map();
    const get = (k) => { if (!by.has(k)) by.set(k, {partner: k, imp: 0, exp: 0, dImp: 0, dExp: 0}); return by.get(k); };
    for (const r of rows) {
      if (inside(r.b) && !inside(r.a)) { const o = get(r.a); o.imp += r.gwh; o.dImp += r.days; via.set(r.a + '|' + r.b, (via.get(r.a + '|' + r.b) || 0) + r.gwh); }
      else if (inside(r.a) && !inside(r.b)) { const o = get(r.b); o.exp += r.gwh; o.dExp += r.days; via.set(r.b + '|' + r.a, (via.get(r.b + '|' + r.a) || 0) + r.gwh); }
    }
    // For the EU27: each partner's arrows point at the EU country it trades most with
    const hub = (partner) => (X === 'EU27' ? (Array.from(via).filter(([k]) => k.startsWith(partner + '|')).sort((a, b) => b[1] - a[1])[0] || [partner + '|DE'])[0].split('|')[1] : X);
    const list = Array.from(by.values()).map((o) => ({...o, net: o.imp - o.exp, hub: hub(o.partner)})).sort((a, b) => (b.imp + b.exp) - (a.imp + a.exp));
    // For the EU27 the day counts are summed over the EU countries bordering the partner: show the share only for single countries
    return {p, X, need, list, imp: d3.sum(list, (o) => o.imp), exp: d3.sum(list, (o) => o.exp)};
  }

  dash.draw('fl-select', (sel) => {
    const m = ok('flows_monthly') || [];
    const have = new Set(m.flatMap((r) => [r.from, r.to]));
    const cs = ['EU27'].concat(EU.filter((c) => have.has(c)).sort((a, b) => ED.name(a).localeCompare(ED.name(b), 'en')));
    sel.replaceChildren(...cs.map((c) => new Option(ED.name(c), c)));
    sel.value = EDS.fl || 'EU27';
    sel.onchange = () => { EDS.fl = sel.value; redraw(); };
  });
  dash.draw('fl-per', (el) => {
    el.replaceChildren(...PERS.map(([k, l]) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = l; b.setAttribute('aria-pressed', String(per() === k)); b.onclick = () => { EDS.flPer = k; EDS.flSel = null; redraw(); }; return b; }));
  });
  dash.draw('fl-period', (sel) => {
    const ps = periods(), p = period();
    sel.replaceChildren(...ps.map((x) => new Option(x.label, x.key)));
    if (p) sel.value = p.key;
    sel.onchange = () => { EDS.flSel = sel.value; redraw(); };
  });
  ['imp', 'exp', 'net'].forEach((k) => dash.draw('fl-th-' + k, (el) => { el.textContent = {imp: 'Imports', exp: 'Exports', net: 'Net imports'}[k] + ' (' + unit() + ')'; }));

  dash.draw('fl-kpis', (el) => {
    el.replaceChildren();
    const v = view(); if (!v) { el.textContent = 'No data yet.'; return; }
    const card = (lab, val, sub) => { const d = document.createElement('div'); d.className = 'ti'; const a = document.createElement('div'); a.className = 'lab'; a.textContent = lab; const b = document.createElement('div'); b.className = 'v'; const n = document.createElement('span'); n.textContent = val; const u = document.createElement('span'); u.className = 'u'; u.textContent = unit(); b.append(n, u); const c = document.createElement('div'); c.className = 'c'; c.textContent = sub; d.append(a, b, c); return d; };
    const net = v.imp - v.exp;
    el.append(card('Imports · ' + v.p.label, fmt(v.imp), 'from ' + v.list.filter((o) => o.imp > 0.05).length + ' neighbours'),
      card('Exports · ' + v.p.label, fmt(v.exp), 'to ' + v.list.filter((o) => o.exp > 0.05).length + ' neighbours'),
      card('Net · ' + v.p.label, (net < 0 ? '−' : '') + fmt(Math.abs(net)), net >= 0 ? 'net importer' : 'net exporter'));
  });

  dash.draw('fl-legend', (el) => {
    el.replaceChildren();
    [['Imports (into the country)', IMP()], ['Exports (out of the country)', EXP()]].forEach(([t, c]) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = c; sp.append(i, document.createTextNode(t)); el.append(sp); });
    const sp = document.createElement('span'); sp.textContent = 'Arrow width grows with the amount; hover an arrow for details.'; el.append(sp);
  });

  let geo = null;
  dash.draw('fl-map', (el) => {
    el.replaceChildren();
    const g = ok('geo_europe'), v = view();
    if (!g) { ED.placeholder(el, dash.data('geo_europe').status); return; }
    if (!v) { ED.placeholder(el, 'empty', 'No flow data yet'); return; }
    if (!geo) geo = g.map((r) => ({id: r.id, name: r.name, lon: +r.lon, lat: +r.lat, geometry: r.geometry ? JSON.parse(r.geometry) : null}));
    const F = new Map(geo.map((x) => [x.id, x]));
    const inside = (c) => (v.X === 'EU27' ? EU.includes(c) : c === v.X);
    const W = Math.max(300, el.clientWidth), H = Math.max(380, Math.min(620, Math.round(W * 0.62)));
    const pt = (c) => { const x = F.get(c); return x ? [x.lon, x.lat] : null; };
    const focus = {type: 'FeatureCollection', features: geo.filter((x) => x.geometry && inside(x.id)).map((x) => ({type: 'Feature', geometry: x.geometry}))
      .concat(v.list.map((o) => pt(o.partner)).filter(Boolean).map((c) => ({type: 'Feature', geometry: {type: 'Point', coordinates: c}})))};
    const proj = d3.geoAzimuthalEqualArea().rotate([-12, -52]).fitExtent([[40, 30], [W - 40, H - 30]], focus).clipExtent([[0, 0], [W, H]]);
    const path = d3.geoPath(proj);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || '');
    const partners = new Set(v.list.map((o) => o.partner));
    svg.append('g').selectAll('path').data(geo.filter((x) => x.geometry)).join('path').attr('d', (x) => path({type: 'Feature', geometry: x.geometry}))
      .style('fill', (x) => (inside(x.id) ? 'var(--cds-chart-muted)' : partners.has(x.id) ? 'var(--color-bg-subtle, rgba(127,127,127,.12))' : 'transparent'))
      .style('fill-opacity', (x) => (inside(x.id) ? 0.55 : 1)).style('stroke', 'var(--cds-chart-axis)').style('stroke-width', (x) => (inside(x.id) ? 1.2 : 0.5));
    const max = d3.max(v.list, (o) => Math.max(o.imp, o.exp)) || 1;
    const wid = d3.scaleSqrt().domain([0, max]).range([1.2, 11]);
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; el.append(tip);
    const showTip = (ev, text) => { tip.textContent = text; tip.hidden = false; const r = el.getBoundingClientRect(); tip.style.left = Math.min(ev.clientX - r.left + 12, el.clientWidth - tip.offsetWidth) + 'px'; tip.style.top = Math.max(0, ev.clientY - r.top - 30) + 'px'; };
    const G = svg.append('g');
    const days = (n) => (v.X === 'EU27' ? '' : ' (' + Math.min(n, v.need) + ' of ' + v.need + ' days)');
    for (const o of v.list) {
      const P = pt(o.partner), C = pt(o.hub); if (!P || !C) continue;
      const a = proj(P), b = proj(C); if (!a || !b) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, u = [dx / len, dy / len], n = [-u[1], u[0]];
      const bp = F.get(o.hub + '|' + o.partner) || F.get(o.partner + '|' + o.hub), bpp = bp ? proj([bp.lon, bp.lat]) : null;
      const M = bpp || [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], L = Math.min(len * 0.55, 96);
      const arrow = (val, sign, color, text) => {
        if (!(val > 0.05)) return;
        const w = wid(val), off = sign * (w / 2 + 4);
        const s = [M[0] - sign * u[0] * L / 2 + n[0] * off, M[1] - sign * u[1] * L / 2 + n[1] * off];
        const e = [M[0] + sign * u[0] * L / 2 + n[0] * off, M[1] + sign * u[1] * L / 2 + n[1] * off];
        const d = [sign * u[0], sign * u[1]], hl = Math.max(7, w * 1.6), hw = Math.max(5, w * 1.1);
        const base = [e[0] - d[0] * hl, e[1] - d[1] * hl];
        const gg = G.append('g').style('cursor', 'default').on('pointermove', (ev) => showTip(ev, text)).on('pointerleave', () => { tip.hidden = true; });
        gg.append('line').attr('x1', s[0]).attr('y1', s[1]).attr('x2', base[0]).attr('y2', base[1]).style('stroke', color).attr('stroke-width', w).attr('stroke-linecap', 'butt');
        gg.append('path').attr('d', `M${e[0]},${e[1]}L${base[0] + n[0] * hw},${base[1] + n[1] * hw}L${base[0] - n[0] * hw},${base[1] - n[1] * hw}Z`).style('fill', color);
        gg.append('text').attr('class', 'lbl').attr('x', s[0] + n[0] * sign * (w / 2 + 9)).attr('y', s[1] + n[1] * sign * (w / 2 + 9) + 4).attr('text-anchor', 'middle').style('fill', color).text(fmt(val));
      };
      arrow(o.imp, 1, IMP(), 'Imports from ' + nm(o.partner) + ': ' + fmt(o.imp) + ' ' + unit() + days(o.dImp));
      arrow(o.exp, -1, EXP(), 'Exports to ' + nm(o.partner) + ': ' + fmt(o.exp) + ' ' + unit() + days(o.dExp));
      const lp = proj(P); if (lp) G.append('text').attr('x', lp[0]).attr('y', lp[1]).attr('text-anchor', 'middle').style('fill', 'var(--color-fg-muted)').text(nm(o.partner).replace(' (UK)', ''));
    }
    if (v.X !== 'EU27') { const c = proj(pt(v.X)); if (c) svg.append('text').attr('class', 'lbl').attr('x', c[0]).attr('y', c[1]).attr('text-anchor', 'middle').style('fill', 'var(--color-fg)').text(ED.name(v.X)); }
  });

  dash.draw('fl-warn', (el) => {
    el.replaceChildren(); el.style.display = 'none';
    const v = view(); if (!v || v.X === 'EU27') return;
    const gaps = v.list.filter((o) => (o.imp > 0.05 && o.dImp < v.need) || (o.exp > 0.05 && o.dExp < v.need) || (o.dImp === 0 && o.dExp === 0));
    if (!gaps.length) return;
    const b0 = document.createElement('strong'); b0.textContent = 'Data gaps: ';
    el.append(b0, document.createTextNode('some days are missing for ' + gaps.map((o) => nm(o.partner)).join(', ') + '. Totals for these borders are understated; see the table.'));
    el.style.display = '';
  });

  dash.draw('fl-table', (tb) => {
    tb.replaceChildren();
    const v = view(); if (!v) return;
    const td = (t) => { const c = document.createElement('td'); c.textContent = t; return c; };
    for (const o of v.list) {
      const tr = document.createElement('tr');
      const cov = v.X === 'EU27' ? '—' : Math.min(Math.max(o.dImp, o.dExp), v.need) + ' of ' + v.need;
      tr.append(td(nm(o.partner)), td(fmt(o.imp)), td(fmt(o.exp)), td((o.net < 0 ? '−' : '') + fmt(Math.abs(o.net))), td(cov));
      tb.append(tr);
    }
    const tr = document.createElement('tr'); tr.style.fontWeight = '600';
    tr.append(td('Total'), td(fmt(v.imp)), td(fmt(v.exp)), td((v.imp - v.exp < 0 ? '−' : '') + fmt(Math.abs(v.imp - v.exp))), td(''));
    tb.append(tr);
  });

  // ---- Hour by hour: imports above zero, exports below, net as a line ----
  function hourBars(el, rows, o = {}) {
    el.replaceChildren();
    if (!rows.length) { ED.placeholder(el, 'empty', o.empty || 'No hourly data'); return; }
    const W = Math.max(280, el.clientWidth), H = o.height || 220, m = {t: 10, r: 12, b: 22, l: 52};
    const x = d3.scaleBand().domain(rows.map((r) => r.h)).range([m.l, W - m.r]).padding(0.15);
    const hi = d3.max(rows, (r) => r.imp) || 1, lo = d3.max(rows, (r) => r.exp) || 1;
    const y = d3.scaleLinear().domain([-lo, hi]).nice().range([H - m.b, m.t]);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || '');
    const ya = svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat((v) => f.n0(Math.abs(v))));
    ya.select('.domain').remove(); ya.selectAll('line').style('stroke', 'var(--cds-chart-grid)');
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(rows.map((r) => r.h).filter((h) => h % 3 === 0)).tickFormat((h) => String(h).padStart(2, '0') + ':00')).selectAll('line,path').style('stroke', 'var(--cds-chart-axis)');
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.h)).attr('width', x.bandwidth()).attr('y', (r) => y(r.imp)).attr('height', (r) => y(0) - y(r.imp)).style('fill', IMP());
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.h)).attr('width', x.bandwidth()).attr('y', y(0)).attr('height', (r) => y(-r.exp) - y(0)).style('fill', EXP());
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--color-fg)').attr('stroke-width', 1);
    svg.append('path').datum(rows).attr('fill', 'none').style('stroke', 'var(--color-fg)').attr('stroke-width', 2).attr('d', d3.line().x((r) => x(r.h) + x.bandwidth() / 2).y((r) => y(r.imp - r.exp)));
    svg.append('text').attr('x', m.l + 4).attr('y', m.t + 10).style('fill', 'var(--color-fg-muted)').text('MW · imports ↑ exports ↓ · line = net');
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; el.append(tip);
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px] = d3.pointer(ev); const k = px * W / svg.node().getBoundingClientRect().width;
        const r = rows.reduce((a, b) => (Math.abs(x(b.h) + x.bandwidth() / 2 - k) < Math.abs(x(a.h) + x.bandwidth() / 2 - k) ? b : a));
        const net = r.imp - r.exp;
        tip.textContent = String(r.h).padStart(2, '0') + ':00–' + String(r.h + 1).padStart(2, '0') + ':00 · imports ' + f.n0(r.imp) + ' MW · exports ' + f.n0(r.exp) + ' MW · net ' + (net < 0 ? '−' : '') + f.n0(Math.abs(net)) + ' MW';
        tip.hidden = false; tip.style.left = Math.min(Math.max(0, (x(r.h) + 12) * el.clientWidth / W), el.clientWidth - tip.offsetWidth) + 'px'; tip.style.top = '0px';
      }).on('pointerleave', () => { tip.hidden = true; });
  }

  const recentRows = (area, date) => (ok('flows_hours_recent') || []).filter((r) => r.area === area && r.date === date).map((r) => ({h: +r.hour, imp: +r.imp, exp: +r.exp})).sort((a, b) => a.h - b.h);
  dash.draw('fl-hours-title', (el) => {
    const p = period(); el.textContent = per() === 'day' && p ? 'Hour by hour · ' + ED.name(EDS.fl || 'EU27') + ', ' + p.label : 'Hour by hour';
  });
  dash.draw('fl-hours', (el) => {
    const p = period();
    if (per() !== 'day') { ED.placeholder(el, 'empty', 'Choose "Day" above to see that day hour by hour (last 35 days).'); return; }
    hourBars(el, p ? recentRows(EDS.fl || 'EU27', p.key) : [], {empty: 'Hour-by-hour data are kept for the last 35 days only: pick a more recent day.'});
  });
  dash.draw('fl-hours-note', (el) => { el.textContent = 'Average power in each hour, MW (equal to MWh in that hour). Hours in Brussels time.'; });

  // ---- When does the country import or export during the day ----
  const WS = [['year', 'Whole year'], ['spring', 'Spring'], ['summer', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter']];
  const wseason = () => EDS.flWhen || 'year';
  const wprof = () => { const d = ok('flows_hours_profile') || []; const A = EDS.fl || 'EU27';
    const by = d3.group(d.filter((r) => r.area === A && r.season === wseason()), (r) => r.period);
    return Array.from(by, ([label, rs]) => ({label, full: label + (rs[0].span ? ' (' + rs[0].span + ')' : ''), rows: d3.range(24).map((h) => { const r = rs.find((z) => +z.hour === h) || {}; return {h, imp: +r.imp || 0, exp: +r.exp || 0}; })})).sort((a, b) => (a.label < b.label ? -1 : 1)); };
  const wshown = () => { const ps = wprof(); const sel = EDS.flWhenYears || ps.slice(-3).map((p) => p.label); return ps.filter((p) => sel.includes(p.label)); };
  const wcolor = (p) => { const ps = wprof(); const i = ps.findIndex((z) => z.label === p.label); return dash.colors[(ps.length - 1 - i) % dash.colors.length]; };
  dash.draw('fl-when-name', (el) => { el.textContent = ED.name(EDS.fl || 'EU27'); });
  dash.draw('fl-when-season', (el) => {
    el.replaceChildren(...WS.map(([k, l]) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = l; b.setAttribute('aria-pressed', String(wseason() === k)); b.onclick = () => { EDS.flWhen = k; EDS.flWhenYears = null; redraw(); }; return b; }));
  });
  dash.draw('fl-when-month', (sel) => {
    sel.replaceChildren(new Option('or a month…', ''), ...MON.map((mm, i) => new Option(mm, 'm' + String(i + 1).padStart(2, '0'))));
    sel.value = wseason().startsWith('m') ? wseason() : '';
    sel.onchange = () => { if (sel.value) { EDS.flWhen = sel.value; EDS.flWhenYears = null; redraw(); } };
  });
  dash.draw('fl-when-years', (el) => {
    el.replaceChildren();
    const ps = wprof(), on = wshown().map((p) => p.label);
    ps.forEach((p) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = p.full; b.setAttribute('aria-pressed', String(on.includes(p.label)));
      if (on.includes(p.label)) { const i = document.createElement('i'); i.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${wcolor(p)}`; b.prepend(i); }
      b.onclick = () => { EDS.flWhenYears = on.includes(p.label) ? on.filter((z) => z !== p.label) : on.concat(p.label); ['fl-when-years', 'fl-when', 'fl-when-note'].forEach((n) => dash.draw(n)); };
      el.append(b); });
  });
  dash.draw('fl-when', (el) => {
    const d = dash.data('flows_hours_profile');
    if (d.status !== 'ok') { ED.placeholder(el, d.status); return; }
    const hd = (h) => new Date(Date.UTC(2000, 0, 1, h));
    const ps = wshown(), last = wprof().slice(-1)[0];
    const ser = ps.map((p) => ({label: p.full, color: wcolor(p), width: last && p.label === last.label ? 2.6 : 1.5, values: p.rows.map((r) => ({x: hd(r.h), y: r.imp - r.exp}))}));
    ED.lineChart(el, ser, {height: 260, legend: false, unit: 'MW', refY: 0, xDomain: [hd(0), hd(23)], xTick: d3.utcFormat('%H:00'),
      tipX: (x) => d3.utcFormat('%H:00')(x) + '–' + String(x.getUTCHours() + 1).padStart(2, '0') + ':00 · net imports', tipFmt: f.n0, empty: wprof().length ? 'Pick at least one year' : 'No hourly data for this country'});
  });
  dash.draw('fl-when-note', (el) => {
    const ps = wshown(); if (!ps.length) { el.textContent = ''; return; }
    const p = ps[ps.length - 1];
    const tot = (k) => d3.sum(p.rows, (r) => r[k]) / 1000;
    const imin = p.rows.reduce((a, b) => (b.imp - b.exp < a.imp - a.exp ? b : a)), imax = p.rows.reduce((a, b) => (b.imp - b.exp > a.imp - a.exp ? b : a));
    const hh = (h) => String(h).padStart(2, '0') + ':00';
    el.textContent = p.full + ', average day: imports ' + f.n1(tot('imp')) + ' GWh, exports ' + f.n1(tot('exp')) + ' GWh. Highest net imports at ' + hh(imax.h) + ' (' + f.n0(imax.imp - imax.exp) + ' MW), lowest at ' + hh(imin.h) + ' (' + f.n0(imin.imp - imin.exp) + ' MW).' +
      (wseason().startsWith('m') ? '' : wseason() === 'winter' ? ' Winter runs from December of the year before to February.' : '');
  });
})();
