#!/usr/bin/env node
/**
 * API smoke checklist for the advanced review flow. It intentionally uses fetch
 * only, so it can run in this repo without installing Playwright/Cypress.
 *
 * Required env:
 *   GRAPHQL_URL=http://localhost:4000/graphql
 *   CUSTOMER_TOKEN=...
 *   MANAGER_TOKEN=...
 *   DEMO_RESTAURANT_ID=...
 */
const endpoint = process.env.GRAPHQL_URL || "http://localhost:4000/graphql";
const customerToken = process.env.CUSTOMER_TOKEN;
const managerToken = process.env.MANAGER_TOKEN;
const restaurantId = process.env.DEMO_RESTAURANT_ID;

const required = { CUSTOMER_TOKEN: customerToken, MANAGER_TOKEN: managerToken, DEMO_RESTAURANT_ID: restaurantId };
const missing = Object.entries(required).filter(([, value]) => !value).map(([key]) => key);
if (missing.length) {
  console.error(`Missing env: ${missing.join(", ")}`);
  process.exit(2);
}

async function gql(query, variables, token) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) throw new Error(JSON.stringify(json.errors || json, null, 2));
  return json.data;
}

const reviewTitle = `Smoke review ${new Date().toISOString()}`;
const created = await gql(`mutation CreateReview($input: ReviewInput!) { createReview(input: $input) { id status title } }`, {
  input: { targetType: "restaurant", targetId: restaurantId, restaurantId, rating: 2, title: reviewTitle, content: "Smoke test: món lên hơi chậm nhưng nhân viên hỗ trợ tốt." },
}, customerToken);
const reviewId = created.createReview.id;
console.log(`created pending review: ${reviewId}`);

const pending = await gql(`query Pending($restaurantId: ID!) { reviews(restaurantId: $restaurantId, status: "pending", limit: 20) { items { id title status } } }`, { restaurantId }, managerToken);
if (!pending.reviews.items.some((r) => r.id === reviewId)) throw new Error("Manager cannot see pending review");
console.log("manager sees pending review");

await gql(`mutation Approve($id: ID!) { setReviewStatus(id: $id, status: "published") { id status } }`, { id: reviewId }, managerToken);
const published = await gql(`query Published($restaurantId: ID!) { reviews(restaurantId: $restaurantId, status: "published", limit: 20) { items { id status } } }`, { restaurantId }, customerToken);
if (!published.reviews.items.some((r) => r.id === reviewId)) throw new Error("Published review is not visible");
console.log("published review visible");

await gql(`mutation Reply($input: ReviewCommentInput!) { createReviewComment(input: $input) { id officialReply } }`, { input: { reviewId, restaurantId, officialReply: true, content: "Cảm ơn bạn, nhà hàng đã ghi nhận và cải thiện tốc độ phục vụ." } }, managerToken);
const withReply = await gql(`query Review($id: ID!) { review(id: $id) { id firstOfficialReply { id content } } }`, { id: reviewId }, customerToken);
if (!withReply.review.firstOfficialReply?.id) throw new Error("Official reply missing");
console.log("official reply visible");

const report = await gql(`mutation Report($id: ID!) { reportReview(id: $id, input: { reason: "other", detail: "Smoke report" }) { id status } }`, { id: reviewId }, customerToken);
console.log(`report created: ${report.reportReview.id}`);
await gql(`mutation Resolve($id: ID!) { resolveReviewReport(id: $id, input: { status: "resolved", resolutionNote: "Smoke resolved" }) { id status } }`, { id: report.reportReview.id }, managerToken);
const analytics = await gql(`query Analytics($restaurantId: ID!) { reviewAnalytics(restaurantId: $restaurantId) { totalReviews actionQueueCounts { needsModeration needsReply highRisk } reviewInsightSummary { source summary } } }`, { restaurantId }, managerToken);
console.log("analytics ok", analytics.reviewAnalytics.actionQueueCounts, analytics.reviewAnalytics.reviewInsightSummary.source);
console.log("review flow smoke passed");
