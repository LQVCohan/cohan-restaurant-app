# Implementation checklist

- [x] Trace cart schema, cart hold mutation, checkout resolver, Apollo mutation and modal action.
- [x] Trace VNPAY session creation, provider configuration, payment authorization and callback flow.
- [x] Bypass duplicate checkout-hold pre-processing and keep the canonical checkout transaction.
- [x] Enforce email-or-phone contact validation at the backend trust boundary.
- [x] Allow customers to create payment sessions only for their own orders.
- [x] Add VNPAY to the active customer checkout modal.
- [x] Keep online-card/VNPAY orders in `draft` and release them to kitchen only after the verified provider callback.
- [x] Make full name optional and compact the confirmation modal layout.
- [x] Add focused regression tests.
- [x] Remove the superseded checkout modal implementation and its obsolete test.
- [x] Re-fetch changed files and review callers/usages.
- [x] Verify frontend/backend lint, focused tests, menu RBAC, build and Playwright smoke in CI run 8253.
- [x] Verify the final deferred-online test in the restored standard suite; only unrelated baseline tests remain failing.
- [x] Restore the repository's standard CI gates after the verification run.

## Not run

- Real VNPAY sandbox transaction from browser through provider ReturnURL/IPN.
- Manual visual review on a physical 390×844 device and desktop POS browser.
- A clean standard full-suite run is still blocked by unrelated baseline failures recorded in PR #1350.
