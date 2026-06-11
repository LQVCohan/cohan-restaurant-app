import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./AiChatbotAdmin.scss";

const AI_PERMISSIONS = {
  read: "ai.chatbot.read",
  write: "ai.chatbot.write",
  moderate: "ai.chatbot.moderate",
  evaluate: "ai.chatbot.evaluate",
};

const SOURCE_TYPES = ["manual", "faq", "policy", "suggestion"];
const RULE_TYPES = ["blocked_topic", "required_disclaimer", "handoff_topic", "allowed_scope"];
const TABS = ["knowledge", "suggestions", "feedback", "safety", "evaluation"];
const TAB_LABELS = {
  knowledge: "Tri thức",
  suggestions: "Gợi ý",
  feedback: "Phản hồi",
  safety: "An toàn",
  evaluation: "Đánh giá",
};

const KNOWLEDGE_QUERY = gql`
  query ManagerAiKnowledge($restaurantId: ID!, $filter: AiChatbotKnowledgeFilterInput) {
    restaurantAiChatbotKnowledge(restaurantId: $restaurantId, filter: $filter) {
      id title content category tags enabled priority sourceType createdAt updatedAt
    }
  }
`;
const SUGGESTIONS_QUERY = gql`
  query ManagerAiKnowledgeSuggestions($restaurantId: ID!, $filter: AiChatbotKnowledgeSuggestionFilterInput) {
    restaurantAiChatbotKnowledgeSuggestions(restaurantId: $restaurantId, filter: $filter) {
      id question suggestedTitle suggestedContent category tags triggerType confidence status occurrenceCount lastAskedAt createdAt
    }
  }
`;
const FEEDBACK_QUERY = gql`
  query ManagerAiFeedback($restaurantId: ID!, $filter: AiChatbotAnswerFeedbackFilterInput) {
    restaurantAiChatbotAnswerFeedback(restaurantId: $restaurantId, filter: $filter) {
      id question answer rating reason tags sourceTypes confidence status createdAt
    }
  }
`;
const SAFETY_QUERY = gql`
  query ManagerAiSafetyRules($restaurantId: ID!, $filter: AiChatbotSafetyRuleFilterInput) {
    restaurantAiChatbotSafetyRules(restaurantId: $restaurantId, filter: $filter) {
      id ruleType pattern responseMessage enabled priority createdAt updatedAt
    }
  }
`;
const EVALUATION_CASES_QUERY = gql`
  query ManagerAiEvaluationCases($restaurantId: ID!) {
    restaurantAiChatbotEvaluationCases(restaurantId: $restaurantId) {
      id question expectedBehavior category tags enabled createdAt updatedAt
    }
  }
`;
const EXPORT_QUERY = gql`
  query ExportManagerAiKnowledge($restaurantId: ID!, $format: String) {
    exportRestaurantAiChatbotKnowledge(restaurantId: $restaurantId, format: $format)
  }
`;
const EVALUATE_QUERY = gql`
  query EvaluateManagerAiPrompt($input: EvaluateAiChatbotPromptInput!) {
    evaluateRestaurantAiChatbotPrompt(input: $input) {
      caseId question expectedBehavior category tags answer intent confidence isFallback handoffSuggested handoffReason handoffMessage quickReplies
      knowledgeMatches { id title category sourceType score }
      safetyResult { blocked outOfScope disclaimers handoffSuggested matchedRuleIds }
      sources { type id label status isAvailable formattedPrice }
    }
  }
`;
const RUN_SET_QUERY = gql`
  query RunManagerAiEvaluationSet($input: RunAiChatbotEvaluationSetInput!) {
    runRestaurantAiChatbotEvaluationSet(input: $input) {
      caseId question expectedBehavior category tags answer intent confidence isFallback handoffSuggested handoffReason handoffMessage quickReplies
      knowledgeMatches { id title category sourceType score }
      safetyResult { blocked outOfScope disclaimers handoffSuggested matchedRuleIds }
      sources { type id label status isAvailable formattedPrice }
    }
  }
`;

const CREATE_KNOWLEDGE = gql`mutation CreateManagerAiKnowledge($input: CreateAiChatbotKnowledgeItemInput!) { createRestaurantAiChatbotKnowledgeItem(input: $input) { id } }`;
const UPDATE_KNOWLEDGE = gql`mutation UpdateManagerAiKnowledge($input: UpdateAiChatbotKnowledgeItemInput!) { updateRestaurantAiChatbotKnowledgeItem(input: $input) { id } }`;
const DELETE_KNOWLEDGE = gql`mutation DeleteManagerAiKnowledge($id: ID!) { deleteRestaurantAiChatbotKnowledgeItem(id: $id) }`;
const BULK_KNOWLEDGE_ENABLED = gql`mutation BulkKnowledgeEnabled($input: BulkAiChatbotIdsInput!, $enabled: Boolean!) { bulkUpdateRestaurantAiChatbotKnowledgeEnabled(input: $input, enabled: $enabled) }`;
const BULK_KNOWLEDGE_DELETE = gql`mutation BulkDeleteKnowledge($input: BulkAiChatbotIdsInput!) { bulkDeleteRestaurantAiChatbotKnowledge(input: $input) }`;
const IMPORT_KNOWLEDGE = gql`mutation ImportManagerAiKnowledge($input: ImportAiChatbotKnowledgeInput!) { importRestaurantAiChatbotKnowledge(input: $input) { imported skipped errors } }`;
const APPROVE_SUGGESTION = gql`mutation ApproveManagerAiSuggestion($id: ID!, $input: ApproveAiChatbotKnowledgeSuggestionInput!) { approveRestaurantAiChatbotKnowledgeSuggestion(id: $id, input: $input) { id } }`;
const DISMISS_SUGGESTION = gql`mutation DismissManagerAiSuggestion($id: ID!) { dismissRestaurantAiChatbotKnowledgeSuggestion(id: $id) }`;
const DELETE_SUGGESTION = gql`mutation DeleteManagerAiSuggestion($id: ID!) { deleteRestaurantAiChatbotKnowledgeSuggestion(id: $id) }`;
const BULK_DISMISS_SUGGESTIONS = gql`mutation BulkDismissManagerAiSuggestions($input: BulkAiChatbotIdsInput!) { bulkDismissRestaurantAiChatbotKnowledgeSuggestions(input: $input) }`;
const BULK_DELETE_SUGGESTIONS = gql`mutation BulkDeleteManagerAiSuggestions($input: BulkAiChatbotIdsInput!) { bulkDeleteRestaurantAiChatbotKnowledgeSuggestions(input: $input) }`;
const MARK_FEEDBACK_REVIEWED = gql`mutation MarkAiFeedbackReviewed($id: ID!) { markAiChatbotAnswerFeedbackReviewed(id: $id) }`;
const IGNORE_FEEDBACK = gql`mutation IgnoreAiFeedback($id: ID!) { ignoreAiChatbotAnswerFeedback(id: $id) }`;
const CONVERT_FEEDBACK = gql`mutation ConvertAiFeedback($id: ID!) { convertAiChatbotFeedbackToSuggestion(id: $id) }`;
const BULK_FEEDBACK_REVIEWED = gql`mutation BulkAiFeedbackReviewed($input: BulkAiChatbotIdsInput!) { bulkMarkAiChatbotAnswerFeedbackReviewed(input: $input) }`;
const BULK_FEEDBACK_IGNORE = gql`mutation BulkAiFeedbackIgnore($input: BulkAiChatbotIdsInput!) { bulkIgnoreAiChatbotAnswerFeedback(input: $input) }`;
const BULK_FEEDBACK_CONVERT = gql`mutation BulkAiFeedbackConvert($input: BulkAiChatbotIdsInput!) { bulkConvertAiChatbotFeedbackToSuggestion(input: $input) }`;
const CREATE_SAFETY = gql`mutation CreateManagerAiSafetyRule($input: CreateAiChatbotSafetyRuleInput!) { createRestaurantAiChatbotSafetyRule(input: $input) { id } }`;
const UPDATE_SAFETY = gql`mutation UpdateManagerAiSafetyRule($input: UpdateAiChatbotSafetyRuleInput!) { updateRestaurantAiChatbotSafetyRule(input: $input) { id } }`;
const DELETE_SAFETY = gql`mutation DeleteManagerAiSafetyRule($id: ID!) { deleteRestaurantAiChatbotSafetyRule(id: $id) }`;
const BULK_SAFETY_ENABLED = gql`mutation BulkAiSafetyEnabled($input: BulkAiChatbotIdsInput!, $enabled: Boolean!) { bulkUpdateRestaurantAiChatbotSafetyRuleEnabled(input: $input, enabled: $enabled) }`;
const BULK_SAFETY_DELETE = gql`mutation BulkAiSafetyDelete($input: BulkAiChatbotIdsInput!) { bulkDeleteRestaurantAiChatbotSafetyRules(input: $input) }`;
const CREATE_EVAL_CASE = gql`mutation CreateManagerAiEvalCase($input: CreateAiChatbotEvaluationCaseInput!) { createRestaurantAiChatbotEvaluationCase(input: $input) { id } }`;
const UPDATE_EVAL_CASE = gql`mutation UpdateManagerAiEvalCase($input: UpdateAiChatbotEvaluationCaseInput!) { updateRestaurantAiChatbotEvaluationCase(input: $input) { id } }`;
const DELETE_EVAL_CASE = gql`mutation DeleteManagerAiEvalCase($id: ID!) { deleteRestaurantAiChatbotEvaluationCase(id: $id) }`;

