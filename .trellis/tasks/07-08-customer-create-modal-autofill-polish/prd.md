# Customer create modal autofill and polish

## Current behavior

The manager opens **Thêm khách hàng** from Customer Management. All React state values start empty, but the inputs do not provide a real form boundary, stable field names, or autocomplete intent. Browsers and password managers can therefore classify the modal as a login/profile form and inject the currently saved manager credentials into the new-customer fields.

The modal also mixes emoji labels with dense stacked cards, so the primary choice and the fact that the form must start blank are not visually clear.

## End-to-end flow

`Customer` discriminator / `User` identity fields -> `CreateUserInput` and `createGuestUser` -> user mutation resolvers -> `CREATE_USER` / `CREATE_GUEST_USER` in `useUserManagement` -> `AddCustomerModal` -> manager submits from Customer Management.

The backend create contracts, customer role assignment, validation, and permissions are already correct. No schema, resolver, guard, or Apollo mutation change is required.

## Root cause

- Account, contact, and password inputs have no stable `name` values.
- The modal content is not a semantic `<form>`.
- Password fields do not declare `autocomplete="new-password"`.
- Other fields do not explicitly opt out of autofill for this admin-created record workflow.

## Implementation

- Wrap the modal inputs in a semantic form with `autocomplete="off"` and submit through the existing footer button.
- Give every control a stable, customer-specific name.
- Mark new password fields as `new-password`; mark contact/profile fields as non-autofill and include existing password-manager ignore hints.
- Keep the initial React state empty and add a concise notice that manager account information is never reused.
- Replace emoji-heavy mode controls with the installed Lucide icons, improve hierarchy, focus states, responsive spacing, and reduced-motion behavior.
- Preserve all current validation, address lookup, mutations, notifications, and list refresh behavior.
- Add focused component coverage for empty initial values and autocomplete metadata.

## Acceptance criteria

- Opening the modal never displays the logged-in manager's name, email, phone, username, or password.
- Full-account and guest modes both start with empty customer fields.
- Password inputs expose `autocomplete="new-password"`; customer identity/contact fields do not request current-user autofill.
- Pressing Enter or the footer submit button follows the same existing validation and mutation path.
- The modal clearly distinguishes full customer accounts from quick guest records.
- Keyboard focus is visible, errors remain readable, and the modal is usable at narrow mobile widths.
- No backend contract, role, restaurant scope, audit, or realtime behavior changes.

## Files

- `src/components/Dashboard_Manager/Customer/AddCustomerModal.jsx`
- `src/components/Dashboard_Manager/Customer/AddCustomerModal.scss`
- `src/components/Dashboard_Manager/Customer/AddCustomerModal.test.jsx`

## Out of scope

- Changing customer registration policy or verification behavior.
- Changing guest permissions or expiry rules.
- Adding a password manager dependency or browser-specific JavaScript workaround.
- Redesigning the Customer Management page.

## Validation plan

- Run the focused AddCustomerModal component test.
- Run frontend conflict and GraphQL operation checks.
- Run frontend unit tests, component tests, production build, and Playwright smoke tests.
- Run the backend CI checks inherited by the repository workflow.
- Review desktop and narrow-width modal behavior; state any browser/password-manager check that cannot be run.
