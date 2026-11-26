// ---------- shared helpers (no writes outside drawings) ----------
window.ED = (function () {
  const it = d3.formatLocale({decimal: '.', thousands: ',', grouping: [3], currency: ['€', ''], minus: '−'});
  const f = {n0: it.format(',.0f'), n1: it.format(',.1f'), n2: it.format(',.2f'), n3: it.format(',.3f'), p1: it.format('+,.1f'), p0: it.format('+,.0f')};
  const parseDay = d3.utcParse('%Y-%m-%d'), parseMonth = d3.utcParse('%Y-%m');
  const dayFmt = d3.utcFormat('%-d %b %Y'), dayShort = d3.utcFormat('%-d %b');
  const MESI = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mLabel = (d) => MESI[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  const NAMES = {EU27:'EU27', AT:'Austria', BE:'Belgium', BG:'Bulgaria', HR:'Croatia', CY:'Cyprus', CZ:'Czechia', DK:'Denmark', EE:'Estonia', FI:'Finland', FR:'France', DE:'Germany', GR:'Greece', HU:'Hungary', IE:'Ireland', IT:'Italy', LV:'Latvia', LT:'Lithuania', LU:'Luxembourg', MT:'Malta', NL:'Netherlands', PL:'Poland', PT:'Portugal', RO:'Romania', SK:'Slovakia', SI:'Slovenia', ES:'Spain', SE:'Sweden', EU:'EU'};
  const name = (c) => (c === 'IE_SEM' ? 'Ireland (SEM)' : NAMES[c] || c.replace('_', ' '));
  const MIXC = {'Solar':'var(--c-solar)','Wind':'var(--c-wind)','Hydro':'var(--c-hydro)','Bio & other renewables':'var(--c-bio)','Nuclear':'var(--c-nuc)','Gas':'var(--c-gas)','Coal & lignite':'var(--c-coal)','Oil':'var(--c-oil)','Pumped storage':'var(--c-pump)','Battery storage':'var(--c-bat)','Other':'var(--c-other)'};
  const MIXORDER = ['Solar','Wind','Hydro','Bio & other renewables','Nuclear','Gas','Coal & lignite','Oil','Pumped storage','Battery storage','Other'];
  const RES = ['Solar', 'Wind', 'Hydro', 'Bio & other renewables'];
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
    if (st === 'error') { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'Failed to load'; el.append(p); }
    else if (msg) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = msg; el.append(p); }
  }

  // Multi-series line chart. series: [{label, color, values:[{x:Date, y:Number}], dash?, width?}]
  function lineChart(el, series, o = {}) {
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth), H = o.height || 260;
    const all = series.flatMap((s) => s.values).filter((d) => isFinite(d.y));
    if (!all.length) { placeholder(el, 'empty', o.empty || 'No data'); return; }
    const leg = document.createElement('div'); leg.className = 'legend';
    series.forEach((s) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = s.color; sp.append(i, document.createTextNode(s.label)); leg.append(sp); });
    if ((series.length > 1 || o.legend) && o.legend !== false) el.append(leg);
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
        tip.style.left = Math.min(Math.max(0, sx + 10), bw - tw) + 'px'; tip.style.top = ((series.length > 1 || o.legend) && o.legend !== false ? 22 : 0) + 'px';
      })
      .on('pointerleave', () => { tip.hidden = true; rule.style('display', 'none'); });
  }

  // Stacked monthly shares. rows: [{x:Date, parts:{group:value}, total}]
  function stackChart(el, rows, groups, colors, o = {}) {
    el.replaceChildren();
    if (!rows.length) { placeholder(el, 'empty', 'No data'); return; }
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

  // Diverging horizontal bars. data: [{label, value, color}] (value can be negative)
  function divBars(el, data, o = {}) {
    el.replaceChildren();
    if (!data.length) { placeholder(el, 'empty', 'No data'); return; }
    const W = Math.max(280, el.clientWidth), rowH = 24, H = data.length * rowH + 8, lw = Math.min(170, W * 0.36);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || '');
    const ext = d3.max(data, (d) => Math.abs(d.value)) || 1;
    const x = d3.scaleLinear().domain([d3.min(data, (d) => d.value) >= 0 ? 0 : -ext, ext]).range([lw + (d3.min(data, (d) => d.value) >= 0 ? 8 : 44), W - 64]);
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', H).style('stroke', 'var(--cds-chart-reference)');
    data.forEach((d, i) => {
      const y = i * rowH + 4;
      svg.append('text').attr('x', 0).attr('y', y + 13).text(d.label);
      svg.append('rect').attr('x', Math.min(x(0), x(d.value))).attr('y', y + 3).attr('height', 14).attr('width', Math.abs(x(d.value) - x(0))).style('fill', d.color);
      svg.append('text').attr('x', d.value >= 0 ? x(d.value) + 4 : x(d.value) - 4).attr('y', y + 14).attr('text-anchor', d.value >= 0 ? 'start' : 'end').text((d.value > 0 && !o.noSign ? '+' : '') + (o.fmt || f.n1)(d.value) + (o.unit || ''));
    });
  }

  // Pie (donut) chart. parts: [{label, value, color}], values in %.
  function pie(el, parts, o = {}) {
    el.replaceChildren();
    parts = parts.filter((p) => p.value > 0);
    if (!parts.length) { placeholder(el, 'empty', o.empty || 'No data'); return; }
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

  // Spider (radar) chart of ratios to a reference (1 = reference).
  // axes: [{id, label, ratio, text}] ; onPick(axis) called on click.
  function spider(el, axes, o = {}) {
    el.replaceChildren();
    if (axes.length < 3) { placeholder(el, 'empty', o.empty || 'Pick at least three indicators'); return; }
    const W = Math.max(300, el.clientWidth), H = o.height || Math.min(520, Math.max(360, W * 0.75));
    const R = Math.min(W / 2 - 110, H / 2 - 40), max = o.max || 2.5;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || '');
    const g = svg.append('g').attr('transform', `translate(${W / 2},${H / 2})`);
    const r = d3.scaleLinear().domain([0, max]).range([0, R]);
    const ang = (i) => (2 * Math.PI * i) / axes.length - Math.PI / 2;
    const pt = (i, v) => [Math.cos(ang(i)) * r(Math.min(max, Math.max(0, v))), Math.sin(ang(i)) * r(Math.min(max, Math.max(0, v)))];
    [0.5, 1.5, 2, 2.5].filter((v) => v <= max).forEach((v) => g.append('circle').attr('r', r(v)).style('fill', 'none').style('stroke', 'var(--cds-chart-grid)'));
    axes.forEach((a, i) => {
      const [x, y] = pt(i, max);
      g.append('line').attr('x1', 0).attr('y1', 0).attr('x2', x).attr('y2', y).style('stroke', 'var(--cds-chart-grid)');
      const [lx, ly] = [Math.cos(ang(i)) * (R + 14), Math.sin(ang(i)) * (R + 14)];
      const t = g.append('text').attr('x', lx).attr('y', ly).attr('dy', '0.35em').attr('text-anchor', Math.abs(lx) < 5 ? 'middle' : lx > 0 ? 'start' : 'end').style('cursor', 'pointer').text(a.label);
      t.on('click', () => o.onPick && o.onPick(a));
    });
    const ref = axes.map((a, i) => pt(i, 1));
    g.append('path').attr('d', d3.line().curve(d3.curveLinearClosed)(ref)).style('fill', 'var(--cds-chart-muted)').style('fill-opacity', 0.35).style('stroke', 'var(--cds-chart-muted)').attr('stroke-width', 1.5);
    const vals = axes.map((a, i) => pt(i, Number.isFinite(a.ratio) ? a.ratio : 0));
    g.append('path').attr('d', d3.line().curve(d3.curveLinearClosed)(vals)).style('fill', o.color).style('fill-opacity', 0.15).style('stroke', o.color).attr('stroke-width', 2);
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; el.append(tip);
    axes.forEach((a, i) => {
      if (!Number.isFinite(a.ratio)) return;
      const [x, y] = vals[i];
      g.append('circle').attr('cx', x).attr('cy', y).attr('r', 6).style('fill', o.color).style('stroke', 'var(--color-panel)').attr('stroke-width', 2).style('cursor', 'pointer')
        .on('pointerenter', (ev) => { tip.textContent = a.text; tip.hidden = false; const bw = el.clientWidth, s = bw / W; tip.style.left = Math.min(Math.max(0, (W / 2 + x) * s + 10), bw - tip.offsetWidth) + 'px'; tip.style.top = Math.max(0, (H / 2 + y) * s - 30) + 'px'; })
        .on('pointerleave', () => { tip.hidden = true; })
        .on('click', () => o.onPick && o.onPick(a));
      if (a.ratio > max) g.append('text').attr('x', x).attr('y', y - 10).attr('text-anchor', 'middle').text('▲');
    });
  }

  // Hour-of-day stacked areas (MW). rows: [{h, v:{key:value}}]; pos/neg: [{key,label,color}]; line: key drawn as a line.
  function hourStack(el, rows, pos, neg, o = {}) {
    el.replaceChildren();
    if (!rows.length) { placeholder(el, 'empty', o.empty || 'No data'); return; }
    const W = Math.max(280, el.clientWidth), H = o.height || 300;
    const keys = pos.concat(neg);
    const rr = rows.map((r) => { const o2 = {h: r.h}; pos.forEach((k) => { o2[k.key] = Math.max(0, r.v[k.key] || 0); }); neg.forEach((k) => { o2[k.key] = -Math.max(0, r.v[k.key] || 0); }); return o2; });
    const st = d3.stack().keys(pos.map((k) => k.key))(rr).concat(neg.length ? d3.stack().keys(neg.map((k) => k.key)).offset(d3.stackOffsetDiverging)(rr.map((r) => { const o2 = {h: r.h}; neg.forEach((k) => { o2[k.key] = r[k.key] || -1e-9; }); return o2; })) : []);
    const lineV = o.line ? rows.map((r) => ({h: r.h, y: r.v[o.line]})) : [];
    const hi = o.yMax || Math.max(d3.max(st, (s) => d3.max(s, (d) => d[1])) || 0, d3.max(lineV, (d) => d.y) || 0);
    const lo = Math.min(0, d3.min(st, (s) => d3.min(s, (d) => d[0])) || 0);
    const y = d3.scaleLinear().domain([lo, hi]).nice();
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || '');
    const fmt = (v) => (Math.abs(v) >= 1000 ? f.n0(v / 1000) + 'k' : f.n0(v));
    const ya = svg.append('g'); ya.call(d3.axisLeft(y).ticks(5).tickFormat(fmt));
    let ml = 8; ya.selectAll('text').each(function () { ml = Math.max(ml, this.getComputedTextLength() + 10); });
    const m = {t: 8, r: 14, b: 22, l: ml};
    const x = d3.scaleLinear().domain([0, 23]).range([m.l, W - m.r]); y.range([H - m.b, m.t]);
    ya.attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(fmt));
    ya.select('.domain').remove(); ya.selectAll('line').style('stroke', 'var(--cds-chart-grid)');
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues([0, 3, 6, 9, 12, 15, 18, 21]).tickFormat((h) => String(h).padStart(2, '0') + ':00')).selectAll('line,path').style('stroke', 'var(--cds-chart-axis)');
    if (o.shade) {
      const sm = o.shade.max || d3.max(rows, (r) => r.v[o.shade.key]) || 1, top = y.domain()[1];
      svg.append('path').datum(rows.filter((r) => Number.isFinite(r.v[o.shade.key]))).style('fill', o.shade.color).style('fill-opacity', 0.22)
        .attr('d', d3.area().curve(d3.curveMonotoneX).x((r) => x(r.h)).y0(y(0)).y1((r) => y(top * 0.95 * Math.max(0, r.v[o.shade.key]) / sm)));
    }
    const area = d3.area().x((d) => x(d.data.h)).y0((d) => y(d[0])).y1((d) => y(d[1]));
    st.forEach((s) => { const k = keys.find((z) => z.key === s.key); svg.append('path').datum(s).attr('d', area).style('fill', k.color).style('fill-opacity', k.neg ? 0.55 : 0.9); });
    if (lo < 0) svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-reference)');
    if (lineV.length) svg.append('path').datum(lineV).attr('fill', 'none').style('stroke', 'var(--color-fg)').attr('stroke-width', 2).attr('stroke-dasharray', '5 3').attr('d', d3.line().defined((d) => isFinite(d.y)).x((d) => x(d.h)).y((d) => y(d.y)));
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; el.append(tip);
    const rule = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-reference)').style('display', 'none');
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px] = d3.pointer(ev); const hh = Math.max(0, Math.min(23, Math.round(x.invert(px * W / svg.node().getBoundingClientRect().width))));
        const r = rows.find((z) => z.h === hh); if (!r) return;
        rule.attr('x1', x(hh)).attr('x2', x(hh)).style('display', null);
        tip.replaceChildren(); const h = document.createElement('div'); h.className = 'muted'; h.textContent = String(hh).padStart(2, '0') + ':00–' + String(hh + 1).padStart(2, '0') + ':00' + (o.line && isFinite(r.v[o.line]) ? ' · demand ' + f.n0(r.v[o.line]) + ' MW' : ''); tip.append(h);
        (o.shade && isFinite(r.v[o.shade.key]) ? [{key: o.shade.key, label: o.shade.label + ' (background shape)', color: o.shade.color}] : []).concat(pos.slice().reverse(), neg).forEach((k) => { const v = r.v[k.key]; if (!(v > 0.5)) return; const d = document.createElement('div'); const ii = document.createElement('i'); ii.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;background:${k.color};opacity:${k.neg ? 0.55 : 1}`; d.append(ii, document.createTextNode(k.label + ': ' + (k.neg ? '−' : '') + f.n0(v) + ' MW')); tip.append(d); });
        tip.hidden = false; const bw = el.clientWidth, sx = x(hh) * bw / W; tip.style.left = Math.min(Math.max(0, sx + 12), bw - tip.offsetWidth) + 'px'; tip.style.top = '0px';
      })
      .on('pointerleave', () => { tip.hidden = true; rule.style('display', 'none'); });
  }

  // Hour-of-day balance as shares of demand (%). P: {rows:[{h, v:{load, key:MW}}]} or null.
  // pos: sources stacked above zero, neg: below zero ([{key, label, color, op}]).
  // o: {yDomain, h (marker hour), bat (batteries reported?), onHover(h), empty}. Returns {setH(h)}.
  function shareStack(el, P, pos, neg, o = {}) {
    el.replaceChildren();
    if (!P || !P.rows.length) { placeholder(el, 'empty', o.empty || 'No data'); return {setH() {}}; }
    const W = Math.max(280, el.clientWidth), H = o.height || 300, m = {t: 26, r: 18, b: 22, l: 36};
    const sh = (r, k) => { const l = r.v.load, x = r.v[k]; return l > 0 && Number.isFinite(x) ? 100 * Math.max(0, x) / l : 0; };
    const layers = [];
    let base = P.rows.map(() => 0);
    pos.forEach((k) => { const top = P.rows.map((r, i) => base[i] + sh(r, k.key)); layers.push({k, lo: base, hi: top}); base = top; });
    base = P.rows.map(() => 0);
    neg.forEach((k) => { const bot = P.rows.map((r, i) => base[i] - sh(r, k.key)); layers.push({k, lo: bot, hi: base}); base = bot; });
    const dom = o.yDomain || [Math.min(0, d3.min(layers, (l) => d3.min(l.lo))), Math.max(100, d3.max(layers, (l) => d3.max(l.hi)))];
    const x = d3.scaleLinear().domain([0, 23]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain(dom).nice().range([H - m.b, m.t]);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', el.getAttribute('aria-label') || '');
    const ya = svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSize(-(W - m.l - m.r)).tickFormat((v) => f.n0(v)));
    ya.select('.domain').remove(); ya.selectAll('line').style('stroke', 'var(--cds-chart-grid)');
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues([0, 6, 12, 18, 23]).tickFormat((h) => String(h).padStart(2, '0') + ':00')).selectAll('line,path').style('stroke', 'var(--cds-chart-axis)');
    layers.forEach((l) => svg.append('path').attr('d', d3.area().x((_, i) => x(P.rows[i].h)).y0((_, i) => y(l.lo[i])).y1((_, i) => y(l.hi[i]))(P.rows))
      .style('fill', l.k.color).style('fill-opacity', l.k.op || 1).style('stroke', 'var(--color-bg, #fff)').attr('stroke-width', 0.6));
    [0, 100].forEach((v) => svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(v)).attr('y2', y(v)).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', v ? '4 3' : null));
    svg.append('text').attr('x', W - m.r).attr('y', y(100) - 4).attr('text-anchor', 'end').text('demand = 100');
    const bat = (h) => { const r = P.rows.find((z) => z.h === h); return r ? sh(r, 'battery_out') : NaN; };
    const rule = svg.append('line').attr('y1', m.t - 6).attr('y2', H - m.b).style('stroke', 'var(--color-fg)').attr('stroke-width', 1.6);
    const lab = svg.append('text').attr('y', 13).style('fill', 'var(--color-fg)').style('font-size', '12px');
    const hh = (h) => String(h).padStart(2, '0') + ':00';
    const setH = (h) => {
      rule.attr('x1', x(h)).attr('x2', x(h));
      lab.attr('x', Math.min(Math.max(x(h), m.l + 80), W - m.r - 80)).attr('text-anchor', 'middle').text(null);
      if (o.bat) { lab.append('tspan').text('Batteries at ' + hh(h) + ': '); lab.append('tspan').style('font-weight', '700').text((bat(h) < 1 ? f.n2(bat(h)) : f.n1(bat(h))) + '%'); }
      else lab.append('tspan').text(hh(h) + ' · batteries not reported');
    };
    setH(o.h === undefined ? 19 : o.h);
    const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; el.append(tip);
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px] = d3.pointer(ev); const h = Math.max(0, Math.min(23, Math.round(x.invert(px * W / svg.node().getBoundingClientRect().width))));
        if (o.onHover) o.onHover(h); else setH(h);
        const r = P.rows.find((z) => z.h === h); if (!r) return;
        tip.replaceChildren(); const hd = document.createElement('div'); hd.className = 'muted'; hd.textContent = hh(h) + '–' + hh(h + 1) + ' · % of demand'; tip.append(hd);
        const line = (k, v, sign) => { const d = document.createElement('div'); const ii = document.createElement('i'); ii.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;background:${k.color};opacity:${k.op || 1}`; d.append(ii, document.createTextNode(k.label + ': ' + sign + f.n1(v) + '%')); tip.append(d); };
        pos.slice().reverse().forEach((k) => { const v = sh(r, k.key); if (k.key === 'battery_out' && !o.bat) return; if (v >= 0.05 || k.key === 'battery_out') line(k, v, ''); });
        neg.forEach((k) => { const v = sh(r, k.key); if (v >= 0.05) line(k, v, '−'); });
        const ni = sh(r, 'imp') - sh(r, 'exp'); const n = document.createElement('div'); n.style.fontWeight = '600'; n.textContent = 'Net ' + (ni >= 0 ? 'imports' : 'exports') + ': ' + f.n1(Math.abs(ni)) + '%'; tip.append(n);
        const dm = document.createElement('div'); dm.className = 'muted'; dm.textContent = 'Demand: ' + f.n1(r.v.load / 1000) + ' GW'; tip.append(dm);
        tip.hidden = false; const bw = el.clientWidth, sx = x(h) * bw / W; tip.style.left = (sx + 14 + tip.offsetWidth > bw ? Math.max(0, sx - 14 - tip.offsetWidth) : sx + 14) + 'px'; tip.style.top = '20px';
      })
      .on('pointerleave', () => { tip.hidden = true; });
    return {setH};
  }

  return {f, parseDay, parseMonth, dayFmt, dayShort, mLabel, name, MIXC, MIXORDER, RES, num, chgSpan, placeholder, lineChart, stackChart, divBars, pie, spider, hourStack, shareStack};
})();

