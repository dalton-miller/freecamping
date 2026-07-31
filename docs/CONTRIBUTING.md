# Contributing

Thanks for helping grow the Missouri dispersed camping dataset! This guide covers how to add or correct sites, photos, and what we expect around accuracy.

## Adding a new site

1. Edit `data/sites.geojson` directly — each site is a GeoJSON `Feature` with a `Point` geometry (`[longitude, latitude]` order) and a `properties` object following `data/schema.json`. See [`docs/DATA_SCHEMA.md`](DATA_SCHEMA.md) for a full field-by-field reference with examples.
2. Give the site a stable, unique, lowercase-hyphenated `id` slug (e.g. `cedar-creek-pull-off`). Never reuse an id for a different site.
3. Keep `photos` as an empty array unless you're also contributing photos (see below).

## Validate before you PR

Run the validator and paste its output into your PR description:

```
pip install -r scripts/requirements.txt
python scripts/validate_data.py --strict
```

The PR should show **zero errors** (warnings about missing photos are fine). If your change touches existing entries, also regenerate the GPX export with `python scripts/geojson_to_gpx.py`.

## Accuracy expectations

- **Don't guess coordinates from memory.** Drop a pin on a map (USGS topo, CalTopo, Google Maps satellite, the MVUM) and use those coordinates.
- **Cite a source** in the `source` field: an agency page URL, a forum thread link, or "personal visit, YYYY-MM". If it's community-reported and unverified, say so (e.g. "overlandbound.com forum thread, unverified").
- **Always set `last_verified` to the date you last reviewed the entry against its source.** It records when the entry was last reviewed, not a guarantee of on-the-ground accuracy. If you're not fully confident in a location, say so explicitly in `notes` rather than omitting the caveat — honest uncertainty is more useful than false precision.

## Leave No Trace / responsible sharing

Avoid adding hyper-specific coordinates for fragile or already-overused sites — a general area plus an access description is often more responsible than an exact pin. Don't publicize sites that show signs of overuse, are near sensitive cultural or ecological resources, or where camping is tolerated but not clearly legal. When in doubt, describe the general area and point readers to the managing agency.

## Photo contributions

- Place images in `data/photos/<site-id>/` (one folder per site id).
- Keep each image under ~1MB — resize/compress before committing.
- JPG or PNG only.
- Reference the relative path in the site's `photos` array, e.g. `"data/photos/noblett-lake-below-dam/view-from-dam.jpg"`.
- Only submit photos you took yourself and are willing to share under the dataset's ODbL 1.0 license.

## PR checklist

Copy this into your PR description:

```markdown
- [ ] Ran `validate_data.py --strict` with no errors (output pasted below)
- [ ] Coordinates confirmed on a map, not guessed
- [ ] Source cited
- [ ] Uncertain details noted honestly in `notes`
- [ ] Photos under 1MB and placed in `data/photos/<site-id>/`
```
