# Design

## Direction

Use the existing warm cream and orange customer palette, but reduce the generic white-card feel. The drawer should read like a compact order review rather than an admin panel.

## Information hierarchy

- Header: `Giỏ hàng` plus a plain-language item count; destructive clear action stays secondary.
- Restaurant group: small store mark, restaurant name, and a text `Xóa nhóm` action. Never expose IDs.
- Product row: thumbnail on the left; name, serving choice and hold state in the center; quantity and line total in a dedicated bottom action row.
- Footer: `Tạm tính`, a short pricing note, and one primary `Tiếp tục thanh toán` action.

## Responsive behavior

- Drawer uses `100dvh` and safe-area padding.
- On narrow screens, product content remains a two-column thumbnail/content grid while actions span the full row below.
- Footer remains visible without covering the final cart item.
- Secondary metadata wraps naturally and technical keys are translated.

## Interaction

- Focus-visible rings on every button/input.
- Hover/pressed feedback only where pointer hover exists.
- Reduced-motion disables drawer/item transitions.
- Disabled states remain legible and do not rely on color alone.
