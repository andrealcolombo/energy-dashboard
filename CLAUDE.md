# Energy dashboard — rules for anyone (human or Claude) changing this repository

Owner: Andrea Colombo. The app is a private Claude dashboard built from `app/index.html`
and the CSV files in `data/dashboard/`.

## Every change must be traceable
1. Record it in `CHANGELOG.md` in two places, newest first:
   - one row at the top of the Summary table: date, requested by, made by, the change in under 15 words;
   - an entry under today's date in Details: who asked, what changed, why. Plain language, two to four lines.
   - the same row in the *Change log* table at the bottom of `app/index.html` (and republish the app).
2. Commit with a message that summarises the request in one line, then what changed.
3. Changes by colleagues go through a pull request that Andrea reviews. Do not push to `main`
   on someone else's behalf without their request.

## Data rules
- Never commit the DG ENER weekly newsletter or figures taken from it: it is an internal
  Commission document. It lives only in the private app (files uploaded to the artifact).
- Never print or commit the ENTSO-E API key. It is the GitHub secret `ENTSOE_API_KEY`.
- Public sources only in this repository: ENTSO-E Transparency Platform, EC Weekly Oil Bulletin, Eurostat,
  IMF commodity prices via FRED (TTF).
- The public website (`site/`, GitHub Pages) must never show the DG ENER tab, newsletter figures, the news
  feed or the change log. `site/build_site.py` removes them and stops if any is left.

## Layout
- `src/config.py` — countries, bidding zones, start date.
- `src/fetch_entsoe.py` — downloads prices (daily), generation and load (weekly, Sundays).
- `src/fetch_oil_bulletin.py` — EC Weekly Oil Bulletin (weekly).
- `src/build_dashboard_files.py` — compact files read by the app, in `data/dashboard/`.
- `.github/workflows/fetch-entsoe.yml` — daily schedule; `backfill.yml` — one-off parallel history.
- `src/fetch_ttf.py` — TTF monthly average (IMF via FRED), daily run.
- `src/build_excel.py` — one Excel file with all public datasets.
- `site/` — public website built from `app/` (`build_site.py`, `runtime.js`, `extra.js`);
  `.github/workflows/pages.yml` deploys it to GitHub Pages after each data update.
- `app/index.html` — the dashboard page (Claude "Data" dashboard type: d3 + `dash` runtime).
  After changing it, republish the app, check that `python site/build_site.py` still builds the public site,
  and record the change in `CHANGELOG.md`.

## Method choices to keep consistent
- Daily averages are time-weighted (hourly until Sept 2025, then 15-minute products).
- Country price for multi-zone countries (DK, IT, SE): simple mean of zones (not the PUN).
- EU27 price: country prices weighted by monthly load.
- Days and months follow Europe/Brussels time. The running month is excluded from mix and load.
