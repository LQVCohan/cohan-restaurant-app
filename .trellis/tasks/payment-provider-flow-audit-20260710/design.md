# Design

## Shared provider boundary

`providers.js` remains the only place that constructs and verifies provider signatures. VNPAY receives a small timezone formatter and HMAC-SHA512 helper; no dependency is added.

## Authoritative callback boundary

`paymentSession.service.js` continues to own idempotency, amount checks and transactional settlement. Its VNPAY status mapping will require both provider status fields.

`createServer.js` keeps the existing MoMo POST webhook and adds the protocol-specific VNPAY GET IPN response. The return route will verify callback integrity and render a small user-facing result page, while settlement is performed by IPN.

## Manager UI

The provider mode remains in GraphQL/form state so saving unrelated restaurant fields cannot reset the internal configuration. Only the environment control and wording are removed from the rendered manager UI.

## Validation

- Provider unit tests: HMAC-SHA512, GMT+7 dates and expiry.
- Callback/service tests: VNPAY requires both success codes.
- Route test or narrow server test: GET IPN response contract.
- Restaurant component test: MoMo/VNPAY visible; environment wording absent; saved mode preserved.
