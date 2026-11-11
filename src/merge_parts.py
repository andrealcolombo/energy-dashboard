"""Merge per-country outputs of the backfill workflow into data/."""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
parts_dir = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "parts")

for name, keys in [("generation_monthly.csv", ["country", "month", "source"]),
                   ("load_monthly.csv", ["country", "month"]),
                   ("prices_daily.csv", ["zone", "date"])]:
    frames = [pd.read_csv(p) for p in parts_dir.glob(f"*/{name}") if p.stat().st_size > 0]
    if not frames:
        continue
    target = DATA / name
    if target.exists() and target.stat().st_size > 0:
        frames.insert(0, pd.read_csv(target))
    out = pd.concat(frames, ignore_index=True).drop_duplicates(subset=keys, keep="last")
    out.sort_values(keys).to_csv(target, index=False)
    print(name, len(out), "rows,", out[keys[0]].nunique(), "areas")
