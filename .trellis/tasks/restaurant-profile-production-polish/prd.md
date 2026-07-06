# Restaurant profile production polish

## Current behavior

The restaurant profile page is functionally complete but visually diverges from the manager dashboard. Its page-specific styles hardcode cream and brown surfaces while `ManagerUnifiedBackground.css` defines sage as the shared manager accent. The result is a mixed interface: a sage dashboard shell surrounding a warm-brown form workspace.

The page copy also exposes implementation language and mixed terminology such as `RESTAURANT INFO`, `Live Preview`, `Provider`, `realtime`, `AI Rewrite`, `Dress Code & Note`, and raw time-slot values such as `lunch`.

## Root cause and flow

This is a presentation-layer issue:

`RestaurantInfoManagement` form state and GraphQL mutation -> page markup and labels -> `RestaurantInfoManagement.scss` -> page-specific `RestaurantInfoManagementPolish.css` -> manager shared palette.

Schema, resolvers, Apollo operations, permission checks, save behavior, preview synchronization, and validation remain unchanged.

## Visual direction

- Use the existing manager sage palette as the single accent.
- Use cool green-gray surfaces instead of cream or brown.
- Keep the current compact dashboard composition, phone preview, and responsive structure.
- Improve hierarchy with clearer section surfaces, consistent tabs, quieter metric cards, and stronger focus states.
- Reserve warning and danger colors for semantic states only.

## Files to change

- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.scss`: align base component variables and fallback styles with the shared manager palette.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagementPolish.css`: replace the legacy warm palette with shared `--manager-*` variables and refine desktop/mobile density.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx`: update production wording and display labels without changing stored values or mutation payloads.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx`: update selectors and add a copy regression check.

## Acceptance criteria

- The page uses the same sage surface, border, text, shadow, primary action, focus, and active-state colors as the manager dashboard.
- No cream/brown page-specific accent remains in the main workspace.
- The form, summary cards, metrics, tabs, utility cards, payment cards, menu status, and preview label form one coherent visual system.
- Internal English wording is replaced with clear Vietnamese production wording where it is user-facing.
- Stored enum values such as `lunch`, `sandbox`, and `production` remain unchanged; only display labels change.
- Existing save, draft, preview, geolocation, payment, and menu synchronization behavior is preserved.
- Existing component tests pass and the production build succeeds.
- Mobile layouts at 390px and 430px remain single-column without horizontal overflow.

## Validation plan

- Run the targeted `RestaurantInfoManagement.test.jsx` component test.
- Run frontend lint and production build.
- Run the repository PR CI including changed component tests and Playwright smoke tests.
- Review the final changed-file list for unrelated files.
- Manual visual check remains required at desktop, 390x844, and 430x932 because the connector environment cannot render the authenticated page.

## Out of scope

- Changing restaurant schema or GraphQL contracts.
- Rebuilding the form from scratch.
- Adding a new design system, font package, icon library, or component dependency.
- Changing customer-facing restaurant detail styling.
- Changing payment provider behavior or environment configuration.
