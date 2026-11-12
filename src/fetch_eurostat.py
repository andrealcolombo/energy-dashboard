"""Household retail prices of electricity and gas by country, from Eurostat (semi-annual).

Output: data/retail_semiannual.csv
  geo, period (e.g. 2025-S2), product (electricity | gas), eur_per_kwh
Also data/eurostat_structure.txt with the raw dimensions, to check the parser.

Datasets (prices for household consumers, all taxes and levies included, EUR/kWh):
  nrg_pc_204  electricity, band DC (2 500-4 999 kWh/year)
  nrg_pc_202  natural gas, band D2 (20-199 GJ/year)
"""

from __future__ import annotations

import itertools
import json
import sys
import urllib.request
from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data"
BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/"
QUERIES = {
    "electricity": ("nrg_pc_204", {"nrg_cons": "KWH2500-4999", "tax": "I_TAX", "currency": "EUR", "unit": "KWH"}),
    "gas": ("nrg_pc_202", {"nrg_cons": "GJ20-199", "tax": "I_TAX", "currency": "EUR", "unit": "KWH"}),
}
START = "2021"


def get(code: str, params: dict) -> dict:
    q = "&".join(f"{k}={v}" for k, v in params.items())
    url = f"{BASE}{code}?format=JSON&lang=EN&{q}&sinceTimePeriod={START}-S1"
    req = urllib.request.Request(url, headers={"User-Agent": "energy-dashboard"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def jsonstat_to_frame(js: dict) -> pd.DataFrame:
    """Flatten a JSON-stat 2.0 dataset into one row per non-empty cell."""
    ids, sizes = js["id"], js["size"]
    cats = []
    for d in ids:
        index = js["dimension"][d]["category"]["index"]
        if isinstance(index, list):
            index = {c: i for i, c in enumerate(index)}
        cats.append(sorted(index, key=index.get))
    values = js.get("value", {})
    if isinstance(values, list):
        values = {str(i): v for i, v in enumerate(values) if v is not None}
    rows = []
    for flat, combo in enumerate(itertools.product(*cats)):
        v = values.get(str(flat))
        if v is not None:
            rows.append(dict(zip(ids, combo), value=v))
    assert len(rows) <= len(values) and all(len(c) == s for c, s in zip(cats, sizes))
    return pd.DataFrame(rows)


def main() -> int:
    DATA.mkdir(exist_ok=True)
    out, notes = [], []
    for product, (code, params) in QUERIES.items():
        try:
            js = get(code, params)
            df = jsonstat_to_frame(js)
            notes.append(f"{code}: dims={js['id']} sizes={js['size']} rows={len(df)} "
                         f"periods={sorted(df['time'].unique())[-3:] if 'time' in df else '?'}")
            df = df.rename(columns={"time": "period"})
            df["product"] = product
            out.append(df[["geo", "period", "product", "value"]].rename(columns={"value": "eur_per_kwh"}))
        except Exception as exc:  # noqa: BLE001
            notes.append(f"{code}: FAILED {type(exc).__name__}: {exc}")
    (DATA / "eurostat_structure.txt").write_text("\n".join(notes) + "\n")
    print("\n".join(notes))
    if out:
        df = pd.concat(out, ignore_index=True)
        df["geo"] = df["geo"].replace({"EU27_2020": "EU27", "EL": "GR"})
        df["eur_per_kwh"] = df["eur_per_kwh"].astype(float).round(4)
        df.sort_values(["product", "geo", "period"]).to_csv(DATA / "retail_semiannual.csv", index=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
