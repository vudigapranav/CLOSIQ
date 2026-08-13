# CLOSIQ Wardrobe Asset Pipeline

Drop generated/photographed garment images here and they appear in the app automatically — no code changes required.

## Convention

Every catalog garment has a stable `id` and belongs to one wardrobe profile (see
`src/data/garmentCatalog.ts`). Its image must live at:

```
/wardrobe/<profile>/<category-folder>/<id>.png
```

`profile` is `men` or `women`. Category folder mapping:

| GarmentCategory (code) | Folder      |
|-------------------------|-------------|
| `tops`                   | `tops`      |
| `bottoms`                 | `bottoms`   |
| `outerwear`               | `outerwear` |
| `shoes`                   | `footwear`  |
| `accessories`             | `accessories` |

Example: garment id `charcoal_art_tee` (profile `men`, category `tops`) resolves to
`/wardrobe/men/tops/charcoal_art_tee.png`. Garment id `fitted_ribbed_tank_top` (profile `women`,
category `tops`) resolves to `/wardrobe/women/tops/fitted_ribbed_tank_top.png`.

## Source material: `public/test samples/`

The hackathon team drops real generated/photographed garment photos into
`public/test samples/<menswear|women>/<their-own-category-names>/`. That folder is **source
material, not the app's asset location** — never reference it directly from app code, and never
move, rename, or delete anything inside it.

Every file currently in the catalog under `public/wardrobe/<profile>/<category>/<id>.png` is a
**symlink** back into `public/test samples/...`, not a copy — this keeps the repo from
duplicating the (large, multi-MB) source PNGs while still giving every garment a stable,
predictable path. `vite build` dereferences these symlinks automatically, so the production
build ends up with real files, not links. See `STATE.md` → **Wardrobe Asset Status** for the
full inventory, exclusions (exact-duplicate images), and one filename/content mismatch that was
corrected during classification.

## Adding a new generated image

1. Add/confirm the entry in `RAW_CATALOG` in `src/data/garmentCatalog.ts` with a unique,
   stable `id` (the garment's permanent identity — never renamed, never inferred from the
   filename), the correct `profile`, and its metadata (category, color, fit, style,
   layeringRole, etc).
2. Save the generated image as `<id>.png` in the matching `<profile>/<category>` folder above.
3. Done. Every catalog entry's `imagePath` is derived automatically from `id` + `profile` +
   `category` via `getGarmentImagePath()` (see `GARMENT_CATALOG` in `garmentCatalog.ts`) and
   flows everywhere (Collection, onboarding seed wardrobe, Add Item quick-add tiles, AI Stylist
   outfits) with zero other code changes.

## Missing assets

Until the PNG lands, the catalog entry still exists and is fully usable — nothing is invented
or substituted. `GarmentImage` (`src/components/ui/GarmentImage.tsx`) catches the failed image
load and renders an on-brand placeholder (icon + category label) instead of a broken image icon
or an unrelated stock photo. This is automatic and always reflects the real state of this
folder — there is no separate "asset status" flag to keep in sync.

Do not hardcode image URLs elsewhere in the app, and never infer a garment's category, color, or
layering role from its filename — always go through `garmentCatalog.ts`.
