#!/usr/bin/env node
/**
 * API smoke checklist for the advanced review flow. Uses only native fetch.
 *
 * Env for live mode:
 *   GRAPHQL_ENDPOINT or API_URL or GRAPHQL_URL=http://localhost:4000/graphql
 *   CUSTOMER_TOKEN=...
 *   MANAGER_TOKEN=...
 *   DEMO_RESTAURANT_ID=...
 *
 * Flags:
 *   --dry-run  Print env validation + planned steps without mutating data.
 *   --strict   Missing env exits 1 (otherwise dry-run guidance exits 0).
 */
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const strict = args.has("--strict");
const endpoint = process.env.GRAPHQL_ENDPOINT || process.env.API_URL || process.env.GRAPHQL_URL || "http://localhost:4000/graphql";
const env = {
  GRAPHQL_ENDPOINT: endpoint,
  CUSTOMER_TOKEN: process.env.CUSTOMER_TOKEN,
  MANAGER_TOKEN: process.env.MANAGER_TOKEN,
  DEMO_RESTAURANT_ID: process.env.DEMO_RESTAURANT_ID,
};
const requiredKeys = ["GRAPHQL_ENDPOINT", "CUSTOMER_TOKEN", "MANAGER_TOKEN", "DEMO_RESTAURANT_ID"];
const missing = requiredKeys.filter((key) => !env[key]);
const ids = {};
const steps = [
  "customer create review",
  "manager list pending",
  "manager approve",
  "customer/public list sees review",
  "manager official reply",
  "customer sees firstOfficialReply",
  "customer report",
  "manager resolves report",
  "analytics query returns counts",
];

const mark = (status, label, detail = "") => console.log(`${status} ${label}${detail ? ` — ${detail}` : ""}`);

function printGuidance() {
  console.log("Review smoke flow env:");
  requiredKeys.forEach((key) => console.log(`  ${key}=${env[key] ? "<set>" : "<missing>"}`));
  console.log("\nPlanned steps:");
  steps.forEach((step, idx) => console.log(`  ${idx + 1}. ${step}`));
  console.log("\nLive example:");
  console.log("  GRAPHQL_ENDPOINT=http://localhost:4000/graphql CUSTOMER_TOKEN=... MANAGER_TOKEN=... DEMO_RESTAURANT_ID=... node scripts/review-flow-smoke.mjs --strict");
  console.log("\nSafety: created title/content use [SMOKE] prefix. This script resolves reports but does not delete reviews unless a cleanup mutation is added later.");
}

if (dryRun) {
  printGuidance();
  process.exit(missing.length && strict ? 1 : 0);
}

if (missing.length) {
  mark("FAIL", `Missing env: ${missing.join(", ")}`);
  printGuidance();
  process.exit(strict ? 1 : 0);
}

async function gql(query, variables, token) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.errors?.length) throw new Error(JSON.stringify(json.errors || json, null, 2));
  return json.data;
}

async function runStep(label, fn) {
  try {
    const detail = await fn();
    mark("PASS", label, detail);
  } catch (error) {
    mark("FAIL", label, error?.message || String(error));
    if (Object.keys(ids).length) console.log("Created IDs:", ids);
    process.exitCode = 1;
    throw error;
  }
}

const stamp = new Date().toISOString();
const reviewTitle = `[SMOKE] Review flow ${stamp}`;
const smokeContent = `[SMOKE] Smoke test: món lên hơi chậm nhưng nhân viên hỗ trợ tốt. ${stamp}`;

await runStep("customer create review", async () => {
  const created = await gql(`mutation CreateReview($input: ReviewInput!) { createReview(input: $input) { id status title } }`, {
    input: { targetType: "restaurant", targetId: env.DEMO_RESTAURANT_ID, restaurantId: env.DEMO_RESTAURANT_ID, rating: 2, title: reviewTitle, content: smokeContent },
  }, env.CUSTOMER_TOKEN);
  ids.reviewId = created.createReview.id;
  return `reviewId=${ids.reviewId}, status=${created.createReview.status}`;
});

