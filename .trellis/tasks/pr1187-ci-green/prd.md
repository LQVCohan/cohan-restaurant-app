# PR 1187 CI cleanup

## Current behavior and root cause

PR #1187 is mergeable but its merge-result CI combines the chatbot branch with newer `main` changes. Three current failures are stale tests rather than production defects:

1. `order-item-return-review.test.js` builds a non-combo order item without the required immutable `prepStation` snapshot, so the production kitchen work-item guard correctly rejects it.
2. `Sidebar.test.jsx` still queries the old English label `Dashboard`, while the actual accessible navigation label is `Tổng quan`.
3. `MenuItemCard.test.jsx` renders a card that now contains `PrepStationControl`, which uses Apollo `useMutation`, without the repository's normal `MockedProvider` test boundary.

The global chatbot feedback payload issue was already fixed by omitting the `restaurantId` property when the conversation is global.

## End-to-end caller flow

### Order return

`OrderItem.prepStation` transaction snapshot -> `reviewOrderItemReturn` resolver -> `syncKitchenOrderWorkItemForVoidOrReturn` -> `resolveOrderItemStation` -> kitchen work-item update -> resolver test fixture.

### Manager sidebar

`NAVIGATION_SECTIONS` label/page metadata -> permission filtering -> sidebar button accessible name -> Testing Library role query.

### Menu item card

`MenuItemCard` -> `PrepStationControl` -> Apollo `useMutation(UPDATE_PREP_STATION)` -> component test render boundary.

## Files to change

- `cohan-restaurant-backend/tests/resolvers/order-item-return-review.test.js`: add a valid `prepStation` snapshot to the shared non-combo fixture.
- `src/components/Dashboard_Manager/Sidebar.test.jsx`: assert the current accessible label `Tổng quan`.
- `src/components/Dashboard_Manager/Menu/components/MenuItemCard/MenuItemCard.test.jsx`: wrap the component with `MockedProvider` and include a configured preparation station in the fixture.
- `.trellis/tasks/pr1187-ci-green/*`: record scope, root causes, validation and completion status.

No production guard, GraphQL contract, permission rule or visual behavior should change for these failures.

## Acceptance criteria

1. The full-return resolver test reaches its intended refund assertions without bypassing preparation-station validation.
2. Sidebar tests assert the actual localized accessible name and active state.
3. MenuItemCard tests render with the same Apollo boundary used by real callers and still verify card content and status actions.
4. Targeted backend and frontend tests pass.
5. The existing PR branch is synchronized with latest `main` and GitHub Actions CI is green.
6. PR #1187 remains open and is not merged automatically.

## Validation plan

```bash
cd cohan-restaurant-backend
npx vitest run tests/resolvers/order-item-return-review.test.js

cd ..
npx vitest run \
  src/components/Dashboard_Manager/Sidebar.test.jsx \
  src/components/Dashboard_Manager/Menu/components/MenuItemCard/MenuItemCard.test.jsx \
  src/components/common/AiChatbotFeedbackControls.test.jsx

npm run check:conflicts
npm run check:graphql --if-present
```

Then run the normal GitHub Actions CI for PR #1187.

## Out of scope

- Weakening `resolveOrderItemStation` or restoring keyword-based station guessing.
- Changing the Vietnamese sidebar label back to English.
- Adding dependency injection solely to avoid an Apollo test provider.
- Fixing unrelated tests that are already green after branch synchronization.
