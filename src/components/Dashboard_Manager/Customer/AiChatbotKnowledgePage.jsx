import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";

const Q = gql`query ManagerAiKnowledge($restaurantId: ID!, $filter: AiChatbotKnowledgeFilterInput) { restaurantAiChatbotKnowledge(restaurantId: $restaurantId, filter: $filter) { id restaurantId title content category tags enabled priority sourceType updatedAt } }`;
const C = gql`mutation CreateAiKnowledge($input: CreateAiChatbotKnowledgeItemInput!) { createRestaurantAiChatbotKnowledgeItem(input: $input) { id } }`;
const U = gql`mutation UpdateAiKnowledge($input: UpdateAiChatbotKnowledgeItemInput!) { updateRestaurantAiChatbotKnowledgeItem(input: $input) { id } }`;
const D = gql`mutation DeleteAiKnowledge($id: ID!) { deleteRestaurantAiChatbotKnowledgeItem(id: $id) }`;

const blank = { id: "", title: "", content: "", category: "", tags: "", enabled: true, priority: 0, sourceType: "manual" };

export default function AiChatbotKnowledgePage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  const [search, setSearch] = useState("");
  const [enabled, setEnabled] = useState("all");
  const [form, setForm] = useState(blank);
  const [msg, setMsg] = useState("");
  const rid = restaurantId || restaurants?.[0]?.id || "";
  const filter = useMemo(() => ({ search: search || undefined, enabled: enabled === "all" ? undefined : enabled === "on" }), [search, enabled]);
  const { data, loading, error, refetch } = useQuery(Q, { skip: !rid, variables: { restaurantId: rid, filter } });
  const [createItem, { loading: creating }] = useMutation(C);
  const [updateItem, { loading: updating }] = useMutation(U);
  const [deleteItem] = useMutation(D);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    const payload = { ...form, restaurantId: rid, tags: String(form.tags || "").split(",").map((s) => s.trim()).filter(Boolean) };
    if (form.id) await updateItem({ variables: { input: { ...payload, id: form.id } } });
    else await createItem({ variables: { input: payload } });
    setForm(blank); setMsg("Đã lưu knowledge item."); refetch?.();
  };

  const rows = data?.restaurantAiChatbotKnowledge || [];

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
