# MenuManagement Demo Data Guide

This repository already has backend seed infrastructure (`cohan-restaurant-backend/scripts` + npm seed scripts). For MenuManagement final QA/demo, use the dedicated demo seed below.

## 1) Seed command
From repo root:

```bash
npm run seed:demo:menu-management --prefix cohan-restaurant-backend
```

Optional environment:
- `DEMO_RESTAURANT_ID`: use an existing restaurant instead of creating/finding default.
- `DEMO_RESET=1`: remove prior records created by this seed tag and recreate.

## 2) What the seed prepares
- 1 restaurant context (reuse by `DEMO_RESTAURANT_ID`, else first active, else create one).
- 4 menus by `timeSlot`: `breakfast`, `lunch`, `dinner`, `late_night`.
- Dish categories with icon persistence examples.
- Menu groups (`CategoryMenu`) with icon persistence examples.
- Menu items (multiple statuses) with serving variants and by-weight variants in Recipe.
- Recipes with ingredient lines.
- Stock items that produce sufficient / low / out-of-stock inventory states.
- Sample `served` + `completed` orders to populate menu stats.

## 3) QA usage notes
- Run this seed only in local/dev/demo environments.
- The script is idempotent for its tagged records.
- For deterministic re-run, use `DEMO_RESET=1`.

## 4) Quick verification after seed
- Confirm 4 menus visible in MenuManagement screen.
- Confirm at least one item per inventory state (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `NOT_TRACKED`).
- Confirm menu stats (revenue/orderCount/soldItemCount) are non-zero on seeded menus.
