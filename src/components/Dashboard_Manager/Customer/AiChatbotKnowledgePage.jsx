import React, { useContext, useState } from "react";
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";

const Q = gql`query ManagerAiKnowledge($restaurantId: ID!, $filter: AiChatbotKnowledgeFilterInput) { restaurantAiChatbotKnowledge(restaurantId: $restaurantId, filter: $filter) { id title content category tags enabled priority sourceType } }`;
const Q_SUGGESTIONS = gql`query ManagerAiKnowledgeSuggestions($restaurantId: ID!, $filter: AiChatbotKnowledgeSuggestionFilterInput) { restaurantAiChatbotKnowledgeSuggestions(restaurantId: $restaurantId, filter: $filter) { id question status suggestedTitle suggestedContent category tags } }`;
const Q_FEEDBACK = gql`query ManagerAiFeedback($restaurantId: ID!, $filter: AiChatbotAnswerFeedbackFilterInput) { restaurantAiChatbotAnswerFeedback(restaurantId: $restaurantId, filter: $filter) { id question status } }`;
const Q_SAFETY = gql`query ManagerAiSafety($restaurantId: ID!, $filter: AiChatbotSafetyRuleFilterInput) { restaurantAiChatbotSafetyRules(restaurantId: $restaurantId, filter: $filter) { id ruleType pattern enabled priority responseMessage restaurantId } }`;
const Q_EXPORT = gql`query ExportAiKnowledge($restaurantId: ID!, $format: String) { exportRestaurantAiChatbotKnowledge(restaurantId: $restaurantId, format: $format) }`;
const Q_EVAL = gql`query EvalPrompt($input: EvaluateAiChatbotPromptInput!) { evaluateRestaurantAiChatbotPrompt(input: $input) { answer intent confidence isFallback handoffSuggested handoffReason handoffMessage knowledgeMatches { id title category sourceType score } safetyResult { blocked outOfScope disclaimers handoffSuggested matchedRuleIds } } }`;
const Q_EVAL_CASES = gql`query EvalCases($restaurantId: ID!) { restaurantAiChatbotEvaluationCases(restaurantId: $restaurantId) { id question expectedBehavior enabled } }`;
const Q_RUN_SET = gql`query RunEvalSet($input: RunAiChatbotEvaluationSetInput!) { runRestaurantAiChatbotEvaluationSet(input: $input) { caseId question answer confidence isFallback handoffSuggested safetyResult { blocked } } }`;

const C = gql`mutation CreateAiKnowledge($input: CreateAiChatbotKnowledgeItemInput!) { createRestaurantAiChatbotKnowledgeItem(input: $input) { id } }`;
const U = gql`mutation UpdateAiKnowledge($input: UpdateAiChatbotKnowledgeItemInput!) { updateRestaurantAiChatbotKnowledgeItem(input: $input) { id } }`;
const D = gql`mutation DeleteAiKnowledge($id: ID!) { deleteRestaurantAiChatbotKnowledgeItem(id: $id) }`;
const BULK_K_ENABLED = gql`mutation BulkKnowledgeEnabled($input: BulkAiChatbotIdsInput!, $enabled: Boolean!) { bulkUpdateRestaurantAiChatbotKnowledgeEnabled(input: $input, enabled: $enabled) }`;
const BULK_K_DELETE = gql`mutation BulkKnowledgeDelete($input: BulkAiChatbotIdsInput!) { bulkDeleteRestaurantAiChatbotKnowledge(input: $input) }`;
const IMPORT_K = gql`mutation ImportKnowledge($input: ImportAiChatbotKnowledgeInput!) { importRestaurantAiChatbotKnowledge(input: $input) { imported skipped errors } }`;

