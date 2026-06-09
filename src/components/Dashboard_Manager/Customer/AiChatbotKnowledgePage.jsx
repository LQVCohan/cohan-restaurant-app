import React, { useContext, useMemo, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./AiChatbotAdmin.scss";

const Q_KNOWLEDGE = gql`
  query ManagerAiKnowledge($restaurantId: ID!, $filter: AiChatbotKnowledgeFilterInput) {
    restaurantAiChatbotKnowledge(restaurantId: $restaurantId, filter: $filter) { id title content enabled tags }
  }
`;
const Q_SUGGESTIONS = gql`
  query ManagerAiSuggestions($restaurantId: ID!, $filter: AiChatbotKnowledgeSuggestionFilterInput) {
    restaurantAiChatbotKnowledgeSuggestions(restaurantId: $restaurantId, filter: $filter) { id question }
  }
`;
const Q_FEEDBACK = gql`
  query ManagerAiFeedback($restaurantId: ID!, $filter: AiChatbotAnswerFeedbackFilterInput) {
    restaurantAiChatbotAnswerFeedback(restaurantId: $restaurantId, filter: $filter) { id question }
  }
`;
const Q_SAFETY = gql`
  query ManagerAiSafety($restaurantId: ID!, $filter: AiChatbotSafetyRuleFilterInput) {
    restaurantAiChatbotSafetyRules(restaurantId: $restaurantId, filter: $filter) { id ruleType pattern enabled }
  }
`;
const Q_EVAL_CASES = gql`
  query ManagerAiEvalCases($restaurantId: ID!) {
    restaurantAiChatbotEvaluationCases(restaurantId: $restaurantId) { id question enabled }
  }
`;
const Q_EXPORT = gql`query ExportRestaurantAiChatbotKnowledge($restaurantId: ID!, $format: String) { exportRestaurantAiChatbotKnowledge(restaurantId: $restaurantId, format: $format) }`;
const Q_EVALUATE = gql`query EvaluateRestaurantAiChatbotPrompt($input: EvaluateAiChatbotPromptInput!) { evaluateRestaurantAiChatbotPrompt(input: $input) { answer intent confidence isFallback handoffSuggested } }`;
const Q_RUN_SET = gql`query RunRestaurantAiChatbotEvaluationSet($input: RunAiChatbotEvaluationSetInput!) { runRestaurantAiChatbotEvaluationSet(input: $input) { caseId question answer confidence } }`;

const M_BULK_KNOWLEDGE_ENABLED = gql`mutation BulkKnowledgeEnabled($input: BulkAiChatbotIdsInput!, $enabled: Boolean!) { bulkUpdateRestaurantAiChatbotKnowledgeEnabled(input: $input, enabled: $enabled) }`;
const M_BULK_KNOWLEDGE_DELETE = gql`mutation BulkKnowledgeDelete($input: BulkAiChatbotIdsInput!) { bulkDeleteRestaurantAiChatbotKnowledge(input: $input) }`;
const M_IMPORT = gql`mutation ImportKnowledge($input: ImportAiChatbotKnowledgeInput!) { importRestaurantAiChatbotKnowledge(input: $input) { imported skipped errors } }`;
const M_BULK_DISMISS_SUGGESTION = gql`mutation BulkDismissSuggestions($input: BulkAiChatbotIdsInput!) { bulkDismissRestaurantAiChatbotKnowledgeSuggestions(input: $input) }`;
const M_BULK_DELETE_SUGGESTION = gql`mutation BulkDeleteSuggestions($input: BulkAiChatbotIdsInput!) { bulkDeleteRestaurantAiChatbotKnowledgeSuggestions(input: $input) }`;
const M_BULK_FEEDBACK_REVIEWED = gql`mutation BulkFeedbackReviewed($input: BulkAiChatbotIdsInput!) { bulkMarkAiChatbotAnswerFeedbackReviewed(input: $input) }`;
const M_BULK_FEEDBACK_IGNORE = gql`mutation BulkFeedbackIgnore($input: BulkAiChatbotIdsInput!) { bulkIgnoreAiChatbotAnswerFeedback(input: $input) }`;
const M_BULK_FEEDBACK_CONVERT = gql`mutation BulkFeedbackConvert($input: BulkAiChatbotIdsInput!) { bulkConvertAiChatbotFeedbackToSuggestion(input: $input) }`;
const M_BULK_SAFETY_ENABLED = gql`mutation BulkSafetyEnabled($input: BulkAiChatbotIdsInput!, $enabled: Boolean!) { bulkUpdateRestaurantAiChatbotSafetyRuleEnabled(input: $input, enabled: $enabled) }`;
const M_BULK_SAFETY_DELETE = gql`mutation BulkSafetyDelete($input: BulkAiChatbotIdsInput!) { bulkDeleteRestaurantAiChatbotSafetyRules(input: $input) }`;
const M_CREATE_EVAL_CASE = gql`mutation CreateEvalCase($input: CreateAiChatbotEvaluationCaseInput!) { createRestaurantAiChatbotEvaluationCase(input: $input) { id question enabled } }`;

export default function AiChatbotKnowledgePage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const restaurantId = String(restaurants[0]?.id || restaurants[0]?._id || "");
  const [tab, setTab] = useState("knowledge");
  const [selectedKnowledge, setSelectedKnowledge] = useState([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState([]);
  const [selectedFeedback, setSelectedFeedback] = useState([]);
  const [selectedSafety, setSelectedSafety] = useState([]);
  const [exportFormat, setExportFormat] = useState("json");
  const [importFormat, setImportFormat] = useState("json");
  const [importPayload, setImportPayload] = useState("");
  const [evaluationMessage, setEvaluationMessage] = useState("");

  const knowledgeQuery = useQuery(Q_KNOWLEDGE, { variables: { restaurantId, filter: {} }, skip: !restaurantId });
  const suggestionQuery = useQuery(Q_SUGGESTIONS, { variables: { restaurantId, filter: {} }, skip: !restaurantId });
  const feedbackQuery = useQuery(Q_FEEDBACK, { variables: { restaurantId, filter: {} }, skip: !restaurantId });
  const safetyQuery = useQuery(Q_SAFETY, { variables: { restaurantId, filter: {} }, skip: !restaurantId });
  const evalCasesQuery = useQuery(Q_EVAL_CASES, { variables: { restaurantId }, skip: !restaurantId });

  const [exportKnowledge] = useLazyQuery(Q_EXPORT);
  const [evaluatePrompt] = useLazyQuery(Q_EVALUATE);
  const [runSet] = useLazyQuery(Q_RUN_SET);
  const [bulkKnowledgeEnabled] = useMutation(M_BULK_KNOWLEDGE_ENABLED);
  const [bulkKnowledgeDelete] = useMutation(M_BULK_KNOWLEDGE_DELETE);
  const [importKnowledge] = useMutation(M_IMPORT);
  const [bulkDismissSuggestion] = useMutation(M_BULK_DISMISS_SUGGESTION);
  const [bulkDeleteSuggestion] = useMutation(M_BULK_DELETE_SUGGESTION);
  const [bulkFeedbackReviewed] = useMutation(M_BULK_FEEDBACK_REVIEWED);
  const [bulkFeedbackIgnore] = useMutation(M_BULK_FEEDBACK_IGNORE);
  const [bulkFeedbackConvert] = useMutation(M_BULK_FEEDBACK_CONVERT);
  const [bulkSafetyEnabled] = useMutation(M_BULK_SAFETY_ENABLED);
  const [bulkSafetyDelete] = useMutation(M_BULK_SAFETY_DELETE);
  const [createEvalCase] = useMutation(M_CREATE_EVAL_CASE);

  const knowledge = knowledgeQuery.data?.restaurantAiChatbotKnowledge || [];
  const suggestions = suggestionQuery.data?.restaurantAiChatbotKnowledgeSuggestions || [];
  const feedback = feedbackQuery.data?.restaurantAiChatbotAnswerFeedback || [];
  const safety = safetyQuery.data?.restaurantAiChatbotSafetyRules || [];
  const evalCases = evalCasesQuery.data?.restaurantAiChatbotEvaluationCases || [];
  const selectedEvalCaseIds = useMemo(() => evalCases.filter((item) => item.enabled).map((item) => item.id), [evalCases]);

  const toggle = (setter, id) => setter((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const idsInput = (ids) => ({ ids });

  return (
    <main className="ai-chatbot-admin">
      <h1>AI Chatbot Knowledge</h1>
      <section>
        <label>Export format<select aria-label="Export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}><option value="json">json</option><option value="csv">csv</option></select></label>
        <button type="button" onClick={() => exportKnowledge({ variables: { restaurantId, format: exportFormat } })}>Export</button>
        <label>Import format<select aria-label="Import format" value={importFormat} onChange={(event) => setImportFormat(event.target.value)}><option value="json">json</option><option value="csv">csv</option></select></label>
        <label>Import payload<textarea aria-label="Import payload" value={importPayload} onChange={(event) => setImportPayload(event.target.value)} /></label>
        <button type="button" onClick={() => importKnowledge({ variables: { input: { restaurantId, format: importFormat, payload: importPayload } } })}>Import</button>
      </section>
      <nav aria-label="AI chatbot tabs">
        {['knowledge', 'suggestions', 'feedback', 'safety', 'evaluation'].map((item) => <button key={item} type="button" onClick={() => setTab(item)}>{item}</button>)}
      </nav>

      {tab === "knowledge" ? <section><h2>Knowledge</h2>{knowledge.map((item) => <label key={item.id}><input aria-label={`knowledge-${item.id}`} type="checkbox" checked={selectedKnowledge.includes(item.id)} onChange={() => toggle(setSelectedKnowledge, item.id)} />{item.title}</label>)}<button type="button" onClick={() => bulkKnowledgeEnabled({ variables: { input: idsInput(selectedKnowledge), enabled: true } })}>Enable selected</button><button type="button" onClick={() => bulkKnowledgeEnabled({ variables: { input: idsInput(selectedKnowledge), enabled: false } })}>Disable selected</button><button type="button" onClick={() => bulkKnowledgeDelete({ variables: { input: idsInput(selectedKnowledge) } })}>Delete selected</button></section> : null}
      {tab === "suggestions" ? <section><h2>Suggestions</h2>{suggestions.map((item) => <label key={item.id}><input aria-label={`suggestion-${item.id}`} type="checkbox" checked={selectedSuggestions.includes(item.id)} onChange={() => toggle(setSelectedSuggestions, item.id)} />{item.question}</label>)}<button type="button" onClick={() => bulkDismissSuggestion({ variables: { input: idsInput(selectedSuggestions) } })}>Dismiss selected</button><button type="button" onClick={() => bulkDeleteSuggestion({ variables: { input: idsInput(selectedSuggestions) } })}>Delete selected</button></section> : null}
      {tab === "feedback" ? <section><h2>Feedback</h2>{feedback.map((item) => <label key={item.id}><input aria-label={`feedback-${item.id}`} type="checkbox" checked={selectedFeedback.includes(item.id)} onChange={() => toggle(setSelectedFeedback, item.id)} />{item.question}</label>)}<button type="button" onClick={() => bulkFeedbackReviewed({ variables: { input: idsInput(selectedFeedback) } })}>Mark reviewed selected</button><button type="button" onClick={() => bulkFeedbackIgnore({ variables: { input: idsInput(selectedFeedback) } })}>Ignore selected</button><button type="button" onClick={() => bulkFeedbackConvert({ variables: { input: idsInput(selectedFeedback) } })}>Convert selected to suggestions</button></section> : null}
      {tab === "safety" ? <section><h2>Safety</h2>{safety.map((item) => <label key={item.id}><input aria-label={`safety-${item.id}`} type="checkbox" checked={selectedSafety.includes(item.id)} onChange={() => toggle(setSelectedSafety, item.id)} />{item.pattern || item.ruleType}</label>)}<button type="button" onClick={() => bulkSafetyEnabled({ variables: { input: idsInput(selectedSafety), enabled: true } })}>Enable selected</button><button type="button" onClick={() => bulkSafetyEnabled({ variables: { input: idsInput(selectedSafety), enabled: false } })}>Disable selected</button><button type="button" onClick={() => bulkSafetyDelete({ variables: { input: idsInput(selectedSafety) } })}>Delete selected</button></section> : null}
      {tab === "evaluation" ? <section><h2>Evaluation Playground</h2><label>Evaluation message<textarea aria-label="Evaluation message" value={evaluationMessage} onChange={(event) => setEvaluationMessage(event.target.value)} /></label><button type="button" onClick={() => evaluatePrompt({ variables: { input: { restaurantId, message: evaluationMessage } } })}>Run test</button><button type="button" onClick={() => createEvalCase({ variables: { input: { restaurantId, question: evaluationMessage || "Untitled" } } })}>Save case</button><button type="button" onClick={() => runSet({ variables: { input: { restaurantId, caseIds: selectedEvalCaseIds } } })}>Run enabled set</button></section> : null}
    </main>
  );
}
