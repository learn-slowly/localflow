"""진주시 행정경계 데이터를 API에서 받아 GeoJSON으로 변환하여 저장"""
import urllib.request
import json
import time
import re

API_KEY = "7F757A7W61AB87PO"
BASE_URL = "https://www.safetydata.go.kr/V2/api/DSSP-IF-10467"
OUTPUT = "src/data/jinju-boundary.geojson"

def fetch_page(page, num=100):
    url = f"{BASE_URL}?serviceKey={API_KEY}&returnType=json&numOfRows={num}&pageNo={page}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())

def parse_coords(coord_str):
    """Parse coordinate string, stripping parentheses"""
    coords = []
    # Remove all parentheses
    clean = coord_str.replace('(', '').replace(')', '')
    for pair in clean.split(','):
        parts = pair.strip().split()
        if len(parts) >= 2:
            try:
                x, y = float(parts[0]), float(parts[1])
                coords.append([x, y])
            except ValueError:
                continue
    return coords

def epsg3857_to_wgs84(x, y):
    """EPSG:3857 (Web Mercator) -> WGS84 (lng, lat)"""
    import math
    lng = x * 180.0 / 20037508.34
    lat = math.atan(math.exp(y * math.pi / 20037508.34)) * 360.0 / math.pi - 90.0
    return [lng, lat]

def wkt_to_geojson_geometry(wkt):
    """WKT POLYGON/MULTIPOLYGON -> GeoJSON geometry with WGS84 coords"""
    # Check if MULTIPOLYGON
    if wkt.startswith('MULTIPOLYGON'):
        # Extract all polygon rings
        rings_str = wkt.replace('MULTIPOLYGON(', '')[:-1]
        polygons = []
        # Split by ")),((" for multiple polygons
        parts = re.split(r'\)\s*,\s*\(', rings_str)
        for part in parts:
            coords = parse_coords(part)
            if coords:
                wgs_coords = [epsg3857_to_wgs84(x, y) for x, y in coords]
                polygons.append([wgs_coords])
        if len(polygons) == 1:
            return {"type": "Polygon", "coordinates": polygons[0]}
        return {"type": "MultiPolygon", "coordinates": polygons}
    else:
        # POLYGON
        inner = wkt.replace('POLYGON(', '')[:-1]
        coords = parse_coords(inner)
        if not coords:
            return None
        wgs_coords = [epsg3857_to_wgs84(x, y) for x, y in coords]
        return {"type": "Polygon", "coordinates": [wgs_coords]}

def main():
    jinju_items = []
    total_pages = 52  # 5128 / 100

    for page in range(1, total_pages + 1):
        print(f"Fetching page {page}/{total_pages}...")
        try:
            data = fetch_page(page)
            items = data.get("body", [])
            if not items:
                break
            for item in items:
                if "진주" in item.get("SGG_NM", ""):
                    jinju_items.append(item)
                    print(f"  Found: {item['EMD_NM_KORN']} ({item['STDG_EMD_CD']})")
        except Exception as e:
            print(f"  Error on page {page}: {e}")
            time.sleep(2)
            continue
        time.sleep(0.5)  # rate limit

    print(f"\nTotal Jinju items: {len(jinju_items)}")

    # Convert to GeoJSON
    features = []
    for item in jinju_items:
        geom_wkt = item.get("GEOM", "")
        geometry = wkt_to_geojson_geometry(geom_wkt)
        if not geometry:
            print(f"  Skipping {item['EMD_NM_KORN']}: no valid geometry")
            continue

        feature = {
            "type": "Feature",
            "properties": {
                "code": item["STDG_EMD_CD"],
                "name": item["EMD_NM_KORN"],
                "nameEng": item.get("EMD_NM_ENG", ""),
                "sggName": item["SGG_NM"],
            },
            "geometry": geometry
        }
        features.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features
    }

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False)

    print(f"Saved {len(features)} features to {OUTPUT}")

if __name__ == "__main__":
    main()
