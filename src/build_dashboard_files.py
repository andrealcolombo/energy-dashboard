"""Turn the raw CSVs in data/ into the compact files the dashboard app reads.

Writes to data/dashboard/:
  prices_daily.csv     last ~18 months, by area (bidding zone, country, EU27)
  prices_monthly.csv   since 2021, by area
  mix_monthly.csv      generation by country (and EU27), month, source group: GWh and share
  load_monthly.csv     load by country (and EU27), month
  fuels_weekly.csv     consumer fuel prices with taxes, selected countries + EU (if available)

Aggregates computed here (documented in the app's sources):
  country price  = simple average of the country's bidding zones (DK, IT, SE)
  EU27 price     = average of country prices weighted by each country's monthly load
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import config  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / "data"
OUT = DATA / "dashboard"

GROUPS = {
    "Nuclear": "Nucleare",
    "Fossil Gas": "Gas", "Fossil Coal-derived gas": "Gas",
    "Fossil Hard coal": "Carbone e lignite", "Fossil Brown coal/Lignite": "Carbone e lignite",
    "Fossil Peat": "Carbone e lignite", "Fossil Oil shale": "Carbone e lignite",
    "Fossil Oil": "Petrolio",
    "Hydro Run-of-river and poundage": "Idroelettrico", "Hydro Water Reservoir": "Idroelettrico",
    "Hydro Pumped Storage": "Pompaggi",
    "Wind Onshore": "Eolico", "Wind Offshore": "Eolico",
    "Solar": "Solare",
    "Biomass": "Bio, geotermia e altre rinnovabili", "Geothermal": "Bio, geotermia e altre rinnovabili",
    "Other renewable": "Bio, geotermia e altre rinnovabili", "Marine": "Bio, geotermia e altre rinnovabili",
    "Waste": "Altro", "Other": "Altro", "Energy storage": "Altro",
}
RENEWABLE = {"Idroelettrico", "Eolico", "Solare", "Bio, geotermia e altre rinnovabili"}
FUEL_COUNTRIES = {"EU", "IT", "HU", "DE", "FR", "ES", "AT", "PL"}


def prices(load: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    p = pd.read_csv(DATA / "prices_daily.csv")
    p = p[p["hours_covered"] >= 20]  # drop incomplete days (e.g. tomorrow before publication)
    zones = p.rename(columns={"zone": "area"})
    zones["level"] = "zona"

    split = p.groupby("country")["zone"].transform("nunique") > 1
    ctry = (p.groupby(["country", "date"], as_index=False)
              .agg(avg_eur_mwh=("avg_eur_mwh", "mean"), min_eur_mwh=("min_eur_mwh", "min"),
                   max_eur_mwh=("max_eur_mwh", "max"), negative_hours=("negative_hours", "mean")))
    ctry_all = ctry.rename(columns={"country": "area"})
    ctry_all["level"] = "paese"
    ctry_all["country"] = ctry_all["area"]

    # EU27: load-weighted average of country prices
    ctry["month"] = ctry["date"].str[:7]
    w = load[["country", "month", "gwh"]]
    eu = ctry.merge(w, on=["country", "month"], how="inner")
    eu = (eu.assign(wp=eu["avg_eur_mwh"] * eu["gwh"])
            .groupby("date").agg(wp=("wp", "sum"), w=("gwh", "sum"), n=("country", "nunique"),
                                 min_eur_mwh=("avg_eur_mwh", "min"), max_eur_mwh=("avg_eur_mwh", "max"))
            .reset_index())
    eu = eu[eu["n"] >= 20]
    eu = pd.DataFrame({"area": "EU27", "country": "EU27", "level": "UE", "date": eu["date"],
                       "avg_eur_mwh": (eu["wp"] / eu["w"]).round(2),
                       "min_eur_mwh": eu["min_eur_mwh"], "max_eur_mwh": eu["max_eur_mwh"]})

    # countries with one zone appear once, as "paese"
    zones = zones[zones["country"].isin(set(p.loc[split, "country"]))]
    daily = pd.concat([eu, ctry_all, zones], ignore_index=True)
    daily = daily[["date", "area", "country", "level", "avg_eur_mwh", "min_eur_mwh", "max_eur_mwh", "negative_hours"]]
    daily["avg_eur_mwh"] = daily["avg_eur_mwh"].round(2)
    daily["negative_hours"] = daily["negative_hours"].round(2)

    daily["month"] = daily["date"].str[:7]
    monthly = (daily.groupby(["month", "area", "country", "level"], as_index=False)
                    .agg(avg_eur_mwh=("avg_eur_mwh", "mean"), negative_hours=("negative_hours", "sum"),
                         days=("date", "nunique")))
    monthly["avg_eur_mwh"] = monthly["avg_eur_mwh"].round(2)
    monthly["negative_hours"] = monthly["negative_hours"].round(1)

    last = pd.Timestamp(daily["date"].max())
    recent = daily[daily["date"] >= (last - pd.DateOffset(months=18)).strftime("%Y-%m-%d")]
    return recent.drop(columns="month"), monthly


def mix() -> pd.DataFrame:
    g = pd.read_csv(DATA / "generation_monthly.csv")
    g["group"] = g["source"].map(GROUPS).fillna("Altro")
    g = g.groupby(["country", "month", "group"], as_index=False)["gwh"].sum()
    # EU27 only for months where (almost) all countries reported
    n = g.groupby("month")["country"].nunique()
    full = n[n >= 25].index
    eu = g[g["month"].isin(full)].groupby(["month", "group"], as_index=False)["gwh"].sum()
    eu["country"] = "EU27"
    g = pd.concat([eu, g], ignore_index=True)
    g["share_pct"] = (100 * g["gwh"] / g.groupby(["country", "month"])["gwh"].transform("sum")).round(2)
    g["renewable"] = g["group"].isin(RENEWABLE)
    g["gwh"] = g["gwh"].round(1)
    return g[["country", "month", "group", "renewable", "gwh", "share_pct"]]


def loadm() -> pd.DataFrame:
    l = pd.read_csv(DATA / "load_monthly.csv")
    n = l.groupby("month")["country"].nunique()
    eu = l[l["month"].isin(n[n >= 25].index)].groupby("month", as_index=False).agg(gwh=("gwh", "sum"))
    eu["country"] = "EU27"
    eu["peak_mw"] = None
    return pd.concat([eu, l], ignore_index=True)[["country", "month", "gwh", "peak_mw"]]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    load = pd.read_csv(DATA / "load_monthly.csv")
    d, m = prices(load)
    d.to_csv(OUT / "prices_daily.csv", index=False)
    m.to_csv(OUT / "prices_monthly.csv", index=False)
    mix().to_csv(OUT / "mix_monthly.csv", index=False)
    loadm().to_csv(OUT / "load_monthly.csv", index=False)
    f = DATA / "oil_bulletin_weekly.csv"
    if f.exists():
        fu = pd.read_csv(f)
        fu[fu["country"].isin(FUEL_COUNTRIES)].to_csv(OUT / "fuels_weekly.csv", index=False)
    for p in sorted(OUT.glob("*.csv")):
        print(p.name, len(pd.read_csv(p)), "rows", round(p.stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main()
