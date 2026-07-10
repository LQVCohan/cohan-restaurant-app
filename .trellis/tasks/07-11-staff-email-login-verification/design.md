# Design

## Placement

Keep `staff/mutation.js` as the existing persistence layer. Extend the existing `staff/index.js` domain wrapper because it already owns business context, membership creation, restaurant role assignment, and rollback.

## Create flow

For an input containing an email:

1. Normalize and hold the email and phone outside the legacy persistence call.
2. Use the submitted password, or generate one with the existing user-model password generator.
3. Call the existing staff domain flow without contact fields so the legacy resolver cannot dispatch verification before membership and role synchronization.
4. After the domain flow succeeds, load the created staff document, restore contact fields, force `pending` and unverified email state, then save.
5. Send one staff invitation email containing the login identifier, initial password, and `/login` link.
6. Return the normal sanitized staff profile.
7. Roll back the new membership and staff account when restoring contact details or sending the invitation fails.

Phone-only creation continues through the existing path.

## Login flow

After the password comparison succeeds and before the auth payload is built:

- when the account is `STAFF`, has an email, is `pending`, and is not email-verified, mark the email and account verified;
- clear any obsolete email verification token fields;
- persist `status: active`;
- then build the token and client payload from the updated document.

This keeps blocked/inactive guards unchanged and avoids issuing a token containing stale pending state.

## Security

- Plaintext initial passwords exist only in request memory and the outgoing email builder.
- Passwords are not written to MongoDB, logs, EventLog metadata, GraphQL responses, or query parameters.
- Login still requires the normal password check, rate limiting, and CAPTCHA configuration.
