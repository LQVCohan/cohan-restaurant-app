# Defense handover seed

## Current behavior

Demo data is split across independent backend scripts. Scheduling creates operator accounts, customer management creates sample customers and orders, and menu/promotion scripts prepare their own domain data. There is no single repeatable command for a clean graduation-defense environment. Customer demo records also do not guarantee a password that can be used through the real login flow.

## Real flow

`User/Customer model -> login resolver and password/status checks -> GraphQL login mutation -> Login.jsx -> account verification route guard`.

The seed must therefore create an active user with a password hash, a valid role, the correct restaurant scope, and verified contact state instead of only inserting display data.

## Scope

- Reuse the existing permission, parent-role, role, scheduling, menu, promotion and customer seeds.
- Create or reuse one deterministic local defense restaurant.
- Normalize deterministic Admin, Manager, Customer and Staff accounts on every run.
- Add one root command: `npm run seed:defense`.
- Add installation, reset, account and defense-demo instructions under `handover/`.

## Constraints

- Local/development demo only; existing production-like seed protections remain active.
- No new dependency and no copied domain seed implementation.
- No real credential, `.env`, local database state, upload or generated report binary in Git.
- Seed must be repeatable and use one restaurant scope for the main demonstration.

## Acceptance criteria

1. `npm run seed:defense` runs the required seed scripts in dependency order.
2. `npm run seed:defense -- --reset` requests cleanup of supported demo records before rebuilding them.
3. Admin, Manager, Customer and Staff accounts are active, verified, password-authenticated and attached to the intended roles/scope.
4. The customer seed receives explicit confirmation and the selected restaurant ID.
5. A small unit test protects the step order and account contract.
6. `handover/README.md` contains install, run, seed, validation, database backup/restore and defense scenario instructions.
7. `handover/Account.md` documents local-only test accounts and password override behavior.

## Out of scope

- A production database dump.
- Provider credentials for payment, mail, SMS, maps or external AI.
- Replacing existing domain-specific seed scripts.
- Committing the generated thesis PDF to the source repository.