const APPROVE = gql`mutation ApproveAiSuggestion($id: ID!, $input: ApproveAiChatbotKnowledgeSuggestionInput!) { approveRestaurantAiChatbotKnowledgeSuggestion(id: $id, input: $input) { id } }`;
const DISMISS = gql`mutation DismissAiSuggestion($id: ID!) { dismissRestaurantAiChatbotKnowledgeSuggestion(id: $id) }`;
const DELETE_S = gql`mutation DeleteAiSuggestion($id: ID!) { deleteRestaurantAiChatbotKnowledgeSuggestion(id: $id) }`;
const BULK_DISMISS = gql`mutation BulkDismissSuggestion($input: BulkAiChatbotIdsInput!) { bulkDismissRestaurantAiChatbotKnowledgeSuggestions(input: $input) }`;
const BULK_DELETE_S = gql`mutation BulkDeleteSuggestion($input: BulkAiChatbotIdsInput!) { bulkDeleteRestaurantAiChatbotKnowledgeSuggestions(input: $input) }`;

const FEEDBACK_REVIEW = gql`mutation MarkAiFeedbackReviewed($id: ID!) { markAiChatbotAnswerFeedbackReviewed(id: $id) }`;
const FEEDBACK_IGNORE = gql`mutation IgnoreAiFeedback($id: ID!) { ignoreAiChatbotAnswerFeedback(id: $id) }`;
const FEEDBACK_CONVERT = gql`mutation ConvertAiFeedback($id: ID!) { convertAiChatbotFeedbackToSuggestion(id: $id) }`;
const BULK_F_REVIEW = gql`mutation BulkFeedbackReviewed($input: BulkAiChatbotIdsInput!) { bulkMarkAiChatbotAnswerFeedbackReviewed(input: $input) }`;
const BULK_F_IGNORE = gql`mutation BulkFeedbackIgnore($input: BulkAiChatbotIdsInput!) { bulkIgnoreAiChatbotAnswerFeedback(input: $input) }`;
const BULK_F_CONVERT = gql`mutation BulkFeedbackConvert($input: BulkAiChatbotIdsInput!) { bulkConvertAiChatbotFeedbackToSuggestion(input: $input) }`;

const C_SAFETY = gql`mutation CreateAiSafety($input: CreateAiChatbotSafetyRuleInput!) { createRestaurantAiChatbotSafetyRule(input: $input) { id } }`;
const U_SAFETY = gql`mutation UpdateAiSafety($input: UpdateAiChatbotSafetyRuleInput!) { updateRestaurantAiChatbotSafetyRule(input: $input) { id } }`;
const D_SAFETY = gql`mutation DeleteAiSafety($id: ID!) { deleteRestaurantAiChatbotSafetyRule(id: $id) }`;
const BULK_SAFE_ENABLED = gql`mutation BulkSafetyEnabled($input: BulkAiChatbotIdsInput!, $enabled: Boolean!) { bulkUpdateRestaurantAiChatbotSafetyRuleEnabled(input: $input, enabled: $enabled) }`;
const BULK_SAFE_DELETE = gql`mutation BulkSafetyDelete($input: BulkAiChatbotIdsInput!) { bulkDeleteRestaurantAiChatbotSafetyRules(input: $input) }`;
const M_CREATE_CASE = gql`mutation CreateEvalCase($input: CreateAiChatbotEvaluationCaseInput!) { createRestaurantAiChatbotEvaluationCase(input: $input) { id } }`;

const blank = { id: "", title: "", content: "", category: "", tags: "", enabled: true, priority: 0, sourceType: "manual" };
const safetyBlank = { id: "", ruleType: "blocked_topic", pattern: "", responseMessage: "", enabled: true, priority: 0 };

const toggle = (arr, id) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

