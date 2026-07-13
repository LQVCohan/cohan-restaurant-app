# Restaurant review experience UI upgrade

## Current behavior and UX problems

- The review tab works functionally, but the page hierarchy is weak: the title, score summary, filters and review cards all use similar bordered-card treatments.
- The primary action uses a blue button that conflicts with the restaurant detail page's established orange customer palette.
- Rating information is visually fragmented across nested boxes, while counts and score bars are harder to scan than necessary.
- Review actions are compact and do not consistently meet the preferred 44px touch target.
- The write-review modal is visually sparse, centers labels and fields, and does not clearly separate rating, review content, optional staff feedback and submission actions.
- The modal needs safer viewport sizing, clearer focus states and a usable mobile bottom-sheet presentation.

## Real flow and preserved boundaries

1. `RestaurantDetail` renders `ReviewsSection` for the review tab and supplies the canonical `restaurantId`.
2. `ReviewsSection` queries restaurant reviews, review statistics and public restaurant staff through Apollo.
3. Customer actions call the existing create, react, helpful and report mutations.
4. Existing component tests protect authentication checks, review payload shape, staff tagging, reply counts, reporting refresh and inline validation.
5. The reported problems are presentation-only, so the smallest correct boundary is the section stylesheet; React, Apollo and GraphQL behavior remain unchanged.

## Visual direction

Warm editorial review surface using COHAN orange, cream and slate tones, one prominent write-review action, an asymmetric score summary, compact review cards and a composed mobile-first feedback sheet.

## Files changing and why

- `src/components/Customer/RestaurantDetail/components/ReviewsSection/ReviewsSection.scss`
  - Replace the duplicated legacy styling with one focused responsive visual layer for the page, summary, review cards, controls, forms, dialogs, focus states and reduced-motion behavior.
- `.trellis/tasks/07-14-review-experience-ui-upgrade/task.json`
  - Record scope and validation status.
- `.trellis/tasks/07-14-review-experience-ui-upgrade/prd.md`
  - Record the audit, visual direction, constraints and acceptance criteria.

## Acceptance criteria

- The page's title, score summary, filters, review content and primary action are immediately distinguishable.
- The customer-facing visual system uses the existing warm orange/cream palette and no longer mixes blue as the main action color.
- Review actions provide touch targets of at least 44px and visible keyboard focus.
- The write-review modal clearly presents rating, title, content, optional staff selection, helper text, validation and submission action.
- Both review dialogs have consistent warm surfaces, readable labels, bounded viewport height, clear close/actions and a mobile bottom-sheet layout.
- Loading, empty, error, disabled, hover, active and reduced-motion states remain understandable.
- The page has no intended horizontal overflow and stacks logically at phone and tablet breakpoints.
- Existing GraphQL operations, restaurant scope, authentication behavior, mutations and payloads remain unchanged.
- No new dependency, component abstraction or unrelated redesign is added.

## Validation plan

- `npx vitest run src/components/Customer/RestaurantDetail/components/ReviewsSection/ReviewsSection.test.jsx src/components/Customer/RestaurantDetail/components/ReviewsSection/ReviewsSection.flow.test.jsx`
- `npm run check:conflicts`
- `npm run check:graphql`
- `npm run build`
- Manual keyboard review of controls, close actions and visible focus.
- Manual responsive review at 390x844, 430x932, 768px, 1024px and 1440px.

## Out of scope

- Changing review eligibility, moderation rules, authentication, staff performance logic or backend validation.
- Adding image upload, new reactions, pagination behavior or review editing.
- Replacing the existing modal implementation or changing dialog state behavior.
- Redesigning the restaurant detail header, sidebar, tabs or AI widgets.
- Replacing the global customer color system or adding a component library.
