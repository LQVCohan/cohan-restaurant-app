# Replace blocking alert feedback with toast bridge

## Current behavior

Some frontend paths still call native `alert(...)`. The browser blocks the app until the user presses OK, even when the message is only interface feedback or an error notice.

## Root cause

The app already has a global `NotificationProvider` and `NotificationContainer`, but legacy callers still use the browser alert API directly. Fixing each caller one by one would leave sibling paths behind.

## Flow traced

- Browser native alert API
- `NotificationProvider` local toast state
- `NotificationContainer` renders non-blocking toasts
- App root wraps screens in `NotificationProvider` and renders `NotificationContainer`
- Legacy UI actions call `alert(...)` from screens/hooks

## Scope

Replace app-level `window.alert` while `NotificationProvider` is mounted so legacy alert messages become non-blocking toast notifications.

## Constraints

- Do not change `confirm` or `prompt` flows because they collect decisions/input.
- Do not add a new dependency.
- Keep persistent DB notifications separate from UI-only toast feedback.
- Preserve teardown by restoring the original `window.alert` on provider unmount.

## Acceptance criteria

- Calling `window.alert("message")` inside the app renders a toast instead of opening the browser modal.
- Existing `showNotification` callers keep working.
- Native alert is restored when the provider unmounts.

## Files planned

- `src/context/NotificationProvider.jsx`: bridge native alert to the existing toast provider.
- `src/context/NotificationProvider.test.jsx`: targeted regression test for the alert bridge.

## Validation plan

- `npm run check:conflicts`
- `npx vitest run src/context/NotificationProvider.test.jsx`
