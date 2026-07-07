# Align restaurant chatbot tests with Gemini provider policy

## Current behavior and root cause

`restaurantChatbot.service.js` is a thin runtime wrapper that always selects Gemini and delegates to `restaurantChatbotCore.service.js`. Three tests still assume the previous OpenAI request shape or inspect the wrapper for implementation comments that now live in the core service.

## Flow traced

GraphQL AI chatbot resolver -> `restaurantChatbotReviewed.service.js` -> `restaurantChatbot.service.js` Gemini policy wrapper -> `restaurantChatbotCore.service.js` provider/context/persistence logic -> chatbot tests.

## Files to change

- `tests/services/restaurantChatbot.persistence.service.test.js`: assert Gemini history payload and Gemini response shape.
- `tests/services/restaurantChatbot.phase26-cache.service.test.js`: inspect `restaurantChatbotCore.service.js`, where user-specific context logic lives.
- `tests/services/restaurantChatbot.service.test.js`: assert safe context inside Gemini `systemInstruction`.

## Constraints

- Do not change production provider selection.
- Do not restore OpenAI environment fallback in the public wrapper.
- Preserve the original behavioral assertions: no duplicate current message, no caching of user-specific data, and no sensitive fields in provider context.
- Add no dependencies or helper abstraction.

## Acceptance criteria

1. The three previously failing tests pass against the current Gemini contract.
2. Tests still fail if message duplication, private-data caching, or prompt sanitization regresses.
3. Full backend test count has no failures caused by these files.

## Validation

```bash
npm run test -- --run \
  tests/services/restaurantChatbot.persistence.service.test.js \
  tests/services/restaurantChatbot.phase26-cache.service.test.js \
  tests/services/restaurantChatbot.service.test.js
npm run test
```

## Out of scope

- Changing Gemini/OpenAI provider policy.
- Refactoring `restaurantChatbotCore.service.js`.
- Changing chatbot behavior, prompts, caching, persistence, or GraphQL contracts.
