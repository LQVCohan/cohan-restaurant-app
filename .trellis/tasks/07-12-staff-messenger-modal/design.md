# Design

## Direction

Compact staff messenger using the existing sage surfaces: a fixed circular launcher, a restrained bottom-right panel on desktop, and a full-screen conversation surface on mobile. One panel owns both the conversation list and selected thread so staff never sees nested modals.

## State ownership

`StaffLayout` owns only global entry state:

- modal open/closed;
- optional thread ID requested by a notification or legacy deep-link.

`ContactsView` continues to own communication state through `useCommunication`:

- search and department filter;
- selected thread;
- load/read/send/refetch actions.

The server remains the source of truth for threads, messages and unread state.

## Interaction

- The floating launcher and “Liên lạc” navigation control call the same open handler.
- Notification actions pass a thread ID to that handler instead of navigating away.
- The legacy `/staff/contacts` route redirects to the role workspace with `openStaffMessenger` and `threadId` in router state.
- In list mode, the panel shows search, filters, a management shortcut and existing threads.
- In thread mode, `ChatThreadPanel` renders embedded inside the same surface. Back returns to the list; Close dismisses the entire messenger.

## Responsive behavior

- Above 640px: fixed panel near the bottom-right, constrained to viewport height.
- At 640px and below: modal fills `100dvh`, respects safe areas, removes rounded outer corners and keeps 16px composer text.
- The fixed launcher reserves bottom content space and disappears while the modal is open.

## Accessibility

- Native buttons for launcher, nav action, Back and Close.
- Dialog labelling and `aria-modal` on the messenger container.
- Focus moves to Close when the panel opens and returns to the launcher when it closes.
- Escape closes the panel.
- Existing focus rings and reduced-motion rules remain active.

## Deliberate simplifications

- No fake online indicator because the backend does not expose presence.
- Remove the non-functional call action instead of adding a pretend call flow.
- No new context/provider; the state is local to the already-global `StaffLayout`.
