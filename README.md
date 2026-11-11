# Energy dashboard — data pipeline

Downloads ENTSO-E Transparency Platform data for the EU27 every day and stores compact CSV files.
A weekly Claude task reads these files and updates the dashboard app.

| File | Content | Granularity |
|---|---|---|
| `data/prices_daily.csv` | Day-ahead prices per bidding zone: average, min, max (EUR/MWh), hours with negative prices | daily |
| `data/generation_monthly.csv` | Actual generation per production type (GWh) | monthly, by country |
| `data/load_monthly.csv` | Actual total load (GWh) and peak (MW) | monthly, by country |
| `data/status.json` | Last run, row counts, failed queries | — |

Daily averages are time-weighted, so they handle both hourly and 15-minute data.
Days and months follow Brussels time (CET/CEST).

## Setup

1. Settings → Secrets and variables → Actions → New repository secret: `ENTSOE_API_KEY`.
2. Actions → *Fetch ENTSO-E data* → *Run workflow*. The first run backfills from 2021.

The workflow then runs every day at 13:23 UTC. Each run refetches the last 10 days of prices
and the last two months of generation and load, so later corrections by TSOs are picked up.

Countries, zones and start date are set in `src/config.py`.

## Known gaps

- Cyprus and Malta have no coupled day-ahead market: no prices expected.
- Some countries publish generation per type with gaps or delays; see `data/status.json`.
