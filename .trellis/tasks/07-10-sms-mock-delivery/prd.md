# Make mock SMS not report real delivery

## Current behavior

On `/verify-email`, clicking `Gửi lại SMS` calls the `resendSmsVerification(phone)` GraphQL mutation. The resolver finds the user by normalized phone and calls `issueVerificationForUser(..., channels: "SMS")`. The SMS service defaults to `SMS_PROVIDER=mock`; in non-production it logs the message to the backend console but returns `sent: true`, so the resolver returns `true` even though no carrier SMS is delivered.

## Root cause

The shared SMS provider boundary treats mock logging as successful real delivery. This makes account verification and any other SMS caller inherit the same misleading status.

## Flow traced

`User` phone verification fields -> `emailVerification.mutation.js` resolver -> `accountVerification.service.js` issue SMS -> `sms.service.js` provider dispatch -> `VerifyEmailPendingCompact.jsx` GraphQL mutation and feedback.

## Files to change

- `cohan-restaurant-backend/src/services/notifications/sms.service.js`: make mock SMS report not configured outside tests instead of real sent.
- `cohan-restaurant-backend/tests/services/sms.service.test.js`: lock the mock-provider behavior.

## Acceptance criteria

- Local/development mock SMS no longer returns `sent: true`.
- Backend still logs the masked mock message in development so the verification link can be copied from the terminal.
- Tests can still use mock SMS as a successful fake provider under `NODE_ENV=test`.
- No new dependency or provider adapter is added.

## Validation plan

- `cd cohan-restaurant-backend && npx vitest run tests/services/sms.service.test.js tests/resolvers/account-verification.service.test.js tests/resolvers/email-verification-resend.test.js --testTimeout=30000`
