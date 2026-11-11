// ---------- calcs ----------
dash.calc('mix_week', {
  title: "Mix dell'ultima settimana",
  description: 'Per UE27, Italia, Ungheria e altri grandi paesi: quote per fonte negli ultimi 7 giorni e differenza dalle 4 settimane precedenti.',
  inputs: ['mix_weekly'],
  fn: (mix_weekly) => {
    const sh = (c, p, gs) => d3.sum(mix_weekly.filter((d) => d.country === c && d.period === p && gs.includes(d.group)), (d) => Number(d.share_pct));
    const RES = ['Solare', 'Eolico', 'Idroelettrico', 'Bio, geotermia e altre rinnovabili'];
    const r1 = (x) => Math.round(x * 10) / 10;
    return ['EU27', 'IT', 'HU', 'DE', 'FR', 'ES', 'PL', 'AT'].filter((c) => mix_weekly.some((d) => d.country === c && d.period === 'ultimi_7')).map((c) => {
      const any = mix_weekly.find((d) => d.country === c && d.period === 'ultimi_7');
      return {country: c, from: any.from, to: any.to, res7: r1(sh(c, 'ultimi_7', RES)), res_d: r1(sh(c, 'ultimi_7', RES) - sh(c, 'prec_28', RES)), wind7: r1(sh(c, 'ultimi_7', ['Eolico'])), solar7: r1(sh(c, 'ultimi_7', ['Solare'])), gas7: r1(sh(c, 'ultimi_7', ['Gas'])), gas_d: r1(sh(c, 'ultimi_7', ['Gas']) - sh(c, 'prec_28', ['Gas'])), coal7: r1(sh(c, 'ultimi_7', ['Carbone e lignite']))};
    });
  },
});

dash.calc('kpi_power', {
  title: 'Prezzo day-ahead: media 7 giorni',
  description: 'Per UE27, Italia e Ungheria: media degli ultimi 7 giorni disponibili e dei 7 giorni prima.',
  inputs: ['prices_daily'],
  fn: (prices_daily) => ['EU27', 'IT', 'HU'].map((area) => {
    const r = prices_daily.filter((d) => d.area === area && d.avg_eur_mwh !== null && d.avg_eur_mwh !== '').sort((a, b) => (a.date < b.date ? -1 : 1));
    const last7 = r.slice(-7), prev7 = r.slice(-14, -7);
    const mean = (a) => (a.length ? a.reduce((s, d) => s + Number(d.avg_eur_mwh), 0) / a.length : null);
    const a7 = mean(last7), p7 = mean(prev7);
    return {area, last_date: last7.length ? last7[last7.length - 1].date : null, avg7: a7 === null ? null : Math.round(a7 * 10) / 10, prev7: p7 === null ? null : Math.round(p7 * 10) / 10, chg_pct: a7 !== null && p7 ? Math.round((a7 / p7 - 1) * 1000) / 10 : null};
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

dash.calc('zones_it', {
  title: 'Zone italiane: ultimi 30 giorni',
  description: 'Media, minimo e massimo giornaliero, ore negative per zona di offerta italiana; differenza dalla zona Nord.',
  inputs: ['prices_daily'],
  fn: (prices_daily) => {
    const z = prices_daily.filter((d) => d.level === 'zona' && d.country === 'IT');
    const lastDate = d3.max(z, (d) => d.date);
    if (!lastDate) return [];
    const from = new Date(Date.parse(lastDate) - 29 * 86400000).toISOString().slice(0, 10);
    const rec = z.filter((d) => d.date >= from);
    const rows = Array.from(d3.group(rec, (d) => d.area), ([area, v]) => ({area, avg30: Math.round(10 * d3.mean(v, (d) => Number(d.avg_eur_mwh))) / 10, min30: Math.round(10 * d3.min(v, (d) => Number(d.avg_eur_mwh))) / 10, max30: Math.round(10 * d3.max(v, (d) => Number(d.avg_eur_mwh))) / 10, neg30: Math.round(10 * d3.sum(v, (d) => Number(d.negative_hours))) / 10}));
    const nord = rows.find((r) => r.area === 'IT_NORD');
    rows.forEach((r) => { r.spread_nord = nord ? Math.round(10 * (r.avg30 - nord.avg30)) / 10 : null; });
    const order = ['IT_NORD', 'IT_CNOR', 'IT_CSUD', 'IT_SUD', 'IT_CALA', 'IT_SICI', 'IT_SARD'];
    return rows.sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area));
  },
});

dash.calc('mix_ytd', {
  title: 'Mix da inizio anno',
  description: "Per paese e fonte: quota sulla generazione da gennaio all'ultimo mese disponibile, quest'anno, l'anno prima e nel 2021.",
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
      for (const g of groups) rows.push({key: country + '|' + g, country, group: g, last_month: last, cur_year: cy, prev_year: py, y2021: r1(pct(a, g)), ypy: r1(pct(b, g)), ycur: r1(pct(c, g)), d_py: r1(pct(c, g) - pct(b, g))});
      const res = (s) => { const t = ['Solare', 'Eolico', 'Idroelettrico', 'Bio, geotermia e altre rinnovabili'].reduce((z, g) => z + (s.o[g] || 0), 0); return s.tot ? 100 * t / s.tot : NaN; };
      rows.push({key: country + '|Rinnovabili', country, group: 'Rinnovabili (totale)', last_month: last, cur_year: cy, prev_year: py, y2021: r1(res(a)), ypy: r1(res(b)), ycur: r1(res(c)), d_py: r1(res(c) - res(b))});
    }
    return rows;
  },
});

dash.calc('mix_annual', {
  title: 'Mix annuale del paese scelto',
  description: 'Quote annuali per fonte (somma dei GWh mensili) per tutti i paesi e la UE27.',
  inputs: ['mix_monthly'],
  fn: (mix_monthly) => {
    const rows = [];
    const by = d3.rollup(mix_monthly, (v) => v, (d) => d.country, (d) => d.month.slice(0, 4));
    for (const [country, yrs] of by) for (const [year, v] of yrs) {
      const tot = d3.sum(v, (d) => Number(d.gwh));
      const share = (g) => Math.round(1000 * d3.sum(v.filter((d) => d.group === g), (d) => Number(d.gwh)) / tot) / 10;
      const res = Math.round(1000 * d3.sum(v.filter((d) => String(d.renewable) === 'True' || d.renewable === true), (d) => Number(d.gwh)) / tot) / 10;
      rows.push({key: country + '|' + year, country, year, res, 'Solare': share('Solare'), 'Eolico': share('Eolico'), 'Idroelettrico': share('Idroelettrico'), 'Gas': share('Gas'), 'Carbone e lignite': share('Carbone e lignite'), 'Nucleare': share('Nucleare'), twh: Math.round(tot / 100) / 10, months: new Set(v.map((d) => d.month)).size});
    }
    return rows;
  },
});
