# COHAN Backend Specification

## Scope

Applies to `cohan-restaurant-backend/`, GraphQL schema/resolvers, Mongoose models, services, guards, Socket.IO events, and backend tests.

## Pre-development checklist

- Identify the Mongoose model and GraphQL schema fields involved.
- Trace query/mutation -> resolver -> service/guard -> database and side effects.
- Check restaurant scoping and the exact permission constant used by sibling operations.
- Search all callers before changing a shared service, sanitizer, enum, or payload shape.
- Confirm whether audit logging, notifications, or realtime events are required.

## Contract rules

- GraphQL schema, resolver return shape, frontend fragment, and optimistic response must agree.
- Validate IDs, input boundaries, URLs, uploaded assets, and enum values at the server boundary.
- Do not trust restaurantId, userId, role, or ownership values supplied by the client.
- Keep authorization in shared authorization services where existing patterns already route.
- Prefer one shared root-cause guard over duplicated resolver checks.
- Preserve explicit GraphQL error codes used by the frontend.

## Data rules

- Reuse `BaseSchemaModel` and existing schema conventions.
- Add indexes only for demonstrated query or uniqueness requirements.
- Avoid denormalized fields unless an existing read path needs them; update every mutation path when denormalization is required.
- Never store secrets, raw access tokens, or unbounded client-controlled objects.

## Quality check

- Add or update the smallest resolver/service test that fails without the change.
- Run targeted backend tests and GraphQL schema validation.
- Confirm no permission, restaurant-scope, audit-log, or realtime regression was introduced.
