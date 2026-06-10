import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./AiChatbotAdmin.scss";

const Q = gql`query ManagerAiSettings($restaurantId: ID!) { restaurantAiChatbotSettings(restaurantId: $restaurantId) { enabled welcomeMessage starterQuickReplies handoffEnabled handoffUnavailableMessage lowConfidenceHandoffThreshold fallbackMessage } }`;
const M = gql`mutation UpdateManagerAiSettings($input: UpdateAiChatbotSettingsInput!) { updateRestaurantAiChatbotSettings(input: $input) { enabled welcomeMessage starterQuickReplies handoffEnabled handoffUnavailableMessage lowConfidenceHandoffThreshold fallbackMessage updatedAt } }`;

const defaultForm = {
  enabled: true,
  welcomeMessage: "",
  starterQuickReplies: [""],
  handoffEnabled: true,
  handoffUnavailableMessage: "",
  lowConfidenceHandoffThreshold: 0.6,
  fallbackMessage: "",
};

const starterDefaults = {
  enabled: true,
  welcomeMessage: "Xin chào, mình là trợ lý A.I của Cohan Restaurant App. Mình có thể hỗ trợ bạn về menu, đặt bàn, đơn hàng, coupon và hướng dẫn sử dụng hệ thống.",
  starterQuickReplies: ["Gợi ý món bán chạy cho tôi", "Tôi muốn đặt bàn", "Có mã giảm giá nào không?"],
  handoffEnabled: true,
  handoffUnavailableMessage: "Hiện nhà hàng chưa bật hỗ trợ nhân viên qua chatbot. Vui lòng thử lại sau hoặc liên hệ nhà hàng.",
  lowConfidenceHandoffThreshold: 0.6,
  fallbackMessage: "",
};

