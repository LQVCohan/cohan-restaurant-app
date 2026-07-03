# Cross-layer Thinking Guide

Use this guide before changing a feature or fixing a bug.

## Trace order

1. **Persistence**: find the Mongoose model, enum, index, sanitizer, and denormalized fields.
2. **Server**: follow GraphQL schema -> resolver -> shared service/guard -> authorization -> logging/realtime side effects.
3. **Client contract**: find the Apollo fragment, query or mutation, hook, optimistic response, cache update or refetch, and error mapping.
4. **User action**: follow the page/container -> modal/component -> click, submit, retry, or route action.
5. **Tests**: locate the closest existing backend, hook, component, and end-to-end tests.

## Root-cause rule

Fix the earliest shared boundary that is wrong. A shared model, sanitizer, authorization service, resolver helper, fragment, or mapper is usually a smaller and safer fix than repeating a workaround in every caller.

Do not add guards to multiple callers when one shared correction covers them correctly.

## Verification

Run the smallest test that proves the changed boundary and one real caller. Add schema validation, component tests, API tests, or Playwright only when the change crosses those layers.

Before writing, list the exact files to change and why. After writing, report changed line ranges and every validation command that did or did not run.
