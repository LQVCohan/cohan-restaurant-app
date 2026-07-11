import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, X } from "lucide-react";
import "./ChatThreadPanel.scss";

export default function ChatThreadPanel({
  open,
  title,
  subtitle = "",
  meId,
  messages = [],
  loading = false,
  error = null,
  sending = false,
  composerDisabled = false,
  composerPlaceholder = "Nhập tin nhắn...",
  embedded = false,
  onBack,
  onClose,
  onSend,
}) {
  const [text, setText] = useState("");
  const titleId = useId();
  const messagesRef = useRef(null);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [messages],
  );

  useEffect(() => {
    if (!open || loading) return;
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [loading, open, sortedMessages.length]);

  if (!open) return null;

  const handleSend = async (event) => {
    event.preventDefault();
    const content = text.trim();
    if (!content || sending || composerDisabled) return;
    try {
      await onSend?.(content);
      setText("");
    } catch {
      // Parent owns the async error state.
    }
  };

  const panel = (
    <section
      className={`chat-thread-panel ${embedded ? "chat-thread-panel--embedded" : ""}`}
      role={embedded ? "region" : "dialog"}
      aria-modal={embedded ? undefined : "true"}
      aria-labelledby={titleId}
      onClick={(event) => event.stopPropagation()}
    >
      <header>
        <div className="chat-thread-heading">
          {onBack ? (
            <button
              type="button"
              className="chat-thread-back"
              onClick={onBack}
              aria-label="Quay lại danh sách hội thoại"
              autoFocus={embedded}
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          ) : null}
          <div className="chat-thread-heading__copy">
            <h4 id={titleId}>{title || "Hội thoại"}</h4>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
        </div>
        <button
          type="button"
          className="chat-thread-close"
          onClick={onClose}
          aria-label="Đóng hội thoại"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div ref={messagesRef} className="chat-thread-messages" aria-live="polite">
        {loading ? (
          <div className="empty">Đang tải hội thoại...</div>
        ) : error ? (
          <div className="error">Không thể tải hội thoại. Vui lòng thử lại.</div>
        ) : sortedMessages.length === 0 ? (
          <div className="empty">Chưa có tin nhắn nào.</div>
        ) : (
          sortedMessages.map((message, index) => {
            const mine = String(message.senderId) === String(meId);
            return (
              <div
                key={`${message.createdAt}_${index}`}
                className={`msg-row ${mine ? "mine" : "other"}`}
              >
                <div className="bubble">
                  {!mine ? (
                    <div className="sender">
                      {message.senderName || message.senderRole || "Người dùng"}
                    </div>
                  ) : null}
                  <div>{message.content}</div>
                  <div className="time">
                    {message.createdAt
                      ? new Date(message.createdAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form className="chat-thread-composer" onSubmit={handleSend}>
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={composerPlaceholder}
          aria-label="Nội dung tin nhắn"
          disabled={composerDisabled}
        />
        <button
          type="submit"
          aria-label="Gửi tin nhắn"
          disabled={sending || composerDisabled || !text.trim()}
        >
          <Send size={17} aria-hidden="true" />
        </button>
      </form>
    </section>
  );

  if (embedded) return panel;

  return (
    <div className="chat-thread-overlay" onClick={onClose} role="presentation">
      {panel}
    </div>
  );
}
