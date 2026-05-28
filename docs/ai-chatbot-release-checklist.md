# AI Chatbot Release Checklist (Phase 20A)

## 1) Pre-deploy checklist

- [ ] Confirm backend deploy target has `OPENAI_API_KEY` set for production AI responses.
- [ ] Confirm chatbot model override is set intentionally:
  - `AI_CHATBOT_MODEL` (preferred chatbot-specific model)
  - `AI_MODEL` (fallback model key if chatbot-specific value is missing)
- [ ] Confirm `OPENAI_API_KEY` is **not** exposed in frontend env (`VITE_*`) or client bundles.
- [ ] Confirm at least one manager account can access AI chatbot manager pages (knowledge, suggestions, feedback, safety, evaluation, analytics).
- [ ] Confirm permission policies are active for:
  - `RESTAURANT_WRITE` (knowledge/safety/feedback bulk & import/export write flows)
  - report access permission (analytics)
- [ ] Confirm safety rules are seeded for the first production restaurant rollout.
- [ ] Confirm evaluation mode is only used through manager-only evaluation APIs and is non-persistent.
- [ ] Confirm rate-limit behavior is acceptable for launch traffic:
  - `askAiChatbot`
  - `requestAiChatbotHandoff`
  - `aiChatbotGuestReplies`
  - `sendAiChatbotGuestMessage`
  - realtime join policies used by chatbot channels
- [ ] Confirm fallback messages are reviewed for brand-safe wording when OpenAI is unavailable.

## 2) Post-deploy smoke checklist

### Public/guest flows

- [ ] `publicAiChatbotSettings` returns expected `enabled`, welcome message, starter quick replies, and handoff flags.
- [ ] `askAiChatbot` responds successfully for a safe general question.
- [ ] `askAiChatbot` response shape always includes GraphQL-safe arrays:
  - `quickReplies`
  - `actions`
  - `sources`
- [ ] Public feedback submit (`submitAiChatbotAnswerFeedback`) works for a guest-safe payload.
- [ ] Guest handoff follow-up APIs (`aiChatbotGuestReplies`, `sendAiChatbotGuestMessage`) behave with valid `conversationId + guestId`.

### Manager flows

- [ ] Manager can load and edit chatbot settings.
- [ ] Knowledge list/create/update/delete works for one test item.
- [ ] Knowledge import/export works for one valid small payload.
- [ ] Suggestion queue loads and one item can be dismiss/approve tested.
- [ ] Feedback queue loads and one item can be mark-reviewed/ignore tested.
- [ ] Safety rules list and CRUD works for one test rule.
- [ ] Evaluation APIs run without persisting chat side effects.
- [ ] Analytics query returns aggregate payload and rate-limit policy section.

## 3) Required verification steps

### Manager verification

1. Open manager AI chatbot pages.
2. Verify no unauthorized access errors for manager role.
3. Verify manager-only pages are not visible to guest/customer role.

### Guest widget verification

1. Open restaurant detail page with widget enabled.
2. Verify loading state resolves and starter quick replies render.
3. Ask a safe question and verify answer + actions rendering.
4. Trigger handoff request and verify guest polling/messages continue working.

### Safety rules verification

1. Add a temporary high-priority blocking rule in manager safety page.
2. Ask a matching prompt from guest widget.
3. Verify response is blocked/safe and AI provider is not required.
4. Remove temporary rule after test.

### Analytics verification

1. Run `aiChatbotAnalytics` for a restaurant after smoke traffic.
2. Verify top intents, messages by role, and quality queue load.
3. Verify analytics access fails for non-authorized role.

### Import/export verification

1. Export knowledge in JSON and CSV.
2. Import a small valid JSON payload.
3. Import malformed payload and verify validation error (safe failure).

### Evaluation playground verification

1. Run one `evaluateRestaurantAiChatbotPrompt` scenario.
2. Run one `runRestaurantAiChatbotEvaluationSet` scenario.
3. Verify no persisted conversation/message side effects are created from evaluation mode.

## 4) Rollback checklist

- [ ] If severe incident occurs, disable chatbot via settings (`enabled=false`) for impacted restaurant(s).
- [ ] If provider outage/quality issue occurs, keep chatbot enabled only if fallback quality is acceptable; otherwise disable via settings.
- [ ] Revert to last known good backend/frontend release artifact.
- [ ] Re-run post-deploy smoke checklist (public + manager) on rolled-back version.
- [ ] Verify manager-only boundaries and analytics permissions still enforced after rollback.

## 5) Troubleshooting guide

| Symptom | Likely cause | Immediate action |
|---|---|---|
| `askAiChatbot` errors for all requests | Missing/invalid `OPENAI_API_KEY` and fallback path failing due to unrelated runtime issue | Check backend env and server logs; verify fallback path with a basic prompt |
| High rate of `RATE_LIMITED` | Burst traffic or aggressive polling | Review chatbot rate-limit policies and client polling behavior |
| Analytics query denied for manager/staff | Missing report permission mapping | Validate role-permission assignment and `requirePermission` enforcement |
| Knowledge import fails | Invalid format/payload | Validate JSON/CSV payload shape and retry with minimal known-good sample |
| Safety rules appear ignored | Rule disabled or low priority | Confirm `enabled=true` and higher `priority` than conflicting rules |
| Evaluation run alters production chat data | Regression in evaluation-side-effect guard | Block rollout and run evaluation safety tests immediately |

