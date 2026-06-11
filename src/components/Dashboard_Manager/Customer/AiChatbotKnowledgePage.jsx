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
const tabs = ["knowledge", "suggestions", "feedback", "safety", "evaluation"];
const tabLabels = {
  knowledge: "Tri thức",
  suggestions: "Gợi ý",
  feedback: "Phản hồi",
  safety: "An toàn",
  evaluation: "Đánh giá",
};

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
const sourceTypeLabel = (sourceType) => {
  const value = String(sourceType || "").toLowerCase();
  if (value === "manual") return "Thủ công";
  if (value === "suggestion") return "Gợi ý";
  return sourceType || "Khác";
};
const suggestionStatusLabel = (status) => {
  const value = String(status || "").toLowerCase();
  if (value === "pending") return "Đang chờ";
  return status || "Chưa rõ";
};
const feedbackStatusLabel = (status) => {
  const value = String(status || "").toLowerCase();
  if (value === "new") return "Mới";
  if (value === "reviewed") return "Đã xem";
  return status || "Chưa rõ";
};
const toPercent = (value) =>
  value == null ? "—" : `${Math.round(Number(value) * 100)}%`;
const safeTags = (tags) => (Array.isArray(tags) ? tags.filter(Boolean) : []);

function EmptyState({ title, description }) {
  return (
    <div className="ai-admin-empty">
      <div className="ai-admin-empty__icon">∅</div>
      <h4>{title}</h4>
      <p>{description}</p>
    </div>
  );
}

