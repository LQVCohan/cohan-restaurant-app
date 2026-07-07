# Customer self-delete from profile

## Current behavior

The customer profile already renders `SecuritySettings`, and that component already calls the `deleteMyAccount` GraphQL mutation. The resolver soft-deletes the account for 30 days, revokes refresh tokens, clears the refresh cookie, and the frontend logs the user out.

However, the shared profile route and `SecuritySettings` are also available to admin, manager, and staff roles. The delete mutation currently accepts any authenticated user, so non-customer accounts can invoke a customer-facing self-delete action.

## Root cause

The account deletion contract is implemented but not scoped at the shared authorization boundary. Hiding the button alone would not secure direct GraphQL calls; the resolver must enforce the customer role, and the UI should mirror that rule.

## End-to-end flow

1. `User` stores `status`, `deletedAt`, `deleteExpiresAt`, and `deletedBy`.
2. `customerAccountSecurity.graphql` exposes `deleteMyAccount`.
3. `customerAccountSecurity.js` validates identity, role, confirmation text, and current password, then soft-deletes the account and revokes sessions.
4. `SecuritySettings.jsx` shows a danger-zone confirmation only to customers and logs out after success.
5. Focused backend and component tests guard role scope and confirmation behavior.

## Files to change

- `cohan-restaurant-backend/graphql/resolvers/user/customerAccountSecurity.js`: enforce customer-only deletion at the resolver boundary.
- `src/components/Customer/Profile/components/SecuritySettings.jsx`: show deletion controls only for customers and disable submission until confirmation is valid.
- `cohan-restaurant-backend/tests/resolvers/customer-account-security.test.js`: prove non-customers are rejected before data mutation.
- `src/components/Customer/Profile/components/SecuritySettings.test.jsx`: prove the danger zone is customer-only and confirmation-gated.

## Acceptance criteria

- A customer can delete their own account after entering the required phrase and, when applicable, current password.
- The operation keeps the existing 30-day soft-delete behavior and revokes all refresh tokens.
- Admin, manager, staff, HR, and accountant accounts cannot invoke `deleteMyAccount`.
- Non-customer profiles do not render the account deletion danger zone.
- The delete button stays disabled until the confirmation phrase is valid.
- No new GraphQL mutation, service abstraction, dependency, or hard-delete behavior is added.

## Out of scope

- Immediate permanent deletion.
- Admin restore UI.
- Automatic purge after 30 days.
- Moving the danger zone to a separate page.

## Validation plan

- Run the focused backend resolver test.
- Run the focused `SecuritySettings` component test.
- Run GraphQL validation.
- Run frontend and backend builds through CI.
