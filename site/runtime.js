// Minimal stand-in for the Claude "dash" runtime, so the same page code runs on a plain website.
// Loads the CSV files listed in window.SITE_DATA, runs calcs on demand and redraws on request.
window.dash = (function () {
  const calcs = {}, draws = {}, raw = {}, cache = {};
  const colors = ['var(--s0)', 'var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)'];
  let ready = false;
  function data(id) {
    if (calcs[id]) {
      if (!(id in cache)) {
        try { cache[id] = calcs[id].fn(...calcs[id].inputs.map((i) => { const d = data(i); return d.status === 'ok' ? d.data : []; })); }
        catch (e) { console.error('calc ' + id, e); cache[id] = null; }
      }
      return {status: cache[id] === null ? 'error' : 'ok', data: cache[id]};
    }
    if (raw[id]) return {status: 'ok', data: raw[id]};
    return {status: ready ? 'missing' : 'loading', data: []};
  }
  function run(name) {
    document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => {
      if (el.closest('[hidden]')) return;
      try { draws[name](el); } catch (e) { console.error('draw ' + name, e); }
    });
  }
  const runAll = () => Object.keys(draws).forEach(run);
  const api = {
    data, colors,
    calc(id, o) { calcs[id] = {fn: o.fn, inputs: o.inputs || []}; },
    draw(name, fn) { if (fn) { draws[name] = fn; if (ready) run(name); return; } if (draws[name]) run(name); },
    loader() {}, onData(fn) { fn(); }, params() { return {}; }, setParams() {}, refresh() {},
    setLink(id) { try { history.replaceState(null, '', '#' + id); } catch (e) {} },
    runAll,
  };
  const clean = (v) => (v === '' ? null : v);
  window.addEventListener('DOMContentLoaded', async () => {
    await Promise.all(Object.entries(window.SITE_DATA || {}).map(async ([id, url]) => {
      try { const rows = await d3.csv(url, (r) => { for (const k in r) r[k] = clean(r[k]); return r; }); raw[id] = rows; }
      catch (e) { console.error('load ' + id, e); }
    }));
    ready = true;
    runAll();
    document.querySelectorAll('.ed .tab').forEach((t) => t.addEventListener('click', () => setTimeout(runAll, 0)));
    let w = window.innerWidth;
    window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - w) > 40) { w = window.innerWidth; runAll(); } });
  });
  return api;
})();
