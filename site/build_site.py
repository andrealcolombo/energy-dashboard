"""Build the public website (GitHub Pages) from the private Claude dashboard page.

Takes app/index.html and app/ed-*.js, removes the DG ENER newsletter tab, the news feed and the
change log, adds download links and a disclaimer, and writes a static site to _site/.
The two gas cards (TTF weekly, EU storage) use data/gas_weekly.csv: by Andrea's decision (13 Nov 2026)
these two series from the DG ENER weekly newsletter are shown, cited as internal Commission elaborations.

Usage: python site/build_site.py [output_dir]
"""
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
SITE = ROOT / "site"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "_site"

DATA = ["prices_daily", "prices_monthly", "mix_monthly", "mix_weekly", "load_monthly",
        "fuels_weekly", "retail_semiannual", "day_profile"]

THEME = """
:root{--color-fg:#1f1e1d;--color-fg-muted:#5f5c56;--color-bg:#faf9f5;--color-panel:#fff;--color-border-line:#e5e2da;
--color-ok:#2e7d32;--color-warn:#b7791f;--color-bad:#c62828;--font-anthropic-sans:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
--font-anthropic-serif:Georgia,"Times New Roman",serif;--cds-font-size-caption:12px;--cds-font-size-body:14px;--cds-font-size-heading:17px;
--cds-font-size-title:26px;--cds-font-weight-medium:600;--cds-gap-xs:4px;--cds-gap-sm:8px;--cds-gap-md:16px;--cds-gap-lg:28px;
--cds-pad-xs:4px;--cds-pad-sm:8px;--cds-pad-md:12px;--cds-pad-lg:16px;--cds-radius:8px;--cds-chart-muted:#b9b5ab;--cds-chart-grid:#ece9e2;
--cds-chart-axis:#c9c5bc;--cds-chart-reference:#8a867d;--cds-text-secondary:#5f5c56;--cds-surface-popover:#fff;--cds-border:#ddd;
--cds-shadow-popover:0 2px 8px rgba(0,0,0,.15);--s0:#2b6cb0;--s1:#d9653b;--s2:#2f855a;--s3:#805ad5;--s4:#b7791f;--s5:#c53030;--s6:#319795;--s7:#718096}
@media (prefers-color-scheme: dark){:root{--color-fg:#ecebe8;--color-fg-muted:#a9a59d;--color-bg:#1d1c1a;--color-panel:#262522;
--color-border-line:#3a3833;--cds-chart-grid:#33312d;--cds-chart-axis:#4a4741;--cds-chart-muted:#6d6a63;--cds-chart-reference:#8f8b83;
--cds-text-secondary:#a9a59d;--cds-surface-popover:#2c2b28;--cds-border:#44423d;--s0:#63a4e8;--s1:#f08a5d;--s2:#5cbf8a;--s3:#a98ae6}}
body{background:var(--color-bg);color:var(--color-fg);margin:0}
main{max-width:1180px;margin:0 auto;padding:16px}
.ed .site-bar{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:12px;color:var(--color-fg-muted);margin:0 0 var(--cds-gap-md)}
.ed .site-bar a{color:inherit}
main .ed .lede,main .ed details.note,main .ed details.note p,main .ed .disclaimer{max-width:none}
.ed h1 .bolt{height:.9em;width:auto;vertical-align:-.08em;margin-right:.3em}
.ed .disclaimer{font-size:11px;color:var(--color-fg-muted);margin-top:var(--cds-gap-lg)}
"""

BOLT_SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1f3a5f"/>'
            '<path d="M37 6 15 37h14l-4 21 24-33H35z" fill="#f2b632"/></svg>')
FAVICON = "data:image/svg+xml," + BOLT_SVG.replace('"', "'").replace("#", "%23").replace("<", "%3C").replace(">", "%3E")

def cut(s, start, end, repl="", keep_end=False):
    a = s.index(start)
    b = s.index(end, a) + (0 if keep_end else len(end))
    return s[:a] + repl + s[b:]


def must(s, old, new):
    if old not in s:
        raise SystemExit(f"build_site: expected text not found: {old[:70]!r}")
    return s.replace(old, new, 1)