// page state (not data): what the reader has selected. One country (c) for every tab.
window.EDS = {c: 'EU27', extra: [], range: 365, nl: 'gas_ttf', ref: 'EU27', dpSeason: 'year', dpRel: false, dpYears: null, dpMode: 'years', dpCmp: [], dpYear: null,
  flPer: 'month', flSel: null, flWhen: 'year', flWhenYears: null, dmSeason: 'year', dmPair: null, dmH: 19, ind: ['w7', 're_el', 'diesel', 'res_1m', 'gas_12m', 'solar_12m']};
// Older names used by the tabs all point at the single country
['country', 'mix', 'profile', 'dp', 'fl'].forEach((k) => Object.defineProperty(EDS, k, {get: () => EDS.c, set: (v) => { EDS.c = v; }, enumerable: true}));
// Price comparison: the chosen country and the EU27 are always shown, plus up to four other areas
Object.defineProperty(EDS, 'areas', {enumerable: true,
  get: () => { const b = EDS.c === 'EU27' ? ['EU27'] : [EDS.c, 'EU27']; return b.concat(EDS.extra.filter((a) => !b.includes(a))).slice(0, 6); },
  set: (v) => { const b = EDS.c === 'EU27' ? ['EU27'] : [EDS.c, 'EU27']; EDS.extra = v.filter((a) => !b.includes(a)); }});
