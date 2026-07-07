# Order settings sync

## Current behavior

The order settings modal uses a warm cream theme but its primary action and split background do not fully match the manager sage palette. Time thresholds and colors already reach `OrderCard`. `chipSize` only changes summary chips, so the modal promise that it changes dish readability is only partially true. Settings are stored in `localStorage`, therefore they are local to the current browser/device.

## Scope

- Keep the existing common Modal, React and SCSS/CSS stack.
- Make the settings modal visually match the manager order page.
- Normalize time thresholds before saving.
- Clarify that settings apply to Kitchen/Bar displays on this browser.
- Apply chip size to actual KDS item rows using one root data attribute.
- Preserve existing callbacks, localStorage persistence, draft restore and order behavior.
- Add focused component coverage.

## Acceptance criteria

1. Primary save action uses the same manager green as the order page.
2. Modal surfaces use one sage/cream visual system without a hard split background.
3. Every input has an accessible label and utility buttons use `type="button"`.
4. Invalid or descending time thresholds are normalized to positive ascending values.
5. Saving chip size updates the root display mode and actual fullscreen KDS item sizing.
6. The modal states clearly that settings are browser-local.
7. Existing time threshold and color callbacks remain unchanged.

## Validation

- `npx vitest run src/components/Dashboard_Manager/Order/components/OrderSettingsModal.test.jsx`
- `npx vitest run src/components/Dashboard_Manager/Order/OrderManagement.test.jsx`
- `npm run build`
