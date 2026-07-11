# Resolve chatbot scope from unique restaurant knowledge

## Current behavior and root cause

A global chatbot question has no `restaurantId`. `handleRestaurantChatbotMessage` passes that null scope into `findRelevantKnowledgeForChatbot`, which returns no knowledge. The context is therefore built from globally discovered restaurants/menu items instead of following the restaurant that owns the only relevant knowledge match.

## End-to-end flow

`AiChatbotKnowledgeItem.restaurantId` -> knowledge retrieval service -> chatbot scope resolution -> menu/context loading -> GraphQL `askAiChatbot` response -> `AiChatbotWidget` menu source/action.

The GraphQL/frontend contract already carries `scopeMode`, `resolvedRestaurantId`, `source.restaurantId`, and `source.restaurantName`, so no schema or UI change is required.

## Files to change

- `cohan-restaurant-backend/src/services/ai/restaurantChatbotKnowledge.service.js`: add multi-restaurant retrieval while reusing the existing hybrid text/semantic ranking.
- `cohan-restaurant-backend/src/services/ai/restaurantChatbotCore.service.js`: resolve a global request to the unique eligible restaurant owning all relevant knowledge matches before building menu context.
- `cohan-restaurant-backend/tests/services/restaurantChatbotKnowledge.service.test.js`: cover allowed restaurant IDs and unique-owner selection.
- `.trellis/tasks/07-11-ai-chatbot-unique-knowledge-scope/*`: record plan and verification status.

## Acceptance criteria

1. Restaurant-scoped chatbot requests behave exactly as before.
2. For a global request, relevant enabled knowledge is searched only across public, active, chatbot-enabled restaurants.
3. When relevant knowledge matches belong to exactly one restaurant, the response resolves to that restaurant and menu recommendations come only from that restaurant.
4. When no knowledge matches or matches span multiple restaurants, the request remains global.
5. Disabled knowledge and ineligible restaurants cannot determine scope.
6. Existing GraphQL and frontend response contracts remain unchanged.

## Validation plan

```bash
cd cohan-restaurant-backend
npx vitest run tests/services/restaurantChatbotKnowledge.service.test.js
```

Then run repository GraphQL checks if the execution environment is available.

## Out of scope

- Copying one restaurant's policy into other restaurants.
- Merging policies from multiple restaurants into one answer.
- Adding new GraphQL fields or frontend UI.
- Changing how managers create or approve knowledge.
