# Weekly update of the dashboard (scheduled Claude task, Tuesdays 13:37 Vienna)

Dashboard: claude.ai artifact "Mercati energetici UE", slug 05f1ae8e-2868-4ba7-b2d9-84ef960db502
(type Data; content lives in its database: files/*, datasets/*).

1. ENTSO-E and Oil Bulletin data (public).
   - `git clone --depth 1 https://github.com/andrealcolombo/energy-dashboard` (read-only is enough).
   - Check `data/status.json` and the last runs of `fetch-entsoe.yml` (gh api .../actions/runs).
   - Upload with upload_asset every file in `data/dashboard/`: prices_daily.csv, prices_monthly.csv,
     mix_monthly.csv, load_monthly.csv, mix_weekly.csv, fuels_weekly.csv (those that exist).
     Copy them under /home/claude first (files under /tmp are refused).
   - For each, `update` datasets/<same id> (ifVersion from db_get): source.url = new /_blob/ url,
     updated = {at: now UTC, by: "Claude (aggiornamento settimanale)"}, edit = {via: "claude", at: now}.
     If a dataset doc does not exist yet (mix_weekly, fuels_weekly), create it with `set`
     (title, description, source {kind: file, url, name, format: csv}, updated, schedule, staleAfterHours: 336, edit).
2. DG ENER newsletter (internal: never write it to GitHub).
   - Gmail: search `subject:"WEEKLY PRICES" newer_than:8d`, read the newest message (PLAIN_TEXT).
   - Read the current dgener_weekly.csv and dgener_notes.csv (read_asset with the id in datasets/<id>.source.url).
   - Append one row per indicator for the new edition (skip if that edition is already there). Columns:
     edition (date the newsletter was sent, YYYY-MM-DD), week_start, week_end, order, indicator, label, value,
     unit, wow_pct, mom_pct, yoy_pct, ref_period. Indicator ids: elec_wholesale_eu, gas_ttf, ttf_month_ahead,
     lng_acer, gas_storage (wow/yoy in pp), eua, coal, brent_future, brent_dated, petrol_95, diesel, heating_oil,
     elec_retail_hh, gas_retail_hh, hicp_energy_contrib, hicp_total. Keep labels and order as in previous rows.
     Leave a cell empty when the newsletter does not give it. Copy numbers exactly as written.
   - Replace the notes for the new edition: one row per section (edition, order, section, text), in Italian,
     2–3 short sentences each, paraphrased, no long quotes.
   - Upload both files, update datasets/dgener_weekly and datasets/dgener_notes as in step 1.
   - If no newsletter is found, leave these two datasets unchanged and say so in the report.
3. Check: db_list data/users/<id from db_whoami> for `check`/`runs`; fix only obvious data faults.
4. Report to Andrea with SendUserMessage, in Italian, 4–6 lines: what was updated, the week's headline
   (EU27 price, TTF, change vs previous week), anything missing or failed.
