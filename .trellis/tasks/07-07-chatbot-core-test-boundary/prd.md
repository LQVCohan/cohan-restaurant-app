# Restore chatbot core test boundary

## Current behavior

The production chatbot entrypoint correctly enforces Gemini. Its exported `__testables.callAiProvider` also enforces that policy, so provider-specific core tests can no longer control `AI_PROVIDER` and no longer test the core provider fallback behavior they were written for.

## Root cause

A production policy wrapper was applied to a test-only export. The public `handleRestaurantChatbotMessage` and the internal core test boundary have different responsibilities.

## Flow

1. GraphQL and reviewed chatbot services call `handleRestaurantChatbotMessage`.
2. The public entrypoint enforces Gemini and delegates to `restaurantChatbotCore.service.js`.
3. Unit tests consume `__testables` to validate core normalization, fallback, and safety logic.

## Change

- Keep Gemini enforcement on `handleRestaurantChatbotMessage`.
- Re-export the core `__testables` unchanged instead of wrapping `callAiProvider`.

## Acceptance criteria

- Production chatbot calls remain Gemini-only.
- Core tests can set provider environment values without the test helper overriding them.
- No schema, resolver, UI, persistence, permission, or runtime behavior changes.

## Validation

- Backend chatbot service tests.
- Backend lint, full test suite, Menu RBAC check, and build in CI.
