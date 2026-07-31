#!/usr/bin/env python3
"""Validate data/sites.geojson against data/schema.json.

Checks:
  1. sites.geojson is a valid GeoJSON FeatureCollection
  2. Every Feature's "properties" validates against data/schema.json (jsonschema)
  3. geometry.type == "Point" for every feature
  4. Coordinates are [lon, lat] and within Missouri's rough bounding box:
     longitude -95.9..-89.0, latitude 35.9..40.7.
     NOTE: this is a loose sanity-check bounding box, NOT an exact state
     boundary — sites near state borders may legitimately sit just outside it.
  5. Every properties.id is unique across the file

Exits 1 with a list of problems on failure; exits 0 printing
"All N features valid" on success.

--strict additionally warns (without failing) when a feature is missing
recommended-but-optional fields like "photos" or "description".

Usage: python3 scripts/validate_data.py [--strict]
Requires: pip install -r scripts/requirements.txt
"""

import argparse
import json
import sys
from pathlib import Path

from jsonschema import Draft7Validator, FormatChecker

REPO_ROOT = Path(__file__).resolve().parent.parent
SITES_PATH = REPO_ROOT / "data" / "sites.geojson"
SCHEMA_PATH = REPO_ROOT / "data" / "schema.json"

# Loose Missouri sanity-check bounding box (lon_min, lat_min, lon_max, lat_max).
# Not an exact state boundary — border-adjacent points may fall slightly outside.
MO_LON_MIN, MO_LON_MAX = -95.9, -89.0
MO_LAT_MIN, MO_LAT_MAX = 35.9, 40.7

# Optional fields that --strict nudges contributors to fill in.
STRICT_RECOMMENDED_FIELDS = ["photos", "description"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="warn (non-fatal) on missing recommended optional fields",
    )
    args = parser.parse_args()

    errors = []
    warnings = []

    # --- Load files -------------------------------------------------------
    try:
        sites = json.loads(SITES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: could not load {SITES_PATH}: {exc}")
        return 1
    try:
        schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: could not load {SCHEMA_PATH}: {exc}")
        return 1

    # --- 1. FeatureCollection shape ----------------------------------------
    if not isinstance(sites, dict) or sites.get("type") != "FeatureCollection":
        errors.append(("file", "type", "root must be a GeoJSON FeatureCollection"))
        features = []
    else:
        features = sites.get("features")
        if not isinstance(features, list):
            errors.append(("file", "features", "'features' must be an array"))
            features = []

    validator = Draft7Validator(schema, format_checker=FormatChecker())
    seen_ids = {}

    for idx, feature in enumerate(features):
        label = feature.get("properties", {}).get("id") if isinstance(feature, dict) else None
        where = f"feature[{idx}]" + (f" ({label})" if label else "")

        if not isinstance(feature, dict) or feature.get("type") != "Feature":
            errors.append((where, "type", "must be a GeoJSON Feature"))
            continue

        # --- 2. properties against schema ---------------------------------
        props = feature.get("properties")
        if not isinstance(props, dict):
            errors.append((where, "properties", "missing or not an object"))
            props = {}
        else:
            for err in sorted(validator.iter_errors(props), key=lambda e: list(e.path)):
                field = ".".join(str(p) for p in err.path) or "properties"
                errors.append((where, field, err.message))

        # --- 3./4. geometry checks ----------------------------------------
        geom = feature.get("geometry")
        if not isinstance(geom, dict):
            errors.append((where, "geometry", "missing or not an object"))
        else:
            if geom.get("type") != "Point":
                errors.append((where, "geometry.type", f"must be 'Point', got {geom.get('type')!r}"))
            coords = geom.get("coordinates")
            if (
                not isinstance(coords, list)
                or len(coords) != 2
                or not all(isinstance(c, (int, float)) for c in coords)
            ):
                errors.append((where, "geometry.coordinates", "must be [longitude, latitude] numbers"))
            else:
                lon, lat = coords
                if not (MO_LON_MIN <= lon <= MO_LON_MAX and MO_LAT_MIN <= lat <= MO_LAT_MAX):
                    errors.append(
                        (
                            where,
                            "geometry.coordinates",
                            f"[{lon}, {lat}] outside Missouri sanity-check box "
                            f"(lon {MO_LON_MIN}..{MO_LON_MAX}, lat {MO_LAT_MIN}..{MO_LAT_MAX})",
                        )
                    )

        # --- 5. unique ids --------------------------------------------------
        site_id = props.get("id")
        if isinstance(site_id, str):
            if site_id in seen_ids:
                errors.append((where, "id", f"duplicate id {site_id!r} (first seen at feature[{seen_ids[site_id]}])"))
            else:
                seen_ids[site_id] = idx

        # --- strict-mode warnings -------------------------------------------
        if args.strict:
            for field in STRICT_RECOMMENDED_FIELDS:
                if not props.get(field):
                    warnings.append((where, field, "recommended field missing or empty"))

    # --- Report -------------------------------------------------------------
    for where, field, msg in errors:
        print(f"ERROR   {where} | {field}: {msg}")
    for where, field, msg in warnings:
        print(f"WARNING {where} | {field}: {msg}")

    if errors:
        print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)")
        return 1

    print(f"All {len(features)} features valid" + (f" ({len(warnings)} warning(s))" if warnings else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
