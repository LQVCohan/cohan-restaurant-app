# Staff email invitation and login verification

## Current behavior and root cause

- The employee modal may submit an email with a manager-provided password or omit the password.
- The persistence resolver generates a random password when the password is omitted, but that plaintext exists only on the in-memory document and is never delivered to the employee.
- `issueVerificationForUser` currently runs inside the legacy staff persistence resolver before the domain wrapper completes `BrandMembership` creation and restaurant role assignment. A later synchronization failure can therefore delete the account after an email was already sent.
- The active login resolver accepts a valid password for an unverified pending account, but it keeps that staff account pending and unverified.

## End-to-end flow

`CreateUserInput` → staff domain wrapper → staff persistence → BrandMembership → restaurant role assignment → staff invitation email → Apollo login mutation → pending-login resolver → persist verified/active account → authenticated UI.

## Required behavior

1. When a staff email is supplied, use the entered password or generate a secure initial password when it is blank.
2. Do not expose the plaintext password through GraphQL, logs, audit metadata, URLs, or persisted fields.
3. Complete staff creation, business membership, and restaurant role assignment before sending the email.
4. The email must contain the login email, the initial password, and a button opening the COHAN login page.
5. An emailed staff account remains `pending` and unverified before its first successful password login.
6. After valid credentials are confirmed, persist `emailVerified`, `emailVerifiedAt`, `verifiedAt`, and `status: active` before issuing the auth payload.
7. Inactive and blocked accounts remain forbidden. Customer verification behavior remains unchanged.
8. If post-create contact persistence or invitation delivery fails, roll back the newly created staff account and membership so retrying does not create a duplicate account.

## Acceptance criteria

- Staff creation with an entered password sends that exact initial password in the email body.
- Staff creation without a password sends a generated password that matches the stored password hash.
- Invitation delivery happens only after membership and role assignment finish.
- No password appears in the login URL, returned profile, or audit metadata.
- A valid first login activates and verifies only a pending STAFF account with an email.
- Invalid credentials do not change verification fields.
- Existing phone-only staff creation and non-staff login semantics remain unchanged.

## Validation plan

- Focused Vitest for invitation orchestration and rollback.
- Focused Vitest for staff login verification.
- Backend syntax checks for changed JavaScript files.
- GraphQL validation is not required because the schema contract does not change.

## Out of scope

- Magic-link login without a password.
- Persisting or re-displaying plaintext passwords.
- Redesigning the employee modal.
- Changing customer registration verification policy.