export default function AiChatbotKnowledgePage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [activeTab, setActiveTab] = useState("knowledge");
  const [restaurantId, setRestaurantId] = useState("");
  const [form, setForm] = useState(blank);
  const [safetyForm, setSafetyForm] = useState(safetyBlank);
  const [notice, setNotice] = useState("");
  const [exportFormat, setExportFormat] = useState("json");
  const [importFormat, setImportFormat] = useState("json");
  const [importPayload, setImportPayload] = useState("");
  const [exportOutput, setExportOutput] = useState("");
  const [knowledgeSel, setKnowledgeSel] = useState([]);
  const [suggestionSel, setSuggestionSel] = useState([]);
  const [feedbackSel, setFeedbackSel] = useState([]);
  const [safetySel, setSafetySel] = useState([]);
  const [evalMessage, setEvalMessage] = useState("");
  const [evalResult, setEvalResult] = useState(null);
  const [evalSetResults, setEvalSetResults] = useState([]);

  const rid = restaurantId || restaurants?.[0]?.id || "";
  const { data, refetch } = useQuery(Q, { skip: !rid, variables: { restaurantId: rid, filter: {} } });
  const { data: suggestionData, refetch: refetchSuggestion } = useQuery(Q_SUGGESTIONS, { skip: !rid, variables: { restaurantId: rid, filter: { status: "pending" } } });
  const { data: feedbackData, refetch: refetchFeedback } = useQuery(Q_FEEDBACK, { skip: !rid, variables: { restaurantId: rid, filter: {} } });
  const { data: safetyData, refetch: refetchSafety } = useQuery(Q_SAFETY, { skip: !rid, variables: { restaurantId: rid, filter: {} } });
  const { data: evalCasesData, refetch: refetchEvalCases } = useQuery(Q_EVAL_CASES, { skip: !rid, variables: { restaurantId: rid } });

  const rows = data?.restaurantAiChatbotKnowledge || [];
  const suggestionRows = suggestionData?.restaurantAiChatbotKnowledgeSuggestions || [];
  const feedbackRows = feedbackData?.restaurantAiChatbotAnswerFeedback || [];
  const safetyRows = safetyData?.restaurantAiChatbotSafetyRules || [];

  const [createItem] = useMutation(C); const [updateItem] = useMutation(U); const [deleteItem] = useMutation(D);
  const [bulkKnowledgeEnabled] = useMutation(BULK_K_ENABLED); const [bulkKnowledgeDelete] = useMutation(BULK_K_DELETE);
  const [importKnowledge] = useMutation(IMPORT_K); const [exportKnowledge] = useLazyQuery(Q_EXPORT, { fetchPolicy: "no-cache" });
  const [runEvalPrompt] = useLazyQuery(Q_EVAL, { fetchPolicy: "no-cache" });
  const [runEvalSet] = useLazyQuery(Q_RUN_SET, { fetchPolicy: "no-cache" });
  const [createEvalCase] = useMutation(M_CREATE_CASE);

  const [approveSuggestion] = useMutation(APPROVE); const [dismissSuggestion] = useMutation(DISMISS); const [deleteSuggestion] = useMutation(DELETE_S);
  const [bulkDismissSuggestion] = useMutation(BULK_DISMISS); const [bulkDeleteSuggestion] = useMutation(BULK_DELETE_S);

  const [markFeedbackReviewed] = useMutation(FEEDBACK_REVIEW); const [ignoreFeedback] = useMutation(FEEDBACK_IGNORE); const [convertFeedback] = useMutation(FEEDBACK_CONVERT);
  const [bulkFeedbackReviewed] = useMutation(BULK_F_REVIEW); const [bulkFeedbackIgnore] = useMutation(BULK_F_IGNORE); const [bulkFeedbackConvert] = useMutation(BULK_F_CONVERT);

  const [createSafety] = useMutation(C_SAFETY); const [updateSafety] = useMutation(U_SAFETY); const [deleteSafety] = useMutation(D_SAFETY);
  const [bulkSafetyEnabled] = useMutation(BULK_SAFE_ENABLED); const [bulkSafetyDelete] = useMutation(BULK_SAFE_DELETE);

  const onFail = (e, l) => setNotice(`${l} thất bại: ${e?.message || "Lỗi"}`);

  const bulk = async (fn, ok, done) => { try { await fn(); await done?.(); setNotice(ok); } catch (e) { onFail(e, ok); } };

  return <section style={{ padding: 16 }}>
    <h2>AI Chatbot Knowledge Base</h2>
    <label>Nhà hàng <select value={rid} onChange={(e) => setRestaurantId(e.target.value)}>{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    <div style={{ margin: "8px 0" }}>{["knowledge", "suggestions", "feedback", "safety", "evaluation"].map((t) => <button key={t} onClick={() => setActiveTab(t)} disabled={t === activeTab}>{t}</button>)}</div>
    {notice ? <p>{notice}</p> : null}

    {activeTab === "knowledge" && <div>
      <h3>Knowledge Base</h3>
      <p>Selected: {knowledgeSel.length}</p>
      <button onClick={() => bulk(() => bulkKnowledgeEnabled({ variables: { input: { ids: knowledgeSel }, enabled: true } }), "Bulk knowledge success", async () => { setKnowledgeSel([]); await refetch?.(); })}>Enable selected</button>
      <button onClick={() => bulk(() => bulkKnowledgeEnabled({ variables: { input: { ids: knowledgeSel }, enabled: false } }), "Bulk knowledge success", async () => { setKnowledgeSel([]); await refetch?.(); })}>Disable selected</button>
      <button onClick={() => { if (!window.confirm("Delete selected knowledge?")) return; bulk(() => bulkKnowledgeDelete({ variables: { input: { ids: knowledgeSel } } }), "Bulk knowledge success", async () => { setKnowledgeSel([]); await refetch?.(); }); }}>Delete selected</button>

      <h4>Import/Export</h4>
      <label>Export format <select aria-label="Export format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}><option value="json">json</option><option value="csv">csv</option></select></label>
      <button onClick={async () => { try { const out = await exportKnowledge({ variables: { restaurantId: rid, format: exportFormat } }); setExportOutput(out?.data?.exportRestaurantAiChatbotKnowledge || ""); setNotice("Export thành công."); } catch (e) { onFail(e, "Export"); } }}>Export</button>
      <textarea aria-label="Export output" value={exportOutput} onChange={(e) => setExportOutput(e.target.value)} rows={6} style={{ width: "100%" }} />
      <label>Import format <select aria-label="Import format" value={importFormat} onChange={(e) => setImportFormat(e.target.value)}><option value="json">json</option><option value="csv">csv</option></select></label>
      <textarea aria-label="Import payload" value={importPayload} onChange={(e) => setImportPayload(e.target.value)} rows={6} style={{ width: "100%" }} />
      <button onClick={async () => { try { const out = await importKnowledge({ variables: { input: { restaurantId: rid, format: importFormat, payload: importPayload } } }); const res = out?.data?.importRestaurantAiChatbotKnowledge; setNotice(`Import: imported=${res?.imported || 0}, skipped=${res?.skipped || 0}, errors=${(res?.errors || []).length}`); await refetch?.(); } catch (e) { onFail(e, "Import"); } }}>Import</button>

      <ul>{rows.map((item) => <li key={item.id}><input type="checkbox" aria-label={`knowledge-${item.id}`} checked={knowledgeSel.includes(item.id)} onChange={() => setKnowledgeSel((s) => toggle(s, item.id))} /> <strong>{item.title}</strong>
        <button onClick={() => setForm({ ...item, tags: (item.tags || []).join(", ") })}>Sửa</button>
        <button onClick={async () => { try { await updateItem({ variables: { input: { id: item.id, enabled: !item.enabled } } }); await refetch?.(); } catch (e) { onFail(e, "Cập nhật knowledge"); } }}>{item.enabled ? "Tắt" : "Bật"}</button>
        <button onClick={async () => { if (!window.confirm("Xóa mục này?")) return; try { await deleteItem({ variables: { id: item.id } }); await refetch?.(); } catch (e) { onFail(e, "Xóa knowledge"); } }}>Xóa</button>
      </li>)}</ul>
      <form onSubmit={async (e) => { e.preventDefault(); try { const payload = { ...form, restaurantId: rid, tags: String(form.tags || "").split(",").map((s) => s.trim()).filter(Boolean) }; if (form.id) await updateItem({ variables: { input: { ...payload, id: form.id } } }); else await createItem({ variables: { input: payload } }); setForm(blank); await refetch?.(); } catch (err) { onFail(err, "Lưu knowledge"); } }}>
        <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <textarea required value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
        <button type="submit">Lưu</button>
      </form>
    </div>}

    {activeTab === "suggestions" && <div><h3>Knowledge Gap Suggestions</h3><p>Selected: {suggestionSel.length}</p>
      <button onClick={() => bulk(() => bulkDismissSuggestion({ variables: { input: { ids: suggestionSel } } }), "Bulk suggestion success", async () => { setSuggestionSel([]); await refetchSuggestion?.(); })}>Dismiss selected</button>
      <button onClick={() => { if (!window.confirm("Delete selected suggestions?")) return; bulk(() => bulkDeleteSuggestion({ variables: { input: { ids: suggestionSel } } }), "Bulk suggestion success", async () => { setSuggestionSel([]); await refetchSuggestion?.(); }); }}>Delete selected</button>
      <ul>{suggestionRows.map((s) => <li key={s.id}><input type="checkbox" aria-label={`suggestion-${s.id}`} checked={suggestionSel.includes(s.id)} onChange={() => setSuggestionSel((x) => toggle(x, s.id))} /> {s.question}
        <button onClick={async () => { try { await approveSuggestion({ variables: { id: s.id, input: { title: s.suggestedTitle || s.question, content: s.suggestedContent || s.question, category: s.category || "", tags: s.tags || [], sourceType: "faq", enabled: true, priority: 50 } } }); await refetchSuggestion?.(); await refetch?.(); } catch (e) { onFail(e, "Duyệt suggestion"); } }}>Approve</button>
        <button onClick={async () => { try { await dismissSuggestion({ variables: { id: s.id } }); await refetchSuggestion?.(); } catch (e) { onFail(e, "Dismiss suggestion"); } }}>Dismiss</button>
        <button onClick={async () => { try { await deleteSuggestion({ variables: { id: s.id } }); await refetchSuggestion?.(); } catch (e) { onFail(e, "Delete suggestion"); } }}>Delete</button>
      </li>)}</ul>
    </div>}

    {activeTab === "feedback" && <div><h3>Answer Feedback Review</h3><p>Selected: {feedbackSel.length}</p>
      <button onClick={() => bulk(() => bulkFeedbackReviewed({ variables: { input: { ids: feedbackSel } } }), "Bulk feedback success", async () => { setFeedbackSel([]); await refetchFeedback?.(); })}>Mark reviewed selected</button>
      <button onClick={() => bulk(() => bulkFeedbackIgnore({ variables: { input: { ids: feedbackSel } } }), "Bulk feedback success", async () => { setFeedbackSel([]); await refetchFeedback?.(); })}>Ignore selected</button>
      <button onClick={() => bulk(() => bulkFeedbackConvert({ variables: { input: { ids: feedbackSel } } }), "Bulk feedback success", async () => { setFeedbackSel([]); await refetchFeedback?.(); await refetchSuggestion?.(); })}>Convert selected to suggestions</button>
      <ul>{feedbackRows.map((f) => <li key={f.id}><input type="checkbox" aria-label={`feedback-${f.id}`} checked={feedbackSel.includes(f.id)} onChange={() => setFeedbackSel((x) => toggle(x, f.id))} /> {f.question}
        <button onClick={() => markFeedbackReviewed({ variables: { id: f.id } })}>Mark reviewed</button>
        <button onClick={() => ignoreFeedback({ variables: { id: f.id } })}>Ignore</button>
        <button onClick={() => convertFeedback({ variables: { id: f.id } })}>Convert to suggestion</button>
      </li>)}</ul>
    </div>}

    {activeTab === "safety" && <div><h3>Safety Rules</h3><p>Selected: {safetySel.length}</p>
      <button onClick={() => bulk(() => bulkSafetyEnabled({ variables: { input: { ids: safetySel }, enabled: true } }), "Bulk safety success", async () => { setSafetySel([]); await refetchSafety?.(); })}>Enable selected</button>
      <button onClick={() => bulk(() => bulkSafetyEnabled({ variables: { input: { ids: safetySel }, enabled: false } }), "Bulk safety success", async () => { setSafetySel([]); await refetchSafety?.(); })}>Disable selected</button>
      <button onClick={() => { if (!window.confirm("Delete selected safety rules?")) return; bulk(() => bulkSafetyDelete({ variables: { input: { ids: safetySel } } }), "Bulk safety success", async () => { setSafetySel([]); await refetchSafety?.(); }); }}>Delete selected</button>
      <ul>{safetyRows.map((r) => <li key={r.id}><input type="checkbox" aria-label={`safety-${r.id}`} checked={safetySel.includes(r.id)} onChange={() => setSafetySel((x) => toggle(x, r.id))} /> {r.ruleType}
        <button onClick={() => setSafetyForm({ ...r })}>Sửa</button>
        <button onClick={() => deleteSafety({ variables: { id: r.id } })}>Xóa</button>
      </li>)}</ul>
      <form onSubmit={async (e) => { e.preventDefault(); try { const payload = { ...safetyForm, restaurantId: rid, priority: Number(safetyForm.priority || 0) }; if (safetyForm.id) await updateSafety({ variables: { input: payload } }); else await createSafety({ variables: { input: payload } }); setSafetyForm(safetyBlank); await refetchSafety?.(); } catch (e2) { onFail(e2, "Lưu safety"); } }}>
        <input placeholder="Pattern" required value={safetyForm.pattern} onChange={(e) => setSafetyForm((f) => ({ ...f, pattern: e.target.value }))} />
        <button type="submit">Lưu safety</button>
      </form>
    </div>}
    {activeTab === "evaluation" && <div>
      <h3>Evaluation Playground</h3>
      <textarea aria-label="Evaluation message" value={evalMessage} onChange={(e) => setEvalMessage(e.target.value)} rows={5} style={{ width: "100%" }} />
      <button onClick={async () => { try { const out = await runEvalPrompt({ variables: { input: { restaurantId: rid, message: evalMessage.trim(), includeDebug: true } } }); setEvalResult(out?.data?.evaluateRestaurantAiChatbotPrompt || null); setNotice("Run evaluation thành công."); } catch (e) { onFail(e, "Run evaluation"); } }}>Run test</button>
      <button onClick={async () => { try { await createEvalCase({ variables: { input: { restaurantId: rid, question: evalMessage.trim(), enabled: true } } }); await refetchEvalCases?.(); setNotice("Đã lưu evaluation case."); } catch (e) { onFail(e, "Save case"); } }}>Save case</button>
      <button onClick={async () => { try { const out = await runEvalSet({ variables: { input: { restaurantId: rid, includeDebug: false } } }); setEvalSetResults(out?.data?.runRestaurantAiChatbotEvaluationSet || []); setNotice("Đã chạy evaluation set."); } catch (e) { onFail(e, "Run evaluation set"); } }}>Run enabled set</button>
      {evalResult ? <pre>{JSON.stringify(evalResult, null, 2)}</pre> : null}
      <p>Evaluation cases: {(evalCasesData?.restaurantAiChatbotEvaluationCases || []).length}</p>
      <ul>{(evalCasesData?.restaurantAiChatbotEvaluationCases || []).slice(0, 10).map((c) => <li key={c.id}>{c.question}</li>)}</ul>
      {evalSetResults?.length ? <p>Run set results: {evalSetResults.length}</p> : null}
    </div>}
  </section>;
}
