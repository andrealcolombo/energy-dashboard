"""Download the EC Weekly Oil Bulletin price history and keep consumer fuel prices.

Output:
  data/oil_bulletin_weekly.csv   date, country, product, eur_per_litre (prices with taxes)
  data/oil_bulletin_structure.txt  sheet names and header rows of the source file,
                                   written every run so the parser can be checked

Source: European Commission, DG ENER, Weekly Oil Bulletin, "Prices history" file
(prices in force each Monday, since 2005). Prices are in EUR per 1000 litres in the
source; they are converted to EUR per litre here.
"""

from __future__ import annotations

import io
import re
import sys
import urllib.request
from pathlib import Path

import pandas as pd

URL = ("https://energy.ec.europa.eu/document/download/906e60ca-8b6a-44e7-8589-652854d2fd3f_en"
       "?filename=Weekly_Oil_Bulletin_Prices_History_maticni_4web.xlsx")
DATA = Path(__file__).resolve().parent.parent / "data"
OUT = DATA / "oil_bulletin_weekly.csv"
STRUCT = DATA / "oil_bulletin_structure.txt"
START = "2021-01-01"

# Column names look like "AT_price_with_tax_diesel" in the history file (to be confirmed
# by oil_bulletin_structure.txt). Products kept: petrol (Euro-super 95), diesel, heating oil.
COL = re.compile(r"^(?P<cc>[A-Z]{2}|EU|EUR)_price_with_tax_(?P<prod>.+)$", re.I)
PRODUCTS = {"euro95": "petrol_95", "diesel": "diesel", "heating_oil": "heating_oil"}


def download() -> bytes:
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 (energy-dashboard)"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def describe(book: dict[str, pd.DataFrame]) -> str:
    lines = []
    for name, df in book.items():
        lines.append(f"=== sheet: {name!r}  shape={df.shape}")
        for i in range(min(6, len(df))):
            cells = [str(v) for v in df.iloc[i, :40].tolist()]
            lines.append(f"row {i}: " + " | ".join(cells))
    return "\n".join(lines)


def parse(book: dict[str, pd.DataFrame]) -> pd.DataFrame:
    for name, raw in book.items():
        for hdr in range(min(6, len(raw))):
            header = [str(v).strip() for v in raw.iloc[hdr].tolist()]
            hits = [(j, COL.match(h)) for j, h in enumerate(header)]
            hits = [(j, m) for j, m in hits if m]
            if len(hits) < 20:
                continue
            body = raw.iloc[hdr + 1:]
            dates = pd.to_datetime(body.iloc[:, 0], errors="coerce", dayfirst=True)
            rows = []
            for j, m in hits:
                prod = m.group("prod").lower()
                if prod not in PRODUCTS:
                    continue
                cc = m.group("cc").upper()
                cc = "EU" if cc in ("EU", "EUR") else cc
                vals = pd.to_numeric(body.iloc[:, j], errors="coerce")
                rows.append(pd.DataFrame({"date": dates, "country": cc,
                                          "product": PRODUCTS[prod], "eur_per_litre": vals / 1000}))
            if not rows:
                continue
            out = pd.concat(rows).dropna()
            out = out[out["date"] >= START]
            out["date"] = out["date"].dt.strftime("%Y-%m-%d")
            out["eur_per_litre"] = out["eur_per_litre"].round(3)
            print(f"parsed sheet {name!r}, header row {hdr}: {len(out)} rows")
            return out.sort_values(["country", "product", "date"]).reset_index(drop=True)
    raise ValueError("No sheet with *_price_with_tax_* columns found: see oil_bulletin_structure.txt")


def main() -> int:
    DATA.mkdir(exist_ok=True)
    try:
        content = download()
    except Exception as exc:  # noqa: BLE001
        print(f"Oil Bulletin download failed: {exc}")
        return 0  # never block the ENTSO-E part of the workflow
    book = pd.read_excel(io.BytesIO(content), sheet_name=None, header=None)
    STRUCT.write_text(describe(book))
    try:
        df = parse(book)
    except Exception as exc:  # noqa: BLE001
        print(f"Oil Bulletin parse failed: {exc}")
        return 0
    if len(df) > 1000:
        df.to_csv(OUT, index=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
