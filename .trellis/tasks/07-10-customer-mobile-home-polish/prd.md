# Customer mobile home polish

## Scope

- Improve the customer homepage on Android-sized web screens from the screenshots.
- Keep the current React, SCSS, Apollo and customer navigation patterns.
- Preserve existing routes, GraphQL queries, restaurant/category data flow and cart/profile behavior.

## Problems found

- The hero block takes too much vertical space before users reach restaurant/category content.
- Search placeholder is clipped on narrow Android screens.
- Quick access cards and category cards feel bulky and text wraps awkwardly.
- The restaurant empty state is visually too heavy on mobile.
- Two floating assistant entry points can appear at the same time and compete with the bottom navigation.
- Bottom navigation and floating controls need tighter safe-area spacing.

## Target behavior

- Hero copy is shorter and the search row is easier to read on Android.
- Search chips provide quick paths without making the hero taller.
- Quick access cards are compact and still meet touch target expectations.
- Empty state and category cards use less vertical space and clamp long helper text.
- Only one floating assistant button is visible on mobile, positioned above the bottom navigation.
- Bottom navigation is slightly lighter and safe-area aware.

## Acceptance criteria

- 390x844 and 430x932 screens should show search and quick actions without horizontal overflow.
- The visible floating assistant should not cover the bottom navigation.
- Category helper text should not create awkward tall cards.
- Empty restaurant state should remain actionable but compact.

## Validation plan

- `npm run check:conflicts`
- `npm run build`
- Manual Android browser smoke at 390x844 and 430x932 when runtime is available.
