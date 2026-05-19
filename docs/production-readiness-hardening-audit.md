# Production readiness hardening audit

## Security changes
- Removed `x-user-id` payment identity bypass in frontend payment request headers.
- REST payment routes now resolve authenticated user from verified Bearer JWT and reject unauthenticated requests with 401.
- Frontend reservation payment creation sends the stored Bearer token instead of spoofable user headers.

## Env cleanup
- `.env.production` converted to safe example-style placeholders only.
- Removed dev-only `VITE_DEV_*` keys from production profile.
- `.env.example` clarified required frontend variables and optional map token.
- Added docs note that production env must be injected via hosting provider and never committed.

## Placeholder cleanup
- Replaced manager unknown-page fallback with Vietnamese message.
- Hidden unfinished storage allocation tab instead of showing placeholder text.
- Staff quick action `Tính lương` now navigates to real payroll page.
- Settings and backup are now real manager pages registered in the page map and exposed from the sidebar with `system.manage` permission.

## TODO / alert cleanup
- Removed vague runtime TODO comments about ScheduleIncident and documented limitation in `docs/schedule-incident-roadmap.md`.
- Removed runtime "Tính năng đang phát triển" alert from staff quick actions.
- Replaced review-management browser alerts/confirms with inline toast feedback and an in-app delete confirmation dialog.

## Remaining limitations
- ScheduleIncident service/model is intentionally deferred and documented for post-defense implementation.
- Order item return/void flows and menu inventory sync still contain browser prompt/confirm dialogs; these are operational workflows and should be migrated to dedicated modals in a later UX pass.

## Verification
- PR #602 CI completed frontend/backend lint, test, and build successfully before merge.
- After follow-up navigation updates, settings/backup are reachable through sidebar, hash navigation, search metadata, and renderContent.
