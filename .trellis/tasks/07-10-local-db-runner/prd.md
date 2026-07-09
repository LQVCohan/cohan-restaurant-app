# Add local MongoDB npm runner

## Current behavior

Local development requires developers to manually run `mongod.exe` from a full Windows path before starting the backend. When the terminal running MongoDB is closed, backend startup fails with `ECONNREFUSED 127.0.0.1:27017`.

## Root cause

The repository has `env:local` and backend DB connection checks, but no root-level npm command that starts a local MongoDB process with the expected local port and data directory.

## Flow traced

`package.json` scripts -> local MongoDB process -> `cohan-restaurant-backend/.env` `MONGO_URI` -> `config/db.js` `mongoose.connect()` -> backend startup / `scripts/test-db.js`.

## Scope

- Add a root-level `npm run db` command.
- Add one small Node script that starts local MongoDB without new dependencies.
- Reuse the existing backend `test:db` command for connection verification.

## Out of scope

- Restoring sample data.
- Installing MongoDB automatically.
- Changing backend schema/resolvers/frontend behavior.
- Managing production MongoDB or Atlas.

## Acceptance criteria

- `npm run db` starts `mongod` on `127.0.0.1:27017` using a local data directory.
- If MongoDB is already running on that port, the command exits successfully with a clear message.
- Windows installs under `C:\Program Files\MongoDB\Server\*\bin\mongod.exe` are discovered automatically.
- Developers can override the binary or data directory with environment variables.

## Validation plan

- `node --check scripts/start-local-mongo.mjs`
- `npm run db` on a Windows dev machine with MongoDB installed
- `npm run test:db --prefix cohan-restaurant-backend`
