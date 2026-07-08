# Registration password UI polish

## Current behavior and root cause

- The login password has a visibility toggle, but the four registration password fields do not.
- Customer password strength is represented by fixed `::before` / `::after` CSS on the input wrapper. The bar is always fully colored, does not score the current value, and is positioned with negative offsets that crowd the confirm-password label on mobile.
- Backend registration already validates the password through `validatePasswordStrong` before persisting the bcrypt hash, so the server contract is correct.

## End-to-end flow

`models/user.model.js (passwordHash/setPassword)` → `graphql/schema/user.graphql (CreateUserInput.password)` → `graphql/resolvers/user/mutation.js (createUser + validatePasswordStrong)` → `Login.jsx (CREATE_USER_MUTATION)` → customer/brand registration password inputs → `Login.test.jsx`.

## Scope

- Add show/hide controls to password and confirm-password fields for customer and brand registration.
- Replace the fixed CSS-only bar with an inline, labeled strength meter derived from the current password.
- Associate helper/strength text with the password input and preserve keyboard/focus behavior.
- Reuse the existing icon and SCSS system; add no dependency.

## Files changing

- `src/components/Login.jsx`: visibility state, strength calculation/presentation, accessible registration controls.
- `src/components/LoginPolish.scss`: remove negative-position pseudo meter and style the in-flow meter.
- `src/components/Login.test.jsx`: cover visibility toggles and strength label updates.

## Acceptance criteria

- Customer and brand password/confirmation fields can each be shown and hidden independently.
- Icon-only controls have clear accessible names and visible focus behavior inherited from the existing toggle style.
- Password strength is not shown as a permanently full gradient; it updates from empty/weak/medium/strong and includes text so color is not the only signal.
- The meter remains in normal document flow and no longer overlaps the confirm-password label at narrow widths.
- Existing registration mutation variables and backend validation behavior remain unchanged.

## Validation plan

- `npx vitest run src/components/Login.test.jsx`
- `npm run build`
- Manual narrow-layout review at approximately 390×844 and 430×932 when a browser environment is available.

## Out of scope

- Changing the backend zxcvbn threshold or password policy.
- Blocking submit from the client based on the visual score.
- Adding a new password-strength dependency.
