"""Country borders for the cross-border flows map (data/geo/europe.geojson).

Source: Natural Earth 1:50m admin-0 countries (public domain), clipped to Europe
and simplified (coordinates rounded to 0.02 degrees). Run once, by hand:
  python src/build_geo.py path/to/ne_50m_admin_0_countries.geojson
Each feature has `id` (ISO2, as used by ENTSO-E) and `lon`/`lat`, the point
where flow arrows to and from that country start.
"""

import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "geo" / "europe.geojson"
BOX = (-25.0, 25.0, 50.0, 72.0)  # lon min, lat min, lon max, lat max
KEEP = ("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE "
        "GB NO CH LI AD MC SM VA RS BA ME MK AL XK UA MD BY RU TR MA DZ TN LY IS GE").split()
# Arrow anchor points: a point inside the main territory (the centroid would fall
# in the sea or far east for some countries).
ANCHOR = {"NO": (9.5, 61.0), "SE": (15.5, 61.5), "FR": (2.5, 46.6), "RU": (31.0, 57.5),
          "UA": (31.0, 49.0), "TR": (33.0, 39.2), "GB": (-1.8, 52.6), "DK": (9.3, 56.0),
          "GR": (22.0, 39.6), "ES": (-3.7, 40.2), "PT": (-8.0, 39.6), "NL": (5.6, 52.2),
          "MA": (-6.0, 32.5), "IT": (12.0, 43.5), "FI": (26.0, 62.5), "DE": (10.3, 51.1),
          "IE": (-8.0, 53.2), "HR": (16.0, 45.3), "NIE": (-6.6, 54.6), "BY": (28.0, 53.5),
          "PL": (19.2, 52.0), "EE": (25.5, 58.7), "LT": (24.0, 55.3), "LV": (25.0, 56.9)}
# Sea links (submarine cables): a point on the stretch of sea the cable crosses.
SEA = {"IT|MT": (14.4, 36.4), "GR|IT": (19.0, 40.1), "IT|ME": (17.0, 42.3), "FR|GB": (1.3, 50.5),
       "BE|GB": (2.4, 51.6), "NL|GB": (3.3, 52.6), "DK|GB": (5.0, 55.6), "DE|GB": (5.0, 54.3),
       "FR|IE": (-5.6, 49.8), "IE|GB": (-5.2, 53.2), "NL|NO": (5.6, 56.0), "DE|NO": (7.6, 56.0),
       "DK|NO": (8.4, 57.7), "DK|SE": (12.0, 56.3), "DE|SE": (13.2, 55.0), "PL|SE": (16.2, 55.3),
       "LT|SE": (19.2, 56.0), "EE|FI": (25.0, 59.6), "DK|NL": (6.4, 55.0), "ES|MA": (-5.6, 35.95),
       "FI|SE": (21.0, 61.0), "IE|NIE": (-7.0, 54.3)}
NAMES_FIX = {"France": "FR", "Norway": "NO", "Kosovo": "XK"}


def clip(ring, edge, inside, cut):
    out = []
    for i, p in enumerate(ring):
        q = ring[i - 1]
        if inside(p):
            if not inside(q):
                out.append(cut(q, p))
            out.append(p)
        elif inside(q):
            out.append(cut(q, p))
    return out


def clip_box(ring):
    x0, y0, x1, y1 = BOX
    def at_x(x):
        return lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))
    def at_y(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y)
    for inside, cut in [(lambda p: p[0] >= x0, at_x(x0)), (lambda p: p[0] <= x1, at_x(x1)),
                        (lambda p: p[1] >= y0, at_y(y0)), (lambda p: p[1] <= y1, at_y(y1))]:
        if not ring:
            return []
        ring = clip(ring, None, inside, cut)
    return ring


def simplify(ring):
    out = []
    for x, y in ring:
        p = [round(x / 0.02) * 0.02, round(y / 0.02) * 0.02]
        p = [round(p[0], 2), round(p[1], 2)]
        if not out or out[-1] != p:
            out.append(p)
    if len(out) > 3 and out[0] != out[-1]:
        out.append(out[0])
    if len(out) < 4:
        return None
    # d3-geo wants exterior rings clockwise (negative shoelace area in lon/lat)
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(out, out[1:]))
    return out[::-1] if area > 0 else out


def main(src):
    feats = []
    for f in json.load(open(src))["features"]:
        pr = f["properties"]
        iso = pr.get("ISO_A2_EH") or pr.get("ISO_A2")
        iso = NAMES_FIX.get(pr.get("NAME"), iso)
        if iso not in KEEP:
            continue
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        keep = []
        for poly in polys:
            outer = simplify(clip_box([tuple(p) for p in poly[0]]))
            if outer:
                keep.append([outer])  # holes dropped: not visible at this scale
        if not keep:
            continue
        lon, lat = ANCHOR.get(iso, (pr.get("LABEL_X"), pr.get("LABEL_Y")))
        feats.append({"type": "Feature", "id": iso, "properties": {"name": pr.get("NAME"), "lon": lon, "lat": lat},
                      "geometry": {"type": "MultiPolygon", "coordinates": keep}})
    # Border points: where the arrows of each border are centred. Land borders: middle of the
    # vertices the two countries share; sea links: halfway between the anchor points.
    sys.path.insert(0, str(Path(__file__).parent))
    import config
    by = {ft["id"]: ft for ft in feats}
    def verts(iso):
        g = by.get(iso)
        return [tuple(p) for poly in (g["geometry"]["coordinates"] if g else []) for p in poly[0]]
    pts = {}
    for a, b in config.FLOW_BORDERS:
        va, vb = verts(a), set(verts(b))
        near = [p for p in va if any(abs(p[0] - q[0]) <= 0.06 and abs(p[1] - q[1]) <= 0.06 for q in vb)] if vb else []
        pa = (by[a]["properties"]["lon"], by[a]["properties"]["lat"]) if a in by else None
        pb = (by[b]["properties"]["lon"], by[b]["properties"]["lat"]) if b in by else ANCHOR.get(b)
        if len(near) >= 3:
            # the shared vertex closest to the middle of the shared stretch
            cx = sum(p[0] for p in near) / len(near); cy = sum(p[1] for p in near) / len(near)
            pts[f"{a}|{b}"] = list(min(near, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2))
        elif pa and pb:
            pts[f"{a}|{b}"] = [round((pa[0] + pb[0]) / 2, 2), round((pa[1] + pb[1]) / 2, 2)]
    pts.update({k: list(v) for k, v in SEA.items()})
    # Northern Ireland: no separate polygon in Natural Earth, an anchor point only
    feats.append({"type": "Feature", "id": "NIE", "properties": {"name": "Northern Ireland", "lon": -6.6, "lat": 54.6}, "geometry": None})
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"type": "FeatureCollection", "source": "Natural Earth 1:50m (public domain), simplified", "border_points": pts, "features": feats}, separators=(",", ":")))
    print(OUT, OUT.stat().st_size // 1024, "KB,", len(feats), "features")


if __name__ == "__main__":
    main(sys.argv[1])
