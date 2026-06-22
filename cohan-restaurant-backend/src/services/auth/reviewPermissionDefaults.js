export const REVIEW_ROLE_PERMISSION_DEFAULTS = Object.freeze({
  manager: [
    "review.read",
    "review.reply",
    "review.moderate",
    "review.delete",
    "review.report.read",
    "review.report.resolve",
    "review.export",
    "review.analytics.read",
  ],
  staff: ["review.read", "review.reply"],
  supervisor: [
    "review.read",
    "review.reply",
    "review.moderate",
    "review.report.read",
  ],
});
