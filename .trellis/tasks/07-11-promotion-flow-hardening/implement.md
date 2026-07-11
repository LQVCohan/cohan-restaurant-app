# Implementation plan

1. Harden the Promotion model fields and attach a shared active-capacity query guard.
2. Validate mutation enums, dates, numeric ranges and restaurant-owned references before persistence.
3. Keep update ownership immutable and enable Mongoose validators on update/toggle.
4. Synchronize management operations with authoritative mutation results and route status-only changes through `togglePromotion`.
5. Extend the existing order-promotion selector normalizer for COMBO and FREESHIP.
6. Repair focused resolver/hook tests and add a model-level capacity regression check.
7. Review final diffs and record unavailable runtime checks.