const defaultKnowledgeForm = { title: "", content: "", category: "general", tags: "", enabled: true, priority: 0, sourceType: "manual" };
const defaultSafetyForm = { ruleType: "blocked_topic", pattern: "", responseMessage: "", enabled: true, priority: 0 };
const defaultEvalForm = { question: "", expectedBehavior: "", category: "manual", tags: "", enabled: true };

const normalizePermission = (value) => String(value || "").trim().toLowerCase();
const collectPermissionCodes = (user = {}) => {
  const set = new Set();
  const add = (permission) => {
    if (!permission) return;
    if (typeof permission === "string") set.add(normalizePermission(permission));
    else set.add(normalizePermission(permission.code || permission.permissionCode || permission.slug || permission.name));
  };
  [
    user.permissions,
    user.permissionCodes,
    user.effectivePermissions,
    user.effectivePermissionCodes,
    user.role?.permissions,
    user.role?.directPermissions,
    user.role?.parentRole?.permissions,
  ].forEach((list) => Array.isArray(list) && list.forEach(add));
  return set;
};
const hasPermission = (user, permission) => {
  const codes = collectPermissionCodes(user);
  return codes.has("*") || codes.has(normalizePermission(permission));
};
const hasAnyPermission = (user, permissions) => permissions.some((permission) => hasPermission(user, permission));
const parseTags = (value) => String(value || "").split(",").map((tag) => tag.trim()).filter(Boolean);
const tagText = (tags) => (Array.isArray(tags) ? tags.join(", ") : tags || "");
const safeTags = (tags) => (Array.isArray(tags) ? tags.filter(Boolean) : []);
const toPercent = (value) => value == null ? "—" : `${Math.round(Number(value) * 100)}%`;
const formatDate = (value) => value ? new Date(value).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const statusClass = (enabled) => `ai-admin-status ${enabled ? "is-on" : "is-off"}`;
const permissionTitle = (permission) => `Thiếu quyền ${permission}`;

function EmptyState({ title, description }) {
  return <div className="ai-admin-empty"><div className="ai-admin-empty__icon">∅</div><h4>{title}</h4><p>{description}</p></div>;
}

function ConfirmPanel({ pendingConfirm, onCancel }) {
  if (!pendingConfirm) return null;
  return (
    <div className={`ai-admin-confirm ${pendingConfirm.danger ? "is-danger" : ""}`} role="alertdialog" aria-live="polite">
      <div><strong>{pendingConfirm.title}</strong><p>{pendingConfirm.description}</p></div>
      <div className="ai-admin-actions">
        <button type="button" className="ai-admin-button--secondary" onClick={onCancel}>Hủy</button>
        <button type="button" className={pendingConfirm.danger ? "ai-admin-button--danger" : ""} onClick={pendingConfirm.onConfirm}>{pendingConfirm.confirmLabel || "Xác nhận"}</button>
      </div>
    </div>
  );
}

function ResultSummary({ result }) {
  const rows = Array.isArray(result) ? result : [result].filter(Boolean);
  if (!rows.length) return null;
  return (
    <article className="ai-admin-panel ai-admin-panel--result">
      <header className="ai-admin-panel__header ai-admin-panel__header--compact"><div><p className="ai-admin-eyebrow">Kết quả</p><h3>Kết quả evaluation</h3></div></header>
      <div className="ai-admin-result-list">
        {rows.map((item, index) => (
          <details key={`${item?.caseId || "single"}_${index}`} className="ai-admin-result-item" open={rows.length === 1}>
            <summary>
              <strong>{item?.question || `Case ${index + 1}`}</strong>
              <span>Confidence {toPercent(item?.confidence)}</span>
              <span>Fallback {item?.isFallback ? "Có" : "Không"}</span>
              <span>Handoff {item?.handoffSuggested ? "Có" : "Không"}</span>
              <span>Knowledge {item?.knowledgeMatches?.length || 0}</span>
              <span>Sources {item?.sources?.length || 0}</span>
              <span>Safety {item?.safetyResult?.blocked ? "Blocked" : item?.safetyResult?.outOfScope ? "Out of scope" : "OK"}</span>
            </summary>
            <pre>{JSON.stringify(item, null, 2)}</pre>
          </details>
        ))}
      </div>
    </article>
  );
}

