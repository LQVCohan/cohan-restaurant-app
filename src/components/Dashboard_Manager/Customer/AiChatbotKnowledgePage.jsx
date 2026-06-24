import React, { useContext, useMemo, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./AiChatbotAdmin.scss";

const KNOWLEDGE_QUERY = gql`
  query ManagerAiKnowledge(
    $restaurantId: ID!
    $filter: AiChatbotKnowledgeFilterInput
  ) {
    restaurantAiChatbotKnowledge(restaurantId: $restaurantId, filter: $filter) {
      id
      title
      content
      category
      tags
      enabled
      priority
      sourceType
      createdAt
      updatedAt
    }
  }
`;
const SUGGESTIONS_QUERY = gql`
  query ManagerAiKnowledgeSuggestions(
    $restaurantId: ID!
    $filter: AiChatbotKnowledgeSuggestionFilterInput
  ) {
    restaurantAiChatbotKnowledgeSuggestions(
      restaurantId: $restaurantId
      filter: $filter
    ) {
      id
      question
      suggestedTitle
      suggestedContent
      category
      tags
      triggerType
      confidence
      status
      occurrenceCount
      lastAskedAt
      createdAt
    }
  }
`;
const FEEDBACK_QUERY = gql`
  query ManagerAiFeedback(
    $restaurantId: ID!
    $filter: AiChatbotAnswerFeedbackFilterInput
  ) {
    restaurantAiChatbotAnswerFeedback(
      restaurantId: $restaurantId
      filter: $filter
    ) {
      id
      question
      answer
      rating
      reason
      tags
      sourceTypes
      confidence
      status
      createdAt
    }
  }
`;
const SAFETY_QUERY = gql`
  query ManagerAiSafetyRules(
    $restaurantId: ID!
    $filter: AiChatbotSafetyRuleFilterInput
  ) {
    restaurantAiChatbotSafetyRules(
      restaurantId: $restaurantId
      filter: $filter
    ) {
      id
      ruleType
      pattern
      responseMessage
      enabled
      priority
      createdAt
      updatedAt
    }
  }
`;
const EVALUATION_CASES_QUERY = gql`
  query ManagerAiEvaluationCases($restaurantId: ID!) {
    restaurantAiChatbotEvaluationCases(restaurantId: $restaurantId) {
      id
      question
      expectedBehavior
      category
      tags
      enabled
      createdAt
      updatedAt
    }
  }
`;
const EXPORT_QUERY = gql`
  query ExportManagerAiKnowledge($restaurantId: ID!, $format: String) {
    exportRestaurantAiChatbotKnowledge(
      restaurantId: $restaurantId
      format: $format
    )
  }
`;
const EVALUATE_QUERY = gql`
  query EvaluateManagerAiPrompt($input: EvaluateAiChatbotPromptInput!) {
    evaluateRestaurantAiChatbotPrompt(input: $input) {
      caseId
      question
      expectedBehavior
      category
      tags
      answer
      intent
      confidence
      isFallback
      handoffSuggested
      handoffReason
      handoffMessage
      quickReplies
      knowledgeMatches {
        id
        title
        category
        sourceType
        score
      }
      safetyResult {
        blocked
        outOfScope
        disclaimers
        handoffSuggested
        matchedRuleIds
      }
      sources {
        type
        id
        label
        status
        isAvailable
        formattedPrice
      }
    }
  }
`;
const RUN_SET_QUERY = gql`
  query RunManagerAiEvaluationSet($input: RunAiChatbotEvaluationSetInput!) {
    runRestaurantAiChatbotEvaluationSet(input: $input) {
      caseId
      question
      expectedBehavior
      category
      tags
      answer
      intent
      confidence
      isFallback
      handoffSuggested
      handoffReason
      handoffMessage
      knowledgeMatches {
        id
        title
        category
        sourceType
        score
      }
      safetyResult {
        blocked
        outOfScope
        disclaimers
        handoffSuggested
        matchedRuleIds
      }
    }
  }
`;
const CREATE_KNOWLEDGE = gql`
  mutation CreateManagerAiKnowledge(
    $input: CreateAiChatbotKnowledgeItemInput!
  ) {
    createRestaurantAiChatbotKnowledgeItem(input: $input) {
      id
    }
  }
`;
const UPDATE_KNOWLEDGE = gql`
  mutation UpdateManagerAiKnowledge(
    $input: UpdateAiChatbotKnowledgeItemInput!
  ) {
    updateRestaurantAiChatbotKnowledgeItem(input: $input) {
      id
    }
  }
`;
const DELETE_KNOWLEDGE = gql`
  mutation DeleteManagerAiKnowledge($id: ID!) {
    deleteRestaurantAiChatbotKnowledgeItem(id: $id)
  }
`;
const BULK_KNOWLEDGE_ENABLED = gql`
  mutation BulkKnowledgeEnabled(
    $input: BulkAiChatbotIdsInput!
    $enabled: Boolean!
  ) {
    bulkUpdateRestaurantAiChatbotKnowledgeEnabled(
      input: $input
      enabled: $enabled
    )
  }
`;
const BULK_KNOWLEDGE_DELETE = gql`
  mutation BulkDeleteKnowledge($input: BulkAiChatbotIdsInput!) {
    bulkDeleteRestaurantAiChatbotKnowledge(input: $input)
  }
`;
const IMPORT_KNOWLEDGE = gql`
  mutation ImportManagerAiKnowledge($input: ImportAiChatbotKnowledgeInput!) {
    importRestaurantAiChatbotKnowledge(input: $input) {
      imported
      skipped
      errors
    }
  }
`;
const GENERATE_KNOWLEDGE_SUGGESTIONS = gql`
  mutation GenerateManagerAiKnowledgeSuggestions($input: GenerateAiChatbotKnowledgeSuggestionsInput!) {
    generateRestaurantAiChatbotKnowledgeSuggestions(input: $input) {
      created
      updated
      skipped
      total
      suggestions {
        id
        question
        suggestedTitle
        suggestedContent
        category
        tags
        triggerType
        confidence
        status
        occurrenceCount
        lastAskedAt
        createdAt
      }
    }
  }
`;
const APPROVE_SUGGESTION = gql`
  mutation ApproveManagerAiSuggestion(
    $id: ID!
    $input: ApproveAiChatbotKnowledgeSuggestionInput!
  ) {
    approveRestaurantAiChatbotKnowledgeSuggestion(id: $id, input: $input) {
      id
    }
  }
`;
const DISMISS_SUGGESTION = gql`
  mutation DismissManagerAiSuggestion($id: ID!) {
    dismissRestaurantAiChatbotKnowledgeSuggestion(id: $id)
  }
`;
const DELETE_SUGGESTION = gql`
  mutation DeleteManagerAiSuggestion($id: ID!) {
    deleteRestaurantAiChatbotKnowledgeSuggestion(id: $id)
  }
`;
const BULK_DISMISS_SUGGESTIONS = gql`
  mutation BulkDismissManagerAiSuggestions($input: BulkAiChatbotIdsInput!) {
    bulkDismissRestaurantAiChatbotKnowledgeSuggestions(input: $input)
  }
`;
const BULK_DELETE_SUGGESTIONS = gql`
  mutation BulkDeleteManagerAiSuggestions($input: BulkAiChatbotIdsInput!) {
    bulkDeleteRestaurantAiChatbotKnowledgeSuggestions(input: $input)
  }
`;
const MARK_FEEDBACK_REVIEWED = gql`
  mutation MarkAiFeedbackReviewed($id: ID!) {
    markAiChatbotAnswerFeedbackReviewed(id: $id)
  }
`;
const IGNORE_FEEDBACK = gql`
  mutation IgnoreAiFeedback($id: ID!) {
    ignoreAiChatbotAnswerFeedback(id: $id)
  }
`;
const CONVERT_FEEDBACK = gql`
  mutation ConvertAiFeedback($id: ID!) {
    convertAiChatbotFeedbackToSuggestion(id: $id)
  }
`;
const BULK_FEEDBACK_REVIEWED = gql`
  mutation BulkAiFeedbackReviewed($input: BulkAiChatbotIdsInput!) {
    bulkMarkAiChatbotAnswerFeedbackReviewed(input: $input)
  }
`;
const BULK_FEEDBACK_IGNORE = gql`
  mutation BulkAiFeedbackIgnore($input: BulkAiChatbotIdsInput!) {
    bulkIgnoreAiChatbotAnswerFeedback(input: $input)
  }
`;
const BULK_FEEDBACK_CONVERT = gql`
  mutation BulkAiFeedbackConvert($input: BulkAiChatbotIdsInput!) {
    bulkConvertAiChatbotFeedbackToSuggestion(input: $input)
  }
`;
const CREATE_SAFETY = gql`
  mutation CreateManagerAiSafetyRule($input: CreateAiChatbotSafetyRuleInput!) {
    createRestaurantAiChatbotSafetyRule(input: $input) {
      id
    }
  }
`;
const UPDATE_SAFETY = gql`
  mutation UpdateManagerAiSafetyRule($input: UpdateAiChatbotSafetyRuleInput!) {
    updateRestaurantAiChatbotSafetyRule(input: $input) {
      id
    }
  }
`;
const DELETE_SAFETY = gql`
  mutation DeleteManagerAiSafetyRule($id: ID!) {
    deleteRestaurantAiChatbotSafetyRule(id: $id)
  }
`;
const BULK_SAFETY_ENABLED = gql`
  mutation BulkAiSafetyEnabled(
    $input: BulkAiChatbotIdsInput!
    $enabled: Boolean!
  ) {
    bulkUpdateRestaurantAiChatbotSafetyRuleEnabled(
      input: $input
      enabled: $enabled
    )
  }
`;
const BULK_SAFETY_DELETE = gql`
  mutation BulkAiSafetyDelete($input: BulkAiChatbotIdsInput!) {
    bulkDeleteRestaurantAiChatbotSafetyRules(input: $input)
  }
`;
const CREATE_EVAL_CASE = gql`
  mutation CreateManagerAiEvalCase(
    $input: CreateAiChatbotEvaluationCaseInput!
  ) {
    createRestaurantAiChatbotEvaluationCase(input: $input) {
      id
    }
  }
`;
const UPDATE_EVAL_CASE = gql`
  mutation UpdateManagerAiEvalCase(
    $input: UpdateAiChatbotEvaluationCaseInput!
  ) {
    updateRestaurantAiChatbotEvaluationCase(input: $input) {
      id
    }
  }
`;
const DELETE_EVAL_CASE = gql`
  mutation DeleteManagerAiEvalCase($id: ID!) {
    deleteRestaurantAiChatbotEvaluationCase(id: $id)
  }
`;

const defaultKnowledgeForm = {
  title: "",
  content: "",
  category: "general",
  tags: "",
  enabled: true,
  priority: 0,
  sourceType: "manual",
};
const defaultSafetyForm = {
  ruleType: "blocked_topic",
  pattern: "",
  responseMessage: "",
  enabled: true,
  priority: 0,
};
const defaultEvalForm = {
  question: "",
  expectedBehavior: "",
  category: "manual",
  tags: "",
  enabled: true,
};
const tabs = ["knowledge", "suggestions", "feedback", "safety", "evaluation"];
const tabLabels = {
  knowledge: "Tri thức",
  suggestions: "Gợi ý",
  feedback: "Phản hồi",
  safety: "An toàn",
  evaluation: "Kiểm thử",
};
const SOURCE_TYPES = new Set(["manual", "faq", "policy", "suggestion"]);
const RULE_TYPES = new Set([
  "blocked_topic",
  "required_disclaimer",
  "handoff_topic",
  "allowed_scope",
]);

const collectPermissionCodes = (user) => {
  const out = new Set();
  const push = (value) => {
    if (!value) return;
    if (typeof value === "string") out.add(value);
    else if (typeof value === "object")
      push(value.code || value.slug || value.name || value.permissionCode);
  };
  [
    user?.permissions,
    user?.permissionCodes,
    user?.effectivePermissions,
    user?.role?.permissions,
    user?.role?.directPermissions,
  ].forEach((list) => Array.isArray(list) && list.forEach(push));
  if (
    ["admin", "manager"].includes(
      String(
        user?.roleName || user?.role?.slug || user?.role?.name || "",
      ).toLowerCase(),
    )
  ) {
    [
      "ai.chatbot.read",
      "ai.chatbot.write",
      "ai.chatbot.moderate",
      "ai.chatbot.evaluate",
      "ai.chatbot.analytics.read",
      "ai.chatbot.handoff",
    ].forEach((p) => out.add(p));
  }
  return out;
};
const hasAny = (codes, wanted) =>
  codes.has("*") || wanted.some((p) => codes.has(p));
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const parseTags = (value) =>
  String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
const tagText = (tags) => (Array.isArray(tags) ? tags.join(", ") : tags || "");
const statusClass = (enabled) =>
  `ai-admin-status ${enabled ? "is-on" : "is-off"}`;
const toPercent = (value) =>
  value == null ? "—" : `${Math.round(Number(value) * 100)}%`;
const safeTags = (tags) => (Array.isArray(tags) ? tags.filter(Boolean) : []);
const sourceTypeLabel = (sourceType) =>
  ({
    manual: "Thủ công",
    faq: "FAQ",
    policy: "Chính sách",
    suggestion: "Gợi ý",
  })[String(sourceType || "").toLowerCase()] ||
  sourceType ||
  "Khác";
const ratingLabel = (rating) =>
  rating === "helpful"
    ? "Hữu ích"
    : rating === "not_helpful"
      ? "Phản hồi chưa hài lòng"
      : rating || "—";

const suggestionReasonLabel = (triggerType) =>
  ({
    no_knowledge_match: "Khách hỏi nhưng chatbot chưa có nội dung phù hợp",
    fallback_response: "Câu trả lời cần rà soát",
    low_confidence: "Chatbot chưa đủ chắc chắn",
  })[String(triggerType || "").toLowerCase()] ||
  "Khách hỏi nhưng chatbot cần thêm nội dung hỗ trợ";
const statusLabel = (status) =>
  ({
    pending: "Đang chờ",
    new: "Cần xem",
    reviewed: "Đã xem",
    ignored: "Đã bỏ qua",
    approved: "Đã duyệt",
    dismissed: "Đã bỏ qua",
  })[String(status || "").toLowerCase()] || status || "—";
const safetyRuleLabel = (ruleType) =>
  ({
    blocked_topic: "Chủ đề cần chặn",
    required_disclaimer: "Nội dung cần cảnh báo",
    handoff_topic: "Chủ đề nên chuyển cho nhân viên",
    allowed_scope: "Phạm vi chatbot có thể trả lời",
  })[String(ruleType || "").toLowerCase()] || "Quy tắc an toàn";

function EmptyState({ title, description }) {
  return (
    <div className="ai-admin-empty">
      <div className="ai-admin-empty__icon">∅</div>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  );
}
function ConfirmPanel({ pendingConfirm, onCancel }) {
  if (!pendingConfirm) return null;
  return (
    <div
      className={`ai-admin-notice ${pendingConfirm.danger ? "ai-admin-notice--danger" : ""}`}
      role="alert"
    >
      <strong>{pendingConfirm.title}</strong>
      <p>{pendingConfirm.description}</p>
      <div className="ai-admin-actions">
        <button
          type="button"
          className={pendingConfirm.danger ? "ai-admin-button--danger" : ""}
          onClick={pendingConfirm.onConfirm}
        >
          {pendingConfirm.confirmLabel || "Xác nhận"}
        </button>
        <button
          type="button"
          className="ai-admin-button--secondary"
          onClick={onCancel}
        >
          Hủy
        </button>
      </div>
    </div>
  );
}

export default function AiChatbotKnowledgePage() {
  const { restaurants = [], user } = useContext(AuthContext) || {};
  const permissions = useMemo(() => collectPermissionCodes(user), [user]);
  const canReadAi = hasAny(permissions, [
    "ai.chatbot.read",
    "ai.chatbot.write",
    "ai.chatbot.moderate",
    "ai.chatbot.evaluate",
  ]);
  const canWriteKnowledge = hasAny(permissions, ["ai.chatbot.write"]);
  const canModerateAi = hasAny(permissions, ["ai.chatbot.moderate"]);
  const canEvaluateAi = hasAny(permissions, ["ai.chatbot.evaluate"]);
  const readOnly =
    canReadAi && !canWriteKnowledge && !canModerateAi && !canEvaluateAi;

  const [restaurantId, setRestaurantId] = useState("");
  const effectiveRestaurantId = restaurantId || restaurants?.[0]?.id || "";
  const [activeTab, setActiveTab] = useState("knowledge");
  const [selectedKnowledge, setSelectedKnowledge] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState([]);
  const [selectedSafety, setSelectedSafety] = useState([]);
  const [knowledgeForm, setKnowledgeForm] = useState(defaultKnowledgeForm);
  const [editingKnowledgeId, setEditingKnowledgeId] = useState(null);
  const [knowledgeEditorOpen, setKnowledgeEditorOpen] = useState(false);
  const [safetyForm, setSafetyForm] = useState(defaultSafetyForm);
  const [editingSafetyId, setEditingSafetyId] = useState(null);
  const [safetyEditorOpen, setSafetyEditorOpen] = useState(false);
  const [evalForm, setEvalForm] = useState(defaultEvalForm);
  const [editingEvalId, setEditingEvalId] = useState(null);
  const [exportFormat, setExportFormat] = useState("json");
  const [exportOutput, setExportOutput] = useState("");
  const [importFormat, setImportFormat] = useState("json");
  const [importPayload, setImportPayload] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [evaluationMessage, setEvaluationMessage] = useState("");
  const [evalResult, setEvalResult] = useState(null);
  const [notice, setNotice] = useState("");
  const [errorText, setErrorText] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState(null);

  const commonVars = useMemo(
    () => ({ restaurantId: effectiveRestaurantId }),
    [effectiveRestaurantId],
  );
  const knowledgeQuery = useQuery(KNOWLEDGE_QUERY, {
    skip: !canReadAi || !effectiveRestaurantId,
    variables: { ...commonVars, filter: {} },
  });
  const suggestionsQuery = useQuery(SUGGESTIONS_QUERY, {
    skip: !canReadAi || !effectiveRestaurantId,
    variables: { ...commonVars, filter: { status: "pending" } },
  });
  const feedbackQuery = useQuery(FEEDBACK_QUERY, {
    skip: !canReadAi || !effectiveRestaurantId,
    variables: { ...commonVars, filter: { status: "new" } },
  });
  const safetyQuery = useQuery(SAFETY_QUERY, {
    skip: !canModerateAi || !effectiveRestaurantId,
    variables: { ...commonVars, filter: {} },
  });
  const evalCasesQuery = useQuery(EVALUATION_CASES_QUERY, {
    skip: !canEvaluateAi || !effectiveRestaurantId,
    variables: commonVars,
  });
  const [exportKnowledge, exportState] = useLazyQuery(EXPORT_QUERY, {
    fetchPolicy: "network-only",
  });
  const [evaluatePrompt, evaluateState] = useLazyQuery(EVALUATE_QUERY, {
    fetchPolicy: "network-only",
  });
  const [runSet, runSetState] = useLazyQuery(RUN_SET_QUERY, {
    fetchPolicy: "network-only",
  });
  const [createKnowledge] = useMutation(CREATE_KNOWLEDGE);
  const [updateKnowledge] = useMutation(UPDATE_KNOWLEDGE);
  const [deleteKnowledge] = useMutation(DELETE_KNOWLEDGE);
  const [bulkKnowledgeEnabled] = useMutation(BULK_KNOWLEDGE_ENABLED);
  const [bulkKnowledgeDelete] = useMutation(BULK_KNOWLEDGE_DELETE);
  const [importKnowledge] = useMutation(IMPORT_KNOWLEDGE);
  const [generateKnowledgeSuggestions, generateKnowledgeSuggestionsState] =
    useMutation(GENERATE_KNOWLEDGE_SUGGESTIONS);
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

  const knowledge = (
    knowledgeQuery.data?.restaurantAiChatbotKnowledge || []
  ).filter(Boolean);
  const suggestions = (
    suggestionsQuery.data?.restaurantAiChatbotKnowledgeSuggestions || []
  ).filter(Boolean);
  const feedback = (
    feedbackQuery.data?.restaurantAiChatbotAnswerFeedback || []
  ).filter(Boolean);
  const safetyRules = (
    safetyQuery.data?.restaurantAiChatbotSafetyRules || []
  ).filter(Boolean);
  const evalCases = (
    evalCasesQuery.data?.restaurantAiChatbotEvaluationCases || []
  ).filter(Boolean);
  const loading =
    knowledgeQuery.loading ||
    suggestionsQuery.loading ||
    feedbackQuery.loading ||
    safetyQuery.loading ||
    evalCasesQuery.loading;
  const queryError =
    knowledgeQuery.error ||
    suggestionsQuery.error ||
    feedbackQuery.error ||
    safetyQuery.error ||
    evalCasesQuery.error;

  const refetchAll = () => {
    knowledgeQuery.refetch?.();
    suggestionsQuery.refetch?.();
    feedbackQuery.refetch?.();
    safetyQuery.refetch?.();
    evalCasesQuery.refetch?.();
  };
  const runAction = async (action, successMessage) => {
    setErrorText("");
    setNotice("");
    try {
      const actionMessage = await action();
      setNotice(typeof actionMessage === "string" && actionMessage ? actionMessage : successMessage);
      setPendingConfirm(null);
      refetchAll();
    } catch (error) {
      setErrorText(
        error?.message || "Không thể hoàn tất thao tác. Vui lòng thử lại.",
      );
    }
  };
  const confirmAction = (config) => setPendingConfirm(config);
  const toggleSelection = (id, selected, setSelected) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  const block = (message) => {
    setErrorText(message);
    setNotice("");
    return false;
  };
  const validatePriority = (value) =>
    Number.isInteger(Number(value)) &&
    Number(value) >= 0 &&
    Number(value) <= 100;
  const validateTags = (tags) =>
    tags.length <= 10 && tags.every((tag) => tag.length <= 40);

  const submitKnowledge = (event) => {
    event.preventDefault();
    if (!canWriteKnowledge)
      return block("Thiếu quyền ai.chatbot.write để thay đổi tri thức.");
    const tags = parseTags(knowledgeForm.tags);
    const input = {
      title: knowledgeForm.title.trim(),
      content: knowledgeForm.content.trim(),
      category: knowledgeForm.category.trim() || "general",
      tags,
      enabled: !!knowledgeForm.enabled,
      priority: Number(knowledgeForm.priority || 0),
      sourceType: knowledgeForm.sourceType.trim() || "manual",
    };
    if (!effectiveRestaurantId)
      return block("Chọn nhà hàng trước khi lưu tri thức.");
    if (!input.title || input.title.length > 160)
      return block("Tiêu đề tri thức bắt buộc và tối đa 160 ký tự.");
    if (!input.content || input.content.length > 3000)
      return block("Nội dung tri thức bắt buộc và tối đa 3000 ký tự.");
    if (input.category.length > 80) return block("Danh mục tối đa 80 ký tự.");
    if (!validateTags(tags))
      return block("Tối đa 10 thẻ, mỗi thẻ tối đa 40 ký tự.");
    if (!validatePriority(input.priority))
      return block("Ưu tiên phải là số nguyên từ 0 đến 100.");
    if (!SOURCE_TYPES.has(input.sourceType))
      return block("Loại nguồn không hợp lệ.");
    runAction(
      async () => {
        if (editingKnowledgeId)
          await updateKnowledge({
            variables: { input: { id: editingKnowledgeId, ...input } },
          });
        else
          await createKnowledge({
            variables: {
              input: { restaurantId: effectiveRestaurantId, ...input },
            },
          });
        setKnowledgeForm(defaultKnowledgeForm);
        setEditingKnowledgeId(null);
        setKnowledgeEditorOpen(false);
      },
      editingKnowledgeId
        ? "Đã cập nhật mục tri thức."
        : "Đã thêm mục tri thức.",
    );
  };
  const editKnowledge = (item) => {
    setKnowledgeEditorOpen(true);
    setEditingKnowledgeId(item.id);
    setKnowledgeForm({
      title: item.title || "",
      content: item.content || "",
      category: item.category || "general",
      tags: tagText(item.tags),
      enabled: !!item.enabled,
      priority: item.priority ?? 0,
      sourceType: item.sourceType || "manual",
    });
  };
  const submitSafety = (event) => {
    event.preventDefault();
    if (!canModerateAi)
      return block("Thiếu quyền ai.chatbot.moderate để quản lý safety rule.");
    const input = {
      ruleType: safetyForm.ruleType.trim() || "blocked_topic",
      pattern: safetyForm.pattern.trim(),
      responseMessage: safetyForm.responseMessage.trim(),
      enabled: !!safetyForm.enabled,
      priority: Number(safetyForm.priority || 0),
    };
    if (!effectiveRestaurantId)
      return block("Chọn nhà hàng trước khi lưu safety rule.");
    if (!RULE_TYPES.has(input.ruleType)) return block("ruleType không hợp lệ.");
    if (!input.pattern) return block("Pattern là bắt buộc.");
    if (!validatePriority(input.priority))
      return block("Ưu tiên phải là số nguyên từ 0 đến 100.");
    runAction(
      async () => {
        if (editingSafetyId)
          await updateSafety({
            variables: { input: { id: editingSafetyId, ...input } },
          });
        else
          await createSafety({
            variables: {
              input: { restaurantId: effectiveRestaurantId, ...input },
            },
          });
        setSafetyForm(defaultSafetyForm);
        setEditingSafetyId(null);
        setSafetyEditorOpen(false);
      },
      editingSafetyId
        ? "Đã cập nhật quy tắc an toàn."
        : "Đã thêm quy tắc an toàn.",
    );
  };
  const editSafety = (item) => {
    setSafetyEditorOpen(true);
    setEditingSafetyId(item.id);
    setSafetyForm({
      ruleType: item.ruleType || "blocked_topic",
      pattern: item.pattern || "",
      responseMessage: item.responseMessage || "",
      enabled: !!item.enabled,
      priority: item.priority ?? 0,
    });
  };
  const submitEvalCase = (event) => {
    event.preventDefault();
    if (!canEvaluateAi)
      return block(
        "Thiếu quyền ai.chatbot.evaluate để quản lý evaluation case.",
      );
    const tags = parseTags(evalForm.tags);
    const input = {
      question: evalForm.question.trim(),
      expectedBehavior: evalForm.expectedBehavior.trim(),
      category: evalForm.category.trim(),
      tags,
      enabled: !!evalForm.enabled,
    };
    if (!effectiveRestaurantId)
      return block("Chọn nhà hàng trước khi lưu evaluation case.");
    if (!input.question || input.question.length > 500)
      return block("Question bắt buộc và tối đa 500 ký tự.");
    if (input.expectedBehavior.length > 1000)
      return block("Expected behavior tối đa 1000 ký tự.");
    if (input.category.length > 80) return block("Category tối đa 80 ký tự.");
    if (!validateTags(tags))
      return block("Tối đa 10 tags, mỗi tag tối đa 40 ký tự.");
    runAction(
      async () => {
        if (editingEvalId)
          await updateEvalCase({
            variables: { input: { id: editingEvalId, ...input } },
          });
        else
          await createEvalCase({
            variables: {
              input: { restaurantId: effectiveRestaurantId, ...input },
            },
          });
        setEvalForm(defaultEvalForm);
        setEditingEvalId(null);
      },
      editingEvalId
        ? "Đã cập nhật evaluation case."
        : "Đã lưu evaluation case.",
    );
  };
  const editEvalCase = (item) => {
    setEditingEvalId(item.id);
    setEvalForm({
      question: item.question || "",
      expectedBehavior: item.expectedBehavior || "",
      category: item.category || "manual",
      tags: tagText(item.tags),
      enabled: item.enabled !== false,
    });
  };
  const validateImport = () => {
    const payload = importPayload.trim();
    if (!canWriteKnowledge)
      return block("Thiếu quyền ai.chatbot.write để nhập tri thức.");
    if (!payload) return block("Dữ liệu nhập không được để trống.");
    if (!["json", "csv"].includes(importFormat))
      return block("Định dạng nhập chỉ hỗ trợ json hoặc csv.");
    if (importFormat === "json") {
      try {
        if (!Array.isArray(JSON.parse(payload)))
          return block("JSON import phải là một mảng.");
      } catch {
        return block("JSON import không hợp lệ.");
      }
    }
    if (importFormat === "csv") {
      const head = payload.split(/\r?\n/)[0]?.toLowerCase() || "";
      if (!head.includes("title") || !head.includes("content"))
        return block("CSV cần có tối thiểu header title và content.");
    }
    return true;
  };
  const onExport = () =>
    runAction(async () => {
      const result = await exportKnowledge({
        variables: {
          restaurantId: effectiveRestaurantId,
          format: exportFormat,
        },
      });
      setExportOutput(result?.data?.exportRestaurantAiChatbotKnowledge || "");
    }, "Đã xuất tri thức.");
  const onImport = () =>
    validateImport() &&
    runAction(async () => {
      const result = await importKnowledge({
        variables: {
          input: {
            restaurantId: effectiveRestaurantId,
            format: importFormat,
            payload: importPayload,
          },
        },
      });
      setImportResult(result?.data?.importRestaurantAiChatbotKnowledge || null);
    }, "Đã nhập tri thức.");

  const generateAutomaticSuggestions = () => {
    if (!canModerateAi)
      return block("Thiếu quyền ai.chatbot.moderate để tạo gợi ý tri thức.");
    if (!effectiveRestaurantId)
      return block("Chọn nhà hàng trước khi tạo gợi ý tri thức.");

    return runAction(
      async () => {
        const result = await generateKnowledgeSuggestions({
          variables: {
            input: {
              restaurantId: effectiveRestaurantId,
              sources: [
                "restaurant_info",
                "opening_hours",
                "booking",
                "menu",
                "payment",
                "promotions",
                "delivery_pickup",
              ],
              overwriteExisting: false,
            },
          },
        });

        const summary =
          result?.data?.generateRestaurantAiChatbotKnowledgeSuggestions;
        setActiveTab("suggestions");
        suggestionsQuery.refetch?.();
        knowledgeQuery.refetch?.();

        if (summary) {
          const message = `Đã tạo ${summary.created} gợi ý mới, cập nhật ${summary.updated}, bỏ qua ${summary.skipped}. Vào tab Gợi ý để duyệt trước khi chatbot sử dụng.`;
          setNotice(message);
          return message;
        }
      },
      "Đã tạo gợi ý tri thức tự động.",
    );
  };

  const selectedAction = (ids, action, message) =>
    runAction(() => action({ variables: { input: { ids } } }), message);
  const disabledWriteTitle = canWriteKnowledge
    ? ""
    : "Thiếu quyền chỉnh sửa chatbot";
  const disabledModerateTitle = canModerateAi
    ? ""
    : "Thiếu quyền quản lý chatbot";
  const disabledEvaluateTitle = canEvaluateAi
    ? ""
    : "Thiếu quyền kiểm thử chatbot";

  const renderKnowledge = () => (
    <div className="ai-admin-grid ai-admin-grid--knowledge">
      <article className="ai-admin-panel">
        <header className="ai-admin-panel__header">
          <div>
            <p className="ai-admin-eyebrow">Tri thức</p>
            <h3>Tri thức chatbot</h3>
            <p>
              Dạng thẻ kết hợp bảng giúp người quản lý xem nhanh tiêu đề, nội
              dung, metadata và trạng thái.
            </p>
          </div>
          <div className="ai-admin-actions ai-admin-actions--end">
            <span className="ai-admin-selection">
              {selectedKnowledge.length} mục đã chọn
            </span>
            <button
              type="button"
              className="ai-admin-button--secondary"
              disabled={
                !canModerateAi ||
                !effectiveRestaurantId ||
                generateKnowledgeSuggestionsState.loading
              }
              title={disabledModerateTitle}
              onClick={generateAutomaticSuggestions}
            >
              {generateKnowledgeSuggestionsState.loading
                ? "Đang tạo..."
                : "Tạo tri thức tự động"}
            </button>
            <button
              type="button"
              disabled={!canWriteKnowledge}
              title={disabledWriteTitle}
              onClick={() => {
                setKnowledgeForm(defaultKnowledgeForm);
                setEditingKnowledgeId(null);
                setKnowledgeEditorOpen(true);
              }}
            >
              Thêm tri thức
            </button>
            <button
              type="button"
              title={disabledWriteTitle}
              disabled={!canWriteKnowledge || !selectedKnowledge.length}
              onClick={() =>
                runAction(
                  () =>
                    bulkKnowledgeEnabled({
                      variables: {
                        input: { ids: selectedKnowledge },
                        enabled: true,
                      },
                    }),
                  "Đã bật các mục đã chọn.",
                )
              }
            >
              Bật mục đã chọn
            </button>
            <button
              type="button"
              className="ai-admin-button--secondary"
              title={disabledWriteTitle}
              disabled={!canWriteKnowledge || !selectedKnowledge.length}
              onClick={() =>
                runAction(
                  () =>
                    bulkKnowledgeEnabled({
                      variables: {
                        input: { ids: selectedKnowledge },
                        enabled: false,
                      },
                    }),
                  "Đã tắt các mục đã chọn.",
                )
              }
            >
              Tắt mục đã chọn
            </button>
            <button
              type="button"
              className="ai-admin-button--danger"
              title={disabledWriteTitle}
              disabled={!canWriteKnowledge || !selectedKnowledge.length}
              onClick={() =>
                confirmAction({
                  danger: true,
                  title: "Xóa các mục tri thức đã chọn?",
                  description: `Bạn sắp xóa ${selectedKnowledge.length} mục. Thao tác này không thể hoàn tác.`,
                  confirmLabel: "Xóa",
                  onConfirm: () =>
                    runAction(
                      () =>
                        bulkKnowledgeDelete({
                          variables: { input: { ids: selectedKnowledge } },
                        }),
                      "Đã xóa các mục đã chọn.",
                    ),
                })
              }
            >
              Xóa mục đã chọn
            </button>
          </div>
        </header>
        {knowledge.length ? (
          <div className="ai-admin-card-list">
            {knowledge.map((item) => (
              <article
                key={item?.id}
                className={`ai-admin-card ${selectedKnowledge.includes(item?.id) ? "is-selected" : ""}`}
              >
                <input
                  className="ai-admin-card__checkbox"
                  aria-label={`knowledge-${item?.id}`}
                  type="checkbox"
                  checked={selectedKnowledge.includes(item?.id)}
                  onChange={() =>
                    toggleSelection(
                      item?.id,
                      selectedKnowledge,
                      setSelectedKnowledge,
                    )
                  }
                />
                <div className="ai-admin-card__body">
                  <div className="ai-admin-card__meta">
                    <span className={statusClass(item?.enabled)}>
                      {item?.enabled ? "Đang bật" : "Đang tắt"}
                    </span>
                    <span>{item?.category || "Chung"}</span>
                    <span>Ưu tiên {item?.priority ?? 0}</span>
                    <span>{sourceTypeLabel(item?.sourceType)}</span>
                  </div>
                  <h4>{item?.title}</h4>
                  <p>{item?.content}</p>
                  <div className="ai-admin-tag-row">
                    {safeTags(item?.tags).map((tag) => (
                      <span key={tag} className="ai-admin-tag">
                        {tag}
                      </span>
                    ))}
                    {!safeTags(item?.tags).length ? (
                      <span className="ai-admin-tag ai-admin-tag--muted">
                        Chưa gắn thẻ
                      </span>
                    ) : null}
                  </div>
                  <small>
                    Cập nhật {formatDate(item?.updatedAt || item?.createdAt)}
                  </small>
                </div>
                <div className="ai-admin-card__actions">
                  <button
                    type="button"
                    disabled={!canWriteKnowledge}
                    title={disabledWriteTitle}
                    onClick={() => editKnowledge(item)}
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="ai-admin-button--secondary"
                    disabled={!canWriteKnowledge}
                    title={disabledWriteTitle}
                    onClick={() =>
                      runAction(
                        () =>
                          updateKnowledge({
                            variables: {
                              input: { id: item?.id, enabled: !item?.enabled },
                            },
                          }),
                        item?.enabled ? "Đã tắt mục." : "Đã bật mục.",
                      )
                    }
                  >
                    {item?.enabled ? "Tắt" : "Bật"}
                  </button>
                  <button
                    type="button"
                    className="ai-admin-button--danger"
                    disabled={!canWriteKnowledge}
                    title={disabledWriteTitle}
                    onClick={() =>
                      confirmAction({
                        danger: true,
                        title: "Xóa mục tri thức?",
                        description:
                          item?.title || "Mục tri thức này sẽ bị xóa.",
                        confirmLabel: "Xóa",
                        onConfirm: () =>
                          runAction(
                            () =>
                              deleteKnowledge({ variables: { id: item?.id } }),
                            "Đã xóa mục tri thức.",
                          ),
                      })
                    }
                  >
                    Xóa
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="ai-admin-empty ai-admin-empty--soft">
            <div className="ai-admin-empty__icon">＋</div>
            <h4>Chưa có mục tri thức</h4>
            <p>Thêm tri thức đầu tiên để chatbot có nguồn trả lời rõ ràng hơn.</p>
            <button type="button" disabled={!canWriteKnowledge} title={disabledWriteTitle} onClick={() => setKnowledgeEditorOpen(true)}>
              Thêm tri thức đầu tiên
            </button>
          </div>
        )}
      </article>
      <aside className="ai-admin-side-stack">
        {knowledgeEditorOpen ? (
        <article className="ai-admin-panel ai-admin-drawer-panel">
          <header className="ai-admin-panel__header ai-admin-panel__header--compact">
            <div>
              <p className="ai-admin-eyebrow">Nội dung tri thức</p>
              <h3>{editingKnowledgeId ? "Sửa tri thức" : "Thêm tri thức"}</h3>
              <p>
                {!canWriteKnowledge
                  ? "Chế độ chỉ xem: bạn cần quyền chỉnh sửa chatbot."
                  : "Chỉ nhập nội dung cần thiết; mở cài đặt nâng cao khi cần."}
              </p>
            </div>
          </header>
          <form className="ai-admin-form" onSubmit={submitKnowledge}>
            <label className="ai-admin-field">
              <span>Tiêu đề</span>
              <input
                disabled={!canWriteKnowledge}
                value={knowledgeForm.title}
                maxLength={160}
                onChange={(e) =>
                  setKnowledgeForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </label>
            <label className="ai-admin-field">
              <span>Nội dung</span>
              <textarea
                disabled={!canWriteKnowledge}
                rows={8}
                maxLength={3000}
                value={knowledgeForm.content}
                onChange={(e) =>
                  setKnowledgeForm((f) => ({ ...f, content: e.target.value }))
                }
              />
            </label>
            <div className="ai-admin-form__split">
              <label className="ai-admin-field">
                <span>Danh mục</span>
                <input
                  disabled={!canWriteKnowledge}
                  maxLength={80}
                  value={knowledgeForm.category}
                  onChange={(e) =>
                    setKnowledgeForm((f) => ({
                      ...f,
                      category: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="ai-admin-field">
                <span>Nguồn nội dung</span>
                <select
                  disabled={!canWriteKnowledge}
                  value={knowledgeForm.sourceType}
                  onChange={(e) =>
                    setKnowledgeForm((f) => ({
                      ...f,
                      sourceType: e.target.value,
                    }))
                  }
                >
                  <option value="manual">Thủ công</option>
                  <option value="faq">FAQ</option>
                  <option value="policy">Chính sách</option>
                  <option value="suggestion">Gợi ý</option>
                </select>
              </label>
            </div>
            <label className="ai-admin-field">
              <span>Thẻ</span>
              <input
                disabled={!canWriteKnowledge}
                value={knowledgeForm.tags}
                onChange={(e) =>
                  setKnowledgeForm((f) => ({ ...f, tags: e.target.value }))
                }
                placeholder="thực đơn, chính sách, cay"
              />
            </label>
            <div className="ai-admin-form__split">
              <label className="ai-admin-field">
                <span>Ưu tiên</span>
                <input
                  disabled={!canWriteKnowledge}
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={knowledgeForm.priority}
                  onChange={(e) =>
                    setKnowledgeForm((f) => ({
                      ...f,
                      priority: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="ai-admin-check">
                <input
                  disabled={!canWriteKnowledge}
                  type="checkbox"
                  checked={!!knowledgeForm.enabled}
                  onChange={(e) =>
                    setKnowledgeForm((f) => ({
                      ...f,
                      enabled: e.target.checked,
                    }))
                  }
                />
                <span>Cho phép chatbot dùng nội dung này</span>
              </label>
            </div>
            <div className="ai-admin-actions">
              <button type="submit" disabled={!canWriteKnowledge}>
                {editingKnowledgeId ? "Cập nhật" : "Thêm tri thức"}
              </button>
              <button
                type="button"
                className="ai-admin-button--secondary"
                onClick={() => {
                  setKnowledgeForm(defaultKnowledgeForm);
                  setEditingKnowledgeId(null);
                  setKnowledgeEditorOpen(false);
                }}
              >
                Đóng
              </button>
            </div>
          </form>
        </article>
        ) : (
          <article className="ai-admin-panel ai-admin-drawer-panel ai-admin-guide-card">
            <div className="ai-admin-empty__icon">i</div>
            <h3>Chọn một mục tri thức</h3>
            <p>Chọn một mục tri thức để xem chi tiết hoặc thêm nội dung mới.</p>
            <p>
              Hệ thống sẽ đọc thông tin nhà hàng, giờ mở cửa, đặt bàn, thực đơn,
              thanh toán, khuyến mãi và giao hàng để tạo các gợi ý tri thức.
              Quản lý cần duyệt trước khi chatbot sử dụng.
            </p>
            <button type="button" disabled={!canWriteKnowledge} title={disabledWriteTitle} onClick={() => setKnowledgeEditorOpen(true)}>Thêm tri thức</button>
          </article>
        )}
        <details className="ai-admin-collapsible ai-admin-panel">
          <summary>Nhập / Xuất dữ liệu</summary>
          <div className="ai-admin-import-export">
            <label className="ai-admin-field">
              <span>Định dạng xuất</span>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <button
              type="button"
              disabled={!effectiveRestaurantId || exportState.loading}
              onClick={onExport}
            >
              Xuất dữ liệu
            </button>
            <label className="ai-admin-field">
              <span>Phần xuất</span>
              <textarea
                value={exportOutput}
                readOnly
                placeholder="Dữ liệu xuất sẽ hiển thị tại đây để copy."
              />
            </label>
            <label className="ai-admin-field">
              <span>Định dạng nhập</span>
              <select
                disabled={!canWriteKnowledge}
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value)}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </label>
            <label className="ai-admin-field">
              <span>Dữ liệu nhập</span>
              <textarea
                disabled={!canWriteKnowledge}
                value={importPayload}
                onChange={(e) => setImportPayload(e.target.value)}
                placeholder="JSON array hoặc CSV với title,content,category,tags,enabled,priority,sourceType"
              />
            </label>
            <button
              type="button"
              disabled={
                !canWriteKnowledge ||
                !effectiveRestaurantId ||
                !importPayload.trim()
              }
              onClick={onImport}
            >
              Nhập dữ liệu
            </button>
            {importResult ? (
              <small>
                Đã nhập {importResult.imported}, đã bỏ qua{" "}
                {importResult.skipped}
                {importResult.errors?.length
                  ? `, lỗi ${importResult.errors.length}`
                  : ""}
              </small>
            ) : null}
          </div>
        </details>
      </aside>
    </div>
  );

  const renderSuggestions = () => (
    <article className="ai-admin-panel">
      <header className="ai-admin-panel__header">
        <div>
          <p className="ai-admin-eyebrow">Gợi ý</p>
          <h3>Gợi ý bổ sung tri thức</h3>
          <p>
            Duyệt các câu hỏi khách đã hỏi nhưng chatbot cần thêm nội dung để trả lời tốt hơn.
          </p>
        </div>
        <div className="ai-admin-actions">
          <span className="ai-admin-selection">
            {selectedSuggestions.length} mục đã chọn
          </span>
          <button
            type="button"
            className="ai-admin-button--secondary"
            disabled={!canModerateAi || !selectedSuggestions.length}
            title={disabledModerateTitle}
            onClick={() =>
              selectedAction(
                selectedSuggestions,
                bulkDismissSuggestion,
                "Đã bỏ qua các gợi ý đã chọn.",
              )
            }
          >
            Bỏ qua
          </button>
          <button
            type="button"
            className="ai-admin-button--danger"
            disabled={!canModerateAi || !selectedSuggestions.length}
            title={disabledModerateTitle}
            onClick={() =>
              confirmAction({
                danger: true,
                title: "Xóa các gợi ý đã chọn?",
                description: `Bạn sắp xóa ${selectedSuggestions.length} gợi ý.`,
                confirmLabel: "Xóa",
                onConfirm: () =>
                  selectedAction(
                    selectedSuggestions,
                    bulkDeleteSuggestion,
                    "Đã xóa các gợi ý đã chọn.",
                  ),
              })
            }
          >
            Xóa
          </button>
        </div>
      </header>
      {suggestions.length ? (
        <div className="ai-admin-card-list">
          {suggestions.map((item) => (
            <article key={item.id} className="ai-admin-card">
              <input
                className="ai-admin-card__checkbox"
                type="checkbox"
                checked={selectedSuggestions.includes(item.id)}
                onChange={() =>
                  toggleSelection(
                    item.id,
                    selectedSuggestions,
                    setSelectedSuggestions,
                  )
                }
              />
              <div className="ai-admin-card__body">
                <div className="ai-admin-card__meta">
                  <span>Lý do: {suggestionReasonLabel(item.triggerType)}</span>
                  <span>{toPercent(item.confidence)}</span>
                  <span>{item.occurrenceCount || 1} lần</span>
                  <span>{statusLabel(item.status)}</span>
                </div>
                <h4>{item.suggestedTitle || item.question}</h4>
                <p>{item.suggestedContent || item.question}</p>
                <small>
                  Lần cuối {formatDate(item.lastAskedAt || item.createdAt)}
                </small>
              </div>
              <div className="ai-admin-card__actions">
                <button
                  type="button"
                  disabled={!canModerateAi}
                  title={disabledModerateTitle}
                  onClick={() =>
                    runAction(
                      () =>
                        approveSuggestion({
                          variables: {
                            id: item.id,
                            input: {
                              title: item.suggestedTitle || item.question,
                              content: item.suggestedContent || item.question,
                              category: item.category || "suggestion",
                              tags: item.tags || [],
                              enabled: true,
                              priority: 20,
                              sourceType: "suggestion",
                            },
                          },
                        }),
                      "Đã duyệt gợi ý thành tri thức.",
                    )
                  }
                >
                  Duyệt
                </button>
                <button
                  type="button"
                  className="ai-admin-button--secondary"
                  disabled={!canModerateAi}
                  title={disabledModerateTitle}
                  onClick={() =>
                    runAction(
                      () => dismissSuggestion({ variables: { id: item.id } }),
                      "Đã bỏ qua gợi ý.",
                    )
                  }
                >
                  Bỏ qua
                </button>
                <button
                  type="button"
                  className="ai-admin-button--danger"
                  disabled={!canModerateAi}
                  title={disabledModerateTitle}
                  onClick={() =>
                    confirmAction({
                      danger: true,
                      title: "Xóa gợi ý?",
                      description: item.question,
                      confirmLabel: "Xóa",
                      onConfirm: () =>
                        runAction(
                          () =>
                            deleteSuggestion({ variables: { id: item.id } }),
                          "Đã xóa gợi ý.",
                        ),
                    })
                  }
                >
                  Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Chưa có gợi ý bổ sung tri thức"
          description="Khi khách hỏi nhưng chatbot chưa có nội dung phù hợp, gợi ý sẽ xuất hiện tại đây."
        />
      )}
    </article>
  );
  const renderFeedback = () => (
    <article className="ai-admin-panel">
      <header className="ai-admin-panel__header">
        <div>
          <p className="ai-admin-eyebrow">Phản hồi</p>
          <h3>Phản hồi khách hàng</h3>
          <p>
            Tập trung vào phản hồi chưa hài lòng và các câu trả lời cần cải thiện.
          </p>
        </div>
        <div className="ai-admin-actions">
          <span className="ai-admin-selection">
            {selectedFeedback.length} mục đã chọn
          </span>
          <button
            type="button"
            disabled={!canModerateAi || !selectedFeedback.length}
            title={disabledModerateTitle}
            onClick={() =>
              selectedAction(
                selectedFeedback,
                bulkFeedbackReviewed,
                "Đã đánh dấu đã xem.",
              )
            }
          >
            Đã xem
          </button>
          <button
            type="button"
            disabled={!canModerateAi || !selectedFeedback.length}
            title={disabledModerateTitle}
            onClick={() =>
              selectedAction(
                selectedFeedback,
                bulkFeedbackConvert,
                "Đã chuyển thành gợi ý tri thức.",
              )
            }
          >
            Suggestion
          </button>
          <button
            type="button"
            className="ai-admin-button--secondary"
            disabled={!canModerateAi || !selectedFeedback.length}
            title={disabledModerateTitle}
            onClick={() =>
              selectedAction(
                selectedFeedback,
                bulkFeedbackIgnore,
                "Đã bỏ qua feedback.",
              )
            }
          >
            Bỏ qua
          </button>
        </div>
      </header>
      {feedback.length ? (
        <div className="ai-admin-card-list">
          {feedback.map((item) => (
            <article key={item.id} className="ai-admin-card">
              <input
                className="ai-admin-card__checkbox"
                type="checkbox"
                checked={selectedFeedback.includes(item.id)}
                onChange={() =>
                  toggleSelection(
                    item.id,
                    selectedFeedback,
                    setSelectedFeedback,
                  )
                }
              />
              <div className="ai-admin-card__body">
                <div className="ai-admin-card__meta">
                  <span>{ratingLabel(item.rating)}</span>
                  <span>{statusLabel(item.status)}</span>
                  <span>{toPercent(item.confidence)}</span>
                </div>
                <h4>{item.question || item.reason || "Phản hồi khách hàng"}</h4>
                <p>{item.reason || item.answer || "Không có ghi chú."}</p>
                <small>{formatDate(item.createdAt)}</small>
              </div>
              <div className="ai-admin-card__actions">
                <button
                  type="button"
                  disabled={!canModerateAi}
                  title={disabledModerateTitle}
                  onClick={() =>
                    runAction(
                      () =>
                        markFeedbackReviewed({ variables: { id: item.id } }),
                      "Đã đánh dấu feedback đã xem.",
                    )
                  }
                >
                  Đã xem
                </button>
                <button
                  type="button"
                  disabled={!canModerateAi}
                  title={disabledModerateTitle}
                  onClick={() =>
                    runAction(
                      () => convertFeedback({ variables: { id: item.id } }),
                      "Đã chuyển phản hồi thành gợi ý tri thức.",
                    )
                  }
                >
                  Suggestion
                </button>
                <button
                  type="button"
                  className="ai-admin-button--secondary"
                  disabled={!canModerateAi}
                  title={disabledModerateTitle}
                  onClick={() =>
                    runAction(
                      () => ignoreFeedback({ variables: { id: item.id } }),
                      "Đã bỏ qua feedback.",
                    )
                  }
                >
                  Bỏ qua
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Chưa có phản hồi cần xem"
          description="Phản hồi chưa hài lòng hoặc câu trả lời cần cải thiện sẽ xuất hiện tại đây."
        />
      )}
    </article>
  );
  const renderSafety = () => (
    <div className="ai-admin-grid ai-admin-grid--safety">
      <article className="ai-admin-panel">
        <header className="ai-admin-panel__header">
          <div>
            <p className="ai-admin-eyebrow">Quy tắc an toàn</p>
            <h3>Quy tắc an toàn</h3>
            <p>
              Chặn chủ đề nhạy cảm, thêm nội dung cần cảnh báo, đề xuất chuyển nhân viên và giới hạn phạm vi trả lời.
            </p>
          </div>
          <div className="ai-admin-actions">
            <span className="ai-admin-selection">
              {selectedSafety.length} mục đã chọn
            </span>
            <button
              disabled={!canModerateAi || !selectedSafety.length}
              title={disabledModerateTitle}
              onClick={() =>
                runAction(
                  () =>
                    bulkSafetyEnabled({
                      variables: {
                        input: { ids: selectedSafety },
                        enabled: true,
                      },
                    }),
                  "Đã bật quy tắc an toàn.",
                )
              }
            >
              Bật
            </button>
            <button
              disabled={!canModerateAi || !selectedSafety.length}
              title={disabledModerateTitle}
              onClick={() =>
                runAction(
                  () =>
                    bulkSafetyEnabled({
                      variables: {
                        input: { ids: selectedSafety },
                        enabled: false,
                      },
                    }),
                  "Đã tắt quy tắc an toàn.",
                )
              }
            >
              Tắt
            </button>
            <button
              className="ai-admin-button--danger"
              disabled={!canModerateAi || !selectedSafety.length}
              title={disabledModerateTitle}
              onClick={() =>
                confirmAction({
                  danger: true,
                  title: "Xóa các quy tắc an toàn đã chọn?",
                  description: `${selectedSafety.length} quy tắc sẽ bị xóa.`,
                  confirmLabel: "Xóa",
                  onConfirm: () =>
                    selectedAction(
                      selectedSafety,
                      bulkSafetyDelete,
                      "Đã xóa quy tắc an toàn.",
                    ),
                })
              }
            >
              Xóa
            </button>
          </div>
        </header>
        {canModerateAi ? (
          safetyRules.length ? (
            <div className="ai-admin-card-list">
              {safetyRules.map((item) => (
                <article key={item.id} className="ai-admin-card">
                  <input
                    className="ai-admin-card__checkbox"
                    type="checkbox"
                    checked={selectedSafety.includes(item.id)}
                    onChange={() =>
                      toggleSelection(
                        item.id,
                        selectedSafety,
                        setSelectedSafety,
                      )
                    }
                  />
                  <div className="ai-admin-card__body">
                    <div className="ai-admin-card__meta">
                      <span className={statusClass(item.enabled)}>
                        {item.enabled ? "Bật" : "Tắt"}
                      </span>
                      <span>{safetyRuleLabel(item.ruleType)}</span>
                      <span>Ưu tiên {item.priority}</span>
                    </div>
                    <h4>{item.pattern}</h4>
                    <p>{item.responseMessage || "Chưa có nội dung cảnh báo."}</p>
                  </div>
                  <div className="ai-admin-card__actions">
                    <button type="button" onClick={() => editSafety(item)}>Sửa</button>
                    <button
                      type="button"
                      className="ai-admin-button--danger"
                      onClick={() =>
                        confirmAction({
                          danger: true,
                          title: "Xóa quy tắc an toàn?",
                          description: item.pattern,
                          confirmLabel: "Xóa",
                          onConfirm: () =>
                            runAction(
                              () =>
                                deleteSafety({ variables: { id: item.id } }),
                              "Đã xóa quy tắc an toàn.",
                            ),
                        })
                      }
                    >
                      Xóa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Chưa có quy tắc an toàn"
              description="Thêm quy tắc để kiểm soát phạm vi chatbot."
            />
          )
        ) : (
          <EmptyState
            title="Thiếu quyền quản lý an toàn"
            description="Bạn cần quyền quản lý chatbot để xem và chỉnh quy tắc an toàn."
          />
        )}
      </article>
      {safetyEditorOpen ? (
      <aside className="ai-admin-panel ai-admin-drawer-panel">
        <header className="ai-admin-panel__header ai-admin-panel__header--compact">
          <div>
            <p className="ai-admin-eyebrow">Nội dung quy tắc</p>
            <h3>{editingSafetyId ? "Sửa quy tắc" : "Thêm quy tắc"}</h3>
          </div>
        </header>
        <form className="ai-admin-form" onSubmit={submitSafety}>
          <label className="ai-admin-field">
            <span>Loại quy tắc</span>
            <select
              disabled={!canModerateAi}
              value={safetyForm.ruleType}
              onChange={(e) =>
                setSafetyForm((f) => ({ ...f, ruleType: e.target.value }))
              }
            >
              {[...RULE_TYPES].map((type) => (
                <option key={type} value={type}>
                  {safetyRuleLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="ai-admin-field">
            <span>Chủ đề hoặc nội dung cần kiểm soát</span>
            <input
              disabled={!canModerateAi}
              value={safetyForm.pattern}
              onChange={(e) =>
                setSafetyForm((f) => ({ ...f, pattern: e.target.value }))
              }
            />
          </label>
          <label className="ai-admin-field">
            <span>Nội dung cần cảnh báo</span>
            <textarea
              disabled={!canModerateAi}
              value={safetyForm.responseMessage}
              onChange={(e) =>
                setSafetyForm((f) => ({
                  ...f,
                  responseMessage: e.target.value,
                }))
              }
            />
          </label>
          <label className="ai-admin-field">
            <span>Ưu tiên</span>
            <input
              disabled={!canModerateAi}
              type="number"
              min="0"
              max="100"
              value={safetyForm.priority}
              onChange={(e) =>
                setSafetyForm((f) => ({ ...f, priority: e.target.value }))
              }
            />
          </label>
          <label className="ai-admin-check">
            <input
              disabled={!canModerateAi}
              type="checkbox"
              checked={!!safetyForm.enabled}
              onChange={(e) =>
                setSafetyForm((f) => ({ ...f, enabled: e.target.checked }))
              }
            />
            <span>Bật quy tắc</span>
          </label>
          <div className="ai-admin-actions">
            <button type="submit" disabled={!canModerateAi}>
              {editingSafetyId ? "Cập nhật" : "Thêm quy tắc"}
            </button>
            <button
              type="button"
              className="ai-admin-button--secondary"
              onClick={() => {
                setSafetyForm(defaultSafetyForm);
                setEditingSafetyId(null);
                setSafetyEditorOpen(false);
              }}
            >
              Đóng
            </button>
          </div>
        </form>
      </aside>
      ) : (
        <aside className="ai-admin-panel ai-admin-guide-card">
          <div className="ai-admin-empty__icon">i</div>
          <h3>Chọn một quy tắc</h3>
          <p>Chọn quy tắc an toàn để xem chi tiết hoặc thêm quy tắc mới.</p>
          <button type="button" disabled={!canModerateAi} title={disabledModerateTitle} onClick={() => setSafetyEditorOpen(true)}>Thêm quy tắc</button>
        </aside>
      )}
    </div>
  );
  const renderEvaluation = () => (
    <div className="ai-admin-grid ai-admin-grid--evaluation">
      <article className="ai-admin-panel">
        <header className="ai-admin-panel__header">
          <div>
            <p className="ai-admin-eyebrow">Kiểm thử phản hồi</p>
            <h3>Kiểm thử phản hồi</h3>
            <p>Thử câu hỏi của khách và kiểm tra chất lượng câu trả lời trước khi áp dụng rộng rãi.</p>
          </div>
          <div className="ai-admin-actions">
            <button
              type="button"
              disabled={
                !canEvaluateAi ||
                !evaluationMessage.trim() ||
                evaluateState.loading
              }
              title={disabledEvaluateTitle}
              onClick={() =>
                runAction(async () => {
                  const result = await evaluatePrompt({
                    variables: {
                      input: {
                        restaurantId: effectiveRestaurantId,
                        message: evaluationMessage,
                        history: [],
                        includeDebug: true,
                      },
                    },
                  });
                  setEvalResult(
                    result?.data?.evaluateRestaurantAiChatbotPrompt || null,
                  );
                }, "Đã chạy kiểm thử.")
              }
            >
              Chạy thử
            </button>
            <button
              type="button"
              disabled={
                !canEvaluateAi ||
                !evalCases.some((item) => item.enabled) ||
                runSetState.loading
              }
              title={disabledEvaluateTitle}
              onClick={() =>
                runAction(async () => {
                  const result = await runSet({
                    variables: {
                      input: {
                        restaurantId: effectiveRestaurantId,
                        caseIds: evalCases
                          .filter((item) => item.enabled)
                          .map((item) => item.id),
                        includeDebug: true,
                      },
                    },
                  });
                  setEvalResult(
                    result?.data?.runRestaurantAiChatbotEvaluationSet || [],
                  );
                }, "Đã chạy bộ câu hỏi đang bật.")
              }
            >
              Chạy bộ câu hỏi
            </button>
          </div>
        </header>
        <label className="ai-admin-field">
          <span>Câu hỏi thử nghiệm</span>
          <textarea
            rows={6}
            value={evaluationMessage}
            onChange={(e) => setEvaluationMessage(e.target.value)}
            placeholder="Nhập câu hỏi thử nghiệm từ khách..."
          />
        </label>
        <form className="ai-admin-form" onSubmit={submitEvalCase}>
          <label className="ai-admin-field">
            <span>Câu hỏi thử nghiệm</span>
            <textarea
              disabled={!canEvaluateAi}
              rows={3}
              value={evalForm.question}
              onChange={(e) =>
                setEvalForm((f) => ({ ...f, question: e.target.value }))
              }
            />
          </label>
          <label className="ai-admin-field">
            <span>Kỳ vọng phản hồi</span>
            <textarea
              disabled={!canEvaluateAi}
              rows={3}
              value={evalForm.expectedBehavior}
              onChange={(e) =>
                setEvalForm((f) => ({ ...f, expectedBehavior: e.target.value }))
              }
            />
          </label>
          <div className="ai-admin-form__split">
            <label className="ai-admin-field">
              <span>Danh mục</span>
              <input
                disabled={!canEvaluateAi}
                value={evalForm.category}
                onChange={(e) =>
                  setEvalForm((f) => ({ ...f, category: e.target.value }))
                }
              />
            </label>
            <label className="ai-admin-field">
              <span>Thẻ</span>
              <input
                disabled={!canEvaluateAi}
                value={evalForm.tags}
                onChange={(e) =>
                  setEvalForm((f) => ({ ...f, tags: e.target.value }))
                }
              />
            </label>
          </div>
          <label className="ai-admin-check">
            <input
              disabled={!canEvaluateAi}
              type="checkbox"
              checked={!!evalForm.enabled}
              onChange={(e) =>
                setEvalForm((f) => ({ ...f, enabled: e.target.checked }))
              }
            />
            <span>Đang bật</span>
          </label>
          <div className="ai-admin-actions">
            <button type="submit" disabled={!canEvaluateAi}>
              {editingEvalId ? "Cập nhật case" : "Save case"}
            </button>
            <button
              type="button"
              className="ai-admin-button--secondary"
              onClick={() => {
                setEvalForm(defaultEvalForm);
                setEditingEvalId(null);
              }}
            >
              Đặt lại
            </button>
          </div>
        </form>
        {evalResult ? (
          <article className="ai-admin-panel ai-admin-panel--result">
            <header className="ai-admin-panel__header ai-admin-panel__header--compact">
              <div>
                <p className="ai-admin-eyebrow">Kết quả</p>
                <h3>Kết quả chatbot trả lời</h3>
              </div>
            </header>
            {!Array.isArray(evalResult) ? (
              <div className="ai-admin-result-summary">
                <span>
                  Độ chắc chắn:{" "}
                  <strong>{toPercent(evalResult.confidence)}</strong>
                </span>
                <span>
                  Chưa đủ thông tin:{" "}
                  <strong>{evalResult.isFallback ? "Có" : "Không"}</strong>
                </span>
                <span>
                  Chuyển nhân viên:{" "}
                  <strong>
                    {evalResult.handoffSuggested ? "Có" : "Không"}
                  </strong>
                </span>
                <span>
                  Nội dung tri thức phù hợp:{" "}
                  <strong>{evalResult.knowledgeMatches?.length || 0}</strong>
                </span>
                <span>
                  Quy tắc an toàn:{" "}
                  <strong>
                    {evalResult.safetyResult?.blocked ? "Blocked" : "OK"}
                  </strong>
                </span>
                <span>
                  Sources: <strong>{evalResult.sources?.length || 0}</strong>
                </span>
              </div>
            ) : (
              <div className="ai-admin-result-summary">
                <span>
                  Cases run: <strong>{evalResult.length}</strong>
                </span>
              </div>
            )}
            <details>
              <summary>Xem JSON raw</summary>
              <pre>{JSON.stringify(evalResult, null, 2)}</pre>
            </details>
          </article>
        ) : null}
      </article>
      <aside className="ai-admin-panel">
        <header className="ai-admin-panel__header ai-admin-panel__header--compact">
          <div>
            <p className="ai-admin-eyebrow">Bộ kiểm thử</p>
            <h3>Câu hỏi kiểm thử</h3>
            <p>{evalCases.length} case trong bộ kiểm thử.</p>
          </div>
        </header>
        {canEvaluateAi && evalCases.length ? (
          <div className="ai-admin-eval-cases">
            <ul>
              {evalCases.map((item) => (
                <li key={item.id}>
                  <strong>{item.question}</strong>
                  <span className={statusClass(item.enabled)}>
                    {item.enabled ? "Enabled" : "Disabled"}
                  </span>
                  <small>
                    {item.category || "manual"} ·{" "}
                    {safeTags(item.tags).join(", ") || "no tags"}
                  </small>
                  <div className="ai-admin-actions">
                    <button type="button" onClick={() => editEvalCase(item)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          () =>
                            updateEvalCase({
                              variables: {
                                input: { id: item.id, enabled: !item.enabled },
                              },
                            }),
                          item.enabled ? "Đã disable case." : "Đã enable case.",
                        )
                      }
                    >
                      {item.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      type="button"
                      className="ai-admin-button--danger"
                      onClick={() =>
                        confirmAction({
                          danger: true,
                          title: "Xóa câu hỏi kiểm thử?",
                          description: item.question,
                          confirmLabel: "Xóa",
                          onConfirm: () =>
                            runAction(
                              () =>
                                deleteEvalCase({ variables: { id: item.id } }),
                              "Đã xóa câu hỏi kiểm thử.",
                            ),
                        })
                      }
                    >
                      Xóa
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <EmptyState
            title={
              canEvaluateAi ? "Chưa có câu hỏi kiểm thử" : "Thiếu quyền kiểm thử"
            }
            description={
              canEvaluateAi
                ? "Lưu câu hỏi thử nghiệm để kiểm tra chất lượng phản hồi định kỳ."
                : "Bạn cần quyền kiểm thử chatbot để xem và quản lý câu hỏi kiểm thử."
            }
          />
        )}
      </aside>
    </div>
  );

  if (!canReadAi)
    return (
      <section className="ai-admin-page ai-admin-page--knowledge">
        <EmptyState
          title="Không có quyền truy cập"
          description="Bạn cần quyền ai.chatbot.read hoặc quyền AI chatbot tương ứng để mở trung tâm quản trị chatbot."
        />
      </section>
    );

  return (
    <section className="ai-admin-page ai-admin-page--knowledge">
      <header className="ai-admin-hero">
        <div className="ai-admin-hero__copy">
          <p className="ai-admin-eyebrow">Trung tâm tri thức</p>
          <h2>Tri thức Chatbot AI</h2>
          <p>
            Quản lý nội dung chatbot dùng để trả lời khách và các gợi ý cần duyệt. {readOnly ? "Bạn đang ở chế độ chỉ xem." : ""}
          </p>
        </div>
        <label className="ai-admin-field ai-admin-field--restaurant">
          <span>Nhà hàng</span>
          <select
            value={effectiveRestaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
          >
            <option value="">Chọn nhà hàng</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="ai-admin-metrics" aria-label="Tóm tắt tri thức chatbot">
        <article>
          <span>Tri thức có thể dùng</span>
          <strong>{knowledge.length}</strong>
          <small>mục có thể dùng</small>
        </article>
        <article>
          <span>Gợi ý đang chờ</span>
          <strong>{suggestions.length}</strong>
          <small>đang chờ duyệt</small>
        </article>
        <article>
          <span>Phản hồi cần xem</span>
          <strong>{feedback.length}</strong>
          <small>cần rà soát</small>
        </article>
        <article>
          <span>Quy tắc đang bật</span>
          <strong>{safetyRules.filter((rule) => rule.enabled).length}</strong>
          <small>quy tắc đang bật</small>
        </article>
      </div>
      <nav className="ai-admin-tabs" aria-label="Các mục tri thức chatbot">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </nav>
      <ConfirmPanel
        pendingConfirm={pendingConfirm}
        onCancel={() => setPendingConfirm(null)}
      />
      {!effectiveRestaurantId ? (
        <EmptyState
          title="Chọn nhà hàng"
          description="Chọn một nhà hàng để tải dữ liệu AI chatbot."
        />
      ) : null}
      {loading ? (
        <div className="ai-admin-skeleton" role="status">
          Đang tải dữ liệu tri thức chatbot...
        </div>
      ) : null}
      {queryError ? (
        <div className="ai-admin-error" role="alert">
          {queryError.message || "Không thể tải dữ liệu chatbot."}
        </div>
      ) : null}
      {errorText ? (
        <div className="ai-admin-error" role="alert">
          {errorText}
        </div>
      ) : null}
      {notice ? (
        <div className="ai-admin-notice" role="status">
          {notice}
        </div>
      ) : null}
      {effectiveRestaurantId && !queryError ? (
        <section className="ai-admin-tab-panel">
          {activeTab === "knowledge" && renderKnowledge()}
          {activeTab === "suggestions" && renderSuggestions()}
          {activeTab === "feedback" && renderFeedback()}
          {activeTab === "safety" && renderSafety()}
          {activeTab === "evaluation" && renderEvaluation()}
        </section>
      ) : null}
    </section>
  );
}
