# Wallet page premium UI

## Current behavior

The authenticated customer wallet route renders inside `MainLayout`. `WalletPage` loads `myWallet`, `myWalletTransactions`, creates a MoMo/VNPAY top-up session, polls `paymentSession`, and refetches the wallet when payment completes.

The data and payment flow are correct, but the supplied desktop screenshots showed a weak information hierarchy:

- excessive empty space below the customer header;
- an oversized balance hero with low information density;
- wallet metrics stacked as five separate cards in a tall side rail;
- provider selection presented as a technical select rather than a clear payment choice;
- a generic empty transaction state with no next action;
- the top-up form and summary column did not align optically.

## End-to-end trace

1. `cohan-restaurant-backend/graphql/schema/wallet.graphql` exposes `myWallet`, `myWalletTransactions` and `createWalletTopup`.
2. `graphql/resolvers/wallet/index.js` scopes every wallet operation to the authenticated user.
3. `wallet.service.js` aggregates summary values, lists recent transactions, validates provider/amount and creates a payment session.
4. `WalletPage.jsx` queries summary/history, mutates a top-up, polls the payment session and refetches after completion.
5. `/wallet` is protected and rendered inside the shared customer `MainLayout`, which already owns header, footer, cart and mobile shell.

## Root cause

The issue was presentation rather than data or business logic. The previous DOM and SCSS distributed related wallet information into too many equal-weight surfaces, producing a generic card dashboard and excessive vertical length. The provider selector and empty state also failed to communicate the next action clearly.

## UI direction

A compact digital-wallet statement using COHAN orange on warm neutral surfaces: one high-contrast balance area, a clear two-option payment selector, a compact 2×2 wallet summary, and a transaction ledger with purposeful loading/empty states.

## Implementation

- Rebuilt the wallet hero as a high-contrast balance card with wallet status and reconciliation guidance.
- Converted provider selection from a native select into two native radio-card choices for MoMo and VNPAY.
- Grouped quick amounts and custom amount in one amount section with an explicit VND suffix.
- Replaced the tall one-column statistics rail with a compact responsive 2×2 summary panel.
- Added a localized payment-session summary with fixed QR dimensions and clearer payment links.
- Added a guided empty-history state linking back to the top-up section.
- Removed the nested page `<main>` because the shared customer layout already owns the main landmark.
- Added input names, autocomplete behavior, visible focus, 44px touch targets, mobile 16px input text, live status feedback and reduced-motion handling.
- Added `WalletPage.test.jsx` for provider selection and the existing top-up mutation payload.

## Acceptance criteria

- The balance and wallet status are immediately understandable above the fold.
- The main action, “Tạo phiên thanh toán”, remains visually dominant.
- MoMo/VNPAY choices are keyboard-operable native radio controls with clear selected state.
- Summary metrics no longer form a long vertical rail on desktop.
- Responsive rules prevent horizontal overflow at narrow widths by stacking the main layout, providers, summary and transactions.
- Inputs remain at least 16px on mobile and interactive targets are at least 44px.
- Loading, error, payment-session and empty-history states remain understandable.
- Existing query, mutation, polling, refetch, permissions and route behavior remain unchanged.
- No new dependency, schema field, resolver change or service change was introduced.

## Out of scope

- Payment-provider configuration.
- Changing wallet minimum amounts or backend validation.
- Changing callback/webhook behavior.
- Adding withdrawal, transfer or bank-account features.
- Redesigning the shared customer header or footer.

## Validation result

Completed:

- fetched the final JSX, SCSS and test from `main` after writing;
- compared the implementation range and confirmed only `WalletPage.jsx`, `WalletPage.scss` and `WalletPage.test.jsx` changed;
- confirmed no backend or GraphQL contract file changed.

Not run:

- `npx vitest run src/pages/WalletPage.test.jsx`;
- `npm run check:graphql`;
- `npm run check:conflicts`;
- `npm run build`;
- desktop and 390×844/430×932 browser review.

The GitHub connector does not provide a dependency-installed checkout. A shallow clone was attempted for local validation, but the execution environment could not resolve `github.com`. No GitHub Actions workflow run was associated with the final implementation commit.
