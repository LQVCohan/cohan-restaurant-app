# Resolve chatbot scope from unique restaurant knowledge

## Current behavior and root cause

A global chatbot question has no `restaurantId`. The existing core therefore builds a global menu context and later calls `findRelevantKnowledgeForChatbot` with a null restaurant scope, which returns no knowledge. Even when only one restaurant owns the relevant playbook, the answer can therefore recommend unrelated menu items from other restaurants.

## End-to-end flow

`AiChatbotKnowledgeItem.restaurantId` -> unique knowledge owner resolution -> existing chatbot restaurant scope -> restaurant-only menu/context loading -> GraphQL `askAiChatbot` response -> `AiChatbotWidget` menu source/action.

The existing scope resolver remains authoritative. Explicit `restaurantId`, page restaurant, selected menu item, unavailable restaurant, and unique/ambiguous restaurant-name flows are handled first and are never overwritten by knowledge matching.

The GraphQL/frontend contract already carries `scopeMode`, `resolvedRestaurantId`, `source.restaurantId`, and `source.restaurantName`, so no schema or UI change is required.

## Files changed

- `cohan-restaurant-backend/src/services/ai/restaurantChatbotKnowledgeScope.service.js`: search enabled knowledge only across active, published, chatbot-enabled restaurants and return a restaurant only when the relevant matches have one owner.
- `cohan-restaurant-backend/graphql/resolvers/aiChatbot/index.js`: resolve the optional knowledge-derived restaurant before calling the existing reviewed chatbot flow.
- `cohan-restaurant-backend/tests/services/restaurantChatbotKnowledgeScope.service.test.js`: cover a unique owner, multiple owners, existing scope precedence, and ineligible restaurants.
- `.trellis/tasks/07-11-ai-chatbot-unique-knowledge-scope/*`: record scope and verification status.

## Acceptance criteria

1. Restaurant-scoped chatbot requests behave exactly as before.
2. For a truly global request, relevant enabled knowledge is searched only across public, active, chatbot-enabled restaurants.
3. When relevant knowledge matches belong to exactly one restaurant, the existing chatbot flow receives that restaurant ID and therefore loads knowledge and menu recommendations only from that restaurant.
4. When no knowledge matches or strong matches span multiple restaurants, the request remains global.
5. Disabled knowledge and ineligible restaurants cannot determine scope.
6. Existing GraphQL and frontend response contracts remain unchanged.

## Validation plan

```bash
cd cohan-restaurant-backend
npx vitest run tests/services/restaurantChatbotKnowledgeScope.service.test.js
```

Then run repository GraphQL checks if the execution environment is available.

## Out of scope

- Copying one restaurant's policy into other restaurants.
- Merging policies from multiple restaurants into one answer.
- Adding new GraphQL fields or frontend UI.
- Changing how managers create or approve knowledge.
- Changing evaluation-only or internal callers that already provide an explicit restaurant scope.
