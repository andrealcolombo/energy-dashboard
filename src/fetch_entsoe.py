"""Download ENTSO-E data and keep compact CSV files up to date.

Outputs (all in data/):
  prices_daily.csv      zone, country, date, avg/min/max EUR/MWh, negative-price hours
  generation_monthly.csv country, month, source, GWh  (actual generation per production type)
  load_monthly.csv      country, month, GWh, peak MW (actual total load)
  status.json           time of last run, rows per file, failures

The first run backfills from config.START_DATE. Later runs refetch only a
short recent window and overwrite it, so late corrections by TSOs are picked up.

Run:  ENTSOE_API_KEY=... python src/fetch_entsoe.py
"""

from __future__ import annotations

import json
import os
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import config  # noqa: E402

DATA = Path(os.environ.get("DATA_DIR") or Path(__file__).resolve().parent.parent / "data")
PRICES = DATA / "prices_daily.csv"
GEN = DATA / "generation_monthly.csv"
LOAD = DATA / "load_monthly.csv"
GEN_DAILY = DATA / "generation_daily.csv"
DAILY_KEEP_DAYS = 120  # daily generation is kept only for recent weeks
STATUS = DATA / "status.json"

PRICE_REFETCH_DAYS = 10  # daily prices: refetch the last N days on every run
MONTHLY_REFETCH_MONTHS = 2  # generation/load: refetch current + previous month


# ---------------------------------------------------------------- helpers

def interval_hours(index: pd.DatetimeIndex) -> pd.Series:
    """Length in hours of each interval, from the gap to the next timestamp.

    Works for 15-, 30- and 60-minute data, and for series whose resolution
    changes over time (e.g. the 2025 switch to 15-minute day-ahead products).
    """
    if len(index) == 0:
        return pd.Series(dtype=float, index=index)
    deltas = pd.Series(index, index=index).diff().shift(-1).dt.total_seconds() / 3600
    deltas = deltas.ffill().fillna(1.0)  # last interval: same length as the one before
    # ENTSO-E series used here are at most hourly. A longer gap means missing
    # data, so cap it at one hour instead of stretching the last value over it.
    return deltas.clip(upper=1.0)


def to_local(obj):
    return obj.tz_convert(config.LOCAL_TZ)


def window_start(existing: pd.DataFrame, key_col: str, key: str, time_col: str,
                 fallback: pd.Timestamp, back: pd.DateOffset) -> pd.Timestamp:
    """Where to start downloading for one zone/country."""
    if existing.empty:
        return fallback
    sub = existing.loc[existing[key_col] == key, time_col]
    if sub.empty:
        return fallback
    last = pd.Timestamp(sub.max()).tz_localize(config.LOCAL_TZ)
    return max(fallback, (last - back).normalize())


def month_floor(ts: pd.Timestamp) -> pd.Timestamp:
    return ts.normalize().replace(day=1)


def read_csv(path: Path) -> pd.DataFrame:
    if not path.exists() or path.stat().st_size == 0:
        return pd.DataFrame()
    try:
        return pd.read_csv(path)
    except pd.errors.EmptyDataError:
        return pd.DataFrame()


def save(df: pd.DataFrame, path: Path) -> None:
    if not df.empty:
        df.to_csv(path, index=False)


