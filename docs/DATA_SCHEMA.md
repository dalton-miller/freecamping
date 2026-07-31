# Data Schema

Every site in `data/sites.geojson` is a GeoJSON `Feature` with a `Point` geometry and a `properties` object conforming to [`data/schema.json`](../data/schema.json) (JSON Schema draft-07). This page documents each field.

## Fields

| Name | Type | Required | Description | Example |
|------|------|----------|-------------|---------|
| `id` | string | Yes | Stable unique slug (lowercase, hyphenated). Never reuse an id for a different site. | `"noblett-lake-below-dam"` |
| `name` | string | Yes | Human-readable site name. | `"Noblett Lake Dispersed Site"` |
| `land_manager` | string (enum) | Yes | Managing agency. One of `"Mark Twain National Forest"`, `"Missouri Department of Conservation"`, `"Other"`. | `"Mark Twain National Forest"` |
| `access` | string (enum) | Yes | Road/vehicle access character. One of `"paved"`, `"gravel"`, `"high_clearance_recommended"`, `"4wd_recommended"`. | `"paved"` |
| `last_verified` | string (ISO 8601 date) | Yes | Date the entry was last reviewed against its source. Records review, not confirmed accuracy — flag location uncertainty in `notes`/`source`. | `"2024-06-15"` |
| `description` | string | No | Free-text description of the site. | `"Gravel pull-offs along the road below the dam."` |
| `fire_restrictions` | string | No | Fire rules for the site. | `"Fires in established rings only."` |
| `amenities` | array of enum strings | No | Amenities present. Values from `"vault_toilet"`, `"fire_ring"`, `"water_nearby"`, `"trash_service"`, `"picnic_table"`. | `["vault_toilet", "fire_ring"]` |
| `cell_signal` | string (enum) | No | Typical cell signal. One of `"none"`, `"weak"`, `"good"`. | `"weak"` |
| `rig_size_limit_ft` | number or null | No | Maximum recommended rig length in feet, or null if no practical limit/unknown. | `25` |
| `photos` | array of strings | No | Photo references — relative paths under `data/photos/` or absolute URLs. Empty array if none. | `["data/photos/noblett-lake-below-dam/view.jpg"]` |
| `source` | string | No | Where this entry came from (agency page, forum thread, personal visit). Be honest about verification status. | `"https://www.fs.usda.gov/recarea/mtnf/recarea/?recid=21786"` |
| `notes` | string | No | Caveats and uncertainty flags. Use this rather than omitting honest doubt. | `"Exact pull-off location approximate — confirm on-site with MVUM map."` |

## Geometry

- `geometry.type` must be `"Point"`.
- `coordinates` must be `[longitude, latitude]` (GeoJSON order — lon first).
- Coordinates should fall within Missouri (roughly lon −95.9 to −89.0, lat 35.9 to 40.7); the validator enforces this as a sanity check.

## Example Feature

This example validates against `data/schema.json`:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [-92.0397, 36.9458]
  },
  "properties": {
    "id": "noblett-lake-dispersed-site",
    "name": "Noblett Lake Dispersed Site",
    "land_manager": "Mark Twain National Forest",
    "access": "paved",
    "last_verified": "2024-06-15",
    "description": "Dispersed camping in the Noblett Lake area below the dam, near the developed campground.",
    "fire_restrictions": "Fires in established rings only.",
    "amenities": ["vault_toilet", "fire_ring"],
    "cell_signal": "weak",
    "rig_size_limit_ft": 25,
    "photos": [],
    "source": "https://www.fs.usda.gov/recarea/mtnf/recarea/?recid=21786",
    "notes": "Coordinates approximate for the general dispersed area near the developed campground."
  }
}
```
