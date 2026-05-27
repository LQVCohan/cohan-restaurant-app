import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";

const Q = gql`query ManagerAiKnowledge($restaurantId: ID!, $filter: AiChatbotKnowledgeFilterInput) { restaurantAiChatbotKnowledge(restaurantId: $restaurantId, filter: $filter) { id restaurantId title content category tags enabled priority sourceType updatedAt } }`;
const Q_SUGGESTIONS = gql`query ManagerAiKnowledgeSuggestions($restaurantId: ID!, $filter: AiChatbotKnowledgeSuggestionFilterInput) { restaurantAiChatbotKnowledgeSuggestions(restaurantId: $restaurantId, filter: $filter) { id restaurantId question triggerType confidence occurrenceCount lastAskedAt suggestedTitle suggestedContent category tags status approvedKnowledgeItemId } }`;
const C = gql`mutation CreateAiKnowledge($input: CreateAiChatbotKnowledgeItemInput!) { createRestaurantAiChatbotKnowledgeItem(input: $input) { id } }`;
const U = gql`mutation UpdateAiKnowledge($input: UpdateAiChatbotKnowledgeItemInput!) { updateRestaurantAiChatbotKnowledgeItem(input: $input) { id } }`;
const D = gql`mutation DeleteAiKnowledge($id: ID!) { deleteRestaurantAiChatbotKnowledgeItem(id: $id) }`;
const APPROVE = gql`mutation ApproveAiSuggestion($id: ID!, $input: ApproveAiChatbotKnowledgeSuggestionInput!) { approveRestaurantAiChatbotKnowledgeSuggestion(id: $id, input: $input) { id } }`;
const DISMISS = gql`mutation DismissAiSuggestion($id: ID!) { dismissRestaurantAiChatbotKnowledgeSuggestion(id: $id) }`;
const DELETE_S = gql`mutation DeleteAiSuggestion($id: ID!) { deleteRestaurantAiChatbotKnowledgeSuggestion(id: $id) }`;
const Q_FEEDBACK = gql`query ManagerAiFeedback($restaurantId: ID!, $filter: AiChatbotAnswerFeedbackFilterInput) { restaurantAiChatbotAnswerFeedback(restaurantId: $restaurantId, filter: $filter) { id question answer reason confidence rating status createdAt } }`;
const FEEDBACK_REVIEW = gql`mutation MarkAiFeedbackReviewed($id: ID!) { markAiChatbotAnswerFeedbackReviewed(id: $id) }`;
const FEEDBACK_IGNORE = gql`mutation IgnoreAiFeedback($id: ID!) { ignoreAiChatbotAnswerFeedback(id: $id) }`;
const FEEDBACK_CONVERT = gql`mutation ConvertAiFeedback($id: ID!) { convertAiChatbotFeedbackToSuggestion(id: $id) }`;

const Q_SAFETY = gql`query ManagerAiSafety($restaurantId: ID!, $filter: AiChatbotSafetyRuleFilterInput) { restaurantAiChatbotSafetyRules(restaurantId: $restaurantId, filter: $filter) { id restaurantId ruleType pattern responseMessage enabled priority } }`;
const C_SAFETY = gql`mutation CreateAiSafety($input: CreateAiChatbotSafetyRuleInput!) { createRestaurantAiChatbotSafetyRule(input: $input) { id } }`;
const U_SAFETY = gql`mutation UpdateAiSafety($input: UpdateAiChatbotSafetyRuleInput!) { updateRestaurantAiChatbotSafetyRule(input: $input) { id } }`;
const D_SAFETY = gql`mutation DeleteAiSafety($id: ID!) { deleteRestaurantAiChatbotSafetyRule(id: $id) }`;


const blank = { id: "", title: "", content: "", category: "", tags: "", enabled: true, priority: 0, sourceType: "manual" };
const safetyBlank = { id: "", ruleType: "blocked_topic", pattern: "", responseMessage: "", enabled: true, priority: 0 };

