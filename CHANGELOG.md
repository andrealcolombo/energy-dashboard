# Changelog

Every change to the data pipeline or to the dashboard is recorded here, newest first.
Each entry says who asked, what changed and why. Git history has the line-by-line detail.

## 2026-11-11

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