## 6) Known non-blocking warnings

- Temporary OpenAI provider degradation may reduce answer quality while fallback remains functional.
- Analytics may lag immediately after deploy if low traffic volume exists.
- Empty knowledge base at rollout is acceptable if fallback and safety baselines are verified.

## Phase 22 universal assistant checklist

- [ ] Verify `OPENAI_API_KEY` / `GEMINI_API_KEY` are configured only on backend runtime and are not exposed via `VITE_*` frontend variables.
- [ ] Verify guest identity questions answer that the user is currently a guest.
- [ ] Verify authenticated identity questions expose only display name, email already visible in auth context, and role/user type.
- [ ] Verify own recent order/reservation summaries are scoped to the current authenticated user.
- [ ] Verify requests for another user's data, credentials, API keys, secrets, or non-authorized manager data are refused.
- [ ] Verify current page context is sent by the widget: `pathname`, `restaurantId`, selected menu item when available, user role, and feature-map matches.
- [ ] Verify deterministic fallback answers for identity, ordering, reservation, cart/orders/profile navigation, and menu recommendations when the AI provider is unavailable.
- [ ] Run targeted backend chatbot tests.
- [ ] Run targeted frontend chatbot tests.
- [ ] Run frontend build.
- [ ] Run backend build/typecheck script if available.

## Phase 22 route map validation notes

- Customer routes were verified against `src/routes/AppRouter.jsx`: `/`, `/restaurant/:id`, `/cus-menu`, `/food/:foodId`, `/checkout`, `/orders`, `/restaurant/:id/layout`, and `/profile`.
- Cart is not a standalone route; it is opened through the existing customer cart event/drawer using the safe `openCart` action.
- Manager/staff routes were verified against `src/routes/AppRouter.jsx` and `src/layouts/ManagerLayout.jsx`: `/manager`, `/manager#inventory`, `/manager#ai-chatbot-knowledge`, and `/staff/schedule`.
- Manager-only feature-map entries remain marked with `managerOnly=true` and are filtered by actual frontend role helpers before being sent as page context.

## Phase 23 query-aware assistant checklist

- [ ] Ask “đặt bàn ở đâu” from Home and verify Reservations/table booking is suggested.
- [ ] Ask “giỏ hàng đâu” and verify the safe `openCart` action opens the cart drawer/event.
- [ ] Ask “xem đơn hàng ở đâu” and verify `/orders` is suggested for customer-safe navigation.
- [ ] Ask “quản lý chatbot ở đâu” as a customer and verify manager-only links are hidden/refused.
- [ ] Ask “quản lý chatbot ở đâu” as manager/admin and verify the manager AI chatbot tools entry is available.
- [ ] Verify backend sanitization removes `javascript:`, `data:`, `mailto:`, malformed, external, and unknown feature actions before provider prompting.
- [ ] Verify ordering fallback lists all ordering steps and includes safe navigation/actions where available.
- [ ] Verify reservation fallback lists all booking steps and links to `/restaurant/:restaurantId/layout` when a restaurant is in context.
- [ ] Verify guest cart/order/reservation questions ask the user to log in instead of exposing private data.
- [ ] Verify provider prompts identify the bot as an AI App Assistant for Cohan Restaurant App and still require JSON-only, context-only, secret-safe answers.

## Phase 24 safe action cards checklist

- [ ] Backend deterministic actions render before provider actions and remain capped/deduplicated.
- [ ] Supported action types are only `link`, `openCart`, `handoff`, and `search`.
- [ ] Sanitization rejects `javascript:`, `data:`, `mailto:`, `tel:`, `//external`, unknown types, arbitrary JS functions, `add_to_cart_candidate`, destructive actions, payment auto-submit, checkout auto-submit, and reservation auto-create actions.
- [ ] Ordering questions show guided steps plus “Xem menu” and “Mở giỏ hàng”; `/checkout` is shown only after an authenticated cart exists.
- [ ] Reservation questions show “Mở trang đặt bàn” with `/restaurant/:id/layout` when restaurant context exists, otherwise “Chọn nhà hàng”.
- [ ] Logged-in users can see “Đơn hàng của tôi”, “Hồ sơ của tôi”, and “Giỏ hàng của tôi”; guests are not shown user-specific data claims.
- [ ] Manager actions are hidden from customer roles and shown only for allowed manager/admin/hr/accountant roles.
- [ ] Frontend action cards use `navigate()` for internal links, the existing cart event for `openCart`, the existing handoff mutation for `handoff`, and safe chatbot resubmission for `search`.
- [ ] Manual safety rule: the chatbot never auto-orders, auto-pays, auto-reserves, mutates profiles, or performs destructive actions.
