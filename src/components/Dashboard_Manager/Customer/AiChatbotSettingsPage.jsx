import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./AiChatbotAdmin.scss";

const Q = gql`query ManagerAiSettings($restaurantId: ID!) { restaurantAiChatbotSettings(restaurantId: $restaurantId) { enabled welcomeMessage starterQuickReplies handoffEnabled handoffUnavailableMessage lowConfidenceHandoffThreshold fallbackMessage } }`;
const M = gql`mutation UpdateManagerAiSettings($input: UpdateAiChatbotSettingsInput!) { updateRestaurantAiChatbotSettings(input: $input) { enabled welcomeMessage starterQuickReplies handoffEnabled handoffUnavailableMessage lowConfidenceHandoffThreshold fallbackMessage updatedAt } }`;

const defaultForm = { enabled: true, welcomeMessage: "", starterQuickReplies: [""], handoffEnabled: true, handoffUnavailableMessage: "", lowConfidenceHandoffThreshold: 0.6, fallbackMessage: "" };
const starterDefaults = {
  enabled: true,
  welcomeMessage: "Xin chào, mình là trợ lý A.I của Cohan Restaurant App. Mình có thể hỗ trợ bạn về menu, đặt bàn, đơn hàng, coupon và hướng dẫn sử dụng hệ thống.",
  starterQuickReplies: ["Gợi ý món bán chạy cho tôi", "Tôi muốn đặt bàn", "Có mã giảm giá nào không?"],
  handoffEnabled: true,
  handoffUnavailableMessage: "Hiện nhà hàng chưa bật hỗ trợ nhân viên qua chatbot. Vui lòng thử lại sau hoặc liên hệ nhà hàng.",
  lowConfidenceHandoffThreshold: 0.6,
  fallbackMessage: "",
};

