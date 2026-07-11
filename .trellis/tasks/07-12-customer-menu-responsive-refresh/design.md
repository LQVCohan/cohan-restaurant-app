# Design

## Visual direction

A compact warm food marketplace: cream surfaces, amber action color, dark cocoa text and restrained sage for availability. The signature detail is a context strip that combines active meal, category, result count and filter reset.

## Component decisions

- Restaurant discovery receives a compact search toolbar between the hero and restaurant grid.
- Menu header keeps the existing card but uses Lucide controls, a styled sort field and a clear-search action.
- Meal tabs remain visible and scrollable; booking restrictions are explained only when a locked reservation meal exists.
- Result context sits after categories and before availability notes.
- Menu cards preserve image, name, promotion, preference, real preparation time and price; low stock appears only from maxAvailable.
- At phone widths, cards use a bounded image column and concise information column instead of a tall poster card.

## Accessibility

- Native button, input, select and link elements remain.
- Icon-only controls keep accessible names.
- Controls are at least 44px and retain focus-visible rings.
- Color is paired with text for availability and warnings.
- Reduced motion remains respected.