def merge(existing: pd.DataFrame, new: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    """Append new rows; new rows win on duplicate keys."""
    if new.empty:
        return existing
    out = pd.concat([existing, new], ignore_index=True) if not existing.empty else new
    return out.drop_duplicates(subset=keys, keep="last").sort_values(keys).reset_index(drop=True)


def with_retry(fn, *args, tries=3, **kwargs):
    for attempt in range(tries):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001
            name = type(exc).__name__
            if name in ("NoMatchingDataError", "InvalidBusinessParameterError") or attempt == tries - 1:
                raise
            time.sleep(10 * (attempt + 1))


# ---------------------------------------------------------------- transforms

def daily_prices(series: pd.Series, zone: str) -> pd.DataFrame:
    s = series.dropna()
    if s.empty:
        return pd.DataFrame()
    s = to_local(s)
    hrs = interval_hours(s.index)
    df = pd.DataFrame({"price": s.values, "hours": hrs.values}, index=s.index)
    df["date"] = df.index.date
    df["w"] = df["price"] * df["hours"]
    df["neg_hours"] = df["hours"].where(df["price"] < 0, 0.0)
    g = df.groupby("date")
    out = pd.DataFrame({
        "avg_eur_mwh": g["w"].sum() / g["hours"].sum(),  # time-weighted base price
        "min_eur_mwh": g["price"].min(),
        "max_eur_mwh": g["price"].max(),
        "negative_hours": g["neg_hours"].sum(),
        "hours_covered": g["hours"].sum(),
    }).round(2).reset_index()
    out.insert(0, "zone", zone)
    out.insert(1, "country", config.PRICE_ZONES[zone])
    out["date"] = out["date"].astype(str)
    return out


def generation_only(df: pd.DataFrame) -> pd.DataFrame:
    """Keep "Actual Aggregated" columns and name them by production type.

    Some countries report generation and consumption (pumping, storage charging) per
    type. entsoe-py then returns (type, kind) pairs, as a MultiIndex or, when years
    are concatenated, as plain tuples next to single-level names.
    """
    keep, names = [], []
    for col in df.columns:
        if isinstance(col, tuple):
            if len(col) > 1 and col[1] != "Actual Aggregated":
                continue
            keep.append(col); names.append(col[0])
        else:
            keep.append(col); names.append(col)
    out = df.loc[:, keep].copy()
    out.columns = names
    return out.T.groupby(level=0).sum(min_count=1).T  # merge duplicate names


def monthly_generation(df: pd.DataFrame, country: str) -> pd.DataFrame:
    if df is None or df.empty:
        return pd.DataFrame()
    if isinstance(df, pd.Series):
        df = df.to_frame()
    df = generation_only(df)
    df = to_local(df)
    hrs = interval_hours(df.index)
    energy = df.mul(hrs, axis=0) / 1000  # MW x h -> GWh
    energy["month"] = energy.index.strftime("%Y-%m")
    out = energy.groupby("month").sum(min_count=1)
    out = out.reset_index().melt(id_vars="month", var_name="source", value_name="gwh")
    out = out.dropna(subset=["gwh"])
    out["gwh"] = out["gwh"].round(2)
    out.insert(0, "country", country)
    return out[["country", "month", "source", "gwh"]]


def daily_generation(df: pd.DataFrame, country: str) -> pd.DataFrame:
    """Daily GWh per production type, for the recent-weeks view of the mix."""
    if df is None or df.empty:
        return pd.DataFrame()
    if isinstance(df, pd.Series):
        df = df.to_frame()
    df = generation_only(df)
    df = to_local(df)
    cutoff = pd.Timestamp.now(tz=config.LOCAL_TZ).normalize() - pd.Timedelta(days=DAILY_KEEP_DAYS)
    df = df[df.index >= cutoff]
    if df.empty:
        return pd.DataFrame()
    hrs = interval_hours(df.index)
    energy = df.mul(hrs, axis=0) / 1000
    energy["date"] = energy.index.strftime("%Y-%m-%d")
    out = energy.groupby("date").sum(min_count=1).reset_index().melt(id_vars="date", var_name="source", value_name="gwh")
    out = out.dropna(subset=["gwh"])
    out["gwh"] = out["gwh"].round(3)
    out.insert(0, "country", country)
    return out[["country", "date", "source", "gwh"]]


def monthly_load(obj, country: str) -> pd.DataFrame:
    if obj is None or len(obj) == 0:
        return pd.DataFrame()
    s = obj.iloc[:, 0] if isinstance(obj, pd.DataFrame) else obj
    s = to_local(s.dropna())
    hrs = interval_hours(s.index)
    df = pd.DataFrame({"mw": s.values, "gwh": s.values * hrs.values / 1000}, index=s.index)
    df["month"] = df.index.strftime("%Y-%m")
    g = df.groupby("month")
    out = pd.DataFrame({"gwh": g["gwh"].sum().round(2), "peak_mw": g["mw"].max().round(0)}).reset_index()
    out.insert(0, "country", country)
    return out


# ---------------------------------------------------------------- main

class _Skip(Exception):
    pass


def run(client, parts=("prices", "generation", "load")) -> dict:
    only = [c.strip() for c in os.environ.get("ONLY_COUNTRIES", "").split(",") if c.strip()]
    if only:  # used by the parallel backfill workflow: one country per job
        config.COUNTRIES = {c: n for c, n in config.COUNTRIES.items() if c in only}
        config.PRICE_ZONES = {z: c for z, c in config.PRICE_ZONES.items() if c in only}
    DATA.mkdir(exist_ok=True)
    tz = config.LOCAL_TZ
    start0 = pd.Timestamp(config.START_DATE, tz=tz)
    end = (pd.Timestamp.now(tz=tz).normalize() + pd.Timedelta(days=2))  # includes tomorrow's day-ahead
    failures: list[str] = []

    # Day-ahead prices
    prices = read_csv(PRICES)
    for zone in (config.PRICE_ZONES if "prices" in parts else []):
        start = window_start(prices, "zone", zone, "date", start0, pd.DateOffset(days=PRICE_REFETCH_DAYS))
        try:
            s = with_retry(client.query_day_ahead_prices, zone, start=start, end=end)
            prices = merge(prices, daily_prices(s, zone), ["zone", "date"])
            print(f"prices     {zone:8s} ok  from {start.date()}")
        except Exception as exc:  # noqa: BLE001
            failures.append(f"prices {zone}: {type(exc).__name__}: {str(exc)[:150]}")
            print(f"prices     {zone:8s} FAIL {type(exc).__name__}")
        save(prices, PRICES)  # save as we go: a crash keeps progress

    # Generation per production type and total load, by country
    gen = read_csv(GEN)
    gen_daily = read_csv(GEN_DAILY)
    load = read_csv(LOAD)
    back = pd.DateOffset(months=MONTHLY_REFETCH_MONTHS - 1)
    for cc in config.COUNTRIES:
        start = month_floor(window_start(gen, "country", cc, "month", start0, back))
        try:
            if "generation" not in parts:
                raise _Skip
            df = with_retry(client.query_generation, cc, start=start, end=end, psr_type=None)
            gen = merge(gen, monthly_generation(df, cc), ["country", "month", "source"])
            gen_daily = merge(gen_daily, daily_generation(df, cc), ["country", "date", "source"])
            print(f"generation {cc:8s} ok  from {start.date()}")
        except _Skip:
            pass
        except Exception as exc:  # noqa: BLE001
            failures.append(f"generation {cc}: {type(exc).__name__}: {str(exc)[:150]}")
            print(f"generation {cc:8s} FAIL {type(exc).__name__}")
        save(gen, GEN)
        if not gen_daily.empty:
            keep = (pd.Timestamp.now() - pd.Timedelta(days=DAILY_KEEP_DAYS)).strftime("%Y-%m-%d")
            gen_daily = gen_daily[gen_daily["date"] >= keep]
            save(gen_daily, GEN_DAILY)

        start = month_floor(window_start(load, "country", cc, "month", start0, back))
        try:
            if "load" not in parts:
                raise _Skip
            obj = with_retry(client.query_load, cc, start=start, end=end)
            load = merge(load, monthly_load(obj, cc), ["country", "month"])
            print(f"load       {cc:8s} ok  from {start.date()}")
        except _Skip:
            pass
        except Exception as exc:  # noqa: BLE001
            failures.append(f"load {cc}: {type(exc).__name__}: {str(exc)[:150]}")
            print(f"load       {cc:8s} FAIL {type(exc).__name__}")
        save(load, LOAD)

    status = {
        "last_run_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "rows": {"prices_daily": len(prices), "generation_monthly": len(gen), "load_monthly": len(load)},
        "latest": {
            "prices_daily": str(prices["date"].max()) if not prices.empty else None,
            "generation_monthly": str(gen["month"].max()) if not gen.empty else None,
            "load_monthly": str(load["month"].max()) if not load.empty else None,
        },
        "failures": failures,
    }
    old = json.loads(STATUS.read_text()) if STATUS.exists() else {}
    status["parts"] = list(parts)
    status["failures_by_part"] = {**old.get("failures_by_part", {}),
                                  **{p: [f for f in failures if f.startswith(p)] for p in parts}}
    STATUS.write_text(json.dumps(status, indent=2))
    return status


def main():
    key = os.environ.get("ENTSOE_API_KEY")
    if not key:
        sys.exit("ENTSOE_API_KEY is not set (GitHub: Settings > Secrets and variables > Actions).")
    from entsoe import EntsoePandasClient

    parts = tuple(sys.argv[1:]) or ("prices", "generation", "load")
    status = run(EntsoePandasClient(api_key=key, timeout=120, retry_count=3, retry_delay=20), parts)
    print(json.dumps(status, indent=2))
    total = (len(config.PRICE_ZONES) if "prices" in parts else 0) + \
        len(config.COUNTRIES) * (("generation" in parts) + ("load" in parts))
    if len(status["failures"]) == total:
        sys.exit("Every query failed: check the API key and the log above.")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception:
        traceback.print_exc()
        sys.exit(1)
