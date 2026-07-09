# Validation

- Not run here: `node --check scripts/start-local-mongo.mjs` because validation requires the user's checkout after the GitHub update.
- Not run here: `npm run db` because this environment does not have Windows MongoDB installed.
- Not run here: `npm run db:test` because this environment cannot connect to the user's local MongoDB process.

Recommended local validation:

```bash
node --check scripts/start-local-mongo.mjs
npm run db
npm run db:test
```
