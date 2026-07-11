# Implementation plan

## Files changing and why

- `src/layouts/StaffLayout.jsx`: own global messenger open/focus state; convert the contact nav entry and notification thread action into in-page modal entry points; render the floating launcher and modal.
- `src/layouts/StaffLayout.scss`: style and reserve space for the launcher; keep mobile safe-area behavior.
- `src/components/Staff/StaffCommunicationPage.jsx`: preserve old contact URLs by redirecting to the role workspace with modal router state.
- `src/components/Staff/StaffCommunicationPage.scss`: delete because the dedicated contacts page no longer renders.
- `src/components/Staff/components/ContactsView.jsx`: turn the page body into a labelled modal with list/thread modes, error handling and no fake presence/call controls.
- `src/components/Staff/components/ContactsView.scss`: implement desktop dock and mobile full-screen layout using existing sage tokens.
- `src/components/common/ChatThreadPanel.jsx`: add a backwards-compatible embedded presentation and Back action; keep existing standalone use unchanged.
- `src/components/common/ChatThreadPanel.scss`: make embedded mode fill its parent without another overlay.
- `src/layouts/StaffLayout.test.jsx`: prove nav/launcher opening behavior.
- `src/components/Staff/components/ContactsView.test.jsx`: prove thread selection, mark-read and same-modal Back behavior.

## Smallest validation

```bash
npx vitest run src/layouts/StaffLayout.test.jsx src/components/Staff/components/ContactsView.test.jsx
npm run check:conflicts
npm run check:graphql:operations
npm run build
```

## Contract check

No GraphQL field or mutation changes. `Q_CHAT_THREADS`, `Q_CHAT_THREAD`, `M_OPEN_CHAT_THREAD`, `M_SEND_CHAT_MESSAGE` and `M_MARK_THREAD_READ` remain the only data path.
