# Consolidate remaining open PR fixes

## Current behavior and root causes

1. `buildAutoScheduleCreateInputs` trusts the client-controlled `allowPartialApply` flag, allowing an incomplete selected schedule scope to bypass the shared completeness guard.
2. Menu availability watches emit an ephemeral socket event but do not create the persistent Notification consumed by the customer bell. Registration also trusts `input.userId` before authenticated context.
3. `MenuItemLiveState.itemType` is non-null in GraphQL, while the resolver omits it and does not reject unsupported item types. One global frontend caller also omits the explicit type.
4. Selecting a branch from Brand Management changes scope but leaves the user on the same page, although the action promises dashboard navigation.
5. The expanded manager sidebar is 304px, but `--sidebar-width` remains 72px while content is shifted, leaving a false desktop gap.

## End-to-end flows

- Auto schedule: manager mutation input -> staff resolver -> `buildAutoScheduleCreateInputs` -> shared completeness guard -> shift creation.
- Availability notification: watch mutation -> `menuAvailabilityWatch.service` -> Notification/createNotificationOnce -> `notificationCreated` -> `useCommunication` -> `CustomerNotificationContext` -> customer bell.
- Live state: `MenuItemLiveStateInput` -> cart resolver -> Apollo query -> global food availability panel.
- Branch action: Brand Management card -> `useBrandManagement.setSelectedRestaurantId` -> manager scope storage/event -> `manager:navigate` -> ManagerLayout.
- Sidebar: ManagerLayout open state -> sidebar width variable -> shared layout positioning.

## Files to change and why

- `cohan-restaurant-backend/src/services/scheduling/autoSchedule.service.js`: remove the client bypass at the shared guard.
- `cohan-restaurant-backend/tests/services/auto-schedule-hardening.test.js`: prove the legacy flag cannot bypass completeness checks.
- `cohan-restaurant-backend/src/services/menuAvailabilityWatch.service.js`: authenticate watch ownership, persist one notification, and retry after persistence failure.
- `cohan-restaurant-backend/tests/services/menu-availability-watch-notification.test.js`: cover deduplicated persistence, retry, and foreign-user rejection.
- `src/context/CustomerNotificationContext.jsx`: honor the existing notification `actionUrl` payload.
- `cohan-restaurant-backend/graphql/resolvers/cart/query.js`: validate and return `itemType`.
- `cohan-restaurant-backend/tests/resolvers/menu-item-live-state-performance.test.js`: cover the non-null contract and unsupported type.
- `src/components/Customer/Food/FoodDetailAvailabilityGlobalMount.jsx`: send/query `itemType` explicitly.
- `src/hooks/useBrandManagement.js`: reuse the existing manager navigation event only for explicit branch selection on `#brands`.
- `src/hooks/useManagerRestaurantSelection.test.jsx`: verify scope and dashboard event stay aligned.
- `src/layouts/ManagerLayout.scss`: use the expanded sidebar width variable in the open state.

## Acceptance criteria

- Incomplete automatic schedules remain rejected even when a caller sends `allowPartialApply: true`.
- A customer cannot register a watch for another account.
- A user watch creates one persistent bell notification with a food-detail action URL; failed persistence returns the watch to `watching`.
- Live-state responses always satisfy `itemType: String!` for menu items and reject unsupported types.
- Selecting a branch from Brand Management updates scope and opens that branch dashboard, while automatic/default selection and selections from other pages do not navigate.
- Opening the desktop sidebar does not leave the false width gap.

## Out of scope

- Reintroducing manager leave replacement selection from PR #1127; current backend tests deliberately allow manager leave without replacement and ignore legacy replacement IDs.
- The broader MenuItemCard and QR-page redesigns already superseded or not required for these root-cause fixes.
- New abstractions, dependencies, notification channels, or routing systems.

## Validation plan

- `npm run check:conflicts`
- `npm run check:graphql`
- Focused backend Vitest for auto schedule, menu availability notifications, and menu item live state.
- Focused frontend Vitest for manager restaurant selection.
- `npm run build`
- Repository CI.
