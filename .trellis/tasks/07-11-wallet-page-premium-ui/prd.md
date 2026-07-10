# Wallet page premium UI

## Current behavior

The authenticated customer wallet route renders inside `MainLayout`. `WalletPage` loads `myWallet`, `myWalletTransactions`, creates a MoMo/VNPAY top-up session, polls `paymentSession`, and refetches the wallet when payment completes.

The data and payment flow are correct, but the supplied desktop screenshots show a weak information hierarchy:

- excessive empty space below the customer header;
- an oversized balance hero with low information density;
- wallet metrics stacked as five separate cards in a tall side rail;
- provider selection presented as a technical select rather than a clear payment choice;
- a generic empty transaction state with no next action;
- the top-up form and summary column do not align optically.

## End-to-end trace

1. `cohan-restaurant-backend/graphql/schema/wallet.graphql` exposes `myWallet`, `myWalletTransactions` and `createWalletTopup`.
2. `graphql/resolvers/wallet/index.js` scopes every wallet operation to the authenticated user.
3. `wallet.service.js` aggregates summary values, lists recent transactions, validates provider/amount and creates a payment session.
4. `WalletPage.jsx` queries summary/history, mutates a top-up, polls the payment session and refetches after completion.
5. `/wallet` is protected and rendered inside the shared customer `MainLayout`, which already owns header, footer, cart and mobile shell.

## Root cause

The issue is presentation rather than data or business logic. The current DOM and SCSS distribute related wallet information into too many equal-weight surfaces, producing a generic card dashboard and excessive vertical length. The provider selector and empty state also fail to communicate the next action clearly.

## UI direction

A compact digital-wallet statement using COHAN orange on warm neutral surfaces: one high-contrast balance area, a clear two-option payment selector, a compact 2×2 wallet summary, and a transaction ledger with purposeful loading/empty states.

## Scope

- Restructure `WalletPage` without changing GraphQL operations or payment behavior.
- Present MoMo and VNPAY as native radio-card choices.
- Keep quick amounts and custom amount in one coherent amount section.
- Compress metrics into a responsive 2×2 summary grid and show last update as supporting metadata.
- Improve payment-session and empty-history presentation.
- Add explicit input names, autocomplete behavior, focus states, touch targets and QR dimensions.
- Add a focused component test for selecting a provider and sending the existing top-up mutation payload.

## Acceptance criteria

- The balance and wallet status are immediately understandable above the fold.
- The main action, “Tạo phiên thanh toán”, remains visually dominant.
- MoMo/VNPAY choices are keyboard-operable native radio controls with clear selected state.
- Summary metrics do not form a long vertical rail on desktop.
- The page has no horizontal overflow at 390×844 and 430×932.
- Inputs remain at least 16px on mobile and interactive targets are at least 44px.
- Loading, error, payment-session and empty-history states remain understandable.
- Existing query, mutation, polling, refetch, permissions and route behavior remain unchanged.
- No new dependency, schema field, resolver change or service change is introduced.

## Out of scope

- Payment-provider configuration.
- Changing wallet minimum amounts or backend validation.
- Changing callback/webhook behavior.
- Adding withdrawal, transfer or bank-account features.
- Redesigning the shared customer header or footer.

## Validation plan

- `npx vitest run src/pages/WalletPage.test.jsx`
- `npm run check:graphql`
- `npm run check:conflicts`
- `npm run build`
- Desktop and 390×844 responsive review when a browser checkout is available.