const normalizeQuickReplies = (value) =>
  String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export default function AiChatbotSettingsPage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  const effectiveRestaurantId = restaurantId || restaurants?.[0]?.id || "";
  const { data, loading, error, refetch } = useQuery(Q, {
    skip: !effectiveRestaurantId,
    variables: { restaurantId: effectiveRestaurantId },
  });
  const [save, { loading: saving }] = useMutation(M);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (data?.restaurantAiChatbotSettings) setForm(data.restaurantAiChatbotSettings);
  }, [data]);

  const quickRepliesText = useMemo(() => (form.starterQuickReplies || []).join("\n"), [form.starterQuickReplies]);
  const thresholdValue = Number(form.lowConfidenceHandoffThreshold ?? 0.6);
  const thresholdPercent = Math.round(thresholdValue * 100);
  const quickReplyCount = normalizeQuickReplies(quickRepliesText).length;

  const updateForm = (patch) => {
    setNotice("");
    setSaveError("");
    setForm((current) => ({ ...current, ...patch }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!effectiveRestaurantId) return;

    setNotice("");
    setSaveError("");

    try {
      await save({
        variables: {
          input: {
            ...form,
            restaurantId: effectiveRestaurantId,
            starterQuickReplies: normalizeQuickReplies(quickRepliesText),
            lowConfidenceHandoffThreshold: thresholdValue,
          },
        },
      });
      setNotice("Đã lưu cài đặt AI chatbot.");
      refetch?.();
    } catch (mutationError) {
      setSaveError(mutationError?.message || "Không thể lưu cài đặt AI chatbot. Vui lòng thử lại.");
    }
  };

  const resetDefaults = () => {
    setNotice("");
    setSaveError("");
    setForm(starterDefaults);
  };

  return (
    <section className="ai-admin-page ai-admin-page--settings">
      <header className="ai-admin-hero">
        <div className="ai-admin-hero__copy">
          <p className="ai-admin-eyebrow">Thiết lập AI</p>
          <h2>AI Chatbot Settings</h2>
          <p>
            Cấu hình lời chào, quick replies, handoff và ngưỡng confidence trong một không gian dịu mắt,
            dễ rà soát khi manager cần tinh chỉnh chatbot trong thời gian dài.
          </p>
        </div>

        <label className="ai-admin-field ai-admin-field--restaurant">
          <span>Nhà hàng</span>
          <select value={effectiveRestaurantId} onChange={(event) => setRestaurantId(event.target.value)} disabled={!restaurants.length}>
            {!restaurants.length ? <option value="">Chưa có nhà hàng</option> : null}
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
            ))}
          </select>
        </label>
      </header>

      <div className="ai-admin-metrics" aria-label="Trạng thái cấu hình AI chatbot">
        <article>
          <span>Chatbot</span>
          <strong>{form.enabled ? "On" : "Off"}</strong>
          <small>{form.enabled ? "đang phục vụ khách" : "đang tạm tắt"}</small>
        </article>
        <article>
          <span>Handoff</span>
          <strong>{form.handoffEnabled ? "On" : "Off"}</strong>
          <small>{form.handoffEnabled ? "nhân viên có thể tiếp nhận" : "AI không chuyển nhân viên"}</small>
        </article>
        <article>
          <span>Confidence</span>
          <strong>{thresholdPercent}%</strong>
          <small>{thresholdValue.toFixed(2)} = {thresholdPercent}% ngưỡng chuyển hỗ trợ</small>
        </article>
        <article>
          <span>Quick replies</span>
          <strong>{quickReplyCount}</strong>
          <small>gợi ý mở đầu đang cấu hình</small>
        </article>
      </div>

      {loading ? <div className="ai-admin-skeleton" role="status">Đang tải cài đặt AI chatbot...</div> : null}
      {error ? <p className="ai-admin-error" role="alert">{error.message || "Không thể tải cài đặt AI chatbot."}</p> : null}
      {saveError ? <p className="ai-admin-error" role="alert">{saveError}</p> : null}
      {notice ? <p className="ai-admin-notice" role="status">{notice}</p> : null}

      <form className="ai-admin-grid ai-admin-grid--settings" id="ai-chatbot-settings-form" onSubmit={submit}>
        <article className="ai-admin-panel ai-admin-panel--main">
          <header className="ai-admin-panel__header">
            <div>
              <p className="ai-admin-eyebrow">Nội dung khách nhìn thấy</p>
              <h3>Lời chào và câu trả lời dự phòng</h3>
              <p>Giữ giọng nói rõ ràng, thân thiện và tránh câu quá dài vì khách thường đọc nhanh trên điện thoại.</p>
            </div>
            <div className="ai-admin-actions ai-admin-actions--settings">
              <button type="submit" disabled={saving || loading || !effectiveRestaurantId}>{saving ? "Đang lưu..." : "Lưu"}</button>
              <button type="button" className="ai-admin-button--secondary" disabled={saving} onClick={resetDefaults}>Reset mặc định</button>
            </div>
          </header>

          <div className="ai-admin-form ai-admin-form--settings">
            <label className="ai-admin-check ai-admin-check--card">
              <input type="checkbox" checked={!!form.enabled} onChange={(event) => updateForm({ enabled: event.target.checked })} />
              <span>Bật chatbot</span>
              <small>{form.enabled ? "Chatbot hiển thị và nhận câu hỏi của khách." : "Chatbot đang tắt trên kênh khách hàng."}</small>
            </label>

            <label className="ai-admin-field">
              <span>Lời chào</span>
              <textarea
                value={form.welcomeMessage || ""}
                onChange={(event) => updateForm({ welcomeMessage: event.target.value })}
                rows={6}
                placeholder="Ví dụ: Xin chào, mình có thể hỗ trợ bạn về menu, đặt bàn hoặc đơn hàng."
              />
            </label>

            <label className="ai-admin-field">
              <span>Quick replies</span>
              <textarea
                value={quickRepliesText}
                onChange={(event) => updateForm({ starterQuickReplies: event.target.value.split("\n") })}
                rows={7}
                placeholder="Mỗi gợi ý một dòng"
              />
              <small className="ai-admin-help">Khi lưu, hệ thống sẽ trim từng dòng và bỏ qua dòng rỗng.</small>
            </label>

            <label className="ai-admin-field">
              <span>Fallback message</span>
              <textarea
                value={form.fallbackMessage || ""}
                onChange={(event) => updateForm({ fallbackMessage: event.target.value })}
                rows={5}
                placeholder="Tin nhắn khi AI chưa đủ thông tin để trả lời chắc chắn."
              />
            </label>
          </div>
        </article>

        <aside className="ai-admin-panel ai-admin-panel--handoff">
          <header className="ai-admin-panel__header ai-admin-panel__header--compact">
            <div>
              <p className="ai-admin-eyebrow">Handoff</p>
              <h3>Chuyển nhân viên</h3>
              <p>Cài đặt khi AI nên nhường lại cho nhân viên để xử lý thông tin của khách.</p>
            </div>
          </header>

          <div className="ai-admin-form">
            <label className="ai-admin-check ai-admin-check--card">
              <input type="checkbox" checked={!!form.handoffEnabled} onChange={(event) => updateForm({ handoffEnabled: event.target.checked })} />
              <span>Bật hỗ trợ nhân viên</span>
              <small>{form.handoffEnabled ? "Khách có thể được chuyển sang nhân viên khi cần." : "Chatbot sẽ không tạo yêu cầu handoff."}</small>
            </label>

            <label className="ai-admin-field">
              <span>Tin nhắn không handoff</span>
              <textarea
                value={form.handoffUnavailableMessage || ""}
                onChange={(event) => updateForm({ handoffUnavailableMessage: event.target.value })}
                rows={6}
                placeholder="Tin nhắn hiển thị khi nhà hàng chưa hỗ trợ nhân viên qua chatbot."
              />
            </label>

            <label className="ai-admin-field">
              <span>Ngưỡng confidence</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={form.lowConfidenceHandoffThreshold ?? 0.6}
                onChange={(event) => updateForm({ lowConfidenceHandoffThreshold: Number(event.target.value) })}
              />
              <small className="ai-admin-help">0.6 = 60%. AI sẽ cân nhắc handoff khi confidence thấp hơn ngưỡng này.</small>
            </label>

            <div className="ai-admin-empty ai-admin-empty--compact">
              <h4>Lưu ý vận hành</h4>
              <p>Hỗ trợ khung giờ nâng cao sẽ được bổ sung ở phase sau. Hiện tại hãy dùng tin nhắn handoff để hướng dẫn khách rõ ràng.</p>
            </div>
          </div>
        </aside>
      </form>
    </section>
  );
}
