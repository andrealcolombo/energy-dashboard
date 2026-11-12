# Changelog

Every change to the data pipeline or to the dashboard is recorded here, newest first.
Each entry says who asked, what changed and why. Git history has the line-by-line detail.

## 2026-11-12

- **Dashboard v3.2** (asked by Andrea). The always-visible price bar at the top is gone: it looked bad on phones.
  Its indicators moved to a new first tab, *Latest*, as cards grouped by electricity, gas and road fuels, with
  two additions (wholesale 7-day average, petrol 95). The last-7-days generation pie moved from *Generation mix*
  to *Latest* and follows the *Latest* country selector.
- **Dashboard v3.1** (asked by Andrea). Ticker footnote moved right under the ticker, with the abbreviations
  explained (d/d, w/w, y/y, w/e, H1/H2); "power" renamed "electricity". *Generation mix*: own country selector,
  change-since-2021 chart removed. *Country profile*: table removed, a reading guide and per-indicator
  definitions added, new indicator "Battery storage, 3 months" (ENTSO-E "energy storage" discharge, reported
  by few countries). Data: ENTSO-E "Energy storage" is now its own group "Battery storage" (was in "Other").
- **Dashboard v3, in English** (asked by Andrea). New layout: a ticker bar with the latest wholesale power,
  household power, TTF, household gas, diesel and EU gas storage, with a country selector and arrows
  (d/d, w/w or y/y). Four sheets: *Electricity prices* (compare countries and zones: daily, monthly,
  household, negative hours), *Generation mix* (YTD pies vs 2021 and change bars instead of the table,
  monthly evolution, demand, last 7 days), *Country profile* (spider chart vs EU27 with user-chosen
  indicators), *DG ENER weekly* (summary + weekly indicators). Source-group names are now English in the data.
- **Sheets 1–3 redesigned** (asked by Andrea). *Oggi*: country selector (EU27 default); wholesale, retail,
  gas, oil, CO2 cards; 7-day mix pie; full DG ENER weekly table. *Prezzi elettrici*: compare any countries and
  bidding zones (up to 6), summary table, daily/monthly prices, negative hours, Eurostat retail by semester;
  Italian zones table removed. *Mix*: year-to-date pies (this year vs same months of 2021), table, monthly
  evolution, demand; annual table removed.
- **Household retail prices by country** (asked by Andrea: retail electricity in the first two sheets).
  Eurostat semi-annual prices, all taxes included: electricity band DC (nrg_pc_204), gas band D2 (nrg_pc_202).
- **Fuel prices for all EU27 countries** (asked by Andrea: country selector on every sheet).

## 2026-11-11

- **Fix: Oil Bulletin EU average** (Claude). The source file has both EU27 (`EU_`) and euro-area (`EUR_`)
  averages; both were labelled EU. Euro area is now `EA`. Workflow can be run for the Oil Bulletin only.
- **Dashboard published and weekly update scheduled** (asked by Andrea). The app is a private Claude
  dashboard; a scheduled Claude task refreshes it every Tuesday after the DG ENER newsletter arrives
  (instructions in `ops/weekly_update_prompt.md`).
- **Fix: generation by source** (Claude, found while checking the first full dataset). Two issues inflated
  "Other" and deflated hydro: ENTSO-E labels run-of-river hydro "pondage" (not "poundage"), and for some
  countries/years generation came as (type, Aggregated/Consumption) pairs, so pumping and storage charging
  were counted as generation. Consumption is now dropped and labels normalised. EU27 Oct 2026 after the fix:
  wind 22%, nuclear 21%, gas 17%, hydro 8%, other 4% (was 21%).
- **Recovery workflow `merge-run.yml`** (Claude, after a GitHub outage). The backfill had downloaded
  all countries, but artifact uploads failed for 7 of them and the merge job never ran. This workflow merges
  the artifacts of a given run; the 7 countries were downloaded again.
- **Weekly mix view** (asked by Andrea). The pipeline keeps 120 days of daily generation per source;
  the app compares the last 7 published days with the 4 weeks before. Why: price spikes are usually
  explained by the short-term mix (less wind or solar, more gas).
- **Year-to-date mix table** (asked by Andrea). Shares from January to the last complete month,
  compared with the same months of the previous year and of 2021. Why: monthly shares are seasonal;
  a cumulative comparison shows structural change. The running (incomplete) month is excluded.
- **Prices daily, generation/load/Oil Bulletin weekly** (asked by Andrea). Generation and load move
  slowly; they now update on Sundays, ready for the Monday refresh of the app. Load is kept because it
  weights the EU27 average price and tracks electrification.
- **Parallel backfill** (Claude, after the first run proved too slow). The 2021–2026 history of
  generation and load is downloaded with one job per country. The first sequential run took ~30 min
  per country and was stopped after 4h40; the prices it had downloaded (34 zones) were kept.
- **Phased daily workflow** (Claude). Each part (prices, generation, load) is committed as soon as it
  finishes, so a slow part never discards the others. Logs are unbuffered so progress is visible.
- **EC Weekly Oil Bulletin** (asked by Andrea: diesel for Italy and Hungary). Weekly consumer fuel
  prices with taxes, by country, from the Commission's price-history file.
- **Dashboard app, first version** (asked by Andrea). Sections: Today, Electricity prices,
  Mix and demand, Gas/CO2/fuels, Italy·Hungary, DG ENER notes. Source in `app/index.html`.
  DG ENER newsletter figures are internal: they live only in the private app, never in this repository.
- **ENTSO-E pipeline, first version** (asked by Andrea). Day-ahead prices by bidding zone (daily),
  generation per type and load (monthly), EU27, from 2021. API key stored as a GitHub secret.