export default function AiChatbotSettingsPage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  const effectiveRestaurantId = restaurantId || restaurants?.[0]?.id || "";
  const { data, loading, error, refetch } = useQuery(Q, { skip: !effectiveRestaurantId, variables: { restaurantId: effectiveRestaurantId } });
  const [save, { loading: saving }] = useMutation(M);
  const [ok, setOk] = useState("");
  const [form, setForm] = useState(defaultForm);

  useEffect(() => { if (data?.restaurantAiChatbotSettings) setForm(data.restaurantAiChatbotSettings); }, [data]);

  const qrText = useMemo(() => (form.starterQuickReplies || []).join("\n"), [form.starterQuickReplies]);
  const thresholdPercent = Math.round(Number(form.lowConfidenceHandoffThreshold ?? 0.6) * 100);
  const submit = async () => {
    setOk("");
    await save({ variables: { input: { ...form, restaurantId: effectiveRestaurantId, starterQuickReplies: qrText.split("\n").map((x) => x.trim()).filter(Boolean) } } });
    setOk("Đã lưu cài đặt AI chatbot.");
    refetch?.();
  };

  return <section className="ai-admin-page ai-admin-page--settings">
    <header className="ai-admin-hero">
      <div className="ai-admin-hero__copy">
        <p className="ai-admin-eyebrow">Thiết lập AI</p>
        <h2>AI Chatbot Settings</h2>
        <p>Tinh chỉnh lời chào, quick replies, handoff và ngưỡng confidence bằng bố cục dễ đọc, đủ khoảng trắng để cấu hình lâu không bị mỏi mắt.</p>
      </div>
      <label className="ai-admin-field ai-admin-field--restaurant"><span>Nhà hàng</span><select value={effectiveRestaurantId} onChange={(e) => setRestaurantId(e.target.value)}>{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
    </header>

    <div className="ai-admin-metrics" aria-label="Trạng thái cấu hình AI">
      <article><span>Chatbot</span><strong>{form.enabled ? "On" : "Off"}</strong><small>{form.enabled ? "đang phục vụ khách" : "đang tạm tắt"}</small></article>
      <article><span>Handoff</span><strong>{form.handoffEnabled ? "On" : "Off"}</strong><small>chuyển nhân viên khi cần</small></article>
      <article><span>Confidence</span><strong>{thresholdPercent}%</strong><small>ngưỡng chuyển hỗ trợ</small></article>
      <article><span>Quick replies</span><strong>{(form.starterQuickReplies || []).filter(Boolean).length}</strong><small>gợi ý mở đầu</small></article>
    </div>

    {loading ? <div className="ai-admin-skeleton">Đang tải...</div> : null}
    {error ? <p className="ai-admin-error" role="alert">{error.message}</p> : null}
    {ok ? <p className="ai-admin-notice" role="status">{ok}</p> : null}

    <div className="ai-admin-grid ai-admin-grid--settings">
      <article className="ai-admin-panel ai-admin-panel--main">
        <div className="ai-admin-panel__header">
          <div><p className="ai-admin-eyebrow">Nội dung khách nhìn thấy</p><h3>Lời chào và câu trả lời dự phòng</h3><p>Giữ giọng nói rõ ràng, thân thiện và tránh câu quá dài vì khách thường đọc nhanh trên điện thoại.</p></div>
          <div className="ai-admin-actions"><button type="button" disabled={saving || !effectiveRestaurantId} onClick={submit}>Lưu</button><button type="button" className="ai-admin-button--secondary" disabled={saving} onClick={() => setForm(starterDefaults)}>Reset mặc định</button></div>
        </div>
        <div className="ai-admin-form ai-admin-form--settings">
          <label className="ai-admin-check"><input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} /> <span>Bật chatbot</span></label>
          <label className="ai-admin-field"><span>Lời chào</span><textarea value={form.welcomeMessage || ""} onChange={(e) => setForm((f) => ({ ...f, welcomeMessage: e.target.value }))} rows={5} /></label>
          <label className="ai-admin-field"><span>Quick replies</span><textarea value={qrText} onChange={(e) => setForm((f) => ({ ...f, starterQuickReplies: e.target.value.split("\n") }))} rows={6} placeholder="Mỗi gợi ý một dòng" /></label>
          <label className="ai-admin-field"><span>Fallback message</span><textarea value={form.fallbackMessage || ""} onChange={(e) => setForm((f) => ({ ...f, fallbackMessage: e.target.value }))} rows={4} /></label>
        </div>
      </article>

      <aside className="ai-admin-panel">
        <div className="ai-admin-panel__header ai-admin-panel__header--compact"><div><p className="ai-admin-eyebrow">Handoff</p><h3>Chuyển nhân viên</h3><p>Cài đặt khi AI nên nhường lại cho nhân viên để xử lý thông tin của khách.</p></div></div>
        <div className="ai-admin-form">
          <label className="ai-admin-check"><input type="checkbox" checked={!!form.handoffEnabled} onChange={(e) => setForm((f) => ({ ...f, handoffEnabled: e.target.checked }))} /> <span>Bật hỗ trợ nhân viên</span></label>
          <label className="ai-admin-field"><span>Tin nhắn không handoff</span><textarea value={form.handoffUnavailableMessage || ""} onChange={(e) => setForm((f) => ({ ...f, handoffUnavailableMessage: e.target.value }))} rows={5} /></label>
          <label className="ai-admin-field"><span>Ngưỡng confidence</span><input type="number" min="0" max="1" step="0.05" value={form.lowConfidenceHandoffThreshold ?? 0.6} onChange={(e) => setForm((f) => ({ ...f, lowConfidenceHandoffThreshold: Number(e.target.value) }))} /></label>
          <div className="ai-admin-empty ai-admin-empty--compact"><h4>Lưu ý</h4><p>Hỗ trợ khung giờ nâng cao sẽ được bổ sung ở phase sau.</p></div>
        </div>
      </aside>
    </div>
  </section>;
}
