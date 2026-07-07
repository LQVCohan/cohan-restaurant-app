# Align AI knowledge page with manager dashboard tone

## Current behavior

The AI chatbot knowledge page uses its own beige/slate/sage palette assembled from several legacy polish files. The manager Dashboard instead binds its surfaces, borders, text, actions, semantic states, and shadows to the shared `--manager-*` tokens from `ManagerUnifiedBackground.css`. This causes the knowledge page to look like a separate product even though it runs inside the same manager workspace.

## Root cause and flow

Visual flow:

`ManagerLayout -> AiChatbotKnowledgePage.jsx -> AiChatbotAdmin.scss -> AI polish styles imported by index.css -> shared manager tokens from ManagerUnifiedBackground.css`.

The data flow and UI actions are correct. The mismatch occurs only in the final CSS cascade because the AI styles use hard-coded colors instead of the dashboard token contract.

## Scope

- Add one knowledge-page theme bridge that maps existing `--ai-*` variables and component states to the shared `--manager-*` tokens.
- Import that bridge after the existing AI polish files so it becomes the final theme source for this page.
- Keep the current layout, copy, responsive behavior, GraphQL operations, permissions, and actions unchanged.

## Files changing

- `src/components/Dashboard_Manager/Customer/AiChatbotKnowledgeManagerTheme.css`: scoped theme bridge for the knowledge page.
- `src/index.css`: import the theme bridge after `AiManagerUiPolish.css`.

## Acceptance criteria

1. Page canvas remains transparent and uses the shared manager workspace background.
2. Hero, panels, cards, tabs, inputs, borders, and shadows use the same sage/pearl dashboard tokens.
3. Primary, secondary, disabled, hover, pressed, and focus-visible states remain distinct.
4. Success, warning, and danger states preserve semantic colors rather than becoming one accent color.
5. Existing desktop and mobile layout behavior does not change.
6. No backend, GraphQL, permission, or UI action code changes.

## Out of scope

- Redesigning page structure or changing content.
- Modifying the other AI manager pages.
- Adding dependencies or a new design system.

## Validation plan

- Static check that the new stylesheet is imported after existing AI polish layers.
- Review the final selectors for focus visibility, semantic states, and responsive safety.
- Run the narrowest frontend build or browser smoke test when an executable environment is available.
