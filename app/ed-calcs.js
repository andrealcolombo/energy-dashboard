// ---------- calcs ----------
dash.calc('kpi_power', {
  title: 'Day-ahead price: latest days',
  description: 'For every area: latest day and the day before, average of the last 7 days and of the 7 days before.',
  inputs: ['prices_daily'],
  fn: (prices_daily) => Array.from(d3.group(prices_daily.filter((d) => d.avg_eur_mwh !== null && d.avg_eur_mwh !== ''), (d) => d.area), ([area, v]) => {
    const r = v.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const last7 = r.slice(-7), prev7 = r.slice(-14, -7);
    const mean = (a) => (a.length ? a.reduce((s, d) => s + Number(d.avg_eur_mwh), 0) / a.length : null);
    const a7 = mean(last7), p7 = mean(prev7), last = r[r.length - 1], prev = r[r.length - 2];
    const r1 = (x) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
    return {area, last_date: last.date, last_day: r1(Number(last.avg_eur_mwh)), prev_day: prev ? r1(Number(prev.avg_eur_mwh)) : null, day_chg_pct: prev ? r1(100 * (Number(last.avg_eur_mwh) / Number(prev.avg_eur_mwh) - 1)) : null, avg7: r1(a7), prev7: r1(p7), chg_pct: p7 ? r1(100 * (a7 / p7 - 1)) : null};
  }),
});

dash.calc('retail_latest', {
  title: 'Household prices: latest half-year',
  description: 'For each country and the EU27: latest Eurostat household price of electricity and gas in €/MWh, and change on the same half-year a year earlier.',
  inputs: ['retail_semiannual'],
  fn: (retail_semiannual) => Array.from(d3.group(retail_semiannual, (d) => d.geo), ([geo, v]) => {
    const one = (p) => { const r = v.filter((d) => d.product === p).sort((a, b) => (a.period < b.period ? -1 : 1)); const l = r[r.length - 1]; if (!l) return [null, null, null]; const prev = r.find((d) => d.period === (+l.period.slice(0, 4) - 1) + l.period.slice(4)); return [Math.round(Number(l.eur_per_kwh) * 10000) / 10, l.period, prev ? Math.round(1000 * (Number(l.eur_per_kwh) / Number(prev.eur_per_kwh) - 1)) / 10 : null]; };
    const [e, ep, ey] = one('electricity'), [g, gp, gy] = one('gas');
    return {geo, elec_eur_mwh: e, elec_period: ep, elec_yoy_pct: ey, gas_eur_mwh: g, gas_period: gp, gas_yoy_pct: gy};
  }),
});

dash.calc('fuels_latest', {
  title: 'Pump prices: latest week',
  description: 'For each country and the EU: latest diesel and petrol 95 price with taxes (€/l) and change on the week before.',
  inputs: ['fuels_weekly'],
  fn: (fuels_weekly) => Array.from(d3.group(fuels_weekly, (d) => d.country), ([country, v]) => {
    const one = (p) => { const r = v.filter((d) => d.product === p).sort((a, b) => (a.date < b.date ? -1 : 1)); const l = r[r.length - 1], b = r[r.length - 2]; return l ? [Number(l.eur_per_litre), l.date, b ? Math.round(1000 * (Number(l.eur_per_litre) / Number(b.eur_per_litre) - 1)) / 10 : null] : [null, null, null]; };
    const [d, dd, dc] = one('diesel'), [p, , pc] = one('petrol_95');
    return {country, date: dd, diesel: d, diesel_wow_pct: dc, petrol_95: p, petrol_wow_pct: pc};
  }),
});

dash.calc('nl_latest', {
  title: 'DG ENER newsletter: latest edition',
  description: 'Indicators from the most recent weekly newsletter.',
  inputs: ['dgener_weekly'],
  fn: (dgener_weekly) => {
    const last = d3.max(dgener_weekly, (d) => d.edition);
    return dgener_weekly.filter((d) => d.edition === last);
  },
});

dash.calc('mix_ytd', {
  title: 'Generation mix, year to date',
  description: 'For each country and source: share of generation from January to the last complete month, this year, last year and in 2021.',
  inputs: ['mix_monthly'],
  fn: (mix_monthly) => {
    const rows = [];
    for (const [country, v] of d3.group(mix_monthly, (d) => d.country)) {
      const last = d3.max(v, (d) => d.month);
      const cy = last.slice(0, 4), mm = last.slice(5), py = String(+cy - 1);
      const share = (yr) => { const w = v.filter((d) => d.month.slice(0, 4) === yr && d.month.slice(5) <= mm); const tot = d3.sum(w, (d) => Number(d.gwh)); const o = {}; w.forEach((d) => { o[d.group] = (o[d.group] || 0) + Number(d.gwh); }); return {tot, o}; };
      const a = share('2021'), b = share(py), c = share(cy);
      const groups = new Set([...Object.keys(a.o), ...Object.keys(b.o), ...Object.keys(c.o)]);
      const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
      const pct = (s, g) => (s.tot ? 100 * (s.o[g] || 0) / s.tot : NaN);
      for (const g of groups) rows.push({key: country + '|' + g, country, group: g, last_month: last, cur_year: cy, prev_year: py, y2021: r1(pct(a, g)), ypy: r1(pct(b, g)), ycur: r1(pct(c, g)), d_2021: r1(pct(c, g) - pct(a, g)), d_py: r1(pct(c, g) - pct(b, g))});
      const res = (s) => { const t = ['Solar', 'Wind', 'Hydro', 'Bio & other renewables'].reduce((z, g) => z + (s.o[g] || 0), 0); return s.tot ? 100 * t / s.tot : NaN; };
      rows.push({key: country + '|Renewables', country, group: 'Renewables (total)', last_month: last, cur_year: cy, prev_year: py, y2021: r1(res(a)), ypy: r1(res(b)), ycur: r1(res(c)), d_2021: r1(res(c) - res(a)), d_py: r1(res(c) - res(b))});
    }
    return rows;
  },
});

