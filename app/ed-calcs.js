// ---------- calcs ----------
dash.calc('kpi_power', {
  title: 'Prezzo day-ahead: ultimi giorni',
  description: 'Per ogni area: prezzo dell\'ultimo giorno, media degli ultimi 7 giorni e dei 7 giorni prima.',
  inputs: ['prices_daily'],
  fn: (prices_daily) => Array.from(d3.group(prices_daily.filter((d) => d.avg_eur_mwh !== null && d.avg_eur_mwh !== ''), (d) => d.area), ([area, v]) => {
    const r = v.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const last7 = r.slice(-7), prev7 = r.slice(-14, -7);
    const mean = (a) => (a.length ? a.reduce((s, d) => s + Number(d.avg_eur_mwh), 0) / a.length : null);
    const a7 = mean(last7), p7 = mean(prev7), last = r[r.length - 1];
    return {area, last_date: last.date, last_day: Math.round(Number(last.avg_eur_mwh) * 10) / 10, last_min: Number(last.min_eur_mwh), last_max: Number(last.max_eur_mwh), avg7: Math.round(a7 * 10) / 10, prev7: p7 === null ? null : Math.round(p7 * 10) / 10, chg_pct: p7 ? Math.round((a7 / p7 - 1) * 1000) / 10 : null};
  }),
});

dash.calc('price_summary', {
  title: 'Riepilogo prezzi per area',
  description: 'Medie degli ultimi 7 e 30 giorni, media da gennaio all\'ultimo mese completo e stesso periodo dell\'anno prima, ore negative da gennaio, prezzo al dettaglio Eurostat.',
  inputs: ['prices_daily', 'prices_monthly', 'retail_semiannual'],
  fn: (prices_daily, prices_monthly, retail_semiannual) => {
    const lastDate = d3.max(prices_daily, (d) => d.date);
    if (!lastDate) return [];
    const cy = lastDate.slice(0, 4), cm = lastDate.slice(0, 7), py = String(+cy - 1);
    const back = (n) => new Date(Date.parse(lastDate) - (n - 1) * 86400000).toISOString().slice(0, 10);
    const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
    const daily = d3.group(prices_daily, (d) => d.area), monthly = d3.group(prices_monthly, (d) => d.area);
    const ret = d3.group(retail_semiannual.filter((d) => d.product === 'electricity'), (d) => d.geo);
    return Array.from(daily, ([area, v]) => {
      const m = monthly.get(area) || [];
      const wavg = (rows) => { const w = d3.sum(rows, (d) => Number(d.days)); return w ? d3.sum(rows, (d) => Number(d.avg_eur_mwh) * Number(d.days)) / w : NaN; };
      const done = m.filter((d) => d.month.startsWith(cy) && d.month < cm);
      const months = new Set(done.map((d) => d.month.slice(5)));
      const pyRows = m.filter((d) => d.month.startsWith(py) && months.has(d.month.slice(5)));
      const rr = (ret.get(area) || []).slice().sort((a, b) => (a.period < b.period ? -1 : 1));
      const lr = rr[rr.length - 1];
      return {area, avg7: r1(d3.mean(v.filter((d) => d.date >= back(7)), (d) => Number(d.avg_eur_mwh))), avg30: r1(d3.mean(v.filter((d) => d.date >= back(30)), (d) => Number(d.avg_eur_mwh))), ytd: r1(wavg(done)), ytd_py: r1(wavg(pyRows)), neg_ytd: area === 'EU27' ? null : r1(d3.sum(m.filter((d) => d.month.startsWith(cy)), (d) => Number(d.negative_hours))), retail: lr ? r1(Number(lr.eur_per_kwh) * 1000) : null, retail_period: lr ? lr.period : null, ytd_months: months.size};
    });
  },
});

dash.calc('retail_latest', {
  title: 'Prezzi al dettaglio: ultimo semestre',
  description: 'Per paese e UE27: ultimo prezzo Eurostat per le famiglie (elettricità, gas) in €/MWh e variazione sullo stesso semestre dell\'anno prima.',
  inputs: ['retail_semiannual'],
  fn: (retail_semiannual) => Array.from(d3.group(retail_semiannual, (d) => d.geo), ([geo, v]) => {
    const one = (p) => { const r = v.filter((d) => d.product === p).sort((a, b) => (a.period < b.period ? -1 : 1)); const l = r[r.length - 1]; if (!l) return [null, null, null]; const prev = r.find((d) => d.period === (+l.period.slice(0, 4) - 1) + l.period.slice(4)); return [Math.round(Number(l.eur_per_kwh) * 10000) / 10, l.period, prev ? Math.round(1000 * (Number(l.eur_per_kwh) / Number(prev.eur_per_kwh) - 1)) / 10 : null]; };
    const [e, ep, ey] = one('electricity'), [g, gp, gy] = one('gas');
    return {geo, elec_eur_mwh: e, elec_period: ep, elec_yoy_pct: ey, gas_eur_mwh: g, gas_period: gp, gas_yoy_pct: gy};
  }),
});

