import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import "./AiChatbotAdmin.scss";
import "./AiChatbotSettingsRefine.scss";

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
  welcomeMessage:
    "Xin chào, mình là trợ lý A.I của Cohan Restaurant App. Mình có thể hỗ trợ bạn về menu, đặt bàn, đơn hàng, coupon và hướng dẫn sử dụng hệ thống.",
  starterQuickReplies: [
    "Gợi ý món bán chạy cho tôi",
    "Tôi muốn đặt bàn",
    "Có mã giảm giá nào không?",
  ],
  handoffEnabled: true,
  handoffUnavailableMessage:
    "Hiện nhà hàng chưa bật hỗ trợ nhân viên qua chatbot. Vui lòng thử lại sau hoặc liên hệ nhà hàng.",
  lowConfidenceHandoffThreshold: 0.6,
  fallbackMessage: "",
};

const normalizePermission = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();
const collectPermissionCodes = (user = {}) => {
  const set = new Set();

  const add = (permission) => {
    if (!permission) return;

    if (typeof permission === "string") {
      set.add(normalizePermission(permission));
      return;
    }

    set.add(
      normalizePermission(
        permission.code ||
          permission.permissionCode ||
          permission.slug ||
          permission.name,
      ),
    );
  };

  [
    user.permissions,
    user.permissionCodes,
    user.effectivePermissions,
    user.effectivePermissionCodes,
    user.role?.permissions,
    user.role?.directPermissions,
    user.role?.parentRole?.permissions,
  ].forEach((list) => Array.isArray(list) && list.forEach(add));

  const roleName = normalizePermission(
    user.roleName ||
      user.role?.slug ||
      user.role?.name ||
      user.role?.parentRole?.slug ||
      user.role?.parentRole?.name,
  );

  if (["admin", "manager"].includes(roleName)) {
    [
      "ai.chatbot.read",
      "ai.chatbot.write",
      "ai.chatbot.moderate",
      "ai.chatbot.evaluate",
      "ai.chatbot.analytics.read",
      "ai.chatbot.handoff",
    ].forEach(add);
  }

  return set;
};
const hasPermission = (user, permission) => {
  const codes = collectPermissionCodes(user);
  return codes.has("*") || codes.has(normalizePermission(permission));
};
const normalizeQuickReplies = (value) =>
  String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeSettingsSnapshot = (value = defaultForm) => ({
  enabled: !!value.enabled,
  welcomeMessage: String(value.welcomeMessage || ""),
  starterQuickReplies: Array.isArray(value.starterQuickReplies)
    ? value.starterQuickReplies.map((item) => String(item || "").trim()).filter(Boolean)
    : normalizeQuickReplies(value.starterQuickReplies),
  handoffEnabled: !!value.handoffEnabled,
  handoffUnavailableMessage: String(value.handoffUnavailableMessage || ""),
  lowConfidenceHandoffThreshold: Number(value.lowConfidenceHandoffThreshold ?? 0.6),
  fallbackMessage: String(value.fallbackMessage || ""),
});

const serializeSettings = (value) =>
  JSON.stringify(normalizeSettingsSnapshot(value || defaultForm));

function PermissionFallback() {
  return (
    <section className="ai-admin-page ai-admin-page--settings">
      <div className="ai-admin-empty">
        <h3>Không có quyền truy cập</h3>
        <p>Bạn không có quyền xem cấu hình AI chatbot.</p>
      </div>
    </section>
  );
}

