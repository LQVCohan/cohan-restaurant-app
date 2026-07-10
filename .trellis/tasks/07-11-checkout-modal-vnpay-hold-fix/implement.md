# Implementation checklist

- [x] Trace cart schema, cart hold mutation, checkout resolver, Apollo mutation and modal action.
- [x] Trace VNPAY session creation, provider configuration, payment authorization and callback flow.
- [ ] Bypass duplicate checkout-hold pre-processing and keep the canonical checkout transaction.
- [ ] Enforce email-or-phone contact validation at the backend trust boundary.
- [ ] Allow customers to create payment sessions only for their own orders.
- [ ] Add VNPAY to the active customer checkout modal.
- [ ] Make full name optional and compact the confirmation modal layout.
- [ ] Add focused regression tests.
- [ ] Re-fetch changed files and review callers/usages.
- [ ] Record CI, build and manual-browser validation status.
