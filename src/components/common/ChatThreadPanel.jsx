import React, { useMemo, useState } from "react";
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

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [messages]
  );

  if (!open) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || sending || composerDisabled) return;
    try {
      await onSend?.(content);
      setText("");
    } catch {
      // Parent sẽ hiển thị lỗi theo state của nó
    }
  };

  return (
    <div className="chat-thread-overlay" onClick={onClose}>
      <div className="chat-thread-panel" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <h4>{title || "Hội thoại"}</h4>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="chat-thread-messages">
          {loading ? (
            <div className="empty">Đang tải hội thoại...</div>
          ) : error ? (
            <div className="error">
              Không thể tải hội thoại. Vui lòng thử lại.
            </div>
          ) : sortedMessages.length === 0 ? (
            <div className="empty">Chưa có tin nhắn nào.</div>
          ) : (
            sortedMessages.map((m, idx) => {
              const mine = String(m.senderId) === String(meId);
              return (
                <div key={`${m.createdAt}_${idx}`} className={`msg-row ${mine ? "mine" : "other"}`}>
                  <div className="bubble">
                    {!mine && <div className="sender">{m.senderName || m.senderRole || "User"}</div>}
                    <div>{m.content}</div>
                    <div className="time">
                      {m.createdAt
                        ? new Date(m.createdAt).toLocaleTimeString("vi-VN", {
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
            onChange={(e) => setText(e.target.value)}
            placeholder={composerPlaceholder}
            disabled={composerDisabled}
          />
          <button
            type="submit"
            disabled={sending || composerDisabled || !text.trim()}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
