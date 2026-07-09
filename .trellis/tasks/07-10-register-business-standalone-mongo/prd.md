# Fix business owner registration on standalone MongoDB

## Current behavior

Creating a business account through the brand registration form can fail with:

> Transaction numbers are only allowed on a replica set member or mongos

The first fix stopped `registerBusinessOwner` from using MongoDB transactions on standalone MongoDB, but the error can still appear because retryable writes also send a transaction number. Local standalone MongoDB rejects those writes.

## Flow traced

- Mongoose/schema: `User`, `Brand`, `BrandMembership`, `Restaurant`.
- DB connection: `cohan-restaurant-backend/config/db.js` builds the Mongoose connection options.
- Resolver/service: `Mutation.registerBusinessOwner` in `cohan-restaurant-backend/graphql/resolvers/brand/index.js` creates the business owner, brand, membership and first restaurant.
- GraphQL contract: `RegisterBusinessOwnerInput` / `registerBusinessOwner` in `cohan-restaurant-backend/graphql/schema/brand.graphql`.
- Frontend operation: `REGISTER_BUSINESS_OWNER` mutation and `handleBrandRegister` in `src/components/Login.jsx`.
- Tests: no existing targeted test for this mutation was found by repository search.

## Scope

Fix the backend root cause so business registration works on standalone MongoDB while keeping the schema and frontend contract unchanged.

## Acceptance criteria

- The business registration resolver must not call `withTransaction` on standalone MongoDB.
- The MongoDB connection must not use retryable writes by default, so local standalone MongoDB does not receive transaction numbers for normal writes.
- Deployments that need retryable writes can opt in with `MONGO_RETRY_WRITES=true`.
- The GraphQL schema and frontend mutation shape stay unchanged.
- The change should touch the fewest files necessary.

## Out of scope

- Reworking all repository transaction call sites.
- Adding new dependencies or changing MongoDB deployment configuration.