export default function AiChatbotKnowledgePage() {
  const { user, restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  const effectiveRestaurantId = restaurantId || restaurants?.[0]?.id || "";
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).get("tab") || "knowledge");
  const [selectedKnowledge, setSelectedKnowledge] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState([]);
  const [selectedSafety, setSelectedSafety] = useState([]);
  const [knowledgeForm, setKnowledgeForm] = useState(defaultKnowledgeForm);
  const [editingKnowledgeId, setEditingKnowledgeId] = useState(null);
  const [safetyForm, setSafetyForm] = useState(defaultSafetyForm);
  const [editingSafetyId, setEditingSafetyId] = useState(null);
  const [evalForm, setEvalForm] = useState(defaultEvalForm);
  const [editingEvalId, setEditingEvalId] = useState(null);
  const [evaluationMessage, setEvaluationMessage] = useState("");
  const [exportFormat, setExportFormat] = useState("json");
  const [exportOutput, setExportOutput] = useState("");
  const [importFormat, setImportFormat] = useState("json");
  const [importPayload, setImportPayload] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [evalResult, setEvalResult] = useState(null);
  const [notice, setNotice] = useState("");
  const [errorText, setErrorText] = useState("");
  const [formError, setFormError] = useState("");
  const [formWarning, setFormWarning] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState(null);

  const canReadAi = hasAnyPermission(user, [AI_PERMISSIONS.read, AI_PERMISSIONS.write, AI_PERMISSIONS.moderate, AI_PERMISSIONS.evaluate]);
  const canWriteKnowledge = hasPermission(user, AI_PERMISSIONS.write);
  const canModerateAi = hasPermission(user, AI_PERMISSIONS.moderate);
  const canEvaluateAi = hasPermission(user, AI_PERMISSIONS.evaluate);
  const isReadOnly = canReadAi && !canWriteKnowledge && !canModerateAi && !canEvaluateAi;
  const enabledEvalCases = [];

  useEffect(() => {
    const onNavigationQuery = (event) => {
      const tab = event?.detail?.query?.tab;
      if (tab && TABS.includes(tab)) setActiveTab(tab);
    };
    window.addEventListener("manager:navigation-query", onNavigationQuery);
    return () => window.removeEventListener("manager:navigation-query", onNavigationQuery);
  }, []);

  const commonVars = useMemo(() => ({ restaurantId: effectiveRestaurantId }), [effectiveRestaurantId]);
  const knowledgeQuery = useQuery(KNOWLEDGE_QUERY, { skip: !effectiveRestaurantId || !canReadAi, variables: { ...commonVars, filter: null } });
  const suggestionsQuery = useQuery(SUGGESTIONS_QUERY, { skip: !effectiveRestaurantId || !(canReadAi || canModerateAi), variables: { ...commonVars, filter: { status: "pending" } } });
  const feedbackQuery = useQuery(FEEDBACK_QUERY, { skip: !effectiveRestaurantId || !(canReadAi || canModerateAi), variables: { ...commonVars, filter: { status: "new" } } });
  const safetyQuery = useQuery(SAFETY_QUERY, { skip: !effectiveRestaurantId || !(canModerateAi || canWriteKnowledge), variables: { ...commonVars, filter: null } });
  const evalCasesQuery = useQuery(EVALUATION_CASES_QUERY, { skip: !effectiveRestaurantId || !(canEvaluateAi || canWriteKnowledge), variables: commonVars });
  const [exportKnowledge, exportState] = useLazyQuery(EXPORT_QUERY, { fetchPolicy: "network-only" });
  const [evaluatePrompt, evaluateState] = useLazyQuery(EVALUATE_QUERY, { fetchPolicy: "network-only" });
  const [runSet, runSetState] = useLazyQuery(RUN_SET_QUERY, { fetchPolicy: "network-only" });

  const [createKnowledge] = useMutation(CREATE_KNOWLEDGE);
  const [updateKnowledge] = useMutation(UPDATE_KNOWLEDGE);
  const [deleteKnowledge] = useMutation(DELETE_KNOWLEDGE);
  const [bulkKnowledgeEnabled] = useMutation(BULK_KNOWLEDGE_ENABLED);
  const [bulkKnowledgeDelete] = useMutation(BULK_KNOWLEDGE_DELETE);
  const [importKnowledge] = useMutation(IMPORT_KNOWLEDGE);
  const [approveSuggestion] = useMutation(APPROVE_SUGGESTION);
  const [dismissSuggestion] = useMutation(DISMISS_SUGGESTION);
  const [deleteSuggestion] = useMutation(DELETE_SUGGESTION);
  const [bulkDismissSuggestion] = useMutation(BULK_DISMISS_SUGGESTIONS);
  const [bulkDeleteSuggestion] = useMutation(BULK_DELETE_SUGGESTIONS);
  const [markFeedbackReviewed] = useMutation(MARK_FEEDBACK_REVIEWED);
  const [ignoreFeedback] = useMutation(IGNORE_FEEDBACK);
  const [convertFeedback] = useMutation(CONVERT_FEEDBACK);
  const [bulkFeedbackReviewed] = useMutation(BULK_FEEDBACK_REVIEWED);
  const [bulkFeedbackIgnore] = useMutation(BULK_FEEDBACK_IGNORE);
  const [bulkFeedbackConvert] = useMutation(BULK_FEEDBACK_CONVERT);
  const [createSafety] = useMutation(CREATE_SAFETY);
  const [updateSafety] = useMutation(UPDATE_SAFETY);
  const [deleteSafety] = useMutation(DELETE_SAFETY);
  const [bulkSafetyEnabled] = useMutation(BULK_SAFETY_ENABLED);
  const [bulkSafetyDelete] = useMutation(BULK_SAFETY_DELETE);
  const [createEvalCase] = useMutation(CREATE_EVAL_CASE);
  const [updateEvalCase] = useMutation(UPDATE_EVAL_CASE);
  const [deleteEvalCase] = useMutation(DELETE_EVAL_CASE);

  const knowledge = (knowledgeQuery.data?.restaurantAiChatbotKnowledge || []).filter(Boolean);
  const suggestions = (suggestionsQuery.data?.restaurantAiChatbotKnowledgeSuggestions || []).filter(Boolean);
  const feedback = (feedbackQuery.data?.restaurantAiChatbotAnswerFeedback || []).filter(Boolean);
  const safetyRules = (safetyQuery.data?.restaurantAiChatbotSafetyRules || []).filter(Boolean);
  const evalCases = (evalCasesQuery.data?.restaurantAiChatbotEvaluationCases || []).filter(Boolean);
  enabledEvalCases.splice(0, enabledEvalCases.length, ...evalCases.filter((item) => item.enabled));
  const loading = knowledgeQuery.loading || suggestionsQuery.loading || feedbackQuery.loading || safetyQuery.loading || evalCasesQuery.loading;
  const queryError = knowledgeQuery.error || suggestionsQuery.error || feedbackQuery.error || safetyQuery.error || evalCasesQuery.error;

  const refetchAll = () => {
    knowledgeQuery.refetch?.(); suggestionsQuery.refetch?.(); feedbackQuery.refetch?.(); safetyQuery.refetch?.(); evalCasesQuery.refetch?.();
  };
  const runAction = async (action, successMessage) => {
    setErrorText(""); setNotice(""); setFormError(""); setFormWarning("");
    try { await action(); setNotice(successMessage); refetchAll(); }
    catch (error) { setErrorText(error?.message || "Không thể hoàn tất thao tác. Vui lòng thử lại."); }
  };
  const toggleSelection = (id, selected, setSelected) => setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  const askConfirm = (config) => setPendingConfirm({ ...config, onConfirm: async () => { setPendingConfirm(null); await config.onConfirm(); } });

  const validatePriority = (value, field = "priority") => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 100) return `${field} phải là số nguyên từ 0 đến 100.`;
    return "";
  };
  const validateTags = (tags) => {
    if (tags.length > 10) return "Tối đa 10 tags.";
    if (tags.some((tag) => tag.length > 40)) return "Mỗi tag tối đa 40 ký tự.";
    return "";
  };
  const validateKnowledgeInput = (input) => {
    if (!input.title) return "Tiêu đề là bắt buộc.";
    if (input.title.length > 160) return "Tiêu đề tối đa 160 ký tự.";
    if (!input.content) return "Nội dung là bắt buộc.";
    if (input.content.length > 3000) return "Nội dung tối đa 3000 ký tự.";
    if (input.category.length > 80) return "Danh mục tối đa 80 ký tự.";
    const tagError = validateTags(input.tags); if (tagError) return tagError;
    const priorityError = validatePriority(input.priority, "Ưu tiên"); if (priorityError) return priorityError;
    if (!SOURCE_TYPES.includes(input.sourceType)) return "Loại nguồn không hợp lệ.";
    return "";
  };
  const validateImport = () => {
    const payload = importPayload.trim();
    if (!payload) return "Dữ liệu nhập là bắt buộc.";
    if (!["json", "csv"].includes(importFormat)) return "Định dạng nhập chỉ hỗ trợ json hoặc csv.";
    if (importFormat === "json") {
      try { const parsed = JSON.parse(payload); if (!Array.isArray(parsed)) return "JSON import phải là array."; }
      catch { return "JSON import không hợp lệ."; }
    }
    if (importFormat === "csv") {
      const header = payload.split(/\r?\n/)[0] || "";
      const columns = header.split(",").map((c) => c.trim().toLowerCase());
      if (!columns.includes("title") || !columns.includes("content")) return "CSV cần header tối thiểu title,content.";
    }
    return "";
  };
  const validateSafetyInput = (input) => {
    if (!RULE_TYPES.includes(input.ruleType)) return "Loại quy tắc không hợp lệ.";
    if (!input.pattern) return "Mẫu/pattern là bắt buộc.";
    const priorityError = validatePriority(input.priority, "Ưu tiên"); if (priorityError) return priorityError;
    return "";
  };
  const validateEvalInput = (input) => {
    if (!input.question) return "Câu hỏi evaluation là bắt buộc.";
    const tagError = validateTags(input.tags); if (tagError) return tagError;
    return "";
  };

  const submitKnowledge = (event) => {
    event.preventDefault();
    if (!canWriteKnowledge) { setFormError(permissionTitle(AI_PERMISSIONS.write)); return; }
    const input = { title: knowledgeForm.title.trim(), content: knowledgeForm.content.trim(), category: knowledgeForm.category.trim() || "general", tags: parseTags(knowledgeForm.tags), enabled: !!knowledgeForm.enabled, priority: Number(knowledgeForm.priority), sourceType: knowledgeForm.sourceType.trim() || "manual" };
    const validationError = validateKnowledgeInput(input);
    if (validationError) { setFormError(validationError); return; }
    runAction(async () => {
      if (editingKnowledgeId) await updateKnowledge({ variables: { input: { id: editingKnowledgeId, ...input } } });
      else await createKnowledge({ variables: { input: { restaurantId: effectiveRestaurantId, ...input } } });
      setKnowledgeForm(defaultKnowledgeForm); setEditingKnowledgeId(null);
    }, editingKnowledgeId ? "Đã cập nhật mục tri thức." : "Đã thêm mục tri thức.");
  };
  const editKnowledge = (item) => { if (!canWriteKnowledge) return; setEditingKnowledgeId(item.id); setKnowledgeForm({ title: item.title || "", content: item.content || "", category: item.category || "general", tags: tagText(item.tags), enabled: !!item.enabled, priority: item.priority ?? 0, sourceType: item.sourceType || "manual" }); setActiveTab("knowledge"); };
  const submitSafety = (event) => {
    event.preventDefault();
    if (!canModerateAi) { setFormError(permissionTitle(AI_PERMISSIONS.moderate)); return; }
    const input = { ruleType: safetyForm.ruleType.trim(), pattern: safetyForm.pattern.trim(), responseMessage: safetyForm.responseMessage.trim(), enabled: !!safetyForm.enabled, priority: Number(safetyForm.priority) };
    const validationError = validateSafetyInput(input);
    if (validationError) { setFormError(validationError); return; }
    setFormWarning(input.responseMessage ? "" : "Quy tắc không có responseMessage riêng; chatbot sẽ dùng fallback mặc định nếu cần.");
    runAction(async () => {
      if (editingSafetyId) await updateSafety({ variables: { input: { id: editingSafetyId, ...input } } });
      else await createSafety({ variables: { input: { restaurantId: effectiveRestaurantId, ...input } } });
      setSafetyForm(defaultSafetyForm); setEditingSafetyId(null);
    }, editingSafetyId ? "Đã cập nhật quy tắc an toàn." : "Đã thêm quy tắc an toàn.");
  };
  const editSafety = (item) => { if (!canModerateAi) return; setEditingSafetyId(item.id); setSafetyForm({ ruleType: item.ruleType || "blocked_topic", pattern: item.pattern || "", responseMessage: item.responseMessage || "", enabled: !!item.enabled, priority: item.priority ?? 0 }); setActiveTab("safety"); };
  const submitEvalCase = (event) => {
    event.preventDefault();
    if (!canEvaluateAi) { setFormError(permissionTitle(AI_PERMISSIONS.evaluate)); return; }
    const input = { question: evalForm.question.trim(), expectedBehavior: evalForm.expectedBehavior.trim(), category: evalForm.category.trim(), tags: parseTags(evalForm.tags), enabled: !!evalForm.enabled };
    const validationError = validateEvalInput(input);
    if (validationError) { setFormError(validationError); return; }
    setFormWarning(input.expectedBehavior ? "" : "Nên mô tả expectedBehavior để case dễ rà soát khi hồi quy.");
    runAction(async () => {
      if (editingEvalId) await updateEvalCase({ variables: { input: { id: editingEvalId, ...input } } });
      else await createEvalCase({ variables: { input: { restaurantId: effectiveRestaurantId, ...input } } });
      setEvalForm(defaultEvalForm); setEditingEvalId(null);
    }, editingEvalId ? "Đã cập nhật evaluation case." : "Đã lưu evaluation case.");
  };
  const editEvalCase = (item) => { if (!canEvaluateAi) return; setEditingEvalId(item.id); setEvalForm({ question: item.question || "", expectedBehavior: item.expectedBehavior || "", category: item.category || "manual", tags: tagText(item.tags), enabled: item.enabled !== false }); setEvaluationMessage(item.question || ""); setActiveTab("evaluation"); };
  const onExport = () => { if (!canReadAi) return; runAction(async () => { const result = await exportKnowledge({ variables: { restaurantId: effectiveRestaurantId, format: exportFormat } }); setExportOutput(result?.data?.exportRestaurantAiChatbotKnowledge || ""); }, "Đã xuất tri thức."); };
  const onImport = () => { if (!canWriteKnowledge) { setFormError(permissionTitle(AI_PERMISSIONS.write)); return; } const validationError = validateImport(); if (validationError) { setFormError(validationError); return; } runAction(async () => { const result = await importKnowledge({ variables: { input: { restaurantId: effectiveRestaurantId, format: importFormat, payload: importPayload } } }); setImportResult(result?.data?.importRestaurantAiChatbotKnowledge || null); }, "Đã nhập tri thức."); };

  const disabledProps = (allowed, permission) => ({ disabled: !allowed, title: !allowed ? permissionTitle(permission) : undefined });
  const renderBulkKnowledgeActions = () => (
    <div className="ai-admin-actions ai-admin-actions--end">
      <span className="ai-admin-selection">{selectedKnowledge.length} mục đã chọn</span>
      <button type="button" disabled={!canWriteKnowledge || !selectedKnowledge.length} title={!canWriteKnowledge ? permissionTitle(AI_PERMISSIONS.write) : ""} onClick={() => runAction(() => bulkKnowledgeEnabled({ variables: { input: { ids: selectedKnowledge }, enabled: true } }), "Đã bật các mục đã chọn.")}>Bật mục đã chọn</button>
      <button type="button" className="ai-admin-button--secondary" disabled={!canWriteKnowledge || !selectedKnowledge.length} title={!canWriteKnowledge ? permissionTitle(AI_PERMISSIONS.write) : ""} onClick={() => runAction(() => bulkKnowledgeEnabled({ variables: { input: { ids: selectedKnowledge }, enabled: false } }), "Đã tắt các mục đã chọn.")}>Tắt mục đã chọn</button>
      <button type="button" className="ai-admin-button--danger" disabled={!canWriteKnowledge || !selectedKnowledge.length} title={!canWriteKnowledge ? permissionTitle(AI_PERMISSIONS.write) : ""} onClick={() => askConfirm({ type: "bulkDeleteKnowledge", title: "Xóa các mục tri thức đã chọn?", description: `${selectedKnowledge.length} mục sẽ bị xóa. Thao tác này không thể hoàn tác.`, confirmLabel: "Xóa", danger: true, onConfirm: () => runAction(() => bulkKnowledgeDelete({ variables: { input: { ids: selectedKnowledge } } }), "Đã xóa các mục đã chọn.") })}>Xóa mục đã chọn</button>
    </div>
  );

  const renderKnowledge = () => (
    <div className="ai-admin-grid ai-admin-grid--knowledge">
      <article className="ai-admin-panel">
        <header className="ai-admin-panel__header"><div><p className="ai-admin-eyebrow">Tri thức</p><h3>Tri thức chatbot</h3><p>Quản lý nguồn trả lời theo từng nhà hàng.</p></div>{renderBulkKnowledgeActions()}</header>
        {knowledge.length ? <div className="ai-admin-card-list">{knowledge.map((item) => (
          <article key={item.id} className={`ai-admin-card ${selectedKnowledge.includes(item.id) ? "is-selected" : ""}`}>
            <input className="ai-admin-card__checkbox" aria-label={`knowledge-${item.id}`} type="checkbox" checked={selectedKnowledge.includes(item.id)} onChange={() => toggleSelection(item.id, selectedKnowledge, setSelectedKnowledge)} />
            <div className="ai-admin-card__body"><div className="ai-admin-card__meta"><span className={statusClass(item.enabled)}>{item.enabled ? "Đang bật" : "Đang tắt"}</span><span>{item.category || "Chung"}</span><span>Ưu tiên {item.priority ?? 0}</span><span>{item.sourceType || "manual"}</span></div><h4>{item.title}</h4><p>{item.content}</p><div className="ai-admin-tag-row">{safeTags(item.tags).map((tag) => <span key={tag} className="ai-admin-tag">{tag}</span>)}{!safeTags(item.tags).length ? <span className="ai-admin-tag ai-admin-tag--muted">Không có tag</span> : null}</div><small>Cập nhật {formatDate(item.updatedAt || item.createdAt)}</small></div>
            <div className="ai-admin-card__actions"><button type="button" {...disabledProps(canWriteKnowledge, AI_PERMISSIONS.write)} onClick={() => editKnowledge(item)}>Sửa</button><button type="button" className="ai-admin-button--secondary" {...disabledProps(canWriteKnowledge, AI_PERMISSIONS.write)} onClick={() => runAction(() => updateKnowledge({ variables: { input: { id: item.id, enabled: !item.enabled } } }), item.enabled ? "Đã tắt mục." : "Đã bật mục.")}>{item.enabled ? "Tắt" : "Bật"}</button><button type="button" className="ai-admin-button--danger" {...disabledProps(canWriteKnowledge, AI_PERMISSIONS.write)} onClick={() => askConfirm({ type: "deleteKnowledge", title: "Xóa item tri thức?", description: item.title || "Item tri thức này sẽ bị xóa.", confirmLabel: "Xóa", danger: true, onConfirm: () => runAction(() => deleteKnowledge({ variables: { id: item.id } }), "Đã xóa item tri thức.") })}>Xóa</button></div>
          </article>
        ))}</div> : <EmptyState title="Chưa có mục tri thức" description="Thêm nội dung thủ công hoặc nhập JSON/CSV để chatbot có nguồn trả lời rõ ràng hơn." />}
      </article>
      <aside className="ai-admin-side-stack">
        <article className="ai-admin-panel"><header className="ai-admin-panel__header ai-admin-panel__header--compact"><div><p className="ai-admin-eyebrow">Trình chỉnh sửa</p><h3>{editingKnowledgeId ? "Sửa tri thức" : "Thêm tri thức"}</h3><p>{canWriteKnowledge ? "Giữ đầy đủ metadata để lọc, ưu tiên và truy vết nguồn." : "Chế độ chỉ xem: thiếu quyền ghi tri thức."}</p></div></header>
          <form className="ai-admin-form" onSubmit={submitKnowledge}><label className="ai-admin-field"><span>Tiêu đề</span><input value={knowledgeForm.title} disabled={!canWriteKnowledge} maxLength={160} onChange={(e) => setKnowledgeForm((f) => ({ ...f, title: e.target.value }))} /></label><label className="ai-admin-field"><span>Nội dung</span><textarea rows={8} value={knowledgeForm.content} disabled={!canWriteKnowledge} maxLength={3000} onChange={(e) => setKnowledgeForm((f) => ({ ...f, content: e.target.value }))} /></label><div className="ai-admin-form__split"><label className="ai-admin-field"><span>Danh mục</span><input value={knowledgeForm.category} disabled={!canWriteKnowledge} maxLength={80} onChange={(e) => setKnowledgeForm((f) => ({ ...f, category: e.target.value }))} /></label><label className="ai-admin-field"><span>Loại nguồn</span><select value={knowledgeForm.sourceType} disabled={!canWriteKnowledge} onChange={(e) => setKnowledgeForm((f) => ({ ...f, sourceType: e.target.value }))}>{SOURCE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label></div><label className="ai-admin-field"><span>Thẻ</span><input value={knowledgeForm.tags} disabled={!canWriteKnowledge} placeholder="menu, allergy, policy" onChange={(e) => setKnowledgeForm((f) => ({ ...f, tags: e.target.value }))} /><small className="ai-admin-help">Tối đa 10 tags, mỗi tag tối đa 40 ký tự.</small></label><div className="ai-admin-form__split"><label className="ai-admin-field"><span>Ưu tiên</span><input type="number" min="0" max="100" step="1" value={knowledgeForm.priority} disabled={!canWriteKnowledge} onChange={(e) => setKnowledgeForm((f) => ({ ...f, priority: e.target.value }))} /></label><label className="ai-admin-check ai-admin-check--inline"><input type="checkbox" checked={!!knowledgeForm.enabled} disabled={!canWriteKnowledge} onChange={(e) => setKnowledgeForm((f) => ({ ...f, enabled: e.target.checked }))} /><span>Bật</span></label></div><div className="ai-admin-actions"><button type="submit" {...disabledProps(canWriteKnowledge, AI_PERMISSIONS.write)}>{editingKnowledgeId ? "Cập nhật" : "Thêm tri thức"}</button><button type="button" className="ai-admin-button--secondary" disabled={!canWriteKnowledge} onClick={() => { setKnowledgeForm(defaultKnowledgeForm); setEditingKnowledgeId(null); }}>Đặt lại</button></div></form>
        </article>
        <article className="ai-admin-panel"><header className="ai-admin-panel__header ai-admin-panel__header--compact"><div><p className="ai-admin-eyebrow">Nhập / Xuất</p><h3>Dữ liệu tri thức</h3></div></header><div className="ai-admin-import-export"><label className="ai-admin-field"><span>Định dạng xuất</span><select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}><option value="json">json</option><option value="csv">csv</option></select></label><button type="button" disabled={!canReadAi || !effectiveRestaurantId || exportState.loading} onClick={onExport}>Xuất dữ liệu</button><label className="ai-admin-field"><span>Phần xuất</span><textarea value={exportOutput} readOnly placeholder="Dữ liệu xuất sẽ hiển thị tại đây để copy." /></label><label className="ai-admin-field"><span>Định dạng nhập</span><select value={importFormat} disabled={!canWriteKnowledge} onChange={(e) => setImportFormat(e.target.value)}><option value="json">json</option><option value="csv">csv</option></select></label><label className="ai-admin-field"><span>Dữ liệu nhập</span><textarea value={importPayload} disabled={!canWriteKnowledge} onChange={(e) => setImportPayload(e.target.value)} placeholder="JSON array hoặc CSV với title,content" /></label><button type="button" disabled={!canWriteKnowledge || !effectiveRestaurantId || !importPayload.trim()} title={!canWriteKnowledge ? permissionTitle(AI_PERMISSIONS.write) : ""} onClick={onImport}>Nhập dữ liệu</button>{importResult ? <small>Đã nhập {importResult.imported}, đã bỏ qua {importResult.skipped}{importResult.errors?.length ? `, lỗi ${importResult.errors.length}: ${importResult.errors.join("; ")}` : ""}</small> : null}</div></article>
      </aside>
    </div>
  );

  const renderSuggestions = () => <article className="ai-admin-panel"><header className="ai-admin-panel__header"><div><p className="ai-admin-eyebrow">Gợi ý</p><h3>Câu hỏi khách hỏi nhiều</h3><p>Duyệt câu hỏi thành tri thức hoặc loại bỏ gợi ý không còn phù hợp.</p></div><div className="ai-admin-actions"><span className="ai-admin-selection">{selectedSuggestions.length} mục đã chọn</span><button type="button" disabled={!canModerateAi || !selectedSuggestions.length} title={!canModerateAi ? permissionTitle(AI_PERMISSIONS.moderate) : ""} onClick={() => runAction(() => bulkDismissSuggestion({ variables: { input: { ids: selectedSuggestions } } }), "Đã bỏ qua các gợi ý đã chọn.")}>Bỏ qua mục đã chọn</button><button type="button" className="ai-admin-button--danger" disabled={!canModerateAi || !selectedSuggestions.length} title={!canModerateAi ? permissionTitle(AI_PERMISSIONS.moderate) : ""} onClick={() => askConfirm({ type: "bulkDeleteSuggestion", title: "Xóa các gợi ý đã chọn?", description: `${selectedSuggestions.length} gợi ý sẽ bị xóa.`, confirmLabel: "Xóa", danger: true, onConfirm: () => runAction(() => bulkDeleteSuggestion({ variables: { input: { ids: selectedSuggestions } } }), "Đã xóa các gợi ý đã chọn.") })}>Xóa mục đã chọn</button></div></header>{suggestions.length ? <div className="ai-admin-card-list ai-admin-card-list--two">{suggestions.map((item) => <article key={item.id} className={`ai-admin-card ${selectedSuggestions.includes(item.id) ? "is-selected" : ""}`}><input className="ai-admin-card__checkbox" type="checkbox" checked={selectedSuggestions.includes(item.id)} onChange={() => toggleSelection(item.id, selectedSuggestions, setSelectedSuggestions)} /><div className="ai-admin-card__body"><div className="ai-admin-card__meta"><span className="ai-admin-status is-waiting">{item.status || "pending"}</span><span>{item.category || "Chung"}</span><span>{toPercent(item.confidence)}</span><span>{item.occurrenceCount || 0} lần</span></div><h4>{item.question}</h4><p>{item.suggestedTitle || "Chưa có tiêu đề"}</p><small>{item.suggestedContent || "Chưa có nội dung gợi ý."}</small></div><div className="ai-admin-card__actions"><button type="button" {...disabledProps(canModerateAi, AI_PERMISSIONS.moderate)} onClick={() => runAction(() => approveSuggestion({ variables: { id: item.id, input: { title: item.suggestedTitle || item.question, content: item.suggestedContent || item.question, category: item.category || "general", tags: item.tags || [], enabled: true, priority: 0, sourceType: "suggestion" } } }), "Đã duyệt gợi ý.")}>Duyệt</button><button type="button" className="ai-admin-button--secondary" {...disabledProps(canModerateAi, AI_PERMISSIONS.moderate)} onClick={() => runAction(() => dismissSuggestion({ variables: { id: item.id } }), "Đã bỏ qua gợi ý.")}>Bỏ qua</button><button type="button" className="ai-admin-button--danger" {...disabledProps(canModerateAi, AI_PERMISSIONS.moderate)} onClick={() => askConfirm({ type: "deleteSuggestion", title: "Xóa gợi ý này?", description: item.question || "Gợi ý sẽ bị xóa.", confirmLabel: "Xóa", danger: true, onConfirm: () => runAction(() => deleteSuggestion({ variables: { id: item.id } }), "Đã xóa gợi ý.") })}>Xóa</button></div></article>)}</div> : <EmptyState title="Không có suggestion" description="Khi khách hỏi câu AI chưa trả lời tốt, suggestion sẽ xuất hiện ở đây." />}</article>;

  const renderFeedback = () => <article className="ai-admin-panel"><header className="ai-admin-panel__header"><div><p className="ai-admin-eyebrow">Phản hồi</p><h3>Phản hồi từ khách hàng</h3></div><div className="ai-admin-actions"><span className="ai-admin-selection">{selectedFeedback.length} mục đã chọn</span><button type="button" disabled={!canModerateAi || !selectedFeedback.length} title={!canModerateAi ? permissionTitle(AI_PERMISSIONS.moderate) : ""} onClick={() => runAction(() => bulkFeedbackReviewed({ variables: { input: { ids: selectedFeedback } } }), "Đã đánh dấu các feedback đã chọn là đã xem.")}>Đánh dấu đã xem</button><button type="button" className="ai-admin-button--secondary" disabled={!canModerateAi || !selectedFeedback.length} title={!canModerateAi ? permissionTitle(AI_PERMISSIONS.moderate) : ""} onClick={() => runAction(() => bulkFeedbackIgnore({ variables: { input: { ids: selectedFeedback } } }), "Đã bỏ qua các feedback đã chọn.")}>Bỏ qua mục đã chọn</button><button type="button" disabled={!canModerateAi || !selectedFeedback.length} title={!canModerateAi ? permissionTitle(AI_PERMISSIONS.moderate) : ""} onClick={() => runAction(() => bulkFeedbackConvert({ variables: { input: { ids: selectedFeedback } } }), "Đã chuyển các feedback đã chọn thành gợi ý.")}>Chuyển thành gợi ý</button></div></header>{feedback.length ? <div className="ai-admin-card-list ai-admin-card-list--two">{feedback.map((item) => <article key={item.id} className={`ai-admin-card ${selectedFeedback.includes(item.id) ? "is-selected" : ""}`}><input className="ai-admin-card__checkbox" type="checkbox" checked={selectedFeedback.includes(item.id)} onChange={() => toggleSelection(item.id, selectedFeedback, setSelectedFeedback)} /><div className="ai-admin-card__body"><div className="ai-admin-card__meta"><span className="ai-admin-status is-waiting">{item.status || "new"}</span><span>{item.rating}</span><span>{toPercent(item.confidence)}</span><span>{formatDate(item.createdAt)}</span></div><h4>{item.question || "Không có câu hỏi"}</h4><p>{item.reason || item.answer || "Không có ghi chú thêm."}</p></div><div className="ai-admin-card__actions"><button type="button" {...disabledProps(canModerateAi, AI_PERMISSIONS.moderate)} onClick={() => runAction(() => markFeedbackReviewed({ variables: { id: item.id } }), "Đã đánh dấu feedback đã xem.")}>Đã xem</button><button type="button" className="ai-admin-button--secondary" {...disabledProps(canModerateAi, AI_PERMISSIONS.moderate)} onClick={() => runAction(() => ignoreFeedback({ variables: { id: item.id } }), "Đã bỏ qua feedback.")}>Bỏ qua</button><button type="button" {...disabledProps(canModerateAi, AI_PERMISSIONS.moderate)} onClick={() => runAction(() => convertFeedback({ variables: { id: item.id } }), "Đã chuyển feedback thành gợi ý.")}>Chuyển gợi ý</button></div></article>)}</div> : <EmptyState title="Chưa có feedback cần xử lý" description="Feedback mới của khách sẽ được gom tại đây để manager rà soát." />}</article>;

  const renderSafety = () => <div className="ai-admin-grid ai-admin-grid--safety"><article className="ai-admin-panel"><header className="ai-admin-panel__header"><div><p className="ai-admin-eyebrow">Quy tắc an toàn</p><h3>Luật an toàn</h3></div><div className="ai-admin-actions"><span className="ai-admin-selection">{selectedSafety.length} mục đã chọn</span><button type="button" disabled={!canModerateAi || !selectedSafety.length} title={!canModerateAi ? permissionTitle(AI_PERMISSIONS.moderate) : ""} onClick={() => runAction(() => bulkSafetyEnabled({ variables: { input: { ids: selectedSafety }, enabled: true } }), "Đã bật các quy tắc đã chọn.")}>Bật mục đã chọn</button><button type="button" className="ai-admin-button--secondary" disabled={!canModerateAi || !selectedSafety.length} title={!canModerateAi ? permissionTitle(AI_PERMISSIONS.moderate) : ""} onClick={() => runAction(() => bulkSafetyEnabled({ variables: { input: { ids: selectedSafety }, enabled: false } }), "Đã tắt các quy tắc đã chọn.")}>Tắt mục đã chọn</button><button type="button" className="ai-admin-button--danger" disabled={!canModerateAi || !selectedSafety.length} title={!canModerateAi ? permissionTitle(AI_PERMISSIONS.moderate) : ""} onClick={() => askConfirm({ type: "bulkDeleteSafety", title: "Xóa các quy tắc đã chọn?", description: `${selectedSafety.length} quy tắc sẽ bị xóa.`, confirmLabel: "Xóa", danger: true, onConfirm: () => runAction(() => bulkSafetyDelete({ variables: { input: { ids: selectedSafety } } }), "Đã xóa các quy tắc đã chọn.") })}>Xóa mục đã chọn</button></div></header>{safetyRules.length ? <div className="ai-admin-card-list">{safetyRules.map((item) => <article key={item.id} className={`ai-admin-card ${selectedSafety.includes(item.id) ? "is-selected" : ""}`}><input className="ai-admin-card__checkbox" type="checkbox" checked={selectedSafety.includes(item.id)} onChange={() => toggleSelection(item.id, selectedSafety, setSelectedSafety)} /><div className="ai-admin-card__body"><div className="ai-admin-card__meta"><span className={statusClass(item.enabled)}>{item.enabled ? "Đang bật" : "Đang tắt"}</span><span>{item.ruleType}</span><span>Ưu tiên {item.priority ?? 0}</span></div><h4>{item.pattern}</h4><p>{item.responseMessage || "Không có tin nhắn phản hồi riêng."}</p></div><div className="ai-admin-card__actions"><button type="button" {...disabledProps(canModerateAi, AI_PERMISSIONS.moderate)} onClick={() => editSafety(item)}>Sửa</button><button type="button" className="ai-admin-button--secondary" {...disabledProps(canModerateAi, AI_PERMISSIONS.moderate)} onClick={() => runAction(() => updateSafety({ variables: { input: { id: item.id, enabled: !item.enabled } } }), item.enabled ? "Đã tắt quy tắc." : "Đã bật quy tắc.")}>{item.enabled ? "Tắt" : "Bật"}</button><button type="button" className="ai-admin-button--danger" {...disabledProps(canModerateAi, AI_PERMISSIONS.moderate)} onClick={() => askConfirm({ type: "deleteSafety", title: "Xóa quy tắc an toàn?", description: item.pattern || "Quy tắc này sẽ bị xóa.", confirmLabel: "Xóa", danger: true, onConfirm: () => runAction(() => deleteSafety({ variables: { id: item.id } }), "Đã xóa quy tắc an toàn.") })}>Xóa</button></div></article>)}</div> : <EmptyState title="Chưa có quy tắc an toàn" description="Tạo rule để điều hướng các chủ đề nhạy cảm theo chính sách nhà hàng." />}</article><aside className="ai-admin-panel"><header className="ai-admin-panel__header ai-admin-panel__header--compact"><div><p className="ai-admin-eyebrow">Trình chỉnh sửa quy tắc</p><h3>{editingSafetyId ? "Sửa quy tắc" : "Tạo quy tắc"}</h3></div></header><form className="ai-admin-form" onSubmit={submitSafety}><label className="ai-admin-field"><span>Loại quy tắc</span><select value={safetyForm.ruleType} disabled={!canModerateAi} onChange={(e) => setSafetyForm((f) => ({ ...f, ruleType: e.target.value }))}>{RULE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label className="ai-admin-field"><span>Mẫu</span><textarea rows={5} value={safetyForm.pattern} disabled={!canModerateAi} onChange={(e) => setSafetyForm((f) => ({ ...f, pattern: e.target.value }))} /></label><label className="ai-admin-field"><span>Tin nhắn phản hồi</span><textarea rows={5} value={safetyForm.responseMessage} disabled={!canModerateAi} onChange={(e) => setSafetyForm((f) => ({ ...f, responseMessage: e.target.value }))} /><small className="ai-admin-help">Có thể để trống; hệ thống sẽ dùng fallback mặc định.</small></label><div className="ai-admin-form__split"><label className="ai-admin-field"><span>Ưu tiên</span><input type="number" min="0" max="100" step="1" value={safetyForm.priority} disabled={!canModerateAi} onChange={(e) => setSafetyForm((f) => ({ ...f, priority: e.target.value }))} /></label><label className="ai-admin-check ai-admin-check--inline"><input type="checkbox" checked={!!safetyForm.enabled} disabled={!canModerateAi} onChange={(e) => setSafetyForm((f) => ({ ...f, enabled: e.target.checked }))} /><span>Bật</span></label></div><div className="ai-admin-actions"><button type="submit" {...disabledProps(canModerateAi, AI_PERMISSIONS.moderate)}>{editingSafetyId ? "Cập nhật quy tắc" : "Tạo quy tắc"}</button><button type="button" className="ai-admin-button--secondary" disabled={!canModerateAi} onClick={() => { setSafetyForm(defaultSafetyForm); setEditingSafetyId(null); }}>Đặt lại</button></div></form></aside></div>;

  const renderEvaluation = () => <div className="ai-admin-grid ai-admin-grid--evaluation"><article className="ai-admin-panel"><header className="ai-admin-panel__header"><div><p className="ai-admin-eyebrow">Đánh giá</p><h3>Playground đánh giá</h3><p>Thử prompt nhanh, lưu case và chạy bộ case đang bật.</p></div><div className="ai-admin-actions"><button type="button" disabled={!canEvaluateAi || !effectiveRestaurantId || !evaluationMessage.trim() || evaluateState.loading} title={!canEvaluateAi ? permissionTitle(AI_PERMISSIONS.evaluate) : ""} onClick={() => runAction(async () => { const result = await evaluatePrompt({ variables: { input: { restaurantId: effectiveRestaurantId, message: evaluationMessage.trim(), history: [], includeDebug: true } } }); setEvalResult(result?.data?.evaluateRestaurantAiChatbotPrompt || null); }, "Đã chạy thử nghiệm.")}>Chạy thử</button><button type="button" className="ai-admin-button--secondary" disabled={!canEvaluateAi || !enabledEvalCases.length || runSetState.loading} title={!canEvaluateAi ? permissionTitle(AI_PERMISSIONS.evaluate) : !enabledEvalCases.length ? "Không có enabled case" : ""} onClick={() => runAction(async () => { const result = await runSet({ variables: { input: { restaurantId: effectiveRestaurantId, caseIds: enabledEvalCases.map((item) => item.id), includeDebug: true } } }); setEvalResult(result?.data?.runRestaurantAiChatbotEvaluationSet || []); }, "Đã chạy bộ case đang bật.")}>Chạy bộ case đang bật</button></div></header><form className="ai-admin-form" onSubmit={submitEvalCase}><label className="ai-admin-field"><span>Câu hỏi chạy thử</span><textarea rows={5} value={evaluationMessage} disabled={!canEvaluateAi} onChange={(e) => { setEvaluationMessage(e.target.value); setEvalForm((f) => ({ ...f, question: e.target.value })); }} placeholder="Nhập câu hỏi test từ khách..." /></label><label className="ai-admin-field"><span>Câu hỏi lưu case</span><textarea rows={4} value={evalForm.question} disabled={!canEvaluateAi} onChange={(e) => setEvalForm((f) => ({ ...f, question: e.target.value }))} /></label><label className="ai-admin-field"><span>Kỳ vọng</span><textarea rows={4} value={evalForm.expectedBehavior} disabled={!canEvaluateAi} onChange={(e) => setEvalForm((f) => ({ ...f, expectedBehavior: e.target.value }))} placeholder="Nên mô tả: trả lời menu, đề xuất handoff, không trả lời ngoài phạm vi..." /></label><div className="ai-admin-form__split"><label className="ai-admin-field"><span>Category</span><input value={evalForm.category} disabled={!canEvaluateAi} onChange={(e) => setEvalForm((f) => ({ ...f, category: e.target.value }))} /></label><label className="ai-admin-field"><span>Tags</span><input value={evalForm.tags} disabled={!canEvaluateAi} onChange={(e) => setEvalForm((f) => ({ ...f, tags: e.target.value }))} /></label></div><label className="ai-admin-check ai-admin-check--inline"><input type="checkbox" checked={!!evalForm.enabled} disabled={!canEvaluateAi} onChange={(e) => setEvalForm((f) => ({ ...f, enabled: e.target.checked }))} /><span>Enabled</span></label><div className="ai-admin-actions"><button type="submit" {...disabledProps(canEvaluateAi, AI_PERMISSIONS.evaluate)}>{editingEvalId ? "Cập nhật case" : "Lưu case"}</button><button type="button" className="ai-admin-button--secondary" disabled={!canEvaluateAi} onClick={() => { setEvalForm(defaultEvalForm); setEditingEvalId(null); }}>Đặt lại</button></div></form><ResultSummary result={evalResult} /></article><aside className="ai-admin-panel"><header className="ai-admin-panel__header ai-admin-panel__header--compact"><div><p className="ai-admin-eyebrow">Case kiểm thử</p><h3>Các case đánh giá</h3><p>{evalCases.length} case, {enabledEvalCases.length} đang bật.</p></div></header><div className="ai-admin-eval-cases">{evalCases.length ? <ul>{evalCases.map((item) => <li key={item.id}><div><strong>{item.question}</strong><p>{item.expectedBehavior || "Chưa có expected behavior."}</p><small>{item.category || "manual"} · {safeTags(item.tags).join(", ") || "không tag"}</small></div><span className={statusClass(item.enabled)}>{item.enabled ? "Đang bật" : "Đang tắt"}</span><div className="ai-admin-actions"><button type="button" {...disabledProps(canEvaluateAi, AI_PERMISSIONS.evaluate)} onClick={() => editEvalCase(item)}>Sửa</button><button type="button" className="ai-admin-button--secondary" {...disabledProps(canEvaluateAi, AI_PERMISSIONS.evaluate)} onClick={() => runAction(() => updateEvalCase({ variables: { input: { id: item.id, enabled: !item.enabled } } }), item.enabled ? "Đã tắt case." : "Đã bật case.")}>{item.enabled ? "Tắt" : "Bật"}</button><button type="button" className="ai-admin-button--danger" {...disabledProps(canEvaluateAi, AI_PERMISSIONS.evaluate)} onClick={() => askConfirm({ type: "deleteEvaluationCase", title: "Xóa evaluation case?", description: item.question || "Case này sẽ bị xóa.", confirmLabel: "Xóa", danger: true, onConfirm: () => runAction(() => deleteEvalCase({ variables: { id: item.id } }), "Đã xóa evaluation case.") })}>Xóa</button></div></li>)}</ul> : <EmptyState title="Chưa có test case" description="Lưu câu hỏi từ playground để tạo bộ kiểm thử hồi quy." />}</div></aside></div>;

  if (!canReadAi) return <section className="ai-admin-page ai-admin-page--knowledge"><EmptyState title="Bạn không có quyền truy cập quản trị AI chatbot." description="Vui lòng liên hệ quản trị viên để được cấp quyền ai.chatbot.read hoặc quyền thao tác phù hợp." /></section>;

  return <section className="ai-admin-page ai-admin-page--knowledge"><header className="ai-admin-hero"><div className="ai-admin-hero__copy"><p className="ai-admin-eyebrow">Vận hành AI</p><h2>Quản lý tri thức Chatbot AI</h2><p>Không gian quản lý tri thức, gợi ý, phản hồi, quy tắc an toàn và bộ kiểm thử.</p></div><label className="ai-admin-field ai-admin-field--restaurant"><span>Nhà hàng</span><select value={effectiveRestaurantId} onChange={(e) => setRestaurantId(e.target.value)}><option value="">Chọn nhà hàng</option>{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label></header><div className="ai-admin-metrics" aria-label="Tóm tắt tri thức AI"><article><span>Tri thức</span><strong>{knowledge.length}</strong><small>item có thể dùng</small></article><article><span>Gợi ý</span><strong>{suggestions.length}</strong><small>đang chờ duyệt</small></article><article><span>Phản hồi</span><strong>{feedback.length}</strong><small>cần rà soát</small></article><article><span>An toàn</span><strong>{safetyRules.filter((rule) => rule.enabled).length}</strong><small>rule đang bật</small></article></div>{isReadOnly ? <div className="ai-admin-notice">Chế độ chỉ xem: bạn chưa có quyền ghi, kiểm duyệt hoặc evaluation.</div> : null}<nav className="ai-admin-tabs" aria-label="AI chatbot knowledge tabs">{TABS.map((tab) => <button key={tab} type="button" className={activeTab === tab ? "is-active" : ""} onClick={() => setActiveTab(tab)}>{TAB_LABELS[tab] || tab}</button>)}</nav>{!effectiveRestaurantId ? <EmptyState title="Chọn nhà hàng" description="Chọn một nhà hàng để tải dữ liệu AI chatbot." /> : null}{loading ? <div className="ai-admin-skeleton" role="status">Đang tải dữ liệu quản lý AI...</div> : null}{queryError ? <div className="ai-admin-error" role="alert">{queryError.message || "Không thể tải dữ liệu AI."}</div> : null}{errorText ? <div className="ai-admin-error" role="alert">{errorText}</div> : null}{formError ? <div className="ai-admin-error" role="alert">{formError}</div> : null}{formWarning ? <div className="ai-admin-notice" role="status">{formWarning}</div> : null}{notice ? <div className="ai-admin-notice" role="status">{notice}</div> : null}<ConfirmPanel pendingConfirm={pendingConfirm} onCancel={() => setPendingConfirm(null)} />{effectiveRestaurantId && !queryError ? <section className="ai-admin-tab-panel">{activeTab === "knowledge" && renderKnowledge()}{activeTab === "suggestions" && renderSuggestions()}{activeTab === "feedback" && renderFeedback()}{activeTab === "safety" && renderSafety()}{activeTab === "evaluation" && renderEvaluation()}</section> : null}</section>;
}
