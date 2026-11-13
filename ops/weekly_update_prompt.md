# Weekly update of the dashboard (scheduled Claude task, Tuesdays 13:37 Vienna)

Dashboard: claude.ai artifact "Mercati energetici UE", slug 05f1ae8e-2868-4ba7-b2d9-84ef960db502
(type Data; content lives in its database: files/*, datasets/*).

1. ENTSO-E and Oil Bulletin data (public).
   - `git clone --depth 1 https://github.com/andrealcolombo/energy-dashboard` (read-only is enough).
   - Check `data/status.json` and the last runs of `fetch-entsoe.yml` (gh api .../actions/runs).
   - Upload with upload_asset every file in `data/dashboard/`: prices_daily.csv, prices_monthly.csv,
     mix_monthly.csv, load_monthly.csv, mix_weekly.csv, fuels_weekly.csv, retail_semiannual.csv (those that exist).
     Copy them under /home/claude first (files under /tmp are refused).
   - For each, `update` datasets/<same id> (ifVersion from db_get): source.url = new /_blob/ url,
     updated = {at: now UTC, by: "Claude (aggiornamento settimanale)"}, edit = {via: "claude", at: now}.
     If a dataset doc does not exist yet, create it with `set`
     (title, description, source {kind: file, url, name, format: csv}, updated, schedule, staleAfterHours: 336, edit).
2. DG ENER newsletter (internal: never write it to GitHub, except the two gas rows below).
   - Gmail: search `subject:"WEEKLY PRICES" newer_than:8d`, read the newest message (PLAIN_TEXT).
   - Read the current dgener_weekly.csv and dgener_notes.csv (read_asset with the id in datasets/<id>.source.url).
   - Append one row per indicator for the new edition (skip if that edition is already there). Columns:
     edition (date the newsletter was sent, YYYY-MM-DD), week_start, week_end, order, indicator, label, value,
     unit, wow_pct, mom_pct, yoy_pct, ref_period. Indicator ids: elec_wholesale_eu, gas_ttf, ttf_month_ahead,
     lng_acer, gas_storage (wow/yoy in pp), eua, coal, brent_future, brent_dated, petrol_95, diesel, heating_oil,
     elec_retail_hh, gas_retail_hh, hicp_energy_contrib, hicp_total. Keep labels (in English) and order as in previous rows.
     Leave a cell empty when the newsletter does not give it. Copy numbers exactly as written.
   - Add the notes for the new edition: one row per section (edition, order, section, text), in English,
     2–3 short sentences each, paraphrased, no long quotes. Sections as in previous editions.
   - Upload both files, update datasets/dgener_weekly and datasets/dgener_notes as in step 1.
   - If no newsletter is found, leave these two datasets unchanged and say so in the report.
   - Public site (exception decided by Andrea, 13 Nov 2026): append to `data/gas_weekly.csv` in the repository
     only the new edition's `gas_ttf` and `gas_storage` rows (same columns as dgener_weekly.csv), then commit
     ("Gas weekly (DG ENER internal elaboration) <edition>") and push to main. Nothing else from the newsletter
     goes to GitHub. Pushing to main triggers the site rebuild only for app/ or site/ changes, so after the
     push also start the workflow `pages.yml` (gh api -X POST repos/andrealcolombo/energy-dashboard/actions/
     workflows/pages.yml/dispatches -f ref=main). If the push fails, say so in the report.
3. News feed (datasets/news, shown on the *Latest* tab; kept only in the app, not on GitHub).
   - Read the current news.csv (read_asset with the id in datasets/news.source.url). Columns: date (YYYY-MM-DD,
     or YYYY-MM if the day is unknown), date_label (shown as is, e.g. "9 Nov 2026" or "Sep 2026 · background"),
     countries (ISO codes separated by ";", EU = shown for every country), topic (Electricity, Gas, Oil, Retail,
     Policy, Carbon), title, summary, source, url.
   - Sources, in order of preference: Reuters, Bloomberg, FT, Montel News (montelnews.com), AFP/ANSA and other
     national news agencies, recognised European newspapers (Il Sole 24 Ore, Handelsblatt, Les Echos, Le Monde,
     El País, Expansión, Portfolio.hu, Notes from Poland...), Euronews, Politico Europe, Euractiv; official sources
     (European Commission press corner https://ec.europa.eu/commission/presscorner, DG ENER news, ACER, IEA,
     national regulators and TSOs); think tanks (Ember, Bruegel, OIES). Avoid blogs, price-comparison sites and
     aggregators; when a story is syndicated, name the original agency in `source`, e.g. "Arab News (Reuters)".
   - Search the past 7 days: first country news explaining that country's price or mix moves, for the countries
     with the largest weekly price moves on the dashboard (up or down) and for the main markets
     (DE, FR, ES, IT, PL, NL, AT, CZ, RO). No country gets priority beyond these criteria. Then EU-wide news: gas/TTF and storage, weather (wind, solar, dunkelflaute),
     oil/Brent, carbon/EUA, EU energy policy. Tag a story with every country it plausibly affects.
   - The app shows six items per country: country news first, then EU-wide. Aim for recent country items for
     the countries selected above, and keep about eight current EU-wide items.
   - Add the new items. Only items whose link you have actually seen in search or fetch results; never build a URL.
     Title and summary in your own words (no quotes over 15 words), 2–3 sentences, saying what happened and the
     plausible link to prices or the mix. Write links as possible, not proven, causes. State numbers only as the source gives them.
   - Drop items older than 8 weeks, except up to 3 marked "background". Keep at most 60 rows.
   - Upload and update datasets/news as in step 1.
4. Check: db_list data/users/<id from db_whoami> for `check`/`runs`; fix only obvious data faults.
5. Report to Andrea with SendUserMessage, in Italian (the dashboard itself is in English), 4–6 lines: what was updated (including how many news items were added), the week's headline
   (EU27 price, TTF, change vs previous week), anything missing or failed.
