# Design

Keep the current `PrintSetting` document and page structure. Fix the shared boundaries instead of adding a print subsystem.

- Replace role-only checks with restaurant-scoped `print.read`/`print.write` permission checks.
- Preserve legacy manager behavior by adding print permissions to the existing backend/frontend manager fallback maps and seed role.
- Append jobs with MongoDB `$push/$position/$slice`; update one job with positional operators instead of rewriting the full array.
- Validate known printer, enabled template, retry state, and supported job status before mutation.
- Treat the built-in test as configuration validation: mark the printer `configured`, not `online`, and keep `hardwareHandshake: false` explicit.
- Expand confirmed-order ticket creation over every unique configured printer assigned to kitchen/bar.
- Use `useManagerRestaurantSelection` in the page and gate every write action with `print.write` while leaving refresh/read behavior available.
- Keep the current visual system; add only concise read-only and simulated-check wording.
