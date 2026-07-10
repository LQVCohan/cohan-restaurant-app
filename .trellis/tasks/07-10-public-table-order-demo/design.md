# Design

## Identity boundary

The printed table token remains the public read/access credential. Optional customer identity uses two additional short-lived signed JWT purposes with the same configured table-token secret and issuer:

- `customer_table_identity_challenge`: table-scoped phone + five-minute OTP challenge.
- `customer_table_identity`: table-scoped confirmed customer id + eight-hour identity session.

A registered-customer candidate is represented by a signed candidate token and is not converted into an identity token until explicit confirmation. Browser input never contains a trusted `userId`.

The sandbox OTP is `TABLE_QR_DEMO_OTP` or `123456`. It is available only when `NODE_ENV !== production`; production returns a configuration error instead of accepting a fixed code.

## Public GraphQL contract

- `publicRequestTableIdentityOtp(input)` validates table QR access, normalizes phone, and returns a short-lived challenge plus the sandbox OTP for thesis UI.
- `publicVerifyTableIdentityOtp(input)` validates OTP. Registered matches return a confirmation candidate; otherwise the existing guest helper creates/reuses a temporary guest and returns an identity token.
- `publicConfirmTableIdentity(input)` accepts or declines the registered match. Decline returns no identity token.
- `publicSubmitTableOrder(input)` validates QR/table/session, optional identity token, idempotency, menu items, modifier rules, serving variants, inventory, and then persists a pending batch.

## Order lifecycle

The QR-specific creation path reuses:

- `ensureActiveTableSessionForDineInOrder` for the parent table session;
- `hydrateOrderItems` for authoritative item, modifier, serving, prep-station and price snapshots;
- `reserveForOrderTx` for atomic inventory reservation;
- existing tracking/public status and restaurant order events.

The pending QR batch uses `kitchenStatus: draft` and does not create `KitchenOrderWorkItem` rows. `confirmIncomingOrder` atomically claims the pending order, changes it to confirmed, creates the kitchen work items, then creates station print jobs. Existing reject/update status flow releases inventory.

## Demo cart boundary

The browser cart is local to the table page. The server performs authoritative hydration and inventory reservation only on submit. This preserves conflict correctness without changing the authenticated `Cart` model, whose active-cart uniqueness and ownership are intentionally tied to `userId`.

## UI structure

`TableOrderExperience` is embedded in `TableCurrentSessionPage`:

1. optional identity dialog;
2. compact menu controls and item list;
3. native item configuration dialog for serving variant, required modifiers, quantity/weight and note;
4. local cart summary and pending-order submit;
5. success state followed by table-session refetch.

The existing warm customer palette is reused. Main actions are at least 44px, mobile inputs remain 16px, dialogs have explicit labels/errors/cancel paths, and secondary identity details use progressive disclosure.
