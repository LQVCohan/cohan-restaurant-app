# AI Chatbot Staging Verification Preparation Report (Phase 20B)

Date: 2026-05-27 (UTC)
Repository: `LQVCohan/cohan-restaurant-app`
Scope: AI chatbot staging-verification preparation only (prerequisites + blockers), no unrelated auth/token or non-chatbot feature work


## 0) PR scope clarification

This PR is a **staging verification preparation report**, not a completed staging runtime verification.

- It captures deployment/env prerequisites and explicit blockers.
- It records local AI-chatbot test/build readiness evidence.
- It does **not** claim runtime checklist completion because no staging URL/credentials/access were provided in this execution environment.

## 1) Deployment/staging target inspected

Inspected repository deployment-related artifacts:

- Root `README.md` (local dev runbook + docs links).
- Root `package.json` and backend `cohan-restaurant-backend/package.json` scripts.
- Existing AI release readiness doc: `docs/ai-chatbot-release-checklist.md`.
- Env docs and templates: `docs/environment/setup.md`, `.env.example`, `.env.production`.

### Findings

- No explicit staging IaC or deployment descriptor files were found in-repo (no Dockerfile/docker-compose, no `.github/workflows`, no Vercel/Render/Railway/Fly/Netlify config checked into this repository).
- Current repository provides app build/test scripts and environment templates, but staging host wiring appears to be managed externally (platform config and secrets outside Git).

## 2) Staging environment requirements confirmation

Verified/compiled required chatbot values from existing docs/templates.

### Required endpoints/config

- Frontend API URL: `VITE_API_URL` (GraphQL endpoint).
- Frontend websocket URL: `VITE_API_WS` (GraphQL WS endpoint).
- Backend API base/GraphQL URL: must correspond to deployed backend endpoint consumed by `VITE_API_URL`.
- `OPENAI_API_KEY` (server-side only, must not be exposed as `VITE_*`).
- `AI_CHATBOT_MODEL` or `AI_MODEL` (model selection fallback chain documented).
- Database connection: backend `MONGO_URI` required for chatbot settings/knowledge/safety/feedback persistence.

### Access and test data prerequisites

- At least one manager account with chatbot manager page access.
- Test restaurant ID available for manager and public widget smoke flows.
- Chatbot enabled setting for selected restaurant (`enabled=true` for runtime verification).
- Permission prerequisites for smoke:
  - `RESTAURANT_WRITE` for chatbot write/bulk/import-export operations.
  - report/analytics permission for chatbot analytics access.

## 3) Pre-staging checks (local CI-equivalent)

Executed targeted chatbot checks to reduce staging risk before runtime smoke.

### Commands and results

1. Frontend chatbot targeted tests
   - `npm run test:frontend -- src/components/common/AiChatbotWidget.test.jsx src/components/common/AiChatbotWidget.basic.test.jsx src/components/common/AiChatbotWidget.helpers.test.jsx src/components/common/AiChatbotWidget.handoff.test.jsx src/components/Dashboard_Manager/Customer/AiChatbotKnowledgePage.test.jsx src/components/Dashboard_Manager/Customer/AiChatbotAnalyticsPage.test.jsx`
   - Result: **PASS** (all targeted suites passed).
   - Note: non-blocking React `act(...)` warnings observed in `AiChatbotKnowledgePage.test.jsx` output.

2. Backend chatbot targeted tests
   - `npm run test:backend -- cohan-restaurant-backend/tests/services/restaurantChatbot.service.test.js cohan-restaurant-backend/tests/services/restaurantChatbot.settings.service.test.js cohan-restaurant-backend/tests/services/restaurantChatbot.knowledge.service.test.js cohan-restaurant-backend/tests/services/restaurantChatbot.feedback.service.test.js cohan-restaurant-backend/tests/services/restaurantChatbot.safety.service.test.js cohan-restaurant-backend/tests/services/restaurantChatbot.bulk-ops.service.test.js cohan-restaurant-backend/tests/services/aiChatbot.schema.safety.test.js`
   - Result: **PASS** (39/39 tests passed).
   - Note: Mongoose duplicate-index warnings appeared, non-blocking for this chatbot verification phase.

