# Design

## Visual direction

Compact operational shell with warm neutral surfaces, sage accents, role-specific workspace emphasis, and grouped navigation that reads like a work console rather than a row of equal pills.

## Layout

- Header keeps page title, signed-in identity and mobile menu control.
- Desktop navigation groups remain visible but wrap into labeled sections.
- Mobile navigation becomes a contained two-column menu, collapsing to one column at 430px.
- The first visible link is the current role's primary workspace.
- Existing content receives no new data dependency and keeps its own page layout.

## Accessibility and responsive behavior

- Preserve native links/buttons, aria-current, aria-expanded and focus rings.
- Keep minimum 44px touch targets and safe-area padding.
- Do not rely on color alone for active/primary state.
- Respect reduced-motion preferences.
- Review 390x844, 430x932, 768, 1024 and 1440 widths.
