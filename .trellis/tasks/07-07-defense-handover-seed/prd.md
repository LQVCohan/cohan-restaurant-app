# Reusable demo data and local setup documentation

## Current behavior

Demo data is split across independent backend scripts. Scheduling creates operator accounts, customer management creates sample customers and orders, and menu/promotion scripts prepare their own domain data. A deterministic seed command and a MongoDB archive are used to provide one repeatable local dataset.

The archive now exists at `handover/database/cohan-defense.archive.gz`, but the documentation still has three inconsistencies:

- the root README says the archive will be added later instead of confirming it is included;
- `handover/Account.md` sends readers to another file for the password instead of stating the local demo password directly;
- `handover/database/README.md` still uses the old example database name `RestaurantDB_DefenseTest` and says the archive has not been created.

## Real flow

`Clone repository -> install frontend/backend dependencies -> create local env -> restore RestaurantDB archive -> start backend/frontend -> sign in with a documented demo account`.

For account creation and authentication, the implementation flow remains:

`User/Customer model -> login resolver and password/status checks -> GraphQL login mutation -> Login.jsx -> account verification route guard`.

## Scope

- Reuse the existing permission, parent-role, role, scheduling, menu, promotion and customer seeds.
- Maintain one deterministic local demo dataset and the root command `npm run seed:defense`.
- Keep the committed archive at `handover/database/cohan-defense.archive.gz` as the primary sample-data path for new users.
- Make `README.md`, `handover/README.md`, `handover/Account.md` and `handover/database/README.md` consistent with the actual repository state.
- Document the real source database name `RestaurantDB`.

## Constraints

- Local/development demo only; production-like seed protections remain active.
- No new dependency and no copied domain seed implementation.
- No Atlas URI, real credential, `.env`, token or provider key in Git.
- Do not modify the database archive in the documentation-only follow-up.
- Keep the instructions usable by any person cloning the repository, not only a defense reviewer.

## Acceptance criteria

1. `npm run seed:defense` and `npm run seed:defense -- --reset` remain documented as optional developer tools.
2. The root README includes clone, dependency installation, env creation and links to restore/run instructions.
3. The root README states that the sample database archive is already included.
4. `handover/Account.md` lists the shared local demo password directly with the Admin and Customer accounts.
5. `handover/database/README.md` exports and restores `RestaurantDB` and no longer mentions the obsolete `RestaurantDB_DefenseTest` example.
6. No document says that the archive still needs to be created or added.
7. No source code, schema, seed logic or database binary changes in this follow-up.

## Validation plan

- Fetch the final Markdown files from the branch and verify the links, paths, commands and account values.
- Compare the branch with `main` to confirm only task metadata and the three documentation files changed.
- No build or runtime test is required for Markdown-only changes; archive restore/login verification remains a separate manual check.

## Out of scope

- Changing the contents of `cohan-defense.archive.gz`.
- Provider credentials for payment, mail, SMS, maps or external AI.
- Replacing existing domain-specific seed scripts.
- Adding generated thesis/report files.