3. Frontend build
   - `npm run build`
   - Result: **PASS**.
   - Notes: Sass `@import` deprecation warnings and Vite large chunk warnings observed (non-chatbot blocker for this phase).

4. Backend build step
   - `npm run build --prefix cohan-restaurant-backend`
   - Result: **PASS** (`Backend build step: no transpilation required.`).

## 4) Staging runtime smoke verification checklist (blocked)

### Execution status

- **Staging runtime smoke could not be executed from this repository-only environment** because no concrete staging URL, credentials, or deploy environment access was available in the provided context.
- Therefore, items below are recorded as `NOT EXECUTED` (blocked by missing staging target access), not as pass/fail of feature behavior.

### Public/guest chatbot smoke

- `publicAiChatbotSettings` loads: **NOT EXECUTED**.
- `askAiChatbot` safe question answer: **NOT EXECUTED**.
- response arrays (`quickReplies`, `actions`, `sources`) shape check: **NOT EXECUTED**.
- safety-blocked prompt returns safe/blocked response: **NOT EXECUTED**.
- safety-blocked prompt does not require AI provider: **NOT EXECUTED**.
- feedback submit works: **NOT EXECUTED**.
- handoff flow works (if enabled): **NOT EXECUTED**.

### Manager chatbot smoke

- manager pages open + settings load: **NOT EXECUTED**.
- knowledge list/create/update/delete: **NOT EXECUTED**.
- import JSON/CSV + export JSON/CSV: **NOT EXECUTED**.
- suggestions list + bulk dismiss/delete: **NOT EXECUTED**.
- feedback list + bulk review/ignore/convert: **NOT EXECUTED**.
- safety CRUD + bulk enable/disable/delete: **NOT EXECUTED**.
- evaluation playground run + run set: **NOT EXECUTED**.
- analytics risky signals + recent quality queue load: **NOT EXECUTED**.

### Permission boundary smoke

- guest denied manager APIs: **NOT EXECUTED**.
- analytics requires report permission: **NOT EXECUTED**.
- import/export permission enforcement: **NOT EXECUTED**.
- bulk ops require `RESTAURANT_WRITE`: **NOT EXECUTED**.

## 5) Bugs found and fixes

### Bugs fixed in this phase

- None in application code (no staging runtime available to reproduce runtime defects).

### Bugs found but not fixed

- None confirmed as chatbot defects in staging runtime.

### Non-blocking warnings observed during local verification

- React test `act(...)` warnings in knowledge page test logs.
- Mongoose duplicate-index warnings in backend tests.
- Sass/Vite build warnings not specific to chatbot correctness.

## 6) Rollback recommendation

If chatbot staging/production smoke later uncovers severe issue:

1. Disable chatbot per restaurant via chatbot settings (`enabled=false`) as immediate containment.
2. Keep manager permission boundaries intact while triaging.
3. Revert backend/frontend artifact to last known good release.
4. Re-run full chatbot smoke checklist before re-enabling.

## 7) Final production readiness recommendation

**Recommendation: NOT READY for production sign-off yet (staging runtime smoke not executed).**

Reason:
- Code-level targeted chatbot tests and builds are healthy,
- but required **staging/prod-like runtime smoke evidence is incomplete** because no reachable staging target/credentials were provided in this phase context.

## 8) Required follow-up to complete Phase 20B

Once staging target and test credentials are available, execute the release checklist runtime smoke exactly once and append:

- staging URL/environment identifier,
- test restaurant ID (non-secret),
- manager test account role (non-secret),
- per-check pass/fail evidence,
- blocker list + fix references (if any).
