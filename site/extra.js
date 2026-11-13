// Public-site additions: TTF monthly average (IMF via FRED), in place of the internal weekly TTF.
(function () {
  const rows = () => { const d = dash.data('gas_ttf_monthly'); return d.status === 'ok' ? d.data.slice().sort((a, b) => (a.month < b.month ? -1 : 1)) : []; };
  const last = () => { const r = rows(); return r.length ? [r[r.length - 1], r[r.length - 2]] : [null, null]; };
  dash.draw('t-ttfm', (el) => { const [l] = last(); el.textContent = l ? ED.f.n1(+l.eur_mwh) : '—'; });
  dash.draw('t-ttfm-per', (el) => { const [l] = last(); el.textContent = l ? ED.mLabel(ED.parseMonth(l.month)) : '—'; });
  dash.draw('t-ttfm-chg', (el) => { const [l, p] = last(); ED.chgSpan(el, l && p ? 100 * (+l.eur_mwh / +p.eur_mwh - 1) : NaN, {suffix: 'm/m'}); el.classList.add('c'); });
})();
