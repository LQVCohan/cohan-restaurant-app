import React, { useId, useMemo, useState } from "react";
import { Send, X } from "lucide-react";
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
  onClose,
  onSend,
}) {
  const [text, setText] = useState("");
  const titleId = useId();

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [messages],
  );

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

  return (
    <div className="chat-thread-overlay" onClick={onClose} role="presentation">
      <section
        className="chat-thread-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h4 id={titleId}>{title || "Hội thoại"}</h4>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng hội thoại">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="chat-thread-messages" aria-live="polite">
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
    </div>
  );
}
