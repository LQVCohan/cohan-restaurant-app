# Production readiness hardening audit

## Security changes
- Removed `x-user-id` payment identity bypass in frontend payment request headers.
- REST payment routes now resolve authenticated user from verified Bearer JWT and reject unauthenticated requests with 401.

## Env cleanup
- `.env.production` converted to safe example-style placeholders only.
- Removed dev-only `VITE_DEV_*` keys from production profile.
- `.env.example` clarified required frontend variables and optional map token.
- Added docs note that production env must be injected via hosting provider and never committed.

## Placeholder cleanup
- Hidden unfinished manager pages (`settings`, `rates`, `setting`, `backup`) from manager navigation/search/permission map.
- Replaced manager unknown-page fallback with Vietnamese message.
- Hidden unfinished storage allocation tab instead of showing placeholder text.
- Staff quick action `Tính lương` now navigates to real payroll page.

## TODO / alert cleanup
- Removed vague runtime TODO comments about ScheduleIncident and documented limitation in `docs/schedule-incident-roadmap.md`.
- Removed runtime "Tính năng đang phát triển" alert from staff quick actions.

## Remaining limitations
- ScheduleIncident service/model is intentionally deferred and documented for post-defense implementation.
- Many legacy `alert/confirm` calls still exist in other modules; this pass only addressed high-priority flows requested.

## Verification
- Run frontend/backend lint/test/build commands and record results in PR notes.
