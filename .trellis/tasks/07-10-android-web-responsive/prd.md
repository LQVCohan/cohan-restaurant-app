# Android web responsive cleanup

## Scope

- Fix shared manager Android web layout issues found during the initial audit.
- Keep the current React, SCSS, Ant Design and routing stack.
- Preserve existing GraphQL/data flows, permissions, restaurant scope and navigation behavior.
- Prepare the next customer-facing mobile optimization pass by recording the target areas and acceptance criteria.

## Current behavior

- The manager mobile header hides the global search area at `max-width: 768px`, so Android users lose quick navigation.
- The manager layout uses a fixed 64px header height on mobile, leaving no room to keep primary actions and search visible together.
- Mobile content padding does not account for Android safe-area insets.

## Target behavior

- Android manager web keeps menu, account actions and search accessible without horizontal overflow.
- Mobile header can use a compact two-row layout when needed.
- Content padding respects safe-area insets and fixed/overlay controls do not cover content.
- No CSS `zoom`, no new dependencies, and no broad UI rewrite.

## Customer page preparation

Next pass should audit the public/customer entry points, customer navigation, restaurant discovery, menu, cart, reservation, order tracking and AI chat surfaces at 390x844 and 430x932. The customer pass should prioritize touch targets, sticky controls, safe-area padding, loading/empty/error states and deep-linkable navigation.

## Acceptance criteria

- Manager header search remains reachable on Android-sized screens.
- Sidebar overlay remains off-canvas and dismissible on mobile.
- Manager content does not get hidden behind browser safe-area or fixed controls.
- Changes are limited to shared layout/style files unless audit proves a page-specific root cause.

## Validation plan

- `npm run check:conflicts`
- `npm run build`
- Manual browser smoke at 390x844 and 430x932 when runtime is available.
