"""Cross-border physical flows of electricity, daily totals by border and direction.

Output: data/flows_daily.csv
  date     day (Europe/Brussels)
  from,to  ENTSO-E country areas: power flowing from `from` into `to`
  gwh      energy over the day, GWh (sum of hourly or 15-minute values)

Source: ENTSO-E Transparency Platform, cross-border physical flows [12.1.G].
Physical flows are what actually crosses the border, including loop flows; they
differ from the commercial schedules agreed in the market.

Borders are listed in config.FLOW_BORDERS (country level). Where ENTSO-E has
no country-level data, FLOW_ZONE_FALLBACK lists bidding-zone pairs to add up.

KIND=commercial downloads scheduled commercial exchanges into data/exchanges_daily.csv,
same layout.
Modes (env MODE):
  probe   query the last 2 days for every border and direction, print what works
  (empty) first run from config.START_DATE; later runs refetch the last 4 days
Env ONLY_CHUNK=i/n runs one slice of the borders (for parallel backfills).
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import config  # noqa: E402
from fetch_entsoe import with_retry  # noqa: E402

DATA = Path(os.environ.get("DATA_DIR") or Path(__file__).resolve().parent.parent / "data")
# KIND=commercial: scheduled commercial exchanges (day-ahead + intraday, [12.1.F]) instead of physical flows
KIND = os.environ.get("KIND", "physical")
OUT = DATA / ("exchanges_daily.csv" if KIND == "commercial" else "flows_daily.csv")
REFETCH_DAYS = 4
KEYS = ["date", "from", "to"]

# Country pairs with no country-level series: zone pairs to add up instead.
# Filled in from the probe run.
FLOW_ZONE_FALLBACK: dict[tuple[str, str], list[tuple[str, str]]] = {
    ("DK", "GB"): [("DK_1", "GB")],  # Viking Link: no country-level series
    ("GB", "DK"): [("GB", "DK_1")],
}


def query(client, x, y, start, end):
    if KIND == "commercial":
        return with_retry(client.query_scheduled_exchanges, x, y, start=start, end=end, dayahead=False)
    return with_retry(client.query_crossborder_flows, x, y, start=start, end=end)

# Commercial exchanges: zone pairs to use instead of countries (filled in from the probe).
EXCHANGE_ZONES: dict[tuple[str, str], list[tuple[str, str]]] = {}


def series(client, a: str, b: str, start, end) -> pd.Series:
    """MW from a to b, hourly means in UTC."""
    pairs = (EXCHANGE_ZONES if KIND == "commercial" else FLOW_ZONE_FALLBACK).get((a, b)) or [(a, b)]
    parts = []
    for x, y in pairs:
        s = query(client, x, y, start, end)
        parts.append(s.tz_convert("UTC").resample("1h").mean())
    return pd.concat(parts, axis=1).sum(axis=1, min_count=1)


def daily(client, a: str, b: str, start, end) -> pd.DataFrame:
    rows = []
    cur = start
    while cur < end:  # one year at a time: a failure loses one year only
        nxt = min(end, pd.Timestamp(year=cur.year + 1, month=1, day=1, tz=cur.tz))
        t0 = time.time()
        try:
            s = series(client, a, b, cur, nxt).tz_convert(config.LOCAL_TZ)
            d = (s.resample("1D").sum(min_count=1) / 1000).round(3)  # MWh/h summed over hours -> GWh
            n = s.resample("1D").count()
            d = d[n >= 20]  # keep days with almost all hours
            rows.append(pd.DataFrame({"date": d.index.strftime("%Y-%m-%d"), "from": a, "to": b, "gwh": d.values}))
            print(f"  {a}>{b} {cur.year}: ok ({time.time() - t0:.0f}s)", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"  {a}>{b} {cur.year}: {type(exc).__name__} ({time.time() - t0:.0f}s)", flush=True)
        cur = nxt
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(columns=KEYS + ["gwh"])


def directed(borders):
    for a, b in borders:
        yield a, b
        yield b, a


def main() -> None:
    from entsoe import EntsoePandasClient

    key = os.environ.get("ENTSOE_API_KEY")
    if not key:
        sys.exit("ENTSOE_API_KEY is not set")
    client = EntsoePandasClient(api_key=key, timeout=120, retry_count=3, retry_delay=20)
    tz = config.LOCAL_TZ
    borders = list(config.FLOW_BORDERS)
    chunk = os.environ.get("ONLY_CHUNK", "")
    if chunk:
        i, n = (int(x) for x in chunk.split("/"))
        borders = borders[i::n]

    if os.environ.get("MODE") == "probe":
        end = pd.Timestamp.now(tz=tz).normalize()
        start = end - pd.Timedelta(days=2)
        for a, b in directed(borders):
            try:
                s = query(client, a, b, start, end)
                print(f"PROBE {a}>{b} ok {len(s)} points, mean {s.mean():.0f} MW", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"PROBE {a}>{b} {type(exc).__name__}: {str(exc)[:80]}", flush=True)
        return

    DATA.mkdir(exist_ok=True)
    old = pd.read_csv(OUT) if OUT.exists() and OUT.stat().st_size > 0 else pd.DataFrame(columns=KEYS + ["gwh"])
    end = pd.Timestamp.now(tz=tz).normalize()  # up to yesterday included
    first = pd.Timestamp(config.START_DATE, tz=tz)
    for a, b in directed(borders):
        have = old[(old["from"] == a) & (old["to"] == b)]
        start = first if have.empty else max(first, end - pd.Timedelta(days=REFETCH_DAYS))
        new = daily(client, a, b, start, end)
        if new.empty:
            continue
        old = pd.concat([old, new], ignore_index=True).drop_duplicates(KEYS, keep="last")
        old.sort_values(KEYS).to_csv(OUT, index=False)  # save as we go


if __name__ == "__main__":
    main()
