# Remove OpenAI and standardize Gemini 3.5 Flash

## Root cause and caller flow

The project previously selected AI providers independently inside several services:

1. `AiChatbotWidget -> askAiChatbot resolver -> restaurantChatbotReviewed.service -> restaurantChatbot.service`.
2. `useAnalyst -> analytics GraphQL resolver -> demandForecast.service / smartPromotionEngine.service`.
3. `TableActionsLiteModal -> /api/ai/table/* -> aiTable.service`.
4. Review insights and restaurant profile rewriting called Gemini through separate implementations.

This made it possible for some runtime paths to call OpenAI while other paths used Gemini or local Ollama.

## Implemented design

- `geminiClient.service.js` is the shared hosted-model client and defaults to `gemini-3.5-flash`.
- The public chatbot entrypoint enforces `gemini -> local` before every provider call.
- The public AI-table entrypoint sends text suggestions to Gemini and preserves deterministic fallbacks.
- Demand forecast uses only Gemini and local Ollama for narrative enhancement.
- Smart promotion uses Gemini only for wording/guardrails; numeric KPI logic remains deterministic.
- Review insights and restaurant profile rewriting use the shared Gemini client.
- Local AI remains Ollama with Qwen3 chat and BGE-M3 embeddings.
- Backend startup removes legacy OpenAI credentials from the effective runtime environment.

The existing chatbot and table-layout implementations were moved behind core modules so the established business logic and testable layout engine remain unchanged. Their legacy provider helpers are not exported through the public runtime entrypoints and cannot be selected by normal application calls.

## Files changed

- `.env.example`
- `cohan-restaurant-backend/.env.example`
- `cohan-restaurant-backend/src/server/server.js`
- `cohan-restaurant-backend/src/services/ai/geminiClient.service.js`
- `cohan-restaurant-backend/src/services/ai/localAiProvider.service.js`
- `cohan-restaurant-backend/src/services/ai/restaurantChatbot.service.js`
- `cohan-restaurant-backend/src/services/ai/restaurantChatbotCore.service.js`
- `cohan-restaurant-backend/src/services/ai/demandForecast.service.js`
- `cohan-restaurant-backend/src/services/ai/smartPromotionEngine.service.js`
- `cohan-restaurant-backend/src/services/ai/aiTable.service.js`
- `cohan-restaurant-backend/src/services/ai/aiTableLayoutCore.service.js`
- `cohan-restaurant-backend/src/services/reviewInsight.service.js`
- `cohan-restaurant-backend/src/services/ai/restaurantProfileRewrite.service.js`

## Acceptance criteria

1. Public runtime entrypoints cannot select or call OpenAI.
2. Chatbot provider order is Gemini followed by local Ollama fallback.
3. Demand forecast enhancement uses only Gemini/local.
4. Smart promotion and AI-table suggestions use Gemini while preserving deterministic fallbacks.
5. Hosted Gemini calls default to `gemini-3.5-flash`.
6. Qwen3 and BGE-M3 remain the local chat and embedding models.
7. GraphQL schema, resolver outputs, permissions, restaurant scoping, persistence, and frontend operations remain unchanged.

## Validation

- Static review confirmed the public chatbot and AI-table entrypoints route through Gemini.
- GitHub reported no status checks or workflow runs for the final merge commit at review time.
- Local build, Vitest, GraphQL checks, and runtime API smoke tests were not available in the connected environment.
- The literal API model identifier `gemini-3.5-flash` was applied as requested and still requires a real Gemini API smoke test with the project credential.
