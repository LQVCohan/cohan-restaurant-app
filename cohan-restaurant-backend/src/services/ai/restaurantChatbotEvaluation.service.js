import mongoose from "mongoose";
import { AiChatbotEvaluationCase } from "../../../models/index.js";
import { handleRestaurantChatbotMessage } from "./restaurantChatbot.service.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { requireRestaurantPermission } from "../auth/authorization.service.js";

const ensureAuth = (ctx) => { if (!ctx?.user) { const e = new Error("UNAUTHORIZED"); e.code = "UNAUTHORIZED"; throw e; } };
const asObjId = (id) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const userIdFromCtx = (ctx) => asObjId(ctx?.user?._id || ctx?.user?.id);

const asString = (v, n = 0) => String(v || "").trim().slice(0, n || undefined);
const normalizeTags = (tags) => (Array.isArray(tags) ? tags : []).map((t) => asString(t, 40)).filter(Boolean).slice(0, 10);

const toEvaluationCaseDto = (row) => {
  if (!row) return null;
  return {
    ...row,
    id: String(row._id || row.id || ""),
    restaurantId: row.restaurantId ? String(row.restaurantId) : "",
    question: asString(row.question, 500),
    expectedBehavior: asString(row.expectedBehavior, 1000),
    category: asString(row.category, 80),
    tags: normalizeTags(row.tags),
    enabled: row.enabled !== false,
    createdBy: row.createdBy ? String(row.createdBy) : null,
    updatedBy: row.updatedBy ? String(row.updatedBy) : null,
  };
};

const sanitizeCaseInput = (input, { partial = false } = {}) => {
  const question = asString(input?.question, 500);
  if (!partial && !question) { const e = new Error("BAD_USER_INPUT: question is required"); e.code = "BAD_USER_INPUT"; throw e; }
  const payload = {};
  if (!partial || input?.question !== undefined) payload.question = question;
  if (!partial || input?.expectedBehavior !== undefined) payload.expectedBehavior = asString(input?.expectedBehavior, 1000);
  if (!partial || input?.category !== undefined) payload.category = asString(input?.category, 80);
  if (!partial || input?.tags !== undefined) payload.tags = normalizeTags(input?.tags);
  if (!partial || input?.enabled !== undefined) payload.enabled = input?.enabled !== false;
  return payload;
};

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
  const rows = await AiChatbotEvaluationCase.find({ restaurantId: asObjId(restaurantId), enabled: { $in: [true, false] } }).sort({ updatedAt: -1 }).lean();
  return rows.map(toEvaluationCaseDto);
};

export const createRestaurantAiChatbotEvaluationCase = async ({ input, ctx }) => {
  ensureAuth(ctx); await requireRestaurantPermission(ctx, input?.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  const uid = userIdFromCtx(ctx);
  const payload = sanitizeCaseInput(input, { partial: false });
  const created = await AiChatbotEvaluationCase.create({ ...payload, restaurantId: asObjId(input.restaurantId), createdBy: uid, updatedBy: uid });
  return toEvaluationCaseDto(created);
};
export const updateRestaurantAiChatbotEvaluationCase = async ({ input, ctx }) => {
  ensureAuth(ctx);
  const row = await AiChatbotEvaluationCase.findById(input?.id); if (!row) return null;
  await requireRestaurantPermission(ctx, row.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  Object.assign(row, { ...sanitizeCaseInput(input, { partial: true }), updatedBy: userIdFromCtx(ctx) });
  await row.save();
  return toEvaluationCaseDto(row);
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
    results.push({ ...out, caseId: String(c._id), question: c.question, expectedBehavior: c.expectedBehavior || null, category: c.category || null, tags: Array.isArray(c.tags) ? c.tags : [], debug: input?.includeDebug ? { evaluationMode: true } : null });
  }
  return results;
};