export default function AiChatbotSettingsPage() {
  const { user, restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");
  const effectiveRestaurantId = restaurantId || restaurants?.[0]?.id || "";
  const canReadSettings =
    hasPermission(user, "ai.chatbot.read") ||
    hasPermission(user, "ai.chatbot.write");
  const canWriteSettings = hasPermission(user, "ai.chatbot.write");
  const { data, loading, error, refetch } = useQuery(Q, {
    skip: !effectiveRestaurantId || !canReadSettings,
    variables: { restaurantId: effectiveRestaurantId },
  });
  const [save, { loading: saving }] = useMutation(M);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(
    serializeSettings(defaultForm),
  );

  useEffect(() => {
    if (data?.restaurantAiChatbotSettings) {
      const nextSettings = data.restaurantAiChatbotSettings;
      setForm(nextSettings);
      setLastSavedSnapshot(serializeSettings(nextSettings));
    }
  }, [data]);

  const quickRepliesText = useMemo(
    () => (form.starterQuickReplies || []).join("\n"),
    [form.starterQuickReplies],
  );
  const quickReplies = useMemo(
    () => normalizeQuickReplies(quickRepliesText),
    [quickRepliesText],
  );
  const thresholdValue = Number(form.lowConfidenceHandoffThreshold ?? 0.6);
  const thresholdPercent = Number.isFinite(thresholdValue)
    ? Math.round(thresholdValue * 100)
    : 0;
  const quickReplyCount = quickReplies.length;
  const readOnly = canReadSettings && !canWriteSettings;
  const currentSnapshot = useMemo(
    () =>
      serializeSettings({
        ...form,
        starterQuickReplies: quickReplies,
      }),
    [form, quickReplies],
  );
  const hasUnsavedChanges = currentSnapshot !== lastSavedSnapshot;

  const updateForm = (patch) => {
    setNotice("");
    setSaveError("");
    setForm((current) => ({ ...current, ...patch }));
  };
  const validate = () => {
    const threshold = Number(form.lowConfidenceHandoffThreshold);
    if (String(form.welcomeMessage || "").trim().length > 500)
      return "Lời chào tối đa 500 ký tự.";
    if (String(form.fallbackMessage || "").trim().length > 500)
      return "Tin nhắn khi chưa đủ thông tin tối đa 500 ký tự.";
    if (String(form.handoffUnavailableMessage || "").trim().length > 500)
      return "Tin nhắn khi chưa thể chuyển nhân viên tối đa 500 ký tự.";
    if (quickReplies.length > 8) return "Tối đa 8 gợi ý nhanh.";
    if (quickReplies.some((item) => item.length > 80))
      return "Mỗi gợi ý nhanh tối đa 80 ký tự.";
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)
      return "Ngưỡng chuyển nhân viên phải là số từ 0 đến 1.";
    return "";
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!effectiveRestaurantId) return;
    if (!canWriteSettings) {
      setSaveError("Bạn không có quyền chỉnh sửa cấu hình AI chatbot.");
      return;
    }
    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      return;
    }
    setNotice("");
    setSaveError("");
    const input = {
      ...form,
      restaurantId: effectiveRestaurantId,
      starterQuickReplies: quickReplies,
      lowConfidenceHandoffThreshold: Number(
        form.lowConfidenceHandoffThreshold,
      ),
    };
    try {
      const result = await save({
        variables: {
          input,
        },
      });
      const savedSettings =
        result?.data?.updateRestaurantAiChatbotSettings || input;
      setForm(savedSettings);
      setLastSavedSnapshot(serializeSettings(savedSettings));
      setNotice("Đã lưu cài đặt Chatbot AI.");
      refetch?.();
    } catch (mutationError) {
      setSaveError(
        mutationError?.message ||
          "Không thể lưu cài đặt AI chatbot. Vui lòng thử lại.",
      );
    }
  };
  const resetDefaults = () => {
    if (!canWriteSettings) return;
    setNotice("");
    setSaveError("");
    setForm(starterDefaults);
  };

  if (!canReadSettings) return <PermissionFallback />;
  const disabled = readOnly || saving;

  return (
    <section className="ai-admin-page ai-admin-page--settings">
      <header className="ai-admin-hero ai-admin-hero--settings">
        <div className="ai-admin-hero__copy">
          <p className="ai-admin-eyebrow">Thiết lập AI</p>
          <h2>Cài đặt Chatbot AI</h2>
          <p>Quản lý lời chào, gợi ý nhanh và cách chatbot chuyển yêu cầu cho nhân viên.</p>
        </div>
        <label className="ai-admin-field ai-admin-field--restaurant">
          <span>Nhà hàng</span>
          <select
            value={effectiveRestaurantId}
            onChange={(event) => setRestaurantId(event.target.value)}
            disabled={!restaurants.length}
          >
            {!restaurants.length ? (
              <option value="">Chưa có nhà hàng</option>
            ) : null}
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div
        className="ai-admin-settings-status-strip"
        aria-label="Trạng thái cấu hình AI chatbot"
      >
        <article className={form.enabled ? "is-active" : "is-muted"}>
          <span>Chatbot</span>
          <strong>{form.enabled ? "Đang bật" : "Đang tắt"}</strong>
          <small>{form.enabled ? "phục vụ khách" : "tạm tắt"}</small>
        </article>
        <article className={form.handoffEnabled ? "is-active" : "is-muted"}>
          <span>Chuyển nhân viên</span>
          <strong>{form.handoffEnabled ? "Đang bật" : "Đang tắt"}</strong>
          <small>{form.handoffEnabled ? "có thể tiếp nhận" : "chưa tiếp nhận"}</small>
        </article>
        <article>
          <span>Ngưỡng chuyển</span>
          <strong>{thresholdPercent}%</strong>
          <small>khi chatbot chưa chắc chắn</small>
        </article>
        <article>
          <span>Gợi ý nhanh</span>
          <strong>{quickReplyCount} gợi ý</strong>
          <small>đang cấu hình</small>
        </article>
      </div>

      {readOnly ? (
        <p className="ai-admin-notice" role="status">
          Chế độ chỉ xem: bạn không có quyền chỉnh sửa cấu hình AI chatbot.
        </p>
      ) : null}
      {loading ? (
        <div className="ai-admin-skeleton" role="status">
          Đang tải cài đặt Chatbot AI...
        </div>
      ) : null}
      {error ? (
        <p className="ai-admin-error" role="alert">
          {error.message || "Không thể tải cài đặt Chatbot AI."}
        </p>
      ) : null}
      {saveError ? (
        <p className="ai-admin-error" role="alert">
          {saveError}
        </p>
      ) : null}
      {notice ? (
        <p className="ai-admin-notice" role="status">
          {notice}
        </p>
      ) : null}

      <form
        className="ai-admin-grid ai-admin-grid--settings"
        id="ai-chatbot-settings-form"
        onSubmit={submit}
      >
        <article className="ai-admin-panel ai-admin-panel--main">
          <header className="ai-admin-panel__header">
            <div>
              <p className="ai-admin-eyebrow">Nội dung khách nhìn thấy</p>
              <h3>Lời chào và câu trả lời dự phòng</h3>
              <p>Giữ giọng nói rõ ràng, thân thiện và tránh câu quá dài.</p>
            </div>
          </header>
          <div className="ai-admin-form ai-admin-form--settings">
            <label className="ai-admin-check ai-admin-check--card ai-admin-check--inline">
              <input
                type="checkbox"
                checked={!!form.enabled}
                disabled={disabled}
                onChange={(event) =>
                  updateForm({ enabled: event.target.checked })
                }
              />
              <span>Bật chatbot</span>
              <small>
                {form.enabled
                  ? "Chatbot hiển thị và nhận câu hỏi của khách."
                  : "Chatbot đang tắt trên kênh khách hàng."}
              </small>
            </label>

            <label className="ai-admin-field ai-admin-field--calm-textarea">
              <span>Lời chào</span>
              <textarea
                value={form.welcomeMessage || ""}
                disabled={disabled}
                maxLength={500}
                onChange={(event) =>
                  updateForm({ welcomeMessage: event.target.value })
                }
                rows={5}
              />
            </label>

            <label className="ai-admin-field ai-admin-field--calm-textarea">
              <span>Gợi ý nhanh</span>
              <textarea
                value={quickRepliesText}
                disabled={disabled}
                onChange={(event) =>
                  updateForm({
                    starterQuickReplies: event.target.value.split("\n"),
                  })
                }
                rows={5}
                placeholder="Mỗi gợi ý một dòng"
              />
              <small className="ai-admin-help">
                Tối đa 8 dòng, mỗi dòng tối đa 80 ký tự.
              </small>
            </label>

            <details className="ai-admin-collapsible ai-admin-collapsible--settings ai-admin-handoff-compact">
              <summary>
                <span>Quy trình chuyển nhân viên</span>
                <small>
                  {form.handoffEnabled ? "Đang bật" : "Đang tắt"} · Ngưỡng {thresholdPercent}%
                </small>
              </summary>
              <div className="ai-admin-handoff-compact__body">
                <label className="ai-admin-check ai-admin-check--card ai-admin-check--inline">
                  <input
                    type="checkbox"
                    checked={!!form.handoffEnabled}
                    disabled={disabled}
                    onChange={(event) =>
                      updateForm({ handoffEnabled: event.target.checked })
                    }
                  />
                  <span>Cho phép chuyển sang nhân viên</span>
                  <small>
                    {form.handoffEnabled
                      ? "Khách có thể được chuyển sang nhân viên khi cần."
                      : "Chatbot sẽ không tạo yêu cầu chuyển nhân viên."}
                  </small>
                </label>

                <label className="ai-admin-field ai-admin-field--threshold">
                  <span>Ngưỡng chuyển nhân viên</span>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={form.lowConfidenceHandoffThreshold ?? 0.6}
                    disabled={disabled}
                    onChange={(event) =>
                      updateForm({
                        lowConfidenceHandoffThreshold: event.target.value,
                      })
                    }
                  />
                  <small className="ai-admin-help">
                    Khi độ chắc chắn thấp hơn ngưỡng này, chatbot sẽ cân nhắc chuyển khách cho nhân viên.
                  </small>
                </label>

                <details className="ai-admin-collapsible ai-admin-collapsible--settings ai-admin-handoff-message">
                  <summary>Tin nhắn khi chưa có nhân viên</summary>
                  <label className="ai-admin-field ai-admin-field--calm-textarea">
                    <span>Nội dung hiển thị cho khách</span>
                    <textarea
                      value={form.handoffUnavailableMessage || ""}
                      disabled={disabled}
                      maxLength={500}
                      onChange={(event) =>
                        updateForm({ handoffUnavailableMessage: event.target.value })
                      }
                      rows={4}
                    />
                  </label>
                </details>
              </div>
            </details>

            <details className="ai-admin-collapsible ai-admin-collapsible--settings">
              <summary>Cài đặt nâng cao</summary>
              <label className="ai-admin-field ai-admin-field--calm-textarea">
                <span>Tin nhắn khi chưa đủ thông tin</span>
                <textarea
                  value={form.fallbackMessage || ""}
                  disabled={disabled}
                  maxLength={500}
                  onChange={(event) =>
                    updateForm({ fallbackMessage: event.target.value })
                  }
                  rows={4}
                />
              </label>
            </details>
          </div>
        </article>

        <aside className="ai-admin-panel ai-admin-panel--preview">
          <header className="ai-admin-panel__header ai-admin-panel__header--compact">
            <div>
              <p className="ai-admin-eyebrow">Xem trước</p>
              <h3>Khách nhìn thấy gì?</h3>
              <p>Mô phỏng cửa sổ chatbot dựa trên nội dung đang cấu hình.</p>
            </div>
          </header>
          <section className="ai-admin-settings-preview" aria-label="Xem trước chatbot">
            <div className="ai-admin-settings-preview__window">
              <div className="ai-admin-settings-preview__topbar">
                <div>
                  <strong>Trợ lý Cohan</strong>
                  <span>{form.enabled ? "Đang sẵn sàng" : "Đang tắt"}</span>
                </div>
                <i aria-hidden="true" />
              </div>

              <div className="ai-admin-settings-preview__conversation">
                <p className="ai-admin-settings-preview__bubble">
                  {String(form.welcomeMessage || "").trim() ||
                    "Chưa có lời chào. Thêm một câu ngắn để khách biết chatbot có thể hỗ trợ gì."}
                </p>
                <div className="ai-admin-settings-preview__chips">
                  {quickReplies.length ? (
                    quickReplies
                      .slice(0, 5)
                      .map((reply) => <span key={reply}>{reply}</span>)
                  ) : (
                    <small>Chưa có gợi ý nhanh.</small>
                  )}
                </div>
              </div>

              <div className="ai-admin-settings-preview__footer">
                <span>Nhập câu hỏi cho nhà hàng...</span>
                <button type="button" disabled>
                  Gửi
                </button>
              </div>
            </div>

            <div className="ai-admin-settings-preview__notes">
              <article>
                <span>Chuyển nhân viên</span>
                <strong>{form.handoffEnabled ? "Có thể chuyển" : "Đang tắt"}</strong>
              </article>
              <article>
                <span>Ngưỡng chắc chắn</span>
                <strong>{thresholdPercent}%</strong>
              </article>
            </div>
          </section>
        </aside>

        <footer
          className={`ai-admin-settings-footer${
            hasUnsavedChanges ? " ai-admin-settings-footer--dirty" : ""
          }`}
        >
          <div>
            <strong>
              {hasUnsavedChanges ? "Có thay đổi chưa lưu" : "Cài đặt đã đồng bộ"}
            </strong>
            <span>
              {hasUnsavedChanges
                ? "Kiểm tra lại nội dung trước khi áp dụng cho khách."
                : "Thay đổi mới sẽ xuất hiện ở đây trước khi lưu."}
            </span>
          </div>
          <div className="ai-admin-actions ai-admin-actions--settings">
            <button
              type="button"
              className="ai-admin-button--secondary"
              disabled={!canWriteSettings || saving}
              title={!canWriteSettings ? "Thiếu quyền chỉnh sửa chatbot" : ""}
              onClick={resetDefaults}
            >
              Khôi phục mặc định
            </button>
            <button
              type="submit"
              disabled={
                !canWriteSettings ||
                saving ||
                loading ||
                !effectiveRestaurantId ||
                !hasUnsavedChanges
              }
              title={!canWriteSettings ? "Thiếu quyền chỉnh sửa chatbot" : ""}
            >
              {saving ? "Đang lưu..." : "Lưu cài đặt"}
            </button>
          </div>
        </footer>
      </form>
    </section>
  );
}