dash.calc('profile', {
  title: 'Country profile indicators',
  description: 'One value per country and indicator, and the same for the EU27 (load-weighted price; EU27 generation totals; EU averages from Eurostat and the Oil Bulletin; for negative-price hours, the mean of countries).',
  inputs: ['prices_daily', 'prices_monthly', 'retail_semiannual', 'fuels_weekly', 'mix_monthly'],
  fn: (prices_daily, prices_monthly, retail_semiannual, fuels_weekly, mix_monthly) => {
    const out = [];
    const put = (country, indicator, value) => { if (Number.isFinite(value)) out.push({key: country + '|' + indicator, country, indicator, value: Math.round(value * 1000) / 1000}); };
    const lastDate = d3.max(prices_daily, (d) => d.date);
    if (lastDate) {
      const back = (n) => new Date(Date.parse(lastDate) - (n - 1) * 86400000).toISOString().slice(0, 10);
      const cy = lastDate.slice(0, 4), cm = lastDate.slice(0, 7);
      const daily = d3.group(prices_daily.filter((d) => d.level !== 'zone'), (d) => d.country);
      const monthly = d3.group(prices_monthly.filter((d) => d.level !== 'zone'), (d) => d.country);
      const negs = [];
      for (const [c, v] of daily) {
        const p = (n) => v.filter((d) => d.date >= back(n)).map((d) => Number(d.avg_eur_mwh));
        put(c, 'w7', d3.mean(p(7)));
        put(c, 'vol30', d3.deviation(p(30)));
        const m = (monthly.get(c) || []).filter((d) => d.month.startsWith(cy) && d.month < cm);
        const w = d3.sum(m, (d) => Number(d.days));
        if (w) put(c, 'wytd', d3.sum(m, (d) => Number(d.avg_eur_mwh) * Number(d.days)) / w);
        if (c !== 'EU27') { const n = d3.sum((monthly.get(c) || []).filter((d) => d.month.startsWith(cy)), (d) => Number(d.negative_hours)); put(c, 'neg_ytd', n); negs.push(n); }
      }
      if (negs.length) put('EU27', 'neg_ytd', d3.mean(negs));
    }
    for (const [geo, v] of d3.group(retail_semiannual, (d) => d.geo)) {
      for (const [p, id] of [['electricity', 're_el'], ['gas', 're_gas']]) { const r = v.filter((d) => d.product === p).sort((a, b) => (a.period < b.period ? -1 : 1)); if (r.length) put(geo, id, 1000 * Number(r[r.length - 1].eur_per_kwh)); }
    }
    for (const [c, v] of d3.group(fuels_weekly, (d) => d.country)) {
      const key = c === 'EU' ? 'EU27' : c;
      for (const [p, id] of [['diesel', 'diesel'], ['petrol_95', 'petrol']]) { const r = v.filter((d) => d.product === p).sort((a, b) => (a.date < b.date ? -1 : 1)); if (r.length) put(key, id, Number(r[r.length - 1].eur_per_litre)); }
    }
    for (const [c, v] of d3.group(mix_monthly, (d) => d.country)) {
      const ms = Array.from(new Set(v.map((d) => d.month))).sort();
      const sh = (months, groups) => { const w = v.filter((d) => months.includes(d.month)); const t = d3.sum(w, (d) => Number(d.gwh)); return t ? 100 * d3.sum(w.filter((d) => groups.includes(d.group)), (d) => Number(d.gwh)) / t : NaN; };
      const m1 = ms.slice(-1), m12 = ms.slice(-12);
      const RES = ['Solar', 'Wind', 'Hydro', 'Bio & other renewables'];
      put(c, 'res_1m', sh(m1, RES)); put(c, 'res_12m', sh(m12, RES));
      put(c, 'solar_12m', sh(m12, ['Solar'])); put(c, 'wind_12m', sh(m12, ['Wind'])); put(c, 'hydro_12m', sh(m12, ['Hydro']));
      put(c, 'nuclear_12m', sh(m12, ['Nuclear'])); put(c, 'gas_12m', sh(m12, ['Gas'])); put(c, 'coal_12m', sh(m12, ['Coal & lignite']));
    }
    return out;
  },
});
