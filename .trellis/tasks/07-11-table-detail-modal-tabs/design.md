# Design

## Direction

Compact operational table console using the existing sage and warm-neutral manager palette, persistent table context, clear separation between immediate actions and saved configuration, and full-screen mobile behavior.

## Structure

- Header: existing table title and close control.
- Tab bar: Tổng quan, Cấu hình, Vận hành, Đặt bàn, Gợi ý AI.
- Context summary: existing `.talite-info`, kept visible across tabs.
- Dynamic content panel: existing direct `.talite-group` sections are classified by their visible Vietnamese title and hidden when unrelated to the active tab.
- Footer: contextual save explanation, close action, and `Lưu cấu hình` only on persisted-field tabs.

## Implementation boundary

The modal already has complete handlers and persisted fields. Rebuilding the 1,700-line component would duplicate logic and risk contract drift. A focused DOM enhancement is installed once at application startup, follows the repository's existing runtime-enhancement pattern, and does not move React-owned nodes. It only adds navigation, accessibility metadata, and `hidden` state to current direct sections.

## Accessibility

- Native buttons with `role=tab` and a tablist label.
- `aria-selected`, roving `tabIndex`, and one dynamic `tabpanel` body.
- Arrow Left/Right, Home, and End navigation.
- 44px minimum tab targets and visible focus rings.
- Native `hidden` keeps inactive content out of the accessibility tree.

## Responsive

Desktop keeps the modal centered with fixed header, tab bar, and footer. At phone widths the existing modal becomes full-screen; tabs scroll horizontally and content remains a single column without reducing text size.
