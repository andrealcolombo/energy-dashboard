"""Build one Excel workbook with every public dataset behind the dashboard.

Output: data/energy_dashboard_data.xlsx (one sheet per dataset, plus a README sheet).
Public sources only (ENTSO-E, EC Weekly Oil Bulletin, Eurostat). The DG ENER newsletter is never included.
"""
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from openpyxl.styles import Font
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "dashboard"
OUT = ROOT / "data" / "energy_dashboard_data.xlsx"

SHEETS = [
    ("prices_daily", "Day-ahead electricity prices, daily (€/MWh): bidding zones, countries, EU27. Last 18 months.",
     "ENTSO-E Transparency Platform"),
    ("prices_monthly", "Day-ahead electricity prices, monthly average (€/MWh) and hours with negative prices, since 2021.",
     "ENTSO-E Transparency Platform"),
    ("mix_monthly", "Electricity generation by source group (GWh and % of total), monthly, since 2021. Running month excluded.",
     "ENTSO-E Transparency Platform"),
    ("mix_weekly", "Generation by source over the last 7 published days and the 28 days before (GWh and %).",
     "ENTSO-E Transparency Platform"),
    ("load_monthly", "Electricity demand (total load, GWh; peak, MW), monthly, since 2021. Running month excluded.",
     "ENTSO-E Transparency Platform"),
    ("gas_ttf_monthly", "TTF natural gas price, monthly average: USD/MMBtu (IMF) and converted to €/MWh at the monthly USD/EUR rate.",
     "IMF Primary Commodity Prices via FRED (PNGASEUUSDM, DEXUSEU)"),
    ("fuels_weekly", "Pump prices with all taxes (€/litre): petrol 95, diesel, heating oil; EU average and EU27 countries.",
     "European Commission, Weekly Oil Bulletin"),
    ("retail_semiannual", "Household prices with all taxes (€/kWh), by half-year: electricity 2,500–4,999 kWh/yr "
     "(nrg_pc_204, band DC); gas 20–200 GJ/yr (nrg_pc_202, band D2).", "Eurostat"),
]

METHOD = [
    "Daily averages are time-weighted (hourly products until September 2025, 15-minute products after).",
    "Country price for countries with several zones (DK, IT, SE): simple mean of the zones (for Italy, not the PUN).",
    "EU27 price: country prices weighted by monthly electricity demand.",
    "Days and months follow Brussels time.",
    "Battery storage = ENTSO-E 'Energy storage', reported by only some countries.",
]


def main():
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    with pd.ExcelWriter(OUT, engine="openpyxl") as xw:
        rows = [["EU energy markets: data behind the dashboard"], [f"Built {stamp}. Updated automatically every day."], [],
                ["Sheet", "Content", "Source", "Rows"]]
        frames = {}
        for name, desc, src in SHEETS:
            f = SRC / f"{name}.csv"
            if not f.exists():
                f = SRC.parent / f"{name}.csv"
            if not f.exists() or f.stat().st_size == 0:
                continue
            df = pd.read_csv(f)
            frames[name] = df
            rows.append([name, desc, src, len(df)])
        rows += [[], ["Method"]] + [[m] for m in METHOD]
        rows += [[], ["Repository: https://github.com/andrealcolombo/energy-dashboard"]]
        pd.DataFrame(rows).to_excel(xw, sheet_name="README", index=False, header=False)
        for name, df in frames.items():
            df.to_excel(xw, sheet_name=name, index=False)
        wb = xw.book
        wb["README"]["A1"].font = Font(bold=True, size=13)
        for c in "ABCD":
            wb["README"][f"{c}4"].font = Font(bold=True)
        wb["README"].column_dimensions["A"].width = 20
        wb["README"].column_dimensions["B"].width = 95
        wb["README"].column_dimensions["C"].width = 38
        for name in frames:
            ws = wb[name]
            ws.freeze_panes = "A2"
            for i, col in enumerate(frames[name].columns, 1):
                ws.cell(1, i).font = Font(bold=True)
                ws.column_dimensions[get_column_letter(i)].width = max(11, len(col) + 3)
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