export default function AiChatbotKnowledgePage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  const [search, setSearch] = useState("");
  const [enabled, setEnabled] = useState("all");
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState("");
  const [suggestionStatus, setSuggestionStatus] = useState("pending");
  const [suggestionTrigger, setSuggestionTrigger] = useState("all");
  const [suggestionSearch, setSuggestionSearch] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("not_helpful");
  const [feedbackStatus, setFeedbackStatus] = useState("new");
  const [safetyForm, setSafetyForm] = useState(safetyBlank);
  const [safetySearch, setSafetySearch] = useState("");
  const [safetyType, setSafetyType] = useState("all");
  const [safetyEnabled, setSafetyEnabled] = useState("all");
  const rid = restaurantId || restaurants?.[0]?.id || "";
  const filter = useMemo(() => ({ search: search || undefined, enabled: enabled === "all" ? undefined : enabled === "on" }), [search, enabled]);
  const suggestionFilter = useMemo(() => ({ status: suggestionStatus === "all" ? undefined : suggestionStatus, triggerType: suggestionTrigger === "all" ? undefined : suggestionTrigger, search: suggestionSearch || undefined }), [suggestionStatus, suggestionTrigger, suggestionSearch]);
  const { data, loading, error, refetch } = useQuery(Q, { skip: !rid, variables: { restaurantId: rid, filter } });
  const { data: suggestionData, loading: suggestionLoading, error: suggestionError, refetch: refetchSuggestion } = useQuery(Q_SUGGESTIONS, { skip: !rid, variables: { restaurantId: rid, filter: suggestionFilter } });
  const { data: feedbackData, loading: feedbackLoading, refetch: refetchFeedback } = useQuery(Q_FEEDBACK, { skip: !rid, variables: { restaurantId: rid, filter: { rating: feedbackRating === "all" ? undefined : feedbackRating, status: feedbackStatus === "all" ? undefined : feedbackStatus } } });
  const { data: safetyData, loading: safetyLoading, error: safetyError, refetch: refetchSafety } = useQuery(Q_SAFETY, { skip: !rid, variables: { restaurantId: rid, filter: { search: safetySearch || undefined, ruleType: safetyType === "all" ? undefined : safetyType, enabled: safetyEnabled === "all" ? undefined : safetyEnabled === "on" } } });
  const [createItem, { loading: creating }] = useMutation(C);
  const [updateItem, { loading: updating }] = useMutation(U);
  const [deleteItem] = useMutation(D);
  const [approveSuggestion] = useMutation(APPROVE);
  const [dismissSuggestion] = useMutation(DISMISS);
  const [deleteSuggestion] = useMutation(DELETE_S);
  const [markFeedbackReviewed] = useMutation(FEEDBACK_REVIEW);
  const [ignoreFeedback] = useMutation(FEEDBACK_IGNORE);
  const [convertFeedback] = useMutation(FEEDBACK_CONVERT);
  const [createSafety] = useMutation(C_SAFETY);
  const [updateSafety] = useMutation(U_SAFETY);
  const [deleteSafety] = useMutation(D_SAFETY);

  const onApproveSuggestion = async (s) => {
    const title = window.prompt("Title", s.suggestedTitle || s.question) || s.question;
    const contentRaw = window.prompt("Content", s.suggestedContent || "") || "";
    const content = String(contentRaw).trim();
    if (!content) {
      window.alert("Vui lòng nhập nội dung trả lời trước khi duyệt suggestion.");
      return;
    }
    await approveSuggestion({ variables: { id: s.id, input: { title, content, category: s.category || "", tags: s.tags || [], sourceType: "faq", enabled: true, priority: 50 } } });
    refetchSuggestion?.();
    refetch?.();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    const payload = { ...form, restaurantId: rid, tags: String(form.tags || "").split(",").map((s) => s.trim()).filter(Boolean) };
    if (form.id) await updateItem({ variables: { input: { ...payload, id: form.id } } });
    else await createItem({ variables: { input: payload } });
    setForm(blank); setMsg("Đã lưu knowledge item."); refetch?.();
  };

  const rows = data?.restaurantAiChatbotKnowledge || [];
  const suggestionRows = suggestionData?.restaurantAiChatbotKnowledgeSuggestions || [];
  const feedbackRows = feedbackData?.restaurantAiChatbotAnswerFeedback || [];
  const safetyRows = safetyData?.restaurantAiChatbotSafetyRules || [];

  return <section style={{ padding: 16 }}>
    <h2>AI Chatbot Knowledge Base</h2>
    <label>Nhà hàng <select value={rid} onChange={(e) => setRestaurantId(e.target.value)}>{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
      <input placeholder="Tìm theo title/content/tags" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select value={enabled} onChange={(e) => setEnabled(e.target.value)}><option value="all">Tất cả</option><option value="on">Đang bật</option><option value="off">Đã tắt</option></select>
      <button onClick={() => refetch?.()}>Lọc</button>
    </div>
    {loading ? <p>Đang tải...</p> : null}
    {error ? <p>{error.message}</p> : null}
    <ul>{rows.map((item) => <li key={item.id}>
      <strong>{item.title}</strong> ({item.sourceType}) [{item.enabled ? "on" : "off"}] prio:{item.priority}
      <div>{item.category || "-"} | {(item.tags || []).join(", ")}</div>
      <div>{item.content}</div>
      <button onClick={() => setForm({ ...item, tags: (item.tags || []).join(", ") })}>Sửa</button>
      <button onClick={async () => { await updateItem({ variables: { input: { id: item.id, enabled: !item.enabled } } }); refetch?.(); }}>{item.enabled ? "Tắt" : "Bật"}</button>
      <button onClick={async () => { if (!window.confirm("Xóa mục này?")) return; await deleteItem({ variables: { id: item.id } }); refetch?.(); }}>Xóa</button>
    </li>)}</ul>

    <h3 style={{ marginTop: 20 }}>Knowledge Gap Suggestions</h3>
    <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
      <input placeholder="Tìm câu hỏi" value={suggestionSearch} onChange={(e) => setSuggestionSearch(e.target.value)} />
      <select value={suggestionStatus} onChange={(e) => setSuggestionStatus(e.target.value)}><option value="pending">pending</option><option value="approved">approved</option><option value="dismissed">dismissed</option><option value="all">all</option></select>
      <select value={suggestionTrigger} onChange={(e) => setSuggestionTrigger(e.target.value)}><option value="all">all trigger</option><option value="fallback">fallback</option><option value="low_confidence">low_confidence</option><option value="handoff">handoff</option><option value="no_knowledge_match">no_knowledge_match</option></select>
      <button onClick={() => refetchSuggestion?.()}>Lọc gợi ý</button>
    </div>
    {suggestionLoading ? <p>Đang tải gợi ý...</p> : null}
    {suggestionError ? <p>{suggestionError.message}</p> : null}
    <ul>{suggestionRows.map((s) => <li key={s.id}>
      <strong>{s.question}</strong> [{s.status}] ({s.triggerType})
      <div>confidence: {s.confidence ?? "-"} | occurrences: {s.occurrenceCount} | lastAskedAt: {s.lastAskedAt || "-"}</div>
      <div>Gợi ý tiêu đề: {s.suggestedTitle || "-"}</div>
      <div>Gợi ý nội dung: {s.suggestedContent || "-"}</div>
      <div>{s.category || "-"} | {(s.tags || []).join(", ")}</div>
      {s.status === "pending" ? <>
        <button onClick={() => onApproveSuggestion(s)}>Approve</button>
        <button onClick={async () => { await dismissSuggestion({ variables: { id: s.id } }); refetchSuggestion?.(); }}>Dismiss</button>
      </> : null}
      <button onClick={async () => { if (!window.confirm("Xóa suggestion này?")) return; await deleteSuggestion({ variables: { id: s.id } }); refetchSuggestion?.(); }}>Delete</button>
    </li>)}</ul>


    <h3 style={{ marginTop: 20 }}>Safety Rules</h3>
    <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
      <input placeholder="Tìm pattern" value={safetySearch} onChange={(e) => setSafetySearch(e.target.value)} />
      <select value={safetyType} onChange={(e) => setSafetyType(e.target.value)}><option value="all">all type</option><option value="blocked_topic">blocked_topic</option><option value="required_disclaimer">required_disclaimer</option><option value="handoff_topic">handoff_topic</option><option value="allowed_scope">allowed_scope</option></select>
      <select value={safetyEnabled} onChange={(e) => setSafetyEnabled(e.target.value)}><option value="all">Tất cả</option><option value="on">Đang bật</option><option value="off">Đã tắt</option></select>
      <button onClick={() => refetchSafety?.()}>Lọc safety</button>
    </div>
    {safetyLoading ? <p>Đang tải safety rules...</p> : null}
    {safetyError ? <p>{safetyError.message}</p> : null}
    <ul>{safetyRows.map((r) => <li key={r.id}><strong>{r.ruleType}</strong> [{r.enabled ? "on" : "off"}] prio:{r.priority}<div>pattern: {r.pattern}</div><div>response: {r.responseMessage || "-"}</div><button onClick={() => setSafetyForm({ ...r })}>Sửa</button><button onClick={async () => { await updateSafety({ variables: { input: { id: r.id, enabled: !r.enabled } } }); refetchSafety?.(); }}>{r.enabled ? "Tắt" : "Bật"}</button><button onClick={async () => { if (!window.confirm("Xóa safety rule này?")) return; await deleteSafety({ variables: { id: r.id } }); refetchSafety?.(); }}>Xóa</button></li>)}</ul>
    <form onSubmit={async (e) => { e.preventDefault(); const payload = { ...safetyForm, restaurantId: rid, priority: Number(safetyForm.priority || 0) }; if (safetyForm.id) await updateSafety({ variables: { input: { ...payload, id: safetyForm.id } } }); else await createSafety({ variables: { input: payload } }); setSafetyForm(safetyBlank); refetchSafety?.(); }} style={{ marginTop: 12 }}>
      <h3>{safetyForm.id ? "Cập nhật" : "Tạo mới"} Safety rule</h3>
      <div><select value={safetyForm.ruleType} onChange={(e) => setSafetyForm((f) => ({ ...f, ruleType: e.target.value }))}><option value="blocked_topic">blocked_topic</option><option value="required_disclaimer">required_disclaimer</option><option value="handoff_topic">handoff_topic</option><option value="allowed_scope">allowed_scope</option></select></div>
      <div><input required placeholder="Pattern" maxLength={300} value={safetyForm.pattern} onChange={(e) => setSafetyForm((f) => ({ ...f, pattern: e.target.value }))} /></div>
      <div><textarea placeholder="Response message" maxLength={1000} value={safetyForm.responseMessage} onChange={(e) => setSafetyForm((f) => ({ ...f, responseMessage: e.target.value }))} /></div>
      <div><input type="number" min="0" max="100" value={safetyForm.priority} onChange={(e) => setSafetyForm((f) => ({ ...f, priority: Number(e.target.value) }))} /></div>
      <div><label><input type="checkbox" checked={!!safetyForm.enabled} onChange={(e) => setSafetyForm((f) => ({ ...f, enabled: e.target.checked }))} /> enabled</label></div>
      <button type="submit">Lưu safety</button><button type="button" onClick={() => setSafetyForm(safetyBlank)}>Hủy</button>
    </form>

    <h3 style={{ marginTop: 20 }}>Answer Feedback Review</h3>
    <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
      <select value={feedbackRating} onChange={(e) => setFeedbackRating(e.target.value)}><option value="not_helpful">not_helpful</option><option value="helpful">helpful</option><option value="all">all</option></select>
      <select value={feedbackStatus} onChange={(e) => setFeedbackStatus(e.target.value)}><option value="new">new</option><option value="reviewed">reviewed</option><option value="converted_to_suggestion">converted_to_suggestion</option><option value="ignored">ignored</option><option value="all">all</option></select>
      <button onClick={() => refetchFeedback?.()}>Lọc feedback</button>
    </div>
    {feedbackLoading ? <p>Đang tải feedback...</p> : null}
    <ul>{feedbackRows.map((f) => <li key={f.id}><strong>[{f.rating}]</strong> {f.question}<div>{f.answer}</div><div>Lý do: {f.reason || "-"} | confidence: {f.confidence ?? "-"} | status: {f.status}</div><button onClick={async () => { await markFeedbackReviewed({ variables: { id: f.id } }); refetchFeedback?.(); }}>Mark reviewed</button><button onClick={async () => { await ignoreFeedback({ variables: { id: f.id } }); refetchFeedback?.(); }}>Ignore</button><button onClick={async () => { await convertFeedback({ variables: { id: f.id } }); refetchFeedback?.(); refetchSuggestion?.(); }}>Convert to suggestion</button></li>)}</ul>

    <form onSubmit={onSubmit} style={{ marginTop: 12 }}>
      <h3>{form.id ? "Cập nhật" : "Tạo mới"} Knowledge item</h3>
      <div><input required placeholder="Title" maxLength={160} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
      <div><textarea required placeholder="Content" maxLength={3000} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} /></div>
      <div><input placeholder="Category" maxLength={80} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></div>
      <div><input placeholder="Tags cách nhau dấu phẩy" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} /></div>
      <div><input type="number" min="0" max="100" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} /></div>
      <div><select value={form.sourceType} onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value }))}><option value="manual">manual</option><option value="faq">faq</option><option value="policy">policy</option></select></div>
      <div><label><input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> enabled</label></div>
      <button disabled={creating || updating || !rid} type="submit">Lưu</button>
      <button type="button" onClick={() => setForm(blank)}>Hủy</button>
    </form>
    {msg ? <p>{msg}</p> : null}
  </section>;
}