await runStep("manager list pending", async () => {
  const pending = await gql(`query Pending($restaurantId: ID!) { reviews(restaurantId: $restaurantId, status: "pending", limit: 20) { items { id title status } } }`, { restaurantId: env.DEMO_RESTAURANT_ID }, env.MANAGER_TOKEN);
  if (!pending.reviews.items.some((r) => r.id === ids.reviewId)) throw new Error("Manager cannot see pending review");
  return `pending contains reviewId=${ids.reviewId}`;
});

await runStep("manager approve", async () => {
  const approved = await gql(`mutation Approve($id: ID!) { setReviewStatus(id: $id, status: "published") { id status } }`, { id: ids.reviewId }, env.MANAGER_TOKEN);
  if (approved.setReviewStatus.status !== "published") throw new Error("Review was not published");
  return "status=published";
});

await runStep("customer/public list sees review", async () => {
  const published = await gql(`query Published($restaurantId: ID!) { reviews(restaurantId: $restaurantId, status: "published", limit: 20) { items { id status } } }`, { restaurantId: env.DEMO_RESTAURANT_ID }, env.CUSTOMER_TOKEN);
  if (!published.reviews.items.some((r) => r.id === ids.reviewId)) throw new Error("Published review is not visible");
  return `visible reviewId=${ids.reviewId}`;
});

await runStep("manager official reply", async () => {
  const reply = await gql(`mutation Reply($input: ReviewCommentInput!) { createReviewComment(input: $input) { id officialReply } }`, { input: { reviewId: ids.reviewId, restaurantId: env.DEMO_RESTAURANT_ID, officialReply: true, content: "[SMOKE] Cảm ơn bạn, nhà hàng đã ghi nhận và cải thiện tốc độ phục vụ." } }, env.MANAGER_TOKEN);
  ids.replyId = reply.createReviewComment.id;
  return `replyId=${ids.replyId}`;
});

await runStep("customer sees firstOfficialReply", async () => {
  const withReply = await gql(`query Review($id: ID!) { review(id: $id) { id firstOfficialReply { id content } } }`, { id: ids.reviewId }, env.CUSTOMER_TOKEN);
  if (!withReply.review.firstOfficialReply?.id) throw new Error("Official reply missing");
  return `firstOfficialReply=${withReply.review.firstOfficialReply.id}`;
});

await runStep("customer report", async () => {
  const report = await gql(`mutation Report($id: ID!) { reportReview(id: $id, input: { reason: "other", detail: "[SMOKE] Smoke report" }) { id status } }`, { id: ids.reviewId }, env.CUSTOMER_TOKEN);
  ids.reportId = report.reportReview.id;
  return `reportId=${ids.reportId}`;
});

await runStep("manager resolves report", async () => {
  const resolved = await gql(`mutation Resolve($id: ID!) { resolveReviewReport(id: $id, input: { status: "resolved", resolutionNote: "[SMOKE] Smoke resolved" }) { id status } }`, { id: ids.reportId }, env.MANAGER_TOKEN);
  if (resolved.resolveReviewReport.status !== "resolved") throw new Error("Report was not resolved");
  return "status=resolved";
});

await runStep("analytics query returns counts", async () => {
  const analytics = await gql(`query Analytics($restaurantId: ID!) { reviewAnalytics(restaurantId: $restaurantId) { totalReviews actionQueueCounts { needsModeration needsReply highRisk } reviewInsightSummary { source summary } } }`, { restaurantId: env.DEMO_RESTAURANT_ID }, env.MANAGER_TOKEN);
  return `total=${analytics.reviewAnalytics.totalReviews}, insight=${analytics.reviewAnalytics.reviewInsightSummary?.source || "none"}`;
});

console.log("Created IDs:", ids);
mark("PASS", "review flow smoke passed");