dash.calc('fuels_latest', {
  title: 'Carburanti: ultima settimana',
  description: 'Per paese e UE: ultimo prezzo di diesel e benzina 95 con tasse (€/l) e variazione sulla settimana prima.',
  inputs: ['fuels_weekly'],
  fn: (fuels_weekly) => Array.from(d3.group(fuels_weekly, (d) => d.country), ([country, v]) => {
    const one = (p) => { const r = v.filter((d) => d.product === p).sort((a, b) => (a.date < b.date ? -1 : 1)); const l = r[r.length - 1], b = r[r.length - 2]; return l ? [Number(l.eur_per_litre), l.date, b ? Math.round(1000 * (Number(l.eur_per_litre) / Number(b.eur_per_litre) - 1)) / 10 : null] : [null, null, null]; };
    const [d, dd, dc] = one('diesel'), [p, , pc] = one('petrol_95');
    return {country, date: dd, diesel: d, diesel_wow_pct: dc, petrol_95: p, petrol_wow_pct: pc};
  }),
});

dash.calc('res_share', {
  title: 'Quota di rinnovabili nella generazione',
  description: "Per paese: quota di idro, eolico, solare e bio nell'ultimo mese con dati, e nello stesso mese dell'anno prima.",
  inputs: ['mix_monthly'],
  fn: (mix_monthly) => {
    const by = d3.rollup(mix_monthly, (v) => ({res: d3.sum(v, (d) => (String(d.renewable) === 'True' || d.renewable === true ? Number(d.gwh) : 0)), tot: d3.sum(v, (d) => Number(d.gwh)), gas: d3.sum(v, (d) => (d.group === 'Gas' ? Number(d.gwh) : 0))}), (d) => d.country, (d) => d.month);
    const out = [];
    for (const [country, months] of by) {
      const ms = Array.from(months.keys()).sort();
      const last = ms[ms.length - 1];
      const py = (Number(last.slice(0, 4)) - 1) + last.slice(4);
      const cur = months.get(last), prev = months.get(py);
      const l12 = ms.slice(-12).map((m) => months.get(m));
      out.push({country, month: last, res_share: cur.tot ? Math.round(1000 * cur.res / cur.tot) / 10 : null, res_share_py: prev && prev.tot ? Math.round(1000 * prev.res / prev.tot) / 10 : null, gas_share_12m: Math.round(1000 * d3.sum(l12, (x) => x.gas) / d3.sum(l12, (x) => x.tot)) / 10});
    }
    return out;
  },
});

dash.calc('nl_latest', {
  title: 'Newsletter DG ENER: ultima edizione',
  description: "Gli indicatori dell'edizione più recente della newsletter settimanale.",
  inputs: ['dgener_weekly'],
  fn: (dgener_weekly) => {
    const last = d3.max(dgener_weekly, (d) => d.edition);
    return dgener_weekly.filter((d) => d.edition === last);
  },
});

dash.calc('spark', {
  title: 'Clean spark spread UE (settimanale)',
  description: 'Prezzo elettrico medio UE meno costo del gas (TTF / 0,50) e della CO2 (EUA x 0,37 t/MWh). Righe dalla più recente.',
  inputs: ['dgener_weekly'],
  fn: (dgener_weekly) => {
    const by = d3.group(dgener_weekly, (d) => d.edition);
    const rows = [];
    for (const [edition, v] of by) {
      const g = (k) => { const r = v.find((d) => d.indicator === k); return r ? Number(r.value) : NaN; };
      const el = g('elec_wholesale_eu'), gas = g('gas_ttf'), eua = g('eua');
      if ([el, gas, eua].every(Number.isFinite)) rows.push({edition, week_end: v[0].week_end, elec: el, gas, eua, clean_spark: Math.round((el - gas / 0.5 - eua * 0.37) * 10) / 10});
    }
    return rows.sort((a, b) => (a.edition < b.edition ? 1 : -1));
  },
});

dash.calc('mix_ytd', {
  title: 'Mix da inizio anno',
  description: "Per paese e fonte: quota sulla generazione da gennaio all'ultimo mese completo, quest'anno, l'anno prima e nel 2021.",
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
      const res = (s) => { const t = ['Solare', 'Eolico', 'Idroelettrico', 'Bio, geotermia e altre rinnovabili'].reduce((z, g) => z + (s.o[g] || 0), 0); return s.tot ? 100 * t / s.tot : NaN; };
      rows.push({key: country + '|Rinnovabili', country, group: 'Rinnovabili (totale)', last_month: last, cur_year: cy, prev_year: py, y2021: r1(res(a)), ypy: r1(res(b)), ycur: r1(res(c)), d_2021: r1(res(c) - res(a)), d_py: r1(res(c) - res(b))});
    }
    return rows;
  },
});
