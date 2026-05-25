import React, { useContext, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import useCommunication from "@/hooks/useCommunication";
import AiHandoffBadge from "@/components/communication/AiHandoffBadge";
import "./AiHandoffInbox.scss";

const HANDOFF_PREFIX = "ai handoff";
const HANDOFF_MARKER = "[AI HANDOFF]";

const formatTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : "";

const isAiHandoffThread = (thread) =>
  String(thread?.subject || "").trim().toLowerCase().startsWith(HANDOFF_PREFIX);

const isAiHandoffNotification = (n) => String(n?.type || "").toLowerCase() === "ai_chatbot_handoff";


const resolveSenderLabel = (msg) => {
  const role = String(msg?.senderRole || "").toLowerCase();
  if (role === "guest" || role === "customer") return "Khách hàng";
  if (msg?.senderName) return msg.senderName;
  return msg?.senderRole || "Hệ thống";
};

const runBestEffort = (result) => {
  if (!result || typeof result.catch !== "function") return;
  result.catch(() => {});
};

const resolveRestaurantId = ({ propRestaurantId, user }) => {
  if (propRestaurantId) return String(propRestaurantId);
  if (user?.restaurantForStaff) return String(user.restaurantForStaff);
  if (Array.isArray(user?.refRestaurants) && user.refRestaurants[0]) return String(user.refRestaurants[0]);
  if (user?.restaurantId) return String(user.restaurantId);
  return null;
};

export default function AiHandoffInbox({ restaurantId: propRestaurantId = null }) {
  const { user } = useContext(AuthContext) || {};
  const [selectedItem, setSelectedItem] = useState(null);
  const [reply, setReply] = useState("");
  const [warning, setWarning] = useState("");
  const [actionError, setActionError] = useState("");

  const restaurantId = useMemo(
    () => resolveRestaurantId({ propRestaurantId, user }),
    [propRestaurantId, user]
  );

  const {
    threads,
    threadsLoading,
    notifications,
    notificationsLoading,
    thread,
    threadLoading,
    loadThread,
    sendMessage,
    sendMessageState,
    markThreadRead,
    markNotificationRead,
    refetchThreads,
    refetchNotifications,
  } = useCommunication({ restaurantId });

  const notificationItems = useMemo(
    () =>
      (notifications || [])
        .filter(isAiHandoffNotification)
        .map((n) => ({
          kind: "notification",
          id: `notif_${n.id}`,
          notificationId: n.id,
          threadId: n?.payload?.threadId || null,
          unread: !n.readAt,
          preview: n?.payload?.messagePreview || n?.payload?.title || "Yêu cầu hỗ trợ từ chatbot",
          time: n.createdAt,
          restaurantId: n.restaurantId,
        })),
    [notifications]
  );

  const threadItems = useMemo(() => {
    const rows = (threads || []).filter((t) => isAiHandoffThread(t));
    return rows.map((t) => ({
      kind: "thread",
      id: `thread_${t.id}`,
      notificationId: null,
      threadId: t.id,
      unread: Number(t.unreadCount || 0) > 0,
      preview: t.lastMessagePreview || t.subject || "Handoff AI",
      time: t.updatedAt || t.lastMessageAt,
      restaurantId: t.restaurantId,
    }));
  }, [threads]);

  const mergedItems = useMemo(() => {
    const map = new Map();
    for (const item of [...notificationItems, ...threadItems]) {
      const key = item.threadId || item.id;
      if (!map.has(key)) map.set(key, item);
      else {
        const current = map.get(key);
        map.set(key, {
          ...current,
          unread: current.unread || item.unread,
          notificationId: current.notificationId || item.notificationId,
          time: current.time || item.time,
        });
      }
    }
    return [...map.values()].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  }, [notificationItems, threadItems]);

  const openItem = async (item) => {
    setWarning("");
    setActionError("");
    setSelectedItem(item);

    const threadId = item?.threadId || null;
    if (!threadId) {
      setWarning("Thông báo handoff chưa có threadId, vui lòng kiểm tra lại payload.");
      return;
    }

    try {
      const { data } = await loadThread({ variables: { id: threadId } });
      if (!data?.chatThread) {
        setActionError("Không thể tải hội thoại hoặc bạn không có quyền truy cập.");
      }
    } catch {
      setActionError("Không thể tải hội thoại hoặc bạn không có quyền truy cập.");
    }

    if (item.notificationId) {
      runBestEffort(markNotificationRead({ variables: { id: item.notificationId } }));
    }
    runBestEffort(markThreadRead({ variables: { threadId } }));
    runBestEffort(refetchThreads?.());
    runBestEffort(refetchNotifications?.());
  };

  const onSend = async (event) => {
    event.preventDefault();
    const content = reply.trim();
    const threadId = thread?.id || selectedItem?.threadId;
    if (!content || !threadId) return;

    setActionError("");
    try {
      await sendMessage({ variables: { input: { threadId, content } } });
      setReply("");
      await loadThread({ variables: { id: threadId } });
      runBestEffort(refetchThreads?.());
    } catch (error) {
      setActionError(error?.message || "Không thể gửi phản hồi lúc này.");
    }
  };

  const hasHandoffMarker =
    Array.isArray(thread?.messages) &&
    String(thread.messages?.[0]?.content || "").includes(HANDOFF_MARKER);

  if (!restaurantId) {
    return (
      <div className="ai-handoff-inbox__panel">
        <div className="ai-handoff-inbox__content">Chưa xác định được nhà hàng để tải yêu cầu handoff.</div>
      </div>
    );
  }

  const isLoading = threadsLoading || notificationsLoading;

  return (
    <div className="ai-handoff-inbox">
      <section className="ai-handoff-inbox__panel">
        <div className="ai-handoff-inbox__panel-header">
          <h2>Yêu cầu hỗ trợ từ chatbot</h2>
        </div>

        {isLoading ? (
          <div className="ai-handoff-inbox__content">Đang tải dữ liệu handoff...</div>
        ) : mergedItems.length === 0 ? (
          <div className="ai-handoff-inbox__content">Chưa có yêu cầu hỗ trợ từ chatbot.</div>
        ) : (
          <div className="ai-handoff-inbox__list">
            {mergedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ai-handoff-inbox__item ${selectedItem?.id === item.id ? "active" : ""}`}
                onClick={() => openItem(item)}
              >
                <div className="ai-handoff-inbox__item-meta">
                  <AiHandoffBadge />
                  <span>{formatTime(item.time)}</span>
                </div>
                <p className="ai-handoff-inbox__preview">{item.preview}</p>
                <div className="ai-handoff-inbox__item-footer">
                  <span>{item.restaurantId ? `NH: ${String(item.restaurantId).slice(-6)}` : "Không rõ nhà hàng"}</span>
                  <span>{item.unread ? <><span className="ai-handoff-inbox__dot" />Chưa đọc</> : "Đã đọc"}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="ai-handoff-inbox__panel">
        <div className="ai-handoff-inbox__panel-header">
          <h2>Chi tiết hội thoại</h2>
          {(hasHandoffMarker || isAiHandoffThread(thread)) && <AiHandoffBadge />}
        </div>

        <div className="ai-handoff-inbox__content">
          {warning && <div className="ai-handoff-inbox__message">{warning}</div>}
          {actionError && (
            <div className="ai-handoff-inbox__message">
              {actionError}
              <div>
                <button type="button" onClick={() => selectedItem && openItem(selectedItem)}>Thử lại</button>
              </div>
            </div>
          )}
          {!selectedItem ? (
            <div className="ai-handoff-inbox__message">Chọn một yêu cầu handoff để xem chi tiết.</div>
          ) : threadLoading ? (
            <div className="ai-handoff-inbox__message">Đang tải hội thoại...</div>
          ) : !thread ? (
            <div className="ai-handoff-inbox__message">Không có dữ liệu hội thoại.</div>
          ) : (
            (thread.messages || []).map((msg, index) => {
              const isSummary = index === 0 && String(msg?.content || "").includes(HANDOFF_MARKER);
              return (
                <div key={`${msg.createdAt || "na"}_${index}`} className={`ai-handoff-inbox__message ${isSummary ? "is-handoff-summary" : ""}`}>
                  <strong>{resolveSenderLabel(msg)}</strong>
                  <div>{msg.content}</div>
                  <small>{formatTime(msg.createdAt)}</small>
                </div>
              );
            })
          )}
        </div>

        <form className="ai-handoff-inbox__reply" onSubmit={onSend}>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Nhập phản hồi cho luồng hỗ trợ..."
          />
          <button type="submit" disabled={!reply.trim() || !!sendMessageState?.loading}>Gửi phản hồi</button>
          <small>
            Hiện phản hồi của nhân viên được lưu trong luồng hỗ trợ nội bộ; khách guest có thể chưa nhận trực tiếp nếu chưa có guest messaging 2 chiều.
          </small>
        </form>
      </section>
    </div>
  );
}
