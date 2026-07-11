# Transaction management hardening implementation

## Planned sequence

1. Persistence and GraphQL contract corrections.
2. Refund source normalization and supplier/reconciliation server guards.
3. Apollo date/debt contract corrections.
4. UI action eligibility and receivable rendering.
5. Focused regression tests and final diff review.

## Checks

- Verify every target file is fetched from latest `main` immediately before writing.
- Inspect all callers of changed helpers/mutations.
- Keep existing permissions, finance audits and restaurant scoping intact.
- Do not add dependencies or new abstractions.
