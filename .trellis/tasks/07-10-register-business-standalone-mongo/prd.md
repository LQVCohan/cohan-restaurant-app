# Fix business owner registration on standalone MongoDB

## Current behavior

Creating a business account through the brand registration form can fail with:

> Transaction numbers are only allowed on a replica set member or mongos

The resolver starts a MongoDB transaction for `registerBusinessOwner`. That works on replica set / mongos deployments, but local standalone MongoDB does not support transactions.

## Flow traced

- Mongoose/schema: `User`, `Brand`, `BrandMembership`, `Restaurant`.
- Resolver/service: `Mutation.registerBusinessOwner` in `cohan-restaurant-backend/graphql/resolvers/brand/index.js`.
- GraphQL contract: `RegisterBusinessOwnerInput` / `registerBusinessOwner` in `cohan-restaurant-backend/graphql/schema/brand.graphql`.
- Frontend operation: `REGISTER_BUSINESS_OWNER` mutation and `handleBrandRegister` in `src/components/Login.jsx`.
- Tests: no existing targeted test for this mutation was found by repository search.

## Scope

Fix the backend root cause so business registration works on standalone MongoDB while keeping transactions on replica set / mongos deployments.

## Acceptance criteria

- The business registration resolver must not call `withTransaction` on standalone MongoDB.
- Replica set / mongos deployments should keep transactional behavior.
- The GraphQL schema and frontend mutation shape stay unchanged.
- The change should touch the fewest files necessary.

## Out of scope

- Reworking all repository transaction call sites.
- Adding new dependencies or changing MongoDB deployment configuration.
