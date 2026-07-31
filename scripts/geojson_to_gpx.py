#!/usr/bin/env python3
"""Export data/sites.geojson to data/sites.gpx (GPX 1.1).

Each GeoJSON Feature becomes a <wpt>:
  - lat/lon from geometry.coordinates ([lon, lat] order)
  - <name> from properties.name
  - <desc> = one-line summary of land_manager, access, amenities (comma-joined),
    fire_restrictions, and cell_signal (missing/empty fields are skipped)
  - <link href="first photo"><text>Photo</text></link> if photos is non-empty

Output is structured per the GPX 1.1 schema
(https://www.topografix.com/GPX/1/1/gpx.xsd — not bundled here): <gpx> root with
the proper namespace, version="1.1", and a creator attribute.

Usage: python3 scripts/geojson_to_gpx.py   (stdlib only, no dependencies)
"""

import json
import xml.etree.ElementTree as ET
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SITES_PATH = REPO_ROOT / "data" / "sites.geojson"
GPX_PATH = REPO_ROOT / "data" / "sites.gpx"

GPX_NS = "http://www.topografix.com/GPX/1/1"


def build_desc(props: dict) -> str:
    """Readable one-line summary; skips missing/empty fields."""
    parts = []
    if props.get("land_manager"):
        parts.append(props["land_manager"])
    if props.get("access"):
        parts.append(f"Access: {props['access']}")
    if props.get("amenities"):
        parts.append("Amenities: " + ", ".join(props["amenities"]))
    if props.get("fire_restrictions"):
        parts.append(f"Fire: {props['fire_restrictions']}")
    if props.get("cell_signal"):
        parts.append(f"Cell: {props['cell_signal']}")
    return " | ".join(parts)


def main() -> None:
    sites = json.loads(SITES_PATH.read_text(encoding="utf-8"))
    features = sites.get("features", [])

    gpx = ET.Element(
        "gpx",
        {
            "version": "1.1",
            "creator": "mo-dispersed-camping",
        },
    )
    # xmlns is set as the default namespace on the root; unprefixed child
    # elements inherit it, so the output is valid per the GPX 1.1 schema.
    gpx.set("xmlns", GPX_NS)

    count = 0
    for feature in features:
        props = feature.get("properties", {})
        lon, lat = feature["geometry"]["coordinates"]

        wpt = ET.SubElement(gpx, "wpt", {"lat": f"{lat:.6f}", "lon": f"{lon:.6f}"})
        ET.SubElement(wpt, "name").text = props.get("name", "Unnamed site")
        desc = build_desc(props)
        if desc:
            ET.SubElement(wpt, "desc").text = desc
        photos = props.get("photos") or []
        if photos:
            link = ET.SubElement(wpt, "link", {"href": str(photos[0])})
            ET.SubElement(link, "text").text = "Photo"
        count += 1

    tree = ET.ElementTree(gpx)
    ET.indent(tree, space="  ")
    tree.write(GPX_PATH, encoding="utf-8", xml_declaration=True)
    print(f"Wrote {count} waypoints to {GPX_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
