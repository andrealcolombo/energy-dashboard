// ---------- shared helpers (no writes outside drawings) ----------
window.ED = (function () {
  const it = d3.formatLocale({decimal: ',', thousands: '.', grouping: [3], currency: ['€', '']});
  const f = {n0: it.format(',.0f'), n1: it.format(',.1f'), n2: it.format(',.2f'), n3: it.format(',.3f'), p1: it.format('+,.1f'), p0: it.format('+,.0f')};
  const parseDay = d3.utcParse('%Y-%m-%d'), parseMonth = d3.utcParse('%Y-%m');
  const dayFmt = d3.utcFormat('%d/%m/%Y');
  const MESI = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
  const mLabel = (d) => MESI[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  const NAMES = {EU27:'UE27', AT:'Austria', BE:'Belgio', BG:'Bulgaria', HR:'Croazia', CY:'Cipro', CZ:'Cechia', DK:'Danimarca', EE:'Estonia', FI:'Finlandia', FR:'Francia', DE:'Germania', GR:'Grecia', HU:'Ungheria', IE:'Irlanda', IT:'Italia', LV:'Lettonia', LT:'Lituania', LU:'Lussemburgo', MT:'Malta', NL:'Paesi Bassi', PL:'Polonia', PT:'Portogallo', RO:'Romania', SK:'Slovacchia', SI:'Slovenia', ES:'Spagna', SE:'Svezia', EU:'UE'};
  const name = (c) => NAMES[c] || c.replace('_', ' ');
  const MIXC = {'Solare':'var(--c-solar)','Eolico':'var(--c-wind)','Idroelettrico':'var(--c-hydro)','Bio, geotermia e altre rinnovabili':'var(--c-bio)','Nucleare':'var(--c-nuc)','Gas':'var(--c-gas)','Carbone e lignite':'var(--c-coal)','Petrolio':'var(--c-oil)','Pompaggi':'var(--c-pump)','Altro':'var(--c-other)'};
  const MIXORDER = ['Solare','Eolico','Idroelettrico','Bio, geotermia e altre rinnovabili','Nucleare','Gas','Carbone e lignite','Petrolio','Pompaggi','Altro'];
  const num = (v) => (v === null || v === undefined || v === '' ? NaN : +v);

  function chgSpan(el, pct, opts = {}) {
    el.replaceChildren();
    if (pct === null || pct === undefined || pct === '' || !isFinite(pct)) { el.textContent = opts.empty || '—'; el.className = 'chg flat'; return; }
    const good = opts.upIsGood ? pct > 0 : pct < 0;
    el.className = 'chg ' + (Math.abs(pct) < 0.05 ? 'flat' : good ? 'down' : 'up');
    el.textContent = (pct > 0 ? '▲ ' : pct < 0 ? '▼ ' : '') + f.p1(pct) + (opts.unit || '%') + (opts.suffix ? ' ' + opts.suffix : '');
  }

  function placeholder(el, st, msg) {
    el.replaceChildren();
    if (st === 'error') { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Caricamento non riuscito'; el.append(p); }
    else if (msg) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = msg; el.append(p); }
  }

  // Multi-series line chart. series: [{label, color, values:[{x:Date, y:Number}], dash?, width?}]
  function lineChart(el, series, o = {}) {
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth), H = o.height || 260;
    const all = series.flatMap((s) => s.values).filter((d) => isFinite(d.y));
    if (!all.length) { placeholder(el, 'empty', o.empty || 'Nessun dato'); return; }
    const leg = document.createElement('div'); leg.className = 'legend';
    series.forEach((s) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = s.color; sp.append(i, document.createTextNode(s.label)); leg.append(sp); });
    if (series.length > 1 || o.legend) el.append(leg);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || '');
    const x = d3.scaleUtc().domain(o.xDomain || d3.extent(all, (d) => d.x));
    let lo = d3.min(all, (d) => d.y), hi = d3.max(all, (d) => d.y);
    if (o.refY !== undefined && isFinite(o.refY)) { lo = Math.min(lo, o.refY); hi = Math.max(hi, o.refY); }
    if (o.zero !== false) lo = Math.min(0, lo);
    const y = d3.scaleLinear().domain([lo, hi]).nice();
    const yAxis = svg.append('g');
    yAxis.call(d3.axisLeft(y).ticks(5).tickFormat(o.yFmt || f.n0));
    let ml = 8; yAxis.selectAll('text').each(function () { ml = Math.max(ml, this.getComputedTextLength() + 10); });
    const m = {t: 8, r: 28, b: 22, l: ml};
    x.range([m.l, W - m.r]); y.range([H - m.b, m.t]);
    yAxis.attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(o.yFmt || f.n0));
    yAxis.select('.domain').remove();
    yAxis.selectAll('line').style('stroke', 'var(--cds-chart-grid)');
    const xt = Math.max(2, Math.floor((W - m.l) / 90));
    const xAxis = svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(xt).tickFormat(o.xTick || ((d) => mLabel(d))));
    xAxis.selectAll('line,path').style('stroke', 'var(--cds-chart-axis)');
    if (lo < 0) svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-reference)');
    if (o.refY !== undefined && isFinite(o.refY)) svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(o.refY)).attr('y2', y(o.refY)).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
    const line = d3.line().defined((d) => isFinite(d.y)).x((d) => x(d.x)).y((d) => y(d.y));
    series.forEach((s) => {
      svg.append('path').datum(s.values).attr('fill', 'none').style('stroke', s.color).attr('stroke-width', s.width || 1.6).attr('stroke-dasharray', s.dash || null).attr('d', line);
      if (s.values.length === 1) svg.append('circle').attr('cx', x(s.values[0].x)).attr('cy', y(s.values[0].y)).attr('r', 4).style('fill', s.color);
    });
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; el.append(tip);
    const rule = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-reference)').style('display', 'none');
    const xs = Array.from(new Set(all.map((d) => +d.x))).sort((a, b) => a - b);
    const tf = o.tipX || ((d) => dayFmt(d));
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px] = d3.pointer(ev); const xv = +x.invert(px * W / svg.node().getBoundingClientRect().width);
        const i = d3.bisectCenter(xs, xv); const xx = xs[i]; if (xx === undefined) return;
        rule.attr('x1', x(xx)).attr('x2', x(xx)).style('display', null);
        tip.replaceChildren(); const h = document.createElement('div'); h.className = 'muted'; h.textContent = tf(new Date(xx)); tip.append(h);
        series.forEach((s) => { const p = s.values.find((d) => +d.x === xx); if (!p || !isFinite(p.y)) return; const r = document.createElement('div'); const ii = document.createElement('i'); ii.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;background:${s.color}`; r.append(ii, document.createTextNode(s.label + ': ' + (o.tipFmt || f.n1)(p.y) + (o.unit ? ' ' + o.unit : ''))); tip.append(r); });
        tip.hidden = false;
        const bw = el.clientWidth, sx = x(xx) * bw / W; const tw = tip.offsetWidth;
        tip.style.left = Math.min(Math.max(0, sx + 10), bw - tw) + 'px'; tip.style.top = (series.length > 1 || o.legend ? 22 : 0) + 'px';
      })
      .on('pointerleave', () => { tip.hidden = true; rule.style('display', 'none'); });
  }

  // Stacked monthly shares. rows: [{x:Date, parts:{group:value}, total}]
  function stackChart(el, rows, groups, colors, o = {}) {
    el.replaceChildren();
    if (!rows.length) { placeholder(el, 'empty', 'Nessun dato'); return; }
    const W = Math.max(280, el.clientWidth), H = o.height || 280;
    const m = {t: 8, r: 8, b: 22, l: 34};
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || '');
    const x = d3.scaleBand().domain(rows.map((r) => +r.x)).range([m.l, W - m.r]).paddingInner(0.12);
    const y = d3.scaleLinear().domain([0, 100]).range([H - m.b, m.t]);
    const stacked = d3.stack().keys(groups).value((r, k) => r.parts[k] || 0)(rows);
    const ya = svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat((d) => d + '%'));
    ya.select('.domain').remove(); ya.selectAll('line').style('stroke', 'var(--cds-chart-grid)');
    const years = rows.filter((r) => r.x.getUTCMonth() === 0).map((r) => +r.x);
    const step = Math.max(1, Math.ceil(years.length / Math.max(1, Math.floor((W - m.l) / 60))));
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(years.filter((_, i) => i % step === 0)).tickFormat((d) => new Date(d).getUTCFullYear())).selectAll('line,path').style('stroke', 'var(--cds-chart-axis)');
    stacked.forEach((s) => { svg.append('g').selectAll('rect').data(s).join('rect').attr('x', (d) => x(+d.data.x)).attr('width', x.bandwidth()).attr('y', (d) => y(d[1])).attr('height', (d) => Math.max(0, y(d[0]) - y(d[1]))).style('fill', colors[s.key]); });
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; el.append(tip);
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (d) => x(+d.x)).attr('width', x.step()).attr('y', m.t).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointerenter', (ev, d) => {
        tip.replaceChildren(); const h = document.createElement('div'); h.className = 'muted'; h.textContent = mLabel(d.x) + (d.total ? ' · ' + f.n1(d.total / 1000) + ' TWh' : ''); tip.append(h);
        groups.slice().reverse().forEach((g) => { const v = d.parts[g]; if (!v) return; const r = document.createElement('div'); const ii = document.createElement('i'); ii.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;background:${colors[g]}`; r.append(ii, document.createTextNode(g + ': ' + f.n1(v) + '%')); tip.append(r); });
        tip.hidden = false; const bw = el.clientWidth, sx = x(+d.x) * bw / W; tip.style.left = Math.min(Math.max(0, sx + 12), bw - tip.offsetWidth) + 'px'; tip.style.top = '0px';
      })
      .on('pointerleave', () => { tip.hidden = true; });
  }

  // Horizontal paired bars by category. data: [{cat, a, b}]
  function pairBars(el, data, la, lb, ca, cb) {
    el.replaceChildren();
    if (!data.length) { placeholder(el, 'empty', 'Nessun dato'); return; }
    const leg = document.createElement('div'); leg.className = 'legend';
    [[la, ca], [lb, cb]].forEach(([l, c]) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = c; sp.append(i, document.createTextNode(l)); leg.append(sp); });
    el.append(leg);
    const W = Math.max(280, el.clientWidth), rowH = 26, H = data.length * rowH + 10, lw = 150;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || '');
    const x = d3.scaleLinear().domain([0, d3.max(data, (d) => Math.max(d.a || 0, d.b || 0)) || 1]).range([lw, W - 50]);
    data.forEach((d, i) => {
      const g = svg.append('g').attr('transform', `translate(0,${i * rowH + 4})`);
      g.append('text').attr('x', 0).attr('y', 13).text(d.cat.length > 22 ? d.cat.slice(0, 21) + '…' : d.cat);
      g.append('rect').attr('x', lw).attr('y', 2).attr('height', 9).attr('width', Math.max(0, x(d.a || 0) - lw)).style('fill', ca);
      g.append('rect').attr('x', lw).attr('y', 12).attr('height', 9).attr('width', Math.max(0, x(d.b || 0) - lw)).style('fill', cb);
      g.append('text').attr('x', x(d.a || 0) + 4).attr('y', 10).text(f.n1(d.a || 0));
      g.append('text').attr('x', x(d.b || 0) + 4).attr('y', 21).text(f.n1(d.b || 0));
    });
  }

  // Pie (donut) chart. parts: [{label, value, color}], values in %.
  function pie(el, parts, o = {}) {
    el.replaceChildren();
    parts = parts.filter((p) => p.value > 0);
    if (!parts.length) { placeholder(el, 'empty', o.empty || 'Nessun dato'); return; }
    const W = Math.max(220, el.clientWidth), H = o.height || 230, R = Math.min(H / 2 - 6, W / 2 - 6), r0 = R * 0.52;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || '');
    const g = svg.append('g').attr('transform', `translate(${W / 2},${H / 2})`);
    const arcs = d3.pie().sort(null).value((p) => p.value)(parts);
    const arc = d3.arc().innerRadius(r0).outerRadius(R), lab = d3.arc().innerRadius((R + r0) / 2).outerRadius((R + r0) / 2);
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; el.append(tip);
    g.selectAll('path').data(arcs).join('path').attr('d', arc).style('fill', (d) => d.data.color).style('stroke', 'var(--color-panel)').attr('stroke-width', 1)
      .on('pointermove', (ev, d) => { tip.textContent = d.data.label + ': ' + f.n1(d.data.value) + '%'; tip.hidden = false; const [px, py] = d3.pointer(ev, el); tip.style.left = Math.min(px + 12, el.clientWidth - tip.offsetWidth) + 'px'; tip.style.top = Math.max(0, py - 28) + 'px'; })
      .on('pointerleave', () => { tip.hidden = true; });
    g.selectAll('text.pl').data(arcs.filter((d) => d.data.value >= 6)).join('text').attr('class', 'pl').attr('transform', (d) => `translate(${lab.centroid(d)})`).attr('text-anchor', 'middle').attr('dy', '0.35em').style('fill', '#fff').style('font-weight', '600').text((d) => f.n0(d.data.value) + '%');
    if (o.center) g.append('text').attr('text-anchor', 'middle').attr('dy', '0.35em').style('font-size', '13px').style('fill', 'var(--color-fg)').text(o.center);
  }

  return {f, parseDay, parseMonth, dayFmt, mLabel, name, MIXC, MIXORDER, num, chgSpan, placeholder, lineChart, stackChart, pairBars, pie};
})();

// page state (not data): what the reader has selected
window.EDS = {snap: 'EU27', areas: ['EU27', 'IT', 'HU'], range: 365, mixCountry: 'EU27', nl: 'gas_ttf', fuels: ['EU', 'IT', 'HU'], country: 'IT'};
