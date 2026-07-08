# Verified pending login fix

## Current behavior and root cause

The active GraphQL login resolver is `loginWithPendingVerification`, registered after `UserMutation` and therefore overriding its `login` implementation. It intentionally allows an unverified `pending` account to obtain a limited authenticated session for the verification flow.

However, `isPendingVerificationAccount` returns `false` once the account satisfies `ACCOUNT_ACTIVATION_REQUIRE`. If the database contains `status: "pending"` together with `emailVerified: true` (or the equivalent configured policy), the same resolver then rejects the account because its status is not yet `active`. The normal token-verification flow updates both fields, but imported, manually repaired, or partially migrated records can retain this inconsistent state.

## End-to-end flow

`User.status/emailVerified/phoneVerified` -> compatibility GraphQL `login` mutation -> `loginWithPendingVerification` resolver -> Apollo `LOGIN_MUTATION` in `Login.jsx` -> login form submit -> frontend maps backend `FORBIDDEN` to “Tài khoản hiện không thể đăng nhập.”

## Scope

- Reconcile only `pending` accounts that already satisfy the configured activation policy.
- Set the account to `active` and preserve/set `verifiedAt` before issuing the login payload.
- Keep unverified `pending` accounts on the existing verification-session path.
- Keep `inactive` and `blocked` accounts forbidden.
- Do not change the GraphQL schema, frontend mutation, or UI error mapping.

## Acceptance criteria

1. A `pending` account with valid credentials and verification fields satisfying `ACCOUNT_ACTIVATION_REQUIRE` is persisted as `active` and can log in.
2. A `pending` account that does not satisfy the policy remains `pending` and can continue through the existing verification flow.
3. `inactive` and `blocked` accounts remain rejected with `FORBIDDEN`.
4. The login response reflects the reconciled `active` status.
5. A focused backend regression test covers the inconsistent verified/pending state.

## Validation plan

- Run the focused Vitest file for pending-verification login.
- Run a syntax check on the modified resolver.
- Run GraphQL validation only if the schema changes (not expected).

## Out of scope

- Bulk migration of all historical user records.
- Changing activation policy semantics.
- Changing login UI text or client-side verification rules.
- Allowing inactive or blocked accounts to log in.
