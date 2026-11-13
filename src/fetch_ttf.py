"""TTF gas price, monthly average, from public sources (no API key).

Source: IMF Primary Commodity Prices, "Global price of Natural gas, EU" (Dutch TTF), USD/MMBtu,
via FRED series PNGASEUUSDM. Converted to EUR/MWh with the monthly average of the ECB/Fed USD per EUR
rate (FRED series DEXUSEU). 1 MMBtu = 0.293071 MWh.

Output: data/gas_ttf_monthly.csv (month, usd_mmbtu, usd_per_eur, eur_mwh).
"""
import io
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "gas_ttf_monthly.csv"
FRED = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={}"
MWH_PER_MMBTU = 0.293071


def series(sid):
    r = requests.get(FRED.format(sid), timeout=60)
    r.raise_for_status()
    df = pd.read_csv(io.StringIO(r.text))
    df.columns = ["date", "value"]
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df["date"] = pd.to_datetime(df["date"])
    return df.dropna()


def main():
    gas = series("PNGASEUUSDM")
    fx = series("DEXUSEU")
    gas["month"] = gas["date"].dt.strftime("%Y-%m")
    fx["month"] = fx["date"].dt.strftime("%Y-%m")
    fxm = fx.groupby("month")["value"].mean().rename("usd_per_eur")
    out = gas.set_index("month")[["value"]].rename(columns={"value": "usd_mmbtu"}).join(fxm, how="inner")
    out = out[out.index >= "2019-01"]
    out["eur_mwh"] = (out["usd_mmbtu"] / MWH_PER_MMBTU / out["usd_per_eur"]).round(2)
    out = out.round({"usd_mmbtu": 3, "usd_per_eur": 4}).reset_index()
    if out.empty:
        raise SystemExit("no TTF data")
    out.to_csv(OUT, index=False)
    print(f"wrote {OUT}: {len(out)} months, last {out['month'].iloc[-1]} = {out['eur_mwh'].iloc[-1]} EUR/MWh")


if __name__ == "__main__":
    main()
