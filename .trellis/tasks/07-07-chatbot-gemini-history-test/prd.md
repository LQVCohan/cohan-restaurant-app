# Align chatbot tests with Gemini core split

## Current behavior

The public chatbot service now enforces Gemini and delegates implementation to `restaurantChatbotCore.service.js`. Two tests still follow the pre-refactor layout:

- the persistence test configures OpenAI, inspects an OpenAI `messages` payload, and returns an OpenAI `choices` response;
- the cache safety test reads the thin wrapper source even though the user-specific context boundary moved to the core module.

## Root cause

The runtime provider and module boundaries changed, but provider-specific and source-inspection tests retained the old contracts.

## End-to-end flow

1. `restaurantChatbot.service.js` enforces the Gemini provider policy.
2. `restaurantChatbotCore.service.js` builds Gemini `contents`, owns history handling, and deliberately avoids caching user-specific context.
3. `handleRestaurantChatbotMessage` persists the user message, excludes it from provider history, then calls Gemini.
4. Tests must inspect the current provider envelope and the module that owns the behavior.

## Files to change

- `cohan-restaurant-backend/tests/services/restaurantChatbot.persistence.service.test.js`: configure Gemini, inspect `contents[].parts[].text`, and return a Gemini-shaped JSON response.
- `cohan-restaurant-backend/tests/services/restaurantChatbot.phase26-cache.service.test.js`: inspect the core source where the cache boundary now lives.

## Acceptance criteria

- The history test no longer depends on OpenAI environment variables or response fields.
- The prior and current user messages are present in the Gemini request, with the current message exactly once.
- The cache safety test reads the actual owner module after the wrapper/core split.
- Conversation, persistence, and cache assertions remain unchanged.
- No runtime service, GraphQL contract, authorization, persistence, or cache behavior changes.

## Out of scope

- Removing dormant OpenAI implementation code from the core service.
- Changing Gemini prompts, models, fallback order, response normalization, or cache policy.
- Rewriting unrelated chatbot tests.

## Validation plan

- Run the focused chatbot persistence and Phase 26 cache tests through CI.
- Run backend lint, full tests, Menu RBAC, and build through CI.
- Confirm frontend checks remain unaffected.