export default function AiChatbotKnowledgePage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  const effectiveRestaurantId = restaurantId || restaurants?.[0]?.id || "";
  const [activeTab, setActiveTab] = useState("knowledge");
  const [selectedKnowledge, setSelectedKnowledge] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState([]);
  const [selectedSafety, setSelectedSafety] = useState([]);
  const [knowledgeForm, setKnowledgeForm] = useState(defaultKnowledgeForm);
  const [editingKnowledgeId, setEditingKnowledgeId] = useState(null);
  const [safetyForm, setSafetyForm] = useState(defaultSafetyForm);
  const [editingSafetyId, setEditingSafetyId] = useState(null);
  const [exportFormat, setExportFormat] = useState("json");
  const [exportOutput, setExportOutput] = useState("");
  const [importFormat, setImportFormat] = useState("json");
  const [importPayload, setImportPayload] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [evaluationMessage, setEvaluationMessage] = useState("");
  const [evaluationExpected, setEvaluationExpected] = useState("");
  const [evalResult, setEvalResult] = useState(null);
  const [notice, setNotice] = useState("");
  const [errorText, setErrorText] = useState("");

  const commonVars = useMemo(
    () => ({ restaurantId: effectiveRestaurantId }),
    [effectiveRestaurantId],
  );
  const knowledgeQuery = useQuery(KNOWLEDGE_QUERY, {
    skip: !effectiveRestaurantId,
    variables: { ...commonVars, filter: null },
  });
  const suggestionsQuery = useQuery(SUGGESTIONS_QUERY, {
    skip: !effectiveRestaurantId,
    variables: { ...commonVars, filter: { status: "pending" } },
  });
  const feedbackQuery = useQuery(FEEDBACK_QUERY, {
    skip: !effectiveRestaurantId,
    variables: { ...commonVars, filter: { status: "new" } },
  });
  const safetyQuery = useQuery(SAFETY_QUERY, {
    skip: !effectiveRestaurantId,
    variables: { ...commonVars, filter: null },
  });
  const evalCasesQuery = useQuery(EVALUATION_CASES_QUERY, {
    skip: !effectiveRestaurantId,
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
      await action();
      setNotice(successMessage);
      refetchAll();
    } catch (error) {
      setErrorText(
        error?.message || "Không thể hoàn tất thao tác. Vui lòng thử lại.",
      );
    }
  };

  const toggleSelection = (id, selected, setSelected) => {
    setSelected(
      selected.includes(id)
        ? selected.filter((item) => item !== id)
        : [...selected, id],
    );
  };

  const submitKnowledge = (event) => {
    event.preventDefault();
    const input = {
      title: knowledgeForm.title.trim(),
      content: knowledgeForm.content.trim(),
      category: knowledgeForm.category.trim() || "general",
      tags: parseTags(knowledgeForm.tags),
      enabled: !!knowledgeForm.enabled,
      priority: Number(knowledgeForm.priority || 0),
      sourceType: knowledgeForm.sourceType.trim() || "manual",
    };
    if (!input.title || !input.content || !effectiveRestaurantId) return;
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
      },
      editingKnowledgeId
        ? "Đã cập nhật mục tri thức."
        : "Đã thêm mục tri thức.",
    );
  };

  const editKnowledge = (item) => {
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
    const input = {
      ruleType: safetyForm.ruleType.trim() || "blocked_topic",
      pattern: safetyForm.pattern.trim(),
      responseMessage: safetyForm.responseMessage,
      enabled: !!safetyForm.enabled,
      priority: Number(safetyForm.priority || 0),
    };
    if (!input.pattern || !effectiveRestaurantId) return;
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
      },
      editingSafetyId
        ? "Đã cập nhật quy tắc an toàn."
        : "Đã thêm quy tắc an toàn.",
    );
  };

  const editSafety = (item) => {
    setEditingSafetyId(item.id);
    setSafetyForm({
      ruleType: item.ruleType || "blocked_topic",
      pattern: item.pattern || "",
      responseMessage: item.responseMessage || "",
      enabled: !!item.enabled,
      priority: item.priority ?? 0,
    });
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

  const renderKnowledge = () => (
    <div className="ai-admin-grid ai-admin-grid--knowledge">
      <article className="ai-admin-panel">
        <header className="ai-admin-panel__header">
          <div>
            <p className="ai-admin-eyebrow">Tri thức</p>
            <h3>Tri thức chatbot</h3>
            <p>
              Card/table hybrid để scan nhanh title, preview, metadata và trạng
              thái.
            </p>
          </div>
          <div className="ai-admin-actions ai-admin-actions--end">
            <span className="ai-admin-selection">
              {selectedKnowledge.length} mục đã chọn
            </span>
            <button
              type="button"
              disabled={!selectedKnowledge.length}
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
              disabled={!selectedKnowledge.length}
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
              disabled={!selectedKnowledge.length}
              onClick={() =>
                window.confirm("Xóa các mục tri thức đã chọn?") &&
                runAction(
                  () =>
                    bulkKnowledgeDelete({
                      variables: { input: { ids: selectedKnowledge } },
                    }),
                  "Đã xóa các mục đã chọn.",
                )
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
                    <span>{item?.category ? item.category : "Chung"}</span>
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
                        Không có tag
                      </span>
                    ) : null}
                  </div>
                  <small>
                    Cập nhật {formatDate(item?.updatedAt || item?.createdAt)}
                  </small>
                </div>
                <div className="ai-admin-card__actions">
                  <button type="button" onClick={() => editKnowledge(item)}>
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="ai-admin-button--secondary"
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
                    onClick={() =>
                      window.confirm("Xóa item tri thức này?") &&
                      runAction(
                        () => deleteKnowledge({ variables: { id: item?.id } }),
                        "Đã xóa item tri thức.",
                      )
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
            title="Chưa có mục tri thức"
            description="Thêm nội dung thủ công hoặc nhập JSON/CSV để chatbot có nguồn trả lời rõ ràng hơn."
          />
        )}
      </article>
      <aside className="ai-admin-side-stack">
        <article className="ai-admin-panel">
          <header className="ai-admin-panel__header ai-admin-panel__header--compact">
            <div>
              <p className="ai-admin-eyebrow">Trình chỉnh sửa</p>
              <h3>{editingKnowledgeId ? "Sửa tri thức" : "Thêm tri thức"}</h3>
              <p>Giữ đầy đủ metadata để lọc, ưu tiên và truy vết nguồn.</p>
            </div>
          </header>
          <form className="ai-admin-form" onSubmit={submitKnowledge}>
            <label className="ai-admin-field">
              <span>Tiêu đề</span>
              <input
                value={knowledgeForm.title}
                onChange={(e) =>
                  setKnowledgeForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </label>
            <label className="ai-admin-field">
              <span>Nội dung</span>
              <textarea
                rows={8}
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
                <span>Loại nguồn</span>
                <input
                  value={knowledgeForm.sourceType}
                  onChange={(e) =>
                    setKnowledgeForm((f) => ({
                      ...f,
                      sourceType: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <label className="ai-admin-field">
              <span>Thẻ</span>
              <input
                value={knowledgeForm.tags}
                onChange={(e) =>
                  setKnowledgeForm((f) => ({ ...f, tags: e.target.value }))
                }
                placeholder="menu, allergy, policy"
              />
            </label>
            <div className="ai-admin-form__split">
              <label className="ai-admin-field">
                <span>Ưu tiên</span>
                <input
                  type="number"
                  value={knowledgeForm.priority}
                  onChange={(e) =>
                    setKnowledgeForm((f) => ({
                      ...f,
                      priority: e.target.value,
                    }))
                  }
                />
              </label>
              <label className="ai-admin-check ai-admin-check--inline">
                <input
                  type="checkbox"
                  checked={!!knowledgeForm.enabled}
                  onChange={(e) =>
                    setKnowledgeForm((f) => ({
                      ...f,
                      enabled: e.target.checked,
                    }))
                  }
                />
                <span>Bật</span>
              </label>
            </div>
            <div className="ai-admin-actions">
              <button type="submit">
                {editingKnowledgeId ? "Cập nhật" : "Thêm tri thức"}
              </button>
              <button
                type="button"
                className="ai-admin-button--secondary"
                onClick={() => {
                  setKnowledgeForm(defaultKnowledgeForm);
                  setEditingKnowledgeId(null);
                }}
              >
                Đặt lại
              </button>
            </div>
          </form>
        </article>
        <article className="ai-admin-panel">
          <header className="ai-admin-panel__header ai-admin-panel__header--compact">
            <div>
              <p className="ai-admin-eyebrow">Nhập / Xuất</p>
              <h3>Dữ liệu tri thức</h3>
              <p>
                Mảng JSON hoặc CSV đặt trong panel phụ để không chiếm vùng thao
                tác chính.
              </p>
            </div>
          </header>
          <div className="ai-admin-import-export">
            <label className="ai-admin-field">
              <span>Định dạng xuất</span>
              <select
                aria-label="Định dạng xuất"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
              >
                <option value="json">json</option>
                <option value="csv">csv</option>
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
                aria-label="Phần xuất"
                value={exportOutput}
                readOnly
                placeholder="Dữ liệu xuất sẽ hiển thị tại đây để copy."
              />
            </label>
            <label className="ai-admin-field">
              <span>Định dạng nhập</span>
              <select
                aria-label="Định dạng nhập"
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value)}
              >
                <option value="json">json</option>
                <option value="csv">csv</option>
              </select>
            </label>
            <label className="ai-admin-field">
              <span>Dữ liệu nhập</span>
              <textarea
                aria-label="Dữ liệu nhập"
                value={importPayload}
                onChange={(e) => setImportPayload(e.target.value)}
                placeholder="JSON array hoặc CSV với title,content,category,tags,enabled,priority,sourceType"
              />
            </label>
            <button
              type="button"
              disabled={!effectiveRestaurantId || !importPayload.trim()}
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
        </article>
      </aside>
    </div>
  );

  const renderSuggestions = () => (
    <article className="ai-admin-panel">
      <header className="ai-admin-panel__header">
        <div>
          <p className="ai-admin-eyebrow">Gợi ý</p>
          <h3>Câu hỏi khách hỏi nhiều</h3>
          <p>
            Duyệt câu hỏi thành tri thức hoặc loại bỏ các gợi ý không còn phù
            hợp.
          </p>
        </div>
        <div className="ai-admin-actions">
          <span className="ai-admin-selection">
            {selectedSuggestions.length} mục đã chọn
          </span>
          <button
            type="button"
            disabled={!selectedSuggestions.length}
            onClick={() =>
              runAction(
                () =>
                  bulkDismissSuggestion({
                    variables: { input: { ids: selectedSuggestions } },
                  }),
                "Đã bỏ qua các gợi ý đã chọn.",
              )
            }
          >
            Bỏ qua mục đã chọn
          </button>
          <button
            type="button"
            className="ai-admin-button--danger"
            disabled={!selectedSuggestions.length}
            onClick={() =>
              window.confirm("Xóa các gợi ý đã chọn?") &&
              runAction(
                () =>
                  bulkDeleteSuggestion({
                    variables: { input: { ids: selectedSuggestions } },
                  }),
                "Đã xóa các gợi ý đã chọn.",
              )
            }
          >
            Xóa mục đã chọn
          </button>
        </div>
      </header>
      {suggestions.length ? (
        <div className="ai-admin-card-list ai-admin-card-list--two">
          {suggestions.map((item) => (
            <article
              key={item?.id}
              className={`ai-admin-card ${selectedSuggestions.includes(item.id) ? "is-selected" : ""}`}
            >
              <input
                className="ai-admin-card__checkbox"
                aria-label={`suggestion-${item.id}`}
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
                  <span className="ai-admin-status is-waiting">
                    {suggestionStatusLabel(item.status)}
                  </span>
                  <span>{item.category ? item.category : "Chung"}</span>
                  <span>{toPercent(item.confidence)}</span>
                  <span>{item.occurrenceCount || 0} lần</span>
                </div>
                <h4>{item.question}</h4>
                <p>{item.suggestedTitle || "Chưa có tiêu đề"}</p>
                <small>
                  {item.suggestedContent || "Chưa có nội dung gợi ý."}
                </small>
                <div className="ai-admin-tag-row">
                  {(item.tags || []).map((tag) => (
                    <span key={tag} className="ai-admin-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ai-admin-card__actions">
                <button
                  type="button"
                  onClick={() =>
                    runAction(
                      () =>
                        approveSuggestion({
                          variables: {
                            id: item.id,
                            input: {
                              title: item.suggestedTitle || item.question,
                              content: item.suggestedContent || item.question,
                              category: item.category || "general",
                              tags: item.tags || [],
                              enabled: true,
                              priority: 0,
                              sourceType: "suggestion",
                            },
                          },
                        }),
                      "Đã duyệt gợi ý.",
                    )
                  }
                >
                  Duyệt
                </button>
                <button
                  type="button"
                  className="ai-admin-button--secondary"
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
                  onClick={() =>
                    window.confirm("Xóa gợi ý này?") &&
                    runAction(
                      () => deleteSuggestion({ variables: { id: item.id } }),
                      "Đã xóa gợi ý.",
                    )
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
          title="Không có suggestion"
          description="Khi khách hỏi câu AI chưa trả lời tốt, suggestion sẽ xuất hiện ở đây."
        />
      )}
    </article>
  );

  const renderFeedback = () => (
    <article className="ai-admin-panel">
      <header className="ai-admin-panel__header">
        <div>
          <p className="ai-admin-eyebrow">Phản hồi</p>
          <h3>Phản hồi từ khách hàng</h3>
          <p>
            Bố cục thoáng để rà soát rating, câu hỏi và lý do trước khi chuyển
            thành gợi ý.
          </p>
        </div>
        <div className="ai-admin-actions">
          <span className="ai-admin-selection">
            {selectedFeedback.length} mục đã chọn
          </span>
          <button
            type="button"
            disabled={!selectedFeedback.length}
            onClick={() =>
              runAction(
                () =>
                  bulkFeedbackReviewed({
                    variables: { input: { ids: selectedFeedback } },
                  }),
                "Đã đánh dấu các feedback đã chọn là đã xem.",
              )
            }
          >
            Đánh dấu đã xem
          </button>
          <button
            type="button"
            className="ai-admin-button--secondary"
            disabled={!selectedFeedback.length}
            onClick={() =>
              runAction(
                () =>
                  bulkFeedbackIgnore({
                    variables: { input: { ids: selectedFeedback } },
                  }),
                "Đã bỏ qua các feedback đã chọn.",
              )
            }
          >
            Bỏ qua mục đã chọn
          </button>
          <button
            type="button"
            disabled={!selectedFeedback.length}
            onClick={() =>
              runAction(
                () =>
                  bulkFeedbackConvert({
                    variables: { input: { ids: selectedFeedback } },
                  }),
                "Đã chuyển các feedback đã chọn thành gợi ý.",
              )
            }
          >
            Chuyển thành gợi ý
          </button>
        </div>
      </header>
      {feedback.length ? (
        <div className="ai-admin-card-list ai-admin-card-list--two">
          {feedback.map((item) => (
            <article
              key={item?.id}
              className={`ai-admin-card ${selectedFeedback.includes(item.id) ? "is-selected" : ""}`}
            >
              <input
                className="ai-admin-card__checkbox"
                aria-label={`feedback-${item.id}`}
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
                  <span className="ai-admin-status is-waiting">
                    {feedbackStatusLabel(item.status)}
                  </span>
                  <span>{item.rating}</span>
                  <span>{toPercent(item.confidence)}</span>
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                <h4>{item.question || "Không có câu hỏi"}</h4>
                <p>{item.reason || item.answer || "Không có ghi chú thêm."}</p>
                <div className="ai-admin-tag-row">
                  {(item.tags || []).map((tag) => (
                    <span key={tag} className="ai-admin-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ai-admin-card__actions">
                <button
                  type="button"
                  onClick={() =>
                    runAction(
                      () =>
                        markFeedbackReviewed({ variables: { id: item.id } }),
                      "Đã đánh dấu feedback đã xem.",
                    )
                  }
                >
                  Đánh dấu đã xem
                </button>
                <button
                  type="button"
                  className="ai-admin-button--secondary"
                  onClick={() =>
                    runAction(
                      () => ignoreFeedback({ variables: { id: item.id } }),
                      "Đã bỏ qua feedback.",
                    )
                  }
                >
                  Bỏ qua
                </button>
                <button
                  type="button"
                  onClick={() =>
                    runAction(
                      () => convertFeedback({ variables: { id: item.id } }),
                      "Đã chuyển feedback thành gợi ý.",
                    )
                  }
                >
                  Chuyển thành gợi ý
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Chưa có feedback cần xử lý"
          description="Feedback mới của khách sẽ được gom tại đây để manager rà soát."
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
            <h3>Luật an toàn</h3>
            <p>
              Quản lý pattern, độ ưu tiên và phản hồi khi AI cần chặn hoặc
              chuyển hướng.
            </p>
          </div>
          <div className="ai-admin-actions">
            <span className="ai-admin-selection">
              {selectedSafety.length} mục đã chọn
            </span>
            <button
              type="button"
              disabled={!selectedSafety.length}
              onClick={() =>
                runAction(
                  () =>
                    bulkSafetyEnabled({
                      variables: {
                        input: { ids: selectedSafety },
                        enabled: true,
                      },
                    }),
                  "Đã bật các quy tắc đã chọn.",
                )
              }
            >
              Bật mục đã chọn
            </button>
            <button
              type="button"
              className="ai-admin-button--secondary"
              disabled={!selectedSafety.length}
              onClick={() =>
                runAction(
                  () =>
                    bulkSafetyEnabled({
                      variables: {
                        input: { ids: selectedSafety },
                        enabled: false,
                      },
                    }),
                  "Đã tắt các quy tắc đã chọn.",
                )
              }
            >
              Tắt mục đã chọn
            </button>
            <button
              type="button"
              className="ai-admin-button--danger"
              disabled={!selectedSafety.length}
              onClick={() =>
                window.confirm("Xóa các quy tắc an toàn đã chọn?") &&
                runAction(
                  () =>
                    bulkSafetyDelete({
                      variables: { input: { ids: selectedSafety } },
                    }),
                  "Đã xóa các quy tắc đã chọn.",
                )
              }
            >
              Xóa mục đã chọn
            </button>
          </div>
        </header>
        {safetyRules.length ? (
          <div className="ai-admin-card-list">
            {safetyRules.map((item) => (
              <article
                key={item?.id}
                className={`ai-admin-card ${selectedSafety.includes(item?.id) ? "is-selected" : ""}`}
              >
                <input
                  className="ai-admin-card__checkbox"
                  aria-label={`safety-${item.id}`}
                  type="checkbox"
                  checked={selectedSafety.includes(item.id)}
                  onChange={() =>
                    toggleSelection(item.id, selectedSafety, setSelectedSafety)
                  }
                />
                <div className="ai-admin-card__body">
                  <div className="ai-admin-card__meta">
                    <span className={statusClass(item.enabled)}>
                      {item?.enabled ? "Đang bật" : "Đang tắt"}
                    </span>
                    <span>{item.ruleType}</span>
                    <span>Ưu tiên {item.priority ?? 0}</span>
                  </div>
                  <h4>{item.pattern}</h4>
                  <p>
                    {item.responseMessage ||
                      "Không có tin nhắn phản hồi riêng."}
                  </p>
                </div>
                <div className="ai-admin-card__actions">
                  <button type="button" onClick={() => editSafety(item)}>
                    Sửa
                  </button>
                  <button
                    type="button"
                    className="ai-admin-button--secondary"
                    onClick={() =>
                      runAction(
                        () =>
                          updateSafety({
                            variables: {
                              input: { id: item.id, enabled: !item.enabled },
                            },
                          }),
                        item.enabled ? "Đã tắt quy tắc." : "Đã bật quy tắc.",
                      )
                    }
                  >
                    {item.enabled ? "Tắt" : "Bật"}
                  </button>
                  <button
                    type="button"
                    className="ai-admin-button--danger"
                    onClick={() =>
                      window.confirm("Xóa quy tắc an toàn này?") &&
                      runAction(
                        () => deleteSafety({ variables: { id: item.id } }),
                        "Đã xóa quy tắc an toàn.",
                      )
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
            description="Tạo rule để điều hướng các chủ đề nhạy cảm theo chính sách nhà hàng."
          />
        )}
      </article>
      <aside className="ai-admin-panel">
        <header className="ai-admin-panel__header ai-admin-panel__header--compact">
          <div>
            <p className="ai-admin-eyebrow">Trình chỉnh sửa quy tắc</p>
            <h3>{editingSafetyId ? "Sửa quy tắc" : "Tạo quy tắc"}</h3>
          </div>
        </header>
        <form className="ai-admin-form" onSubmit={submitSafety}>
          <label className="ai-admin-field">
            <span>Loại quy tắc</span>
            <input
              value={safetyForm.ruleType}
              onChange={(e) =>
                setSafetyForm((f) => ({ ...f, ruleType: e.target.value }))
              }
            />
          </label>
          <label className="ai-admin-field">
            <span>Mẫu</span>
            <textarea
              rows={5}
              value={safetyForm.pattern}
              onChange={(e) =>
                setSafetyForm((f) => ({ ...f, pattern: e.target.value }))
              }
            />
          </label>
          <label className="ai-admin-field">
            <span>Tin nhắn phản hồi</span>
            <textarea
              rows={5}
              value={safetyForm.responseMessage}
              onChange={(e) =>
                setSafetyForm((f) => ({
                  ...f,
                  responseMessage: e.target.value,
                }))
              }
            />
          </label>
          <div className="ai-admin-form__split">
            <label className="ai-admin-field">
              <span>Ưu tiên</span>
              <input
                type="number"
                value={safetyForm.priority}
                onChange={(e) =>
                  setSafetyForm((f) => ({ ...f, priority: e.target.value }))
                }
              />
            </label>
            <label className="ai-admin-check ai-admin-check--inline">
              <input
                type="checkbox"
                checked={!!safetyForm.enabled}
                onChange={(e) =>
                  setSafetyForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
              <span>Bật</span>
            </label>
          </div>
          <div className="ai-admin-actions">
            <button type="submit">
              {editingSafetyId ? "Cập nhật quy tắc" : "Tạo quy tắc"}
            </button>
            <button
              type="button"
              className="ai-admin-button--secondary"
              onClick={() => {
                setSafetyForm(defaultSafetyForm);
                setEditingSafetyId(null);
              }}
            >
              Đặt lại
            </button>
          </div>
        </form>
      </aside>
    </div>
  );

  const renderEvaluation = () => (
    <div className="ai-admin-grid ai-admin-grid--evaluation">
      <article className="ai-admin-panel">
        <header className="ai-admin-panel__header">
          <div>
            <p className="ai-admin-eyebrow">Đánh giá</p>
            <h3>Playground đánh giá</h3>
            <p>Thử prompt nhanh, lưu case và chạy bộ case đang bật.</p>
          </div>
          <div className="ai-admin-actions">
            <button
              type="button"
              disabled={!evaluationMessage.trim() || evaluateState.loading}
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
                }, "Đã chạy thử nghiệm.")
              }
            >
              Chạy thử
            </button>
            <button
              type="button"
              className="ai-admin-button--secondary"
              disabled={!evaluationMessage.trim()}
              onClick={() =>
                runAction(
                  () =>
                    createEvalCase({
                      variables: {
                        input: {
                          restaurantId: effectiveRestaurantId,
                          question: evaluationMessage,
                          expectedBehavior: evaluationExpected,
                          category: "manual",
                          tags: [],
                          enabled: true,
                        },
                      },
                    }),
                  "Đã lưu case đánh giá.",
                )
              }
            >
              Lưu case
            </button>
            <button
              type="button"
              disabled={runSetState.loading}
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
                }, "Đã chạy bộ case đang bật.")
              }
            >
              Chạy bộ case đang bật
            </button>
          </div>
        </header>
        <form
          className="ai-admin-form"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="ai-admin-field">
            <span>Câu hỏi đánh giá</span>
            <textarea
              aria-label="Câu hỏi đánh giá"
              rows={7}
              value={evaluationMessage}
              onChange={(e) => setEvaluationMessage(e.target.value)}
              placeholder="Nhập câu hỏi test từ khách..."
            />
          </label>
          <label className="ai-admin-field">
            <span>Kỳ vọng</span>
            <textarea
              rows={4}
              value={evaluationExpected}
              onChange={(e) => setEvaluationExpected(e.target.value)}
              placeholder="Kỳ vọng: trả lời menu, đề xuất handoff, không trả lời ngoài phạm vi..."
            />
          </label>
        </form>
        {evalResult ? (
          <article className="ai-admin-panel ai-admin-panel--result">
            <header className="ai-admin-panel__header ai-admin-panel__header--compact">
              <div>
                <p className="ai-admin-eyebrow">Kết quả</p>
                <h3>Kết quả test</h3>
              </div>
            </header>
            {!Array.isArray(evalResult) ? (
              <div className="ai-admin-result-summary">
                <span>
                  Độ tin cậy:{" "}
                  <strong>{toPercent(evalResult.confidence)}</strong>
                </span>
                <span>
                  Dự phòng:{" "}
                  <strong>{evalResult.isFallback ? "Có" : "Không"}</strong>
                </span>
                <span>
                  Chuyển hướng:{" "}
                  <strong>
                    {evalResult.handoffSuggested ? "Có" : "Không"}
                  </strong>
                </span>
                <span>
                  Gợi ý trùng khớp:{" "}
                  <strong>{evalResult.knowledgeMatches?.length || 0}</strong>
                </span>
              </div>
            ) : null}
            <pre>{JSON.stringify(evalResult, null, 2)}</pre>
          </article>
        ) : null}
      </article>
      <aside className="ai-admin-panel">
        <header className="ai-admin-panel__header ai-admin-panel__header--compact">
          <div>
            <p className="ai-admin-eyebrow">Case kiểm thử</p>
            <h3>Các case đánh giá</h3>
            <p>{evalCases.length} case trong bộ kiểm thử.</p>
          </div>
        </header>
        <div className="ai-admin-eval-cases">
          {evalCases.length ? (
            <ul>
              {evalCases.map((item) => (
                <li key={item?.id}>
                  <strong>{item.question}</strong>
                  <span className={statusClass(item.enabled)}>
                    {item?.enabled ? "Đang bật" : "Đang tắt"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Chưa có test case"
              description="Lưu câu hỏi từ playground để tạo bộ kiểm thử hồi quy."
            />
          )}
        </div>
      </aside>
    </div>
  );

  return (
    <section className="ai-admin-page ai-admin-page--knowledge">
      <header className="ai-admin-hero">
        <div className="ai-admin-hero__copy">
          <p className="ai-admin-eyebrow">Vận hành AI</p>
          <h2>Quản lý tri thức Chatbot AI</h2>
          <p>
            Không gian quản lý tri thức, gợi ý, phản hồi, quy tắc an toàn và bộ
            kiểm thử với palette kem ấm dịu mắt cho phiên làm việc dài.
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
      <div className="ai-admin-metrics" aria-label="Tóm tắt tri thức AI">
        <article>
          <span>Tri thức</span>
          <strong>{knowledge.length}</strong>
          <small>item có thể dùng</small>
        </article>
        <article>
          <span>Gợi ý</span>
          <strong>{suggestions.length}</strong>
          <small>đang chờ duyệt</small>
        </article>
        <article>
          <span>Phản hồi</span>
          <strong>{feedback.length}</strong>
          <small>cần rà soát</small>
        </article>
        <article>
          <span>An toàn</span>
          <strong>{safetyRules.filter((rule) => rule.enabled).length}</strong>
          <small>rule đang bật</small>
        </article>
      </div>
      <nav className="ai-admin-tabs" aria-label="AI chatbot knowledge tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "is-active" : ""}
            onClick={() => setActiveTab(tab)}
          >
            {tabLabels[tab] || tab}
          </button>
        ))}
      </nav>
      {!effectiveRestaurantId ? (
        <EmptyState
          title="Chọn nhà hàng"
          description="Chọn một nhà hàng để tải dữ liệu AI chatbot."
        />
      ) : null}
      {loading ? (
        <div className="ai-admin-skeleton" role="status">
          Đang tải dữ liệu quản lý AI...
        </div>
      ) : null}
      {queryError ? (
        <div className="ai-admin-error" role="alert">
          {queryError.message || "Không thể tải dữ liệu AI."}
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
