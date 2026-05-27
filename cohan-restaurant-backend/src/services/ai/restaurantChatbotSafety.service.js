import mongoose from "mongoose";
import { AiChatbotSafetyRule } from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { requireRestaurantPermission } from "../auth/authorization.service.js";

const RULE_TYPES = new Set(["blocked_topic", "required_disclaimer", "handoff_topic", "allowed_scope"]);
const clean = (v, max) => String(v || "").trim().slice(0, max);
const toObjectId = (id) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const clampPriority = (v) => Math.min(100, Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0));
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toRuleDto = (row) => row ? { ...row, id: String(row._id || row.id || ""), restaurantId: row.restaurantId ? String(row.restaurantId) : "", enabled: row.enabled !== false, priority: Number(row.priority || 0), responseMessage: row.responseMessage || "" } : null;

const ensureAuth = (ctx) => { if (!ctx?.user?.id && !ctx?.user?._id) throw Object.assign(new Error("Cần đăng nhập"), { code: "UNAUTHENTICATED" }); };
const ensurePermission = async (ctx, restaurantId, permissionCode) => {
  ensureAuth(ctx);
  if (!mongoose.isValidObjectId(restaurantId)) throw Object.assign(new Error("restaurantId không hợp lệ"), { code: "BAD_USER_INPUT" });
  await requireRestaurantPermission(ctx, restaurantId, permissionCode);
};

const sanitizeRuleInput = (input = {}, { partial = false } = {}) => {
  const patch = {};
  if (!partial || input.ruleType != null) {
    const ruleType = clean(input.ruleType, 40);
    if (!RULE_TYPES.has(ruleType)) throw Object.assign(new Error("ruleType không hợp lệ"), { code: "BAD_USER_INPUT" });
    patch.ruleType = ruleType;
  }
  if (!partial || input.pattern != null) {
    const pattern = clean(input.pattern, 300);
    if (!pattern) throw Object.assign(new Error("pattern là bắt buộc"), { code: "BAD_USER_INPUT" });
    patch.pattern = pattern;
  }
  if (!partial || input.responseMessage != null) patch.responseMessage = clean(input.responseMessage, 1000);
  if (!partial || input.enabled != null) patch.enabled = input.enabled == null ? true : Boolean(input.enabled);
  if (!partial || input.priority != null) patch.priority = clampPriority(input.priority);
  return patch;
};

export async function listRestaurantAiChatbotSafetyRules({ restaurantId, filter = {}, ctx }) {
  await ensurePermission(ctx, restaurantId, PERMISSIONS.REPORT_READ);
  const q = { restaurantId: toObjectId(restaurantId) };
  if (filter.enabled != null) q.enabled = Boolean(filter.enabled);
  if (filter.ruleType && RULE_TYPES.has(filter.ruleType)) q.ruleType = filter.ruleType;
  if (filter.search) q.pattern = { $regex: escapeRegex(clean(filter.search, 80)), $options: "i" };
  const rows = await AiChatbotSafetyRule.find(q).sort({ priority: -1, updatedAt: -1 }).lean();
  return rows.map(toRuleDto);
}
export async function createRestaurantAiChatbotSafetyRule({ input, ctx }) {
  await ensurePermission(ctx, input?.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  const doc = await AiChatbotSafetyRule.create({
    restaurantId: toObjectId(input.restaurantId),
    ...sanitizeRuleInput(input),
    createdBy: toObjectId(ctx?.user?.id || ctx?.user?._id),
    updatedBy: toObjectId(ctx?.user?.id || ctx?.user?._id),
  });
  return toRuleDto(doc.toObject());
}
export async function updateRestaurantAiChatbotSafetyRule({ input, ctx }) {
  if (!mongoose.isValidObjectId(input?.id)) throw Object.assign(new Error("id không hợp lệ"), { code: "BAD_USER_INPUT" });
  const found = await AiChatbotSafetyRule.findById(input.id);
  if (!found) throw Object.assign(new Error("Không tìm thấy dữ liệu"), { code: "NOT_FOUND" });
  await ensurePermission(ctx, found.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  Object.assign(found, sanitizeRuleInput(input, { partial: true }), { updatedBy: toObjectId(ctx?.user?.id || ctx?.user?._id) });
  await found.save();
  return toRuleDto(found.toObject());
}
export async function deleteRestaurantAiChatbotSafetyRule({ id, ctx }) {
  if (!mongoose.isValidObjectId(id)) return false;
  const found = await AiChatbotSafetyRule.findById(id).lean();
  if (!found) return false;
  await ensurePermission(ctx, found.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  await AiChatbotSafetyRule.deleteOne({ _id: found._id });
  return true;
}

const ruleMatches = (pattern, text) => {
  const p = clean(pattern, 300).toLowerCase();
  const src = clean(text, 1200).toLowerCase();
  if (!p || !src) return false;
  if (src.includes(p)) return true;
  return new RegExp(escapeRegex(p), "i").test(src);
};

export async function evaluateRestaurantAiChatbotSafety({ restaurantId, message }) {
  const rid = toObjectId(restaurantId);
  if (!rid) return { blocked: false, handoffSuggested: false, disclaimers: [], matchedRules: [] };
  const rules = await AiChatbotSafetyRule.find({ restaurantId: rid, enabled: true }).sort({ priority: -1, updatedAt: -1 }).lean();
  const text = clean(message, 1200);
  const matched = rules.filter((r) => ruleMatches(r.pattern, text));
  const blocked = matched.find((r) => r.ruleType === "blocked_topic");
  const handoff = matched.find((r) => r.ruleType === "handoff_topic");
  const disclaimers = matched.filter((r) => r.ruleType === "required_disclaimer").map((r) => r.responseMessage || r.pattern).filter(Boolean);
  const allowedScope = rules.filter((r) => r.ruleType === "allowed_scope");
  const inScope = !allowedScope.length || allowedScope.some((r) => ruleMatches(r.pattern, text));
  const outOfScope = Boolean(allowedScope.length && !inScope);
  return {
    blocked: Boolean(blocked || outOfScope),
    blockedMessage: blocked?.responseMessage || "",
    handoffSuggested: Boolean(handoff || outOfScope),
    handoffMessage: handoff?.responseMessage || "",
    disclaimers,
    outOfScope,
    matchedRules: matched.map(toRuleDto),
  };
}
