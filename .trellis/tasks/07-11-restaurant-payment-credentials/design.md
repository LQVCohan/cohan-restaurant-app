# Design

## Data model

Create `PaymentProviderCredential` as an append-only credential version per restaurant/provider/mode.

Fields:

- `restaurantId`
- `provider`: `momo | vnpay`
- `mode`: `sandbox | production`
- `version`
- `active`
- `encryptedPayload`
- `maskedIdentifier`
- `createdBy`, `updatedBy`, `configuredAt`, `disconnectedAt`, timestamps

Saving a new credential deactivates the previous active version and creates a new version. Payment sessions store only the credential id/source/mode in metadata.

## Encryption

Use Node `crypto` with AES-256-GCM, 12-byte random IV and auth tag. Derive a 32-byte key from `PAYMENT_CREDENTIAL_ENCRYPTION_KEY`; accept a 64-char hex or 32-byte base64 key, otherwise derive with `scryptSync`.

Production fails closed when the encryption key is missing. Development/test uses a warned fallback key so existing local workflows remain runnable.

## Credential resolution

`resolvePaymentCredential({ restaurantId, provider, mode, credentialId })`:

1. When `credentialId` is present, load that exact credential version.
2. Otherwise load the latest active restaurant credential for provider/mode.
3. Otherwise build platform credentials from environment variables.
4. Validate required fields and return `{ credentials, source, credentialId, mode }`.

## Payment creation

Restaurant reservation/order/POS flows resolve credentials before calling the shared provider. They store safe metadata:

```js
payment.metadata.paymentCredential = {
  source: "restaurant" | "platform",
  credentialId: "..." | null,
  mode: "sandbox" | "production"
}
```

Wallet topup has no restaurant scope and continues to use platform credentials.

## Callback verification

The callback first finds `PaymentSession`, then resolves the credential using `metadata.paymentCredential.credentialId` and calls `verifyMomoCallback` or `verifyVnpayCallback` with that credential object.

## GraphQL

Add:

- `restaurantPaymentCredentialStatuses(restaurantId)`
- `saveRestaurantPaymentCredential(input)`
- `disconnectRestaurantPaymentCredential(restaurantId, provider, mode)`

Only masked status is returned. Existing public provider config gains `configured` and `credentialSource` so customer payment selectors can avoid showing unavailable providers.

## UI

Add manager page `payment-settings` under “Tài chính & báo cáo”. It uses the selected restaurant from `ManagerLayout`, shows two provider panels, mode selection, masked saved state, explicit secret fields and save/disconnect actions.

No secret is rehydrated into inputs after save.
