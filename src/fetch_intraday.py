"""Average day profile by month: price, load and generation hour by hour.

Output: data/intraday_profile.csv, one row per country, month and hour of day
(Europe/Brussels time, hour 0 = 00:00-01:00):

  country, month, hour,
  price        day-ahead price, EUR/MWh (multi-zone countries: simple mean of zones)
  load         actual total load, MW
  solar, wind, gas, coal, nuclear, hydro, other   generation, MW
  storage_out  pumped hydro + battery generation (discharging), MW
  storage_in   pumped hydro + battery consumption (charging), MW, positive number
  battery_out, battery_in   batteries only ("Energy storage"), MW; empty where not reported

Each value is the average over all days of the month for that hour. 15-minute data
is first averaged to the hour, so values are time-weighted. The running month is
left out, as for the mix and load.

The first run covers config.START_DATE onwards. Later runs refetch the last two
complete months. ENTSO-E reports batteries only from 2025 and for a few countries.

Run:  ENTSOE_API_KEY=... python src/fetch_intraday.py            (all countries)
      ONLY_COUNTRIES=IT,HU DATA_DIR=out python src/fetch_intraday.py
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
OUT = DATA / "intraday_profile.csv"
REFETCH_MONTHS = 2
KEYS = ["country", "month", "hour"]

GROUPS = {
    "solar": ["Solar"],
    "wind": ["Wind Onshore", "Wind Offshore"],
    "gas": ["Fossil Gas", "Fossil Coal-derived gas"],
    "coal": ["Fossil Hard coal", "Fossil Brown coal/Lignite", "Fossil Peat", "Fossil Oil shale"],
    "nuclear": ["Nuclear"],
    "hydro": ["Hydro Run-of-river and pondage", "Hydro Water Reservoir"],
}
STORAGE = ["Hydro Pumped Storage", "Energy storage"]


def by_year(fn, *args, start: pd.Timestamp, end: pd.Timestamp, label: str = "", **kw):
    """Run an ENTSO-E query one calendar year at a time, so a failure loses one year only."""
    parts = []
    cur = start
    while cur < end:
        nxt = min(end, pd.Timestamp(year=cur.year + 1, month=1, day=1, tz=cur.tz))
        t0 = time.time()
        try:
            parts.append(with_retry(fn, *args, start=cur, end=nxt, **kw))
            print(f"  {label} {cur.year}: ok ({time.time() - t0:.0f}s)", flush=True)
        except Exception as exc:  # noqa: BLE001
            print(f"  {label} {cur.year}: {type(exc).__name__} ({time.time() - t0:.0f}s)", flush=True)
        cur = nxt
    if not parts:
        raise RuntimeError(f"no data for {label}")
    out = pd.concat(parts)
    return out[~out.index.duplicated(keep="last")].sort_index()


def hourly(obj: pd.DataFrame | pd.Series) -> pd.DataFrame | pd.Series:
    """Hourly means in UTC (time-weighted for 15/30-minute data)."""
    return obj.tz_convert("UTC").resample("1h").mean()


def split_generation(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Generation ("Actual Aggregated") and consumption ("Actual Consumption") by type."""
    gen, cons = {}, {}
    for col in df.columns:
        if isinstance(col, tuple) and len(col) > 1:
            name, kind = col[0], col[1]
        else:
            name, kind = col, "Actual Aggregated"
        target = gen if kind == "Actual Aggregated" else cons
        target[name] = target[name].add(df[col], fill_value=0) if name in target else df[col]
    return pd.DataFrame(gen), pd.DataFrame(cons, index=df.index)


