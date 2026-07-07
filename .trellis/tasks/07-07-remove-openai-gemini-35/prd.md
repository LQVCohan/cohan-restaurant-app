# Remove OpenAI and standardize Gemini 3.5 Flash

## Current behavior

The project has a mixed AI provider strategy:

- The chatbot can call Gemini, OpenAI, or a local provider.
- Demand forecast can try local, Gemini, and OpenAI.
- Smart promotion and table suggestions call OpenAI directly.
- Review insights, restaurant profile rewriting, and 3D preprocessing use older Gemini model defaults.

This allows OpenAI calls even though the intended project stack is Gemini with local Ollama fallback.

## Root cause and caller flow

The provider choice is implemented independently inside multiple services instead of following one Gemini-first policy.

Runtime flows:

1. `AiChatbotWidget -> askAiChatbot resolver -> restaurantChatbotReviewed.service -> restaurantChatbot.service`.
2. `useAnalyst -> analytics GraphQL resolver -> demandForecast.service / smartPromotionEngine.service`.
3. `TableActionsLiteModal -> /api/ai/table/* -> aiTable.service`.
4. Review insight, restaurant profile rewrite, and table 3D preprocessing call Gemini directly.

The GraphQL schemas, resolver payloads, Apollo queries, UI actions, permissions, restaurant scoping, and persistence contracts do not need to change.

## Scope

- Remove direct calls to `api.openai.com` and `OPENAI_API_KEY` from runtime services.
- Restrict chatbot and forecast provider ordering to Gemini and local Ollama.
- Replace OpenAI enhancement in smart promotion and table suggestions with Gemini.
- Standardize Gemini defaults on `gemini-3.5-flash`.
- Keep BGE-M3 as the local embedding model and Qwen3 as the local chat fallback.
- Update focused tests and environment examples.

## Files changing

- `.env.example`
- `cohan-restaurant-backend/.env.example`
- `cohan-restaurant-backend/src/services/ai/geminiClient.service.js`
- `cohan-restaurant-backend/src/services/ai/localAiProvider.service.js`
- `cohan-restaurant-backend/src/services/ai/restaurantChatbot.service.js`
- `cohan-restaurant-backend/src/services/ai/demandForecast.service.js`
- `cohan-restaurant-backend/src/services/ai/smartPromotionEngine.service.js`
- `cohan-restaurant-backend/src/services/ai/aiTable.service.js`
- `cohan-restaurant-backend/src/services/reviewInsight.service.js`
- `cohan-restaurant-backend/src/services/ai/restaurantProfileRewrite.service.js`
- `cohan-restaurant-backend/src/services/table3d/table3dAiGeneration.service.js`
- Focused provider tests under `cohan-restaurant-backend/tests/`.

## Acceptance criteria

1. Runtime code contains no direct OpenAI API endpoint or `OPENAI_API_KEY` use.
2. Chatbot provider order is Gemini then local fallback; an `openai` configuration value cannot select an OpenAI path.
3. Demand forecast enhancement uses only Gemini/local.
4. Smart promotion and AI table suggestions use Gemini, preserving existing deterministic fallbacks.
5. Default Gemini model is `gemini-3.5-flash` across active Gemini features.
6. Existing schema, resolver outputs, UI actions, permissions, restaurant scope, and safety guards remain unchanged.
7. Focused tests cover Gemini failure/fallback and payload behavior.

## Out of scope

- Changing GraphQL types or frontend layouts.
- Removing deterministic or local-model fallbacks.
- Changing embedding model BGE-M3.
- Changing Hi3D or Meshy image-to-3D providers.
- Committing real API keys or local `.env` files.

## Validation plan

- Search runtime/config/tests for `OPENAI_API_KEY`, `api.openai.com`, and `gpt-`.
- Run focused Vitest files for chatbot, smart promotion, review insight, demand forecast, and AI table services.
- Run backend syntax/import checks or the narrowest available backend test command.
- Run `npm run check:conflicts` and `npm run check:graphql` when available.
