# Restaurant review experience UI upgrade

## Current behavior and UX problems

- The review tab works functionally, but the page hierarchy is weak: the title, score summary, filters and review cards all use similar bordered-card treatments.
- The primary action uses a blue button that conflicts with the restaurant detail page's established orange customer palette.
- Rating information is visually fragmented across nested boxes, while counts and score bars are harder to scan than necessary.
- Review reactions rely on emoji icons, producing inconsistent iconography and small touch targets.
- The write-review modal is visually sparse, centers labels and fields, and does not clearly separate rating, review content, optional staff feedback and submission actions.
- The review screen implements its own modal shell instead of the repository's shared `Modal`, so it misses the shared focus trap, focus restoration, body scroll locking, portal behavior and mobile sheet treatment.

## Real flow and preserved boundaries

1. `RestaurantDetail` renders `ReviewsSection` for the review tab and supplies the canonical `restaurantId`.
2. `ReviewsSection` queries restaurant reviews, review statistics and public restaurant staff through Apollo.
3. Customer actions call the existing create, react, helpful and report mutations.
4. Existing component tests protect authentication checks, review payload shape, staff tagging, reply counts, reporting refresh and inline validation.
5. The shared `src/components/common/Modal.jsx` already provides accessible dialog behavior and is the correct reusable boundary for both review dialogs.

## Visual direction

Warm editorial review surface using COHAN orange, cream and slate tones, one prominent write-review action, an asymmetric score summary, compact review cards and a composed mobile-first feedback sheet.

## Files changing and why

- `src/components/Customer/RestaurantDetail/components/ReviewsSection/ReviewsSection.jsx`
  - Reorganize page hierarchy, replace emoji controls with existing Lucide icons, improve semantic labels and reuse the shared `Modal` for report and write-review flows.
- `src/components/Customer/RestaurantDetail/components/ReviewsSection/ReviewsSection.scss`
  - Replace the duplicated legacy styling with a focused responsive visual layer for the page, review cards, forms, dialogs, focus states and reduced-motion behavior.
- `.trellis/tasks/07-14-review-experience-ui-upgrade/task.json`
  - Record scope and validation status.
- `.trellis/tasks/07-14-review-experience-ui-upgrade/prd.md`
  - Record the audit, visual direction, constraints and acceptance criteria.

## Acceptance criteria

- The page's title, score summary, filters, review content and primary action are immediately distinguishable.
- The customer-facing visual system uses the existing warm orange/cream palette and no longer mixes blue as the main action color.
- Review actions use one icon family, remain understandable with text labels and provide touch targets of at least 44px.
- The write-review modal clearly presents rating, title, content, optional staff selection, helper text, validation and submit/cancel actions.
- Both review dialogs reuse the shared modal behavior for focus trapping, focus restoration, Escape handling, overlay dismissal, scroll locking and mobile sheet layout.
- Native labels, named form controls, inline errors, visible focus and loading/disabled states remain understandable.
- The page has no horizontal overflow and remains usable at 390px, 430px, 768px, 1024px and 1440px.
- Existing GraphQL operations, restaurant scope, authentication behavior, mutations and payloads remain unchanged.
- No new dependency or shared abstraction is added.

## Validation plan

- `npx vitest run src/components/Customer/RestaurantDetail/components/ReviewsSection/ReviewsSection.test.jsx src/components/Customer/RestaurantDetail/components/ReviewsSection/ReviewsSection.flow.test.jsx`
- `npm run check:conflicts`
- `npm run check:graphql`
- `npm run build`
- Manual keyboard review of open, Tab cycle, Escape, close, validation and focus return.
- Manual responsive review at 390x844, 430x932, 768px, 1024px and 1440px.

## Out of scope

- Changing review eligibility, moderation rules, authentication, staff performance logic or backend validation.
- Adding image upload, new reactions, pagination behavior or review editing.
- Redesigning the restaurant detail header, sidebar, tabs or AI widgets.
- Replacing the global customer color system or adding a component library.
