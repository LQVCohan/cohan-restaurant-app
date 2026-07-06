# Restaurant profile production polish

## Previous behavior

The restaurant profile page was functionally complete but visually diverged from the manager dashboard. Its page-specific styles hardcoded cream and brown surfaces while `ManagerUnifiedBackground.css` defines sage as the shared manager accent. The result was a mixed interface: a sage dashboard shell surrounding a warm-brown form workspace.

The page copy also exposed implementation language and mixed terminology such as `RESTAURANT INFO`, `Live Preview`, `Provider`, `realtime`, `AI Rewrite`, `Dress Code & Note`, and raw time-slot values such as `lunch`.

## Root cause and flow

This was a presentation-layer issue:

`RestaurantInfoManagement` form state and GraphQL mutation -> page markup and labels -> `RestaurantInfoManagement.scss` -> page-specific `RestaurantInfoManagementPolish.css` -> manager shared palette.

Schema, resolvers, Apollo operations, permission checks, save behavior, preview synchronization, and validation remain unchanged.

## Implemented visual direction

- Use the existing manager sage palette as the single accent.
- Use cool green-gray surfaces instead of cream or brown.
- Keep the compact dashboard composition, phone preview, and responsive structure.
- Improve hierarchy with clearer section surfaces, consistent tabs, quieter metric cards, and stronger focus states.
- Reserve warning and danger colors for semantic states only.
- Remove the duplicate legacy theme block from the component SCSS so one scoped polish layer remains authoritative.

## Changed files

- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.scss`: aligns base component variables and fallback styles with the shared manager palette and removes the duplicate legacy polish block.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagementPolish.css`: consumes shared `--manager-*` variables and styles desktop/mobile header, summary, form, tabs, controls, cards, amenities, menu status, payment settings, focus states, preview, and reduced-motion behavior.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx`: replaces internal or mixed-language wording with production-ready Vietnamese labels while preserving stored enum values and payloads.
- `src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.test.jsx`: updates the location-tab selector and verifies localized time-slot and preview wording.

## Acceptance criteria

- The page uses the same sage surface, border, text, shadow, primary action, focus, and active-state colors as the manager dashboard.
- No cream/brown page-specific accent remains in the authoritative page polish layer.
- The form, summary cards, metrics, tabs, utility cards, payment cards, menu status, and preview label form one coherent visual system.
- Internal English wording is replaced with clear Vietnamese production wording where it is user-facing.
- Stored enum values such as `lunch`, `sandbox`, and `production` remain unchanged; only display labels change.
- Existing save, draft, preview, geolocation, payment, and menu synchronization behavior is preserved.
- Existing component tests pass and the production build succeeds.
- Responsive rules keep the workspace single-column on small screens without adding horizontal overflow.

## Automated validation completed

GitHub Actions run `28823831694` passed:

- unresolved conflict-marker check;
- frontend lint and unit tests;
- menu RBAC tests;
- changed component tests, including the restaurant profile wording regression;
- production frontend build;
- Playwright browser installation and smoke tests;
- backend lint, full tests, menu RBAC tests, and build.

## Manual visual validation still required

- Review the authenticated page at desktop width after pulling the branch.
- Review at 390x844 and 430x932 to confirm tab scrolling, single-column fields, action width, and phone preview placement.
- Confirm the actual uploaded cover and logo maintain readable contrast because image content varies by restaurant.

## Out of scope

- Changing restaurant schema or GraphQL contracts.
- Rebuilding the form from scratch.
- Adding a new design system, font package, icon library, or component dependency.
- Changing customer-facing restaurant detail styling.
- Changing payment provider behavior or environment configuration.
