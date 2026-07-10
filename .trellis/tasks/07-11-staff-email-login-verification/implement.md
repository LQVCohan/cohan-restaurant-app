# Implementation plan

1. Add a small staff invitation mail service reusing the existing mailer and `APP_PUBLIC_URL`.
2. Extend the staff domain wrapper to hold contact details, provide/generate the initial password, finalize scope and role, restore contacts, send the email, and roll back on failure.
3. Update the active pending-login resolver to activate and email-verify eligible STAFF accounts only after a valid password check.
4. Add focused tests for manager-provided and generated passwords, send ordering/rollback, and first-login verification.
5. Run focused backend tests and syntax checks; widen only if failures indicate shared-contract impact.
