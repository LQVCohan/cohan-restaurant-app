import mongoose from "mongoose";
import { AiChatbotEvaluationCase } from "../../../models/index.js";
import { handleRestaurantChatbotMessage } from "./restaurantChatbot.service.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { requireRestaurantPermission } from "../auth/authorization.service.js";

const ensureAuth = (ctx) => { if (!ctx?.user) { const e = new Error("UNAUTHORIZED"); e.code = "UNAUTHORIZED"; throw e; } };
const asObjId = (id) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const userIdFromCtx = (ctx) => asObjId(ctx?.user?._id || ctx?.user?.id);

const ensureReadEvaluationPermission = async (ctx, restaurantId) => {
  ensureAuth(ctx);
  try { await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.REPORT_READ); }
  catch { await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.RESTAURANT_WRITE); }
};

export const evaluateRestaurantAiChatbotPrompt = async ({ input, ctx }) => {
  const restaurantId = input?.restaurantId;
  const message = String(input?.message || "").trim();
  if (!restaurantId || !message) { const e = new Error("BAD_USER_INPUT: restaurantId and message are required"); e.code = "BAD_USER_INPUT"; throw e; }
  await ensureReadEvaluationPermission(ctx, restaurantId);

  const out = await handleRestaurantChatbotMessage({ message, restaurantId, history: input?.history || [], user: ctx?.user || null, persist: false, recordSuggestions: false, evaluationMode: true });
  return { ...out, caseId: null, question: message, debug: input?.includeDebug ? { historyUsed: (input?.history || []).map((h) => String(h?.content || "")), evaluationMode: true } : null };
};

export const listRestaurantAiChatbotEvaluationCases = async ({ restaurantId, ctx }) => {
  await ensureReadEvaluationPermission(ctx, restaurantId);
  return AiChatbotEvaluationCase.find({ restaurantId: asObjId(restaurantId), enabled: { $in: [true, false] } }).sort({ updatedAt: -1 }).lean();
};

export const createRestaurantAiChatbotEvaluationCase = async ({ input, ctx }) => {
  ensureAuth(ctx); await requireRestaurantPermission(ctx, input?.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  const uid = userIdFromCtx(ctx);
  return AiChatbotEvaluationCase.create({ ...input, restaurantId: asObjId(input.restaurantId), createdBy: uid, updatedBy: uid });
};
export const updateRestaurantAiChatbotEvaluationCase = async ({ input, ctx }) => {
  ensureAuth(ctx);
  const row = await AiChatbotEvaluationCase.findById(input?.id); if (!row) return null;
  await requireRestaurantPermission(ctx, row.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  Object.assign(row, { ...input, updatedBy: userIdFromCtx(ctx) }); await row.save(); return row;
};
export const deleteRestaurantAiChatbotEvaluationCase = async ({ id, ctx }) => {
  ensureAuth(ctx);
  const row = await AiChatbotEvaluationCase.findById(id); if (!row) return false;
  await requireRestaurantPermission(ctx, row.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  await AiChatbotEvaluationCase.deleteOne({ _id: row._id }); return true;
};

export const runRestaurantAiChatbotEvaluationSet = async ({ input, ctx }) => {
  const restaurantId = input?.restaurantId;
  await ensureReadEvaluationPermission(ctx, restaurantId);
  const filter = { restaurantId: asObjId(restaurantId), enabled: true };
  if (Array.isArray(input?.caseIds) && input.caseIds.length) filter._id = { $in: input.caseIds.filter((x) => mongoose.isValidObjectId(x)).map((x) => new mongoose.Types.ObjectId(x)) };
  const cases = await AiChatbotEvaluationCase.find(filter).sort({ updatedAt: -1 }).lean();
  const results = [];
  for (const c of cases) {
    const out = await handleRestaurantChatbotMessage({ message: c.question, restaurantId, user: ctx?.user || null, persist: false, recordSuggestions: false, evaluationMode: true });
    results.push({ ...out, caseId: String(c._id), question: c.question, expectedBehavior: c.expectedBehavior || null, category: c.category || null, tags: c.tags || [], debug: input?.includeDebug ? { evaluationMode: true } : null });
  }
  return results;
};
