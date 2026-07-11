# Recommendation provenance and compact growth widgets

## Current behavior

The growth section renders all promotion campaigns as long expanded cards while the menu widget remains much shorter. The interface exposes sample counts but hides the actual data sources, calculation method, fallback cost behavior, and the limited role of AI. Raw backend tokens such as `AMOUNT` and decimal confidence values are also shown to managers.

## Root cause

The backend services already expose enough method, fallback, sample, summary, recommendation, and note data. The widgets flatten the payload into presentation cards instead of establishing a decision hierarchy and explaining provenance. This makes deterministic recommendations look like opaque AI output and creates a visually unbalanced two-column section.

## End-to-end flow

1. `Order`, `Customer`, `Promotion`, `Coupon`, `StockItem`, `Recipe`, and `Ingredient` store the source data.
2. `buildSmartPromotionEngine` computes rule-based campaigns and may ask Gemini only to rewrite text fields without changing numeric KPI.
3. `buildMenuEngineeringAssistant` calculates item revenue, estimated cost, contribution margin, quadrant, and deterministic actions.
4. Analytics GraphQL exposes both payloads through the existing schema.
5. `useAnalyst` fetches them and `ManagerAnalyst` passes them to the two growth widgets.
6. The widgets must explain provenance, prioritize the primary recommendation, and progressively disclose secondary detail.

## Visual direction

Compact manager decision panel using existing sage and warm-neutral surfaces, one featured recommendation, visible source summary, and native progressive disclosure for supporting detail.

## Files to change

- `SmartPromotionEngineWidget.jsx`: clarify source and AI role, normalize technical values, feature the highest-ranked campaign, and collapse secondary campaigns/promotions.
- `SmartPromotionEngineWidget.scss`: style the provenance block, featured campaign, native details control, responsive layout, focus, and touch states.
- `MenuEngineeringAssistantWidget.jsx`: clarify cost sources and deterministic classification, expose fallback use, improve dish/action hierarchy.
- `MenuEngineeringAssistantWidget.scss`: style the source block, compact dish metrics, action list, and responsive states.
- `GrowthRecommendationWidgets.test.jsx`: verify provenance, AI wording, token normalization, confidence percentage, fallback explanation, and progressive disclosure.

## Acceptance criteria

- Managers can see which operational datasets drive each recommendation without reading backend code.
- Promotion UI states whether AI enhanced wording and explicitly says numeric KPI remain rule-based.
- Menu UI explains snapshot -> recipe/ingredient -> fallback cost priority.
- Raw discount tokens are not displayed and confidence is shown as a percentage.
- Only the highest-ranked campaign is fully prominent; secondary campaigns and reusable vouchers are progressively disclosed.
- Existing navigation callbacks, loading states, empty states, GraphQL contract, permissions, formulas, and restaurant scoping remain unchanged.
- Layout remains readable without horizontal overflow on desktop and phone widths.

## Out of scope

- Changing promotion scoring, KPI formulas, menu quadrant formulas, or fallback margin.
- Adding new GraphQL fields or dependencies.
- Publishing a promotion directly from the analytics screen.
- Replacing the broader manager analytics visual system.

## Validation plan

- Run the focused growth widget component test.
- Run the existing manager analytics component test.
- Run the frontend build.
- Review 390x844, 430x932, 1024 and 1440 layouts.
