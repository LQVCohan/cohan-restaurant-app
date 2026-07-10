# Payment settings friendly UI

## Current behavior

- The manager screen exposes internal terms such as `merchant`, `Sandbox`, `Production`, `AES-256-GCM`, `TmnCode` and `Hash Secret` without enough explanation.
- MoMo and VNPAY are represented by generic icons rather than recognizable provider branding.
- Managers have no direct path from the form to the provider's official setup or account portal.
- Query and mutation errors may expose backend-oriented wording.
- The screen always starts on sandbox even when the restaurant provider configuration is saved in production mode.

## Required behavior

1. Keep the existing GraphQL, permission, encryption and credential-resolution flow unchanged.
2. Present the page in plain Vietnamese focused on connecting a payment account for the selected branch.
3. Show recognizable MoMo and VNPAY brand marks without adding a dependency or remote image runtime requirement.
4. Replace technical environment labels with “Tài khoản dùng thử” and “Tài khoản chính thức” while continuing to send `sandbox` and `production` to GraphQL.
5. Explain each provider field in user-facing language while retaining the provider's exact field name in parentheses.
6. Add an official provider link for obtaining or reviewing integration information.
7. Convert expected backend/network errors into actionable Vietnamese messages.
8. Preserve masking: saved secrets must never be placed back into inputs.
9. Keep the layout clear and usable on desktop and phone widths.

## Acceptance criteria

- The header, status, security message, provider source, actions and COHAN Balance note contain no unexplained platform or cryptography terminology.
- Both provider cards display distinct MoMo/VNPAY branding and an external official help link.
- Existing save, replace, disconnect, enable and mode-selection behavior continues to call the same GraphQL operations and values.
- The saved provider mode is reflected when configuration data loads.
- Focused component tests continue to verify masked identifiers and save payloads, and also verify official help links.

## Out of scope

- Changing payment credentials, encryption, callbacks, payment providers or GraphQL schema.
- Automated provider onboarding or live connection testing.
- Adding a UI/component library or image dependency.

## Validation plan

- Run the focused Vitest component test for `PaymentProviderSettingsPage`.
- Run the frontend build when the environment is available.
- Review 390px, 430px, 768px and desktop responsive rules in the changed SCSS.
