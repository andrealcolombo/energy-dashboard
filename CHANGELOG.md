# Changelog

Every change to the data pipeline or to the dashboard is recorded here, newest first.
The summary table gives one line per change. The details below say what changed and why.
Git history has the line-by-line detail. Routine data updates are not listed.

## Summary

| Date | Requested by | Made by | Change |
|---|---|---|---|
| 2026-11-13 | Andrea | Claude | New section "Prices through the day" in Electricity prices: hourly price, mix, swing |
| 2026-11-13 | Andrea | Claude | Day profiles: hour-by-hour prices, load and generation by month, from ENTSO-E |
| 2026-11-13 | Andrea | Claude | Second daily data run at 17:07 UTC, as a backup to the 13:23 run |
| 2026-11-13 | Andrea | Claude | Renamed "EU Energy Markets Dashboard"; site icon, full-width text; change log in Word |
| 2026-11-13 | Andrea | Claude | Country profile: compare a country with the EU27 or with another country |
| 2026-11-13 | Andrea | Claude | Public site shows weekly TTF and storage from DG ENER, cited as internal elaborations |
| 2026-11-13 | Andrea | Claude | Public website on GitHub Pages, updated daily; TTF monthly from IMF |
| 2026-11-13 | Andrea | Claude | One Excel file with all public datasets, rebuilt daily, downloadable from GitHub |
| 2026-11-12 | Andrea | Claude | News: no fixed priority for Italy and Hungary in the weekly search |
| 2026-11-12 | Andrea | Claude | News feed v3.5: marked Beta; six items, country news first; more country sources |
| 2026-11-12 | Andrea | Claude | Dashboard v3.4: news feed on *Latest*; change log at the bottom of the page |
| 2026-11-12 | Andrea | Claude | Dashboard v3.3: layout uses the full width; household price chart removed |
| 2026-11-12 | Andrea | Claude | Dashboard v3.2: fixed price bar replaced by a new *Latest* tab |
| 2026-11-12 | Andrea | Claude | Dashboard v3.1: abbreviations explained; mix country selector; battery storage indicator |
| 2026-11-12 | Andrea | Claude | Dashboard v3: English, price ticker, four tabs, country profile (spider chart) |
| 2026-11-12 | Andrea | Claude | Sheets 1–3 redesigned: country selector, zone comparison, year-to-date pies |
| 2026-11-12 | Andrea | Claude | Household electricity and gas prices by country (Eurostat) |
| 2026-11-12 | Andrea | Claude | Fuel prices for all EU27 countries |
| 2026-11-11 | Claude | Claude | Fix: Oil Bulletin EU average no longer mixed with the euro area |
| 2026-11-11 | Andrea | Claude | Dashboard published; weekly update every Tuesday |
| 2026-11-11 | Claude | Claude | Fix: generation by source (hydro label, storage charging counted as output) |
| 2026-11-11 | Claude | Claude | Recovery workflow after a GitHub outage |
| 2026-11-11 | Andrea | Claude | Weekly mix view: last 7 days vs the 4 weeks before |
| 2026-11-11 | Andrea | Claude | Year-to-date mix compared with last year and 2021 |
| 2026-11-11 | Andrea | Claude | Prices daily; generation, demand and Oil Bulletin weekly |
| 2026-11-11 | Claude | Claude | Parallel download of the 2021–2026 history |
| 2026-11-11 | Claude | Claude | Daily workflow saves each part as soon as it finishes |
| 2026-11-11 | Andrea | Claude | EC Weekly Oil Bulletin added (diesel, petrol) |
| 2026-11-11 | Andrea | Claude | Dashboard app, first version |
| 2026-11-11 | Andrea | Claude | ENTSO-E data pipeline, first version |

"Requested by: Claude" means a fix Claude found and made while working on another request.

## Details

### 2026-11-13

