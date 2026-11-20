# Customer Home discovery refresh

The desktop hero competes with its own search form through floating cards, motion, and delivery claims. On mobile, repeated restaurant and coupon shortcuts push discovery content down. Give the page a warm editorial hero with one clear search action, a browse link, and food photography on desktop.

The public restaurant filter in the restaurant resolver supplies restaurantsTop and restaurantsNearby through Apollo to HeroSection and RestaurantGrid. Desktop search passes the address and coordinates through Home to RestaurantGrid. Mobile search submits to the shared search route and quick links use existing customer routes. Preserve these flows, dish recommendations, and booking behavior.

Update HeroSection.jsx, HomePremiumPolish.scss, and HomeResponsiveFix.scss for the desktop hero. Update MobileHome.jsx, MobileHome.scss, and MobileHomeResponsivePolish.css for the mobile layout. Update the mobile component test to cover the nearby link.

Acceptance criteria include a visible search and browse action, visible keyboard focus, manual photo controls, and no horizontal page overflow across the 760px breakpoint. Validate with targeted Vitest, the frontend build, and a Chromium smoke test using mocked GraphQL data. Backend and shared navigation changes are out of scope.

## Verification

- Targeted Home and breakpoint tests passed (6 of 6). The wider Home folder run had the same 2 pre-existing cart source-text failures as the baseline.
- The Vite production build, Sass compilation, conflict-marker check, and GraphQL schema and static operation validation passed.
- Chromium with mocked GraphQL data checked 375, 390, 430, 760, 761, 768, 1024, and 1440px. Checks covered mobile search, desktop address suggestions and restaurant discovery, manual photo navigation, guest food detail, and navigation to the booking layout.
- Live backend flows and physical devices were outside this verification.