def page():
    s = (APP / "index.html").read_text()
    s = s.replace('<meta name="dash-one-writer">\n', "")
    s = must(s, "<h1>EU Energy Markets Dashboard</h1>", "<h1>" + BOLT_SVG.replace("<svg ", '<svg class="bolt" aria-hidden="true" ', 1) + "EU Energy Markets Dashboard</h1>")
    s = must(s, '    <button class="tab" role="tab" data-tab="dgener" aria-selected="false">DG ENER weekly</button>\n', "")
    s = cut(s, '    <h2 id="latest-news">', 'data-source="news"></div>\n')
    s = cut(s, "  <!-- ============ DG ENER ============ -->", "  </section>\n")
    s = cut(s, '  <details class="note" style="margin-top:var(--cds-gap-lg)">\n    <summary>Change log</summary>', "  </details>\n\n")
    s = must(s, '  <details class="note">\n    <summary>Sources and method</summary>',
             '  <details class="note" style="margin-top:var(--cds-gap-lg)">\n    <summary>Sources and method</summary>')
    s = must(s, "TTF, storage and the weekly indicators: DG ENER weekly newsletter. News: public news sites and reports, each linked to its source.",
             "TTF day-ahead (weekly average) and EU gas storage: internal elaborations of the European Commission "
             "(DG ENER), updated weekly.")
    stamp = datetime.now(timezone.utc).strftime("%d %b %Y, %H:%M UTC")
    bar = ('  <div class="site-bar"><span>Updated daily · page built ' + stamp + '</span>'
           '<a href="data/energy_dashboard_data.xlsx">Download all data (Excel)</a>'
           '<a href="https://github.com/andrealcolombo/energy-dashboard">Code and CSV files (GitHub)</a></div>\n')
    s = must(s, '  <p class="lede" data-draw="headline">—</p>\n', '  <p class="lede" data-draw="headline">—</p>\n' + bar)
    s = s.replace("</details>\n</div>",
                  "</details>\n  <p class=\"disclaimer\">Independent prototype built from public data "
                  "(ENTSO-E Transparency Platform, Eurostat, European Commission Weekly Oil Bulletin) and internal elaborations "
                  "of the European Commission for TTF and gas storage. "
                  "Not an official publication of the European Commission.</p>\n</div>", 1)
    for bad in ('data-tab="dgener"', 'id="dgener"', "news-list", "Claude", "Change log"):
        if bad in s:
            raise SystemExit(f"build_site: internal content left in page: {bad}")
    files = {k: f"data/{k}.csv" for k in DATA}
    files["dgener_weekly"] = "data/gas_weekly.csv"
    head = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>EU Energy Markets Dashboard</title>'
            f'<link rel="icon" type="image/svg+xml" href="{FAVICON}">'
            '<meta name="description" content="EU27 electricity prices, generation mix, demand and fuel prices, updated daily from public data.">'
            f'<style>{THEME}</style>'
            '<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>'
            f'<script>window.SITE_DATA={files!r};</script>'.replace("'", '"') +
            '<script src="runtime.js"></script></head><body><main>')
    return head + s + "</main></body></html>\n"


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "data").mkdir(parents=True)
    (OUT / "index.html").write_text(page())
    for f in ("ed-core.js", "ed-calcs.js", "ed-ui.js"):
        shutil.copy(APP / f, OUT / f)
    for f in ("runtime.js",):
        shutil.copy(SITE / f, OUT / f)
    for k in DATA:
        shutil.copy(ROOT / "data" / "dashboard" / f"{k}.csv", OUT / "data" / f"{k}.csv")
    for f in ("gas_weekly.csv", "gas_ttf_monthly.csv"):
        if (ROOT / "data" / f).exists():
            shutil.copy(ROOT / "data" / f, OUT / "data" / f)
    xl = ROOT / "data" / "energy_dashboard_data.xlsx"
    if xl.exists():
        shutil.copy(xl, OUT / "data" / xl.name)
    (OUT / ".nojekyll").write_text("")
    print("site written to", OUT)


if __name__ == "__main__":
    main()
