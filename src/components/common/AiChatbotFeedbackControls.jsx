import React, { useMemo, useState } from "react";

export const AI_CHATBOT_FEEDBACK_REASONS = [
  "Trả lời sai",
  "Không đúng câu hỏi",
  "Thông tin đã cũ",
  "Không thực hiện được thao tác",
];

export const buildAiChatbotFeedbackReason = ({ reason, details }) =>
  [String(reason || "").trim(), String(details || "").trim()]
    .filter(Boolean)
    .join(" — ")
    .slice(0, 500);

export const findAiChatbotFeedbackQuestion = (messages = [], index = 0) =>
  [...messages.slice(0, index)]
    .reverse()
    .find((message) => message?.role === "user")?.content || "";

function AiChatbotFeedbackControls({
  item,
  index,
  messages,
  restaurantId,
  guestId,
  submitFeedback,
}) {
  const [mode, setMode] = useState("idle");
  const [selectedReason, setSelectedReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");

  const question = useMemo(
    () => findAiChatbotFeedbackQuestion(messages, index),
    [messages, index],
  );
  const submitting = mode.startsWith("submitting_");
  const submittingHelpful = mode === "submitting_helpful";
  const submittingNotHelpful = mode === "submitting_not_helpful";
  const showNotHelpfulForm = mode === "form" || submittingNotHelpful;
  const sent = mode === "sent";

  const sendFeedback = async (rating, reason = "") => {
    if (submitting || sent) return;
    setMode(`submitting_${rating}`);
    setError("");
    try {
      await submitFeedback({
        variables: {
          input: {
            restaurantId: restaurantId || undefined,
            conversationId: item.meta?.conversationId,
            messageId: item.meta?.answerMessageId || undefined,
            guestId: guestId || undefined,
            question,
            answer: item.content,
            rating,
            ...(reason ? { reason } : {}),
          },
        },
      });
      setMode("sent");
    } catch (feedbackError) {
      setMode(rating === "not_helpful" ? "form" : "idle");
      setError(
        feedbackError?.message ||
          "Chưa gửi được phản hồi. Vui lòng thử lại.",
      );
    }
  };

  if (sent) {
    return (
      <div className="ai-chatbot-actions ai-chatbot-feedback" aria-live="polite">
        <small className="ai-chatbot-feedback__success">
          Cảm ơn bạn! Phản hồi đã được ghi nhận.
        </small>
      </div>
    );
  }

  return (
    <div className="ai-chatbot-actions ai-chatbot-feedback" aria-live="polite">
      <button
        type="button"
        className="ai-chatbot-feedback__trigger ai-chatbot-feedback__trigger--helpful"
        disabled={submitting}
        onClick={() => sendFeedback("helpful")}
      >
        {submittingHelpful ? "Đang gửi..." : "Hữu ích"}
      </button>
      <button
        type="button"
        className="ai-chatbot-feedback__trigger ai-chatbot-feedback__trigger--not-helpful"
        disabled={submitting}
        aria-expanded={showNotHelpfulForm}
        onClick={() => {
          setMode("form");
          setError("");
        }}
      >
        {submittingNotHelpful ? "Đang gửi..." : "Không hữu ích"}
      </button>

      {showNotHelpfulForm ? (
        <form
          className="ai-chatbot-feedback__form"
          onSubmit={(event) => {
            event.preventDefault();
            sendFeedback(
              "not_helpful",
              buildAiChatbotFeedbackReason({
                reason: selectedReason,
                details,
              }),
            );
          }}
        >
          <span className="ai-chatbot-feedback__label">
            Điều gì chưa ổn? <em>Không bắt buộc</em>
          </span>
          <div
            className="ai-chatbot-feedback__reasons"
            role="group"
            aria-label="Lý do câu trả lời không hữu ích"
          >
            {AI_CHATBOT_FEEDBACK_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                className={selectedReason === reason ? "is-selected" : ""}
                aria-pressed={selectedReason === reason}
                disabled={submitting}
                onClick={() =>
                  setSelectedReason((current) =>
                    current === reason ? "" : reason,
                  )
                }
              >
                {reason}
              </button>
            ))}
          </div>
          <label className="ai-chatbot-feedback__details">
            <span>Ghi chú thêm</span>
            <textarea
              value={details}
              maxLength={350}
              disabled={submitting}
              placeholder="Ví dụ: nút không mở đúng trang..."
              onChange={(event) => setDetails(event.target.value)}
            />
          </label>
          <div className="ai-chatbot-feedback__form-actions">
            <button
              type="button"
              className="ai-chatbot-feedback__cancel"
              disabled={submitting}
              onClick={() => {
                setMode("idle");
                setSelectedReason("");
                setDetails("");
                setError("");
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="ai-chatbot-feedback__submit"
              disabled={submitting}
            >
              {submittingNotHelpful ? "Đang gửi..." : "Gửi phản hồi"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <span className="ai-chatbot-feedback__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export default AiChatbotFeedbackControls;
