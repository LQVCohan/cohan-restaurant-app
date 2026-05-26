import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";

const Q = gql`query ManagerAiSettings($restaurantId: ID!) { restaurantAiChatbotSettings(restaurantId: $restaurantId) { enabled welcomeMessage starterQuickReplies handoffEnabled handoffUnavailableMessage lowConfidenceHandoffThreshold fallbackMessage } }`;
const M = gql`mutation UpdateManagerAiSettings($input: UpdateAiChatbotSettingsInput!) { updateRestaurantAiChatbotSettings(input: $input) { enabled welcomeMessage starterQuickReplies handoffEnabled handoffUnavailableMessage lowConfidenceHandoffThreshold fallbackMessage updatedAt } }`;

export default function AiChatbotSettingsPage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  const effectiveRestaurantId = restaurantId || restaurants?.[0]?.id || "";
  const { data, loading, error, refetch } = useQuery(Q, { skip: !effectiveRestaurantId, variables: { restaurantId: effectiveRestaurantId } });
  const [save, { loading: saving }] = useMutation(M);
  const [ok, setOk] = useState("");
  const [form, setForm] = useState({ enabled: true, welcomeMessage: "", starterQuickReplies: [""], handoffEnabled: true, handoffUnavailableMessage: "", lowConfidenceHandoffThreshold: 0.6, fallbackMessage: "" });
  useEffect(() => { if (data?.restaurantAiChatbotSettings) setForm(data.restaurantAiChatbotSettings); }, [data]);
  const qrText = useMemo(() => (form.starterQuickReplies || []).join("\n"), [form.starterQuickReplies]);
  const submit = async () => { setOk(""); await save({ variables: { input: { ...form, restaurantId: effectiveRestaurantId, starterQuickReplies: qrText.split("\n") } } }); setOk("Đã lưu cài đặt AI chatbot."); refetch?.(); };
  return <section style={{ padding: 16 }}>
    <h2>AI Chatbot Settings</h2>
    <p>Lưu ý: hỗ trợ khung giờ nâng cao sẽ được bổ sung ở phase sau.</p>
    <label>Nhà hàng <select value={effectiveRestaurantId} onChange={(e) => setRestaurantId(e.target.value)}>{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    {loading ? <p>Đang tải...</p> : null}
    {error ? <p>{error.message}</p> : null}
    <div><label><input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> Bật chatbot</label></div>
    <div><label>Lời chào<textarea value={form.welcomeMessage || ""} onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))} /></label></div>
    <div><label>Quick replies<textarea value={qrText} onChange={(e) => setForm((f) => ({ ...f, starterQuickReplies: e.target.value.split("\n") }))} /></label></div>
    <div><label><input type="checkbox" checked={!!form.handoffEnabled} onChange={(e) => setForm((f) => ({ ...f, handoffEnabled: e.target.checked }))} /> Bật hỗ trợ nhân viên</label></div>
    <div><label>Tin nhắn không handoff<textarea value={form.handoffUnavailableMessage || ""} onChange={(e) => setForm((f) => ({ ...f, handoffUnavailableMessage: e.target.value }))} /></label></div>
    <div><label>Ngưỡng confidence <input type="number" min="0" max="1" step="0.05" value={form.lowConfidenceHandoffThreshold ?? 0.6} onChange={(e) => setForm((f) => ({ ...f, lowConfidenceHandoffThreshold: Number(e.target.value) }))} /></label></div>
    <div><label>Fallback message<textarea value={form.fallbackMessage || ""} onChange={(e) => setForm((f) => ({ ...f, fallbackMessage: e.target.value }))} /></label></div>
    <button disabled={saving || !effectiveRestaurantId} onClick={submit}>Lưu</button>
    <button disabled={saving} onClick={() => setForm({ enabled: true, welcomeMessage: "Xin chào, mình là trợ lý A.I của Cohan Restaurant App. Mình có thể hỗ trợ bạn về menu, đặt bàn, đơn hàng, coupon và hướng dẫn sử dụng hệ thống.", starterQuickReplies: ["Gợi ý món bán chạy cho tôi", "Tôi muốn đặt bàn", "Có mã giảm giá nào không?"], handoffEnabled: true, handoffUnavailableMessage: "Hiện nhà hàng chưa bật hỗ trợ nhân viên qua chatbot. Vui lòng thử lại sau hoặc liên hệ nhà hàng.", lowConfidenceHandoffThreshold: 0.6, fallbackMessage: "" })}>Reset mặc định</button>
    {ok ? <p>{ok}</p> : null}
  </section>;
}
