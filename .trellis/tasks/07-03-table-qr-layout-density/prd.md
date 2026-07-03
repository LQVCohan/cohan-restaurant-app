# Improve table QR page layout density

## Current behavior

- Opening the desktop sidebar leaves a large empty strip because the content is shifted for a 304px sidebar while the sidebar CSS variable remains 72px.
- The usage flow wraps unpredictably and consumes excess vertical space.
- QR cards stretch to the tallest card in each grid row, leaving empty space in shorter cards.
- Card actions wrap inconsistently across desktop widths.

## Root cause

`ManagerLayout.scss` keeps `--sidebar-width` at the collapsed width inside `.sidebar-open`, while the main panel is translated by the expanded-width delta. The table QR page also relies on stretch-aligned CSS Grid items and free-form flex wrapping.

## Requirements

- Set the open sidebar width to the existing expanded sidebar constant.
- Keep all QR queries, mutations, handlers, labels, and permissions unchanged.
- Make the usage flow compact and scannable.
- Let QR cards use intrinsic height instead of stretching to the tallest sibling.
- Keep actions in a predictable responsive grid.
- Preserve keyboard focus, disabled states, and reduced-motion behavior.

## Acceptance criteria

- No blank strip appears between the open sidebar and manager content on desktop.
- The usage flow stays compact at common desktop widths and stacks cleanly on mobile.
- Missing QR cards no longer inherit unnecessary height from ready QR cards.
- Card actions remain aligned without random wrapping.
- The page remains usable at 390x844, 430x932, and desktop widths.
- No backend, GraphQL, or QR generation behavior changes.

## Out of scope

- Changing QR lifetime, generation, revocation, printing, or public access behavior.
- Redesigning the shared manager header or every manager page.
- Adding dependencies or a new component library.
