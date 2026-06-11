import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./AiChatbotAdmin.scss";

const Q = gql`
  query ManagerAiSettings($restaurantId: ID!) {
    restaurantAiChatbotSettings(restaurantId: $restaurantId) {
      enabled
      welcomeMessage
      starterQuickReplies
      handoffEnabled
      handoffUnavailableMessage
      lowConfidenceHandoffThreshold
      fallbackMessage
    }
  }
`;
const M = gql`
  mutation UpdateManagerAiSettings($input: UpdateAiChatbotSettingsInput!) {
    updateRestaurantAiChatbotSettings(input: $input) {
      enabled
      welcomeMessage
      starterQuickReplies
      handoffEnabled
      handoffUnavailableMessage
      lowConfidenceHandoffThreshold
      fallbackMessage
      updatedAt
    }
  }
`;

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

const normalizePermission = (value) => String(value || "").trim().toLowerCase();
const collectPermissionCodes = (user = {}) => {
  const set = new Set();
  const add = (permission) => {
    if (!permission) return;
    if (typeof permission === "string") set.add(normalizePermission(permission));
    else set.add(normalizePermission(permission.code || permission.permissionCode || permission.slug || permission.name));
  };
  [user.permissions, user.permissionCodes, user.effectivePermissions, user.effectivePermissionCodes, user.role?.permissions, user.role?.directPermissions, user.role?.parentRole?.permissions]
    .forEach((list) => Array.isArray(list) && list.forEach(add));
  return set;
};
const hasPermission = (user, permission) => {
  const codes = collectPermissionCodes(user);
  return codes.has("*") || codes.has(normalizePermission(permission));
};
const normalizeQuickReplies = (value) => String(value || "").split("\n").map((item) => item.trim()).filter(Boolean);

function PermissionFallback() {
  return <section className="ai-admin-page ai-admin-page--settings"><div className="ai-admin-empty"><h3>Không có quyền truy cập</h3><p>Bạn không có quyền xem cấu hình AI chatbot.</p></div></section>;
}