def profile(cc: str, client, start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    cols: dict[str, pd.Series] = {}

    zones = [z for z, c in config.PRICE_ZONES.items() if c == cc]
    zp = []
    for z in zones:
        try:
            zp.append(hourly(by_year(client.query_day_ahead_prices, z, start=start, end=end, label=f'price {z}')).rename(z))
        except Exception as exc:  # noqa: BLE001
            print(f"  price {z}: {type(exc).__name__}")
    if zp:
        cols["price"] = pd.concat(zp, axis=1).mean(axis=1)

    try:
        ld = by_year(client.query_load, cc, start=start, end=end, label='load')
        ld = ld.iloc[:, 0] if isinstance(ld, pd.DataFrame) else ld
        cols["load"] = hourly(ld)
    except Exception as exc:  # noqa: BLE001
        print(f"  load: {type(exc).__name__}")

    try:
        df = by_year(client.query_generation, cc, start=start, end=end, psr_type=None, label='generation')
        if isinstance(df, pd.Series):
            df = df.to_frame()
        gen, cons = split_generation(df)
        gen, cons = hourly(gen), hourly(cons)
        used = set()
        for key, names in GROUPS.items():
            have = [n for n in names if n in gen]
            if have:
                cols[key] = gen[have].sum(axis=1, min_count=1)
                used.update(have)
        st = [n for n in STORAGE if n in gen]
        if st:
            cols["storage_out"] = gen[st].sum(axis=1, min_count=1)
        st_in = [n for n in STORAGE if n in cons]
        if st_in:
            cols["storage_in"] = cons[st_in].sum(axis=1, min_count=1)
        if "Energy storage" in gen:
            cols["battery_out"] = gen["Energy storage"]
        if "Energy storage" in cons:
            cols["battery_in"] = cons["Energy storage"]
        rest = [n for n in gen.columns if n not in used and n not in STORAGE]
        if rest:
            cols["other"] = gen[rest].sum(axis=1, min_count=1)
    except Exception as exc:  # noqa: BLE001
        print(f"  generation: {type(exc).__name__}")

    if not cols:
        return pd.DataFrame()
    h = pd.DataFrame(cols).tz_convert(config.LOCAL_TZ)
    this_month = pd.Timestamp.now(tz=config.LOCAL_TZ).strftime("%Y-%m")
    h["month"] = h.index.strftime("%Y-%m")
    h["hour"] = h.index.hour
    h = h[h["month"] < this_month]
    out = h.groupby(["month", "hour"]).mean().round(1).reset_index()
    out.insert(0, "country", cc)
    return out


def main() -> None:
    from entsoe import EntsoePandasClient

    key = os.environ.get("ENTSOE_API_KEY")
    if not key:
        sys.exit("ENTSOE_API_KEY is not set")
    client = EntsoePandasClient(api_key=key, timeout=120, retry_count=3, retry_delay=20)
    only = [c.strip() for c in os.environ.get("ONLY_COUNTRIES", "").split(",") if c.strip()]
    countries = [c for c in config.COUNTRIES if not only or c in only]

    DATA.mkdir(exist_ok=True)
    old = pd.read_csv(OUT) if OUT.exists() and OUT.stat().st_size > 0 else pd.DataFrame(columns=KEYS)
    tz = config.LOCAL_TZ
    end = pd.Timestamp.now(tz=tz).normalize().replace(day=1)  # start of the running month
    first = pd.Timestamp(config.START_DATE, tz=tz)
    failures = []
    for cc in countries:
        done = old[old["country"] == cc]
        start = first
        if not done.empty:
            start = max(first, end - pd.DateOffset(months=REFETCH_MONTHS))
        try:
            new = profile(cc, client, start, end)
        except Exception as exc:  # noqa: BLE001
            failures.append(cc)
            print(f"intraday {cc:3s} FAIL {type(exc).__name__}: {str(exc)[:120]}")
            continue
        if new.empty:
            failures.append(cc)
            print(f"intraday {cc:3s} no data")
            continue
        old = pd.concat([old, new], ignore_index=True).drop_duplicates(KEYS, keep="last")
        old.sort_values(KEYS).to_csv(OUT, index=False)  # save as we go
        print(f"intraday {cc:3s} ok  {new['month'].min()} to {new['month'].max()}")
    if failures:
        print("Failures:", ", ".join(failures))


if __name__ == "__main__":
    main()