- **Prices through the day** (asked by Andrea). New section at the bottom of the Electricity prices tab,
  added to what was there: average price by hour (one line per year; whole year or season; €/MWh or % of the
  day's average), generation by source hour by hour with storage charging below zero, and the daily price swing.
  Purpose: show how solar and storage change the shape of the day. Data: `day_profile.csv` (years and seasons).
- **Day profiles** (asked by Andrea, after a colleague's remark on batteries and price spikes).
  `src/fetch_intraday.py` builds `data/intraday_profile.csv`: for each country and month, the average price,
  load and generation by type for each hour of the day. History from 2021 via `intraday-backfill.yml`;
  the last two months are refreshed on Sundays. ENTSO-E reports batteries only from 2025, for some countries.
- **Backup data run** (asked by Andrea). The data workflow now also runs every day at 17:07 UTC.
  GitHub often starts scheduled runs hours late (the 13:23 run of 12 Nov started at 20:53) or skips them.
  If the first run already got the day's prices, the second finds nothing new and commits nothing.
- **Name, icon, layout, Word change log** (asked by Andrea). The dashboard is now "EU Energy Markets Dashboard"
  (site and Claude). The site has a lightning-bolt icon (tab and title), and the headline and "Sources and
  method" use the full page width. `src/build_changelog_docx.py` turns this file into `changelog.docx`,
  published next to the Excel file in the GitHub release `data-latest` after every change and every data run.
- **Country profile comparison** (asked by Andrea). A second menu, "compared with", lets the reader pick the
  EU27 average (default) or any other country. The spider chart is normalised on that choice (grey shape = 1×),
  and the values in the legend and tooltips show both countries. Applies to the Claude dashboard and the site.
- **Gas weekly on the public site** (decided by Andrea, after being told the site and repository are public).
  The TTF day-ahead and EU storage rows of the DG ENER newsletter go to `data/gas_weekly.csv` and to the site,
  cited as internal elaborations of the European Commission, so the site matches the Claude dashboard except
  for the newsletter tab. No other newsletter content is committed. The weekly task adds the new rows.
- **Public website** (asked by Andrea, to show the work outside Claude). `site/build_site.py` builds a static copy
  of the dashboard from `app/` without the DG ENER tab, newsletter indicators, news and change log, and with a
  disclaimer and download links. `pages.yml` deploys it to GitHub Pages after every data update. TTF on the
  public site is the IMF monthly average via FRED (`src/fetch_ttf.py`): no free official daily source was found.
- **Excel workbook** (asked by Andrea). `src/build_excel.py` puts every public dataset behind the dashboard in one
  file (`energy_dashboard_data.xlsx`, one sheet per dataset plus a README with sources and method). The daily
  workflow rebuilds it and publishes it as the asset of the GitHub release `data-latest`, a stable download link.
  It is not committed, to keep the repository small. The DG ENER newsletter is never included.

### 2026-11-12

- **News: no fixed country priority** (asked by Andrea). The weekly task no longer searches Italy and Hungary
  every week; it covers the countries with the largest weekly price moves and the main markets, so the feed
  serves every reader equally. Charts keep their current defaults.
- **News feed v3.5** (asked by Andrea). The feed is marked Beta and shows six items: news about the selected
  country first, EU-wide news only to fill the rest (EU27 shows EU-wide news only). New country items for DE, CZ,
  PL, ES, IT. The weekly task now prefers recognised outlets (Reuters, Bloomberg, FT, Montel, national agencies
  and newspapers) and official sources such as the Commission press corner.
- **Dashboard v3.4** (asked by Andrea). *Latest* gets a news feed: up to nine items that may help explain the
  week's moves, for the selected country first and then EU-wide, each with a short summary and a link. Claude
  selects them from public sources; the weekly task refreshes them (step 3 of `ops/weekly_update_prompt.md`).
  The feed lives only in the app. The summary table of this changelog is also shown at the bottom of the dashboard.
- **Dashboard v3.3** (asked by Andrea). Layout rebalanced to use the full width: *Latest* cards stretch across
  the row, *Country profile* definitions are a grid of cards, the *DG ENER weekly* summary flows in two columns.
  Percentages removed from the 7-day mix legend (shown on the pie). Household electricity chart removed from
  *Electricity prices*; household prices stay on *Latest* and *Country profile*.
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

### 2026-11-11

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