export default function AiChatbotSettingsPage() {
  const { user, restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  const effectiveRestaurantId = restaurantId || restaurants?.[0]?.id || "";
  const canReadSettings = hasPermission(user, "ai.chatbot.read") || hasPermission(user, "ai.chatbot.write");
  const canWriteSettings = hasPermission(user, "ai.chatbot.write");
  const { data, loading, error, refetch } = useQuery(Q, { skip: !effectiveRestaurantId || !canReadSettings, variables: { restaurantId: effectiveRestaurantId } });
  const [save, { loading: saving }] = useMutation(M);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState(defaultForm);

  useEffect(() => { if (data?.restaurantAiChatbotSettings) setForm(data.restaurantAiChatbotSettings); }, [data]);

  const quickRepliesText = useMemo(() => (form.starterQuickReplies || []).join("\n"), [form.starterQuickReplies]);
  const thresholdValue = Number(form.lowConfidenceHandoffThreshold ?? 0.6);
  const thresholdPercent = Number.isFinite(thresholdValue) ? Math.round(thresholdValue * 100) : 0;
  const quickReplyCount = normalizeQuickReplies(quickRepliesText).length;
  const readOnly = canReadSettings && !canWriteSettings;

  const updateForm = (patch) => { setNotice(""); setSaveError(""); setForm((current) => ({ ...current, ...patch })); };
  const validate = () => {
    const quickReplies = normalizeQuickReplies(quickRepliesText);
    const threshold = Number(form.lowConfidenceHandoffThreshold);
    if (String(form.welcomeMessage || "").trim().length > 500) return "Lời chào tối đa 500 ký tự.";
    if (String(form.fallbackMessage || "").trim().length > 500) return "Fallback message tối đa 500 ký tự.";
    if (String(form.handoffUnavailableMessage || "").trim().length > 500) return "Tin nhắn không handoff tối đa 500 ký tự.";
    if (quickReplies.length > 8) return "Tối đa 8 quick replies.";
    if (quickReplies.some((item) => item.length > 80)) return "Mỗi quick reply tối đa 80 ký tự.";
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) return "Ngưỡng confidence phải là số từ 0 đến 1.";
    return "";
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!effectiveRestaurantId) return;
    if (!canWriteSettings) { setSaveError("Bạn không có quyền chỉnh sửa cấu hình AI chatbot."); return; }
    const validationError = validate();
    if (validationError) { setSaveError(validationError); return; }
    setNotice(""); setSaveError("");
    try {
      await save({ variables: { input: { ...form, restaurantId: effectiveRestaurantId, starterQuickReplies: normalizeQuickReplies(quickRepliesText), lowConfidenceHandoffThreshold: Number(form.lowConfidenceHandoffThreshold) } } });
      setNotice("Đã lưu cài đặt AI chatbot.");
      refetch?.();
    } catch (mutationError) {
      setSaveError(mutationError?.message || "Không thể lưu cài đặt AI chatbot. Vui lòng thử lại.");
    }
  };
  const resetDefaults = () => { if (!canWriteSettings) return; setNotice(""); setSaveError(""); setForm(starterDefaults); };

  if (!canReadSettings) return <PermissionFallback />;
  const disabled = readOnly || saving;

  return (
    <section className="ai-admin-page ai-admin-page--settings">
      <header className="ai-admin-hero"><div className="ai-admin-hero__copy"><p className="ai-admin-eyebrow">Thiết lập AI</p><h2>Cài đặt Chatbot AI</h2><p>Cấu hình lời chào, gợi ý nhanh, handoff và ngưỡng độ chắc chắn.</p></div><label className="ai-admin-field ai-admin-field--restaurant"><span>Nhà hàng</span><select value={effectiveRestaurantId} onChange={(event) => setRestaurantId(event.target.value)} disabled={!restaurants.length}>{!restaurants.length ? <option value="">Chưa có nhà hàng</option> : null}{restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></label></header>
      <div className="ai-admin-metrics" aria-label="Trạng thái cấu hình AI chatbot"><article><span>Chatbot</span><strong>{form.enabled ? "Bật" : "Tắt"}</strong><small>{form.enabled ? "đang phục vụ khách" : "đang tạm tắt"}</small></article><article><span>Handoff</span><strong>{form.handoffEnabled ? "Bật" : "Tắt"}</strong><small>{form.handoffEnabled ? "nhân viên có thể tiếp nhận" : "AI không chuyển nhân viên"}</small></article><article><span>Độ chắc chắn</span><strong>{thresholdPercent}%</strong><small>{Number.isFinite(thresholdValue) ? thresholdValue.toFixed(2) : "—"} ngưỡng chuyển hỗ trợ</small></article><article><span>Quick replies</span><strong>{quickReplyCount}</strong><small>gợi ý mở đầu đang cấu hình</small></article></div>
      {readOnly ? <p className="ai-admin-notice" role="status">Chế độ chỉ xem: bạn không có quyền chỉnh sửa cấu hình AI chatbot.</p> : null}
      {loading ? <div className="ai-admin-skeleton" role="status">Đang tải cài đặt AI chatbot...</div> : null}
      {error ? <p className="ai-admin-error" role="alert">{error.message || "Không thể tải cài đặt AI chatbot."}</p> : null}
      {saveError ? <p className="ai-admin-error" role="alert">{saveError}</p> : null}
      {notice ? <p className="ai-admin-notice" role="status">{notice}</p> : null}
      <form className="ai-admin-grid ai-admin-grid--settings" id="ai-chatbot-settings-form" onSubmit={submit}>
        <article className="ai-admin-panel ai-admin-panel--main"><header className="ai-admin-panel__header"><div><p className="ai-admin-eyebrow">Nội dung khách nhìn thấy</p><h3>Lời chào và câu trả lời dự phòng</h3><p>Giữ giọng nói rõ ràng, thân thiện và tránh câu quá dài.</p></div><div className="ai-admin-actions ai-admin-actions--settings"><button type="submit" disabled={!canWriteSettings || saving || loading || !effectiveRestaurantId} title={!canWriteSettings ? "Thiếu quyền ai.chatbot.write" : ""}>{saving ? "Đang lưu..." : "Lưu"}</button><button type="button" className="ai-admin-button--secondary" disabled={!canWriteSettings || saving} title={!canWriteSettings ? "Thiếu quyền ai.chatbot.write" : ""} onClick={resetDefaults}>Reset mặc định</button></div></header><div className="ai-admin-form ai-admin-form--settings"><label className="ai-admin-check ai-admin-check--card"><input type="checkbox" checked={!!form.enabled} disabled={disabled} onChange={(event) => updateForm({ enabled: event.target.checked })} /><span>Bật chatbot</span><small>{form.enabled ? "Chatbot hiển thị và nhận câu hỏi của khách." : "Chatbot đang tắt trên kênh khách hàng."}</small></label><label className="ai-admin-field"><span>Lời chào</span><textarea value={form.welcomeMessage || ""} disabled={disabled} maxLength={500} onChange={(event) => updateForm({ welcomeMessage: event.target.value })} rows={6} /></label><label className="ai-admin-field"><span>Gợi ý nhanh</span><textarea value={quickRepliesText} disabled={disabled} onChange={(event) => updateForm({ starterQuickReplies: event.target.value.split("\n") })} rows={7} placeholder="Mỗi gợi ý một dòng" /><small className="ai-admin-help">Tối đa 8 dòng, mỗi dòng tối đa 80 ký tự.</small></label><label className="ai-admin-field"><span>Tin nhắn khi AI chưa chắc</span><textarea value={form.fallbackMessage || ""} disabled={disabled} maxLength={500} onChange={(event) => updateForm({ fallbackMessage: event.target.value })} rows={5} /></label></div></article>
        <aside className="ai-admin-panel ai-admin-panel--handoff"><header className="ai-admin-panel__header ai-admin-panel__header--compact"><div><p className="ai-admin-eyebrow">Handoff</p><h3>Chuyển nhân viên</h3><p>Cài đặt khi AI nên nhường lại cho nhân viên xử lý.</p></div></header><div className="ai-admin-form"><label className="ai-admin-check ai-admin-check--card"><input type="checkbox" checked={!!form.handoffEnabled} disabled={disabled} onChange={(event) => updateForm({ handoffEnabled: event.target.checked })} /><span>Bật hỗ trợ nhân viên</span><small>{form.handoffEnabled ? "Khách có thể được chuyển sang nhân viên khi cần." : "Chatbot sẽ không tạo yêu cầu handoff."}</small></label><label className="ai-admin-field"><span>Tin nhắn không handoff</span><textarea value={form.handoffUnavailableMessage || ""} disabled={disabled} maxLength={500} onChange={(event) => updateForm({ handoffUnavailableMessage: event.target.value })} rows={6} /></label><label className="ai-admin-field"><span>Ngưỡng độ chắc chắn</span><input type="number" min="0" max="1" step="0.05" value={form.lowConfidenceHandoffThreshold ?? 0.6} disabled={disabled} onChange={(event) => updateForm({ lowConfidenceHandoffThreshold: event.target.value })} /><small className="ai-admin-help">0.6 = 60%. AI sẽ cân nhắc handoff khi confidence thấp hơn ngưỡng này.</small></label><div className="ai-admin-empty ai-admin-empty--compact"><h4>Lưu ý vận hành</h4><p>Reset mặc định chỉ cập nhật form, không tự động lưu.</p></div></div></aside>
      </form>
    </section>
  );
}
