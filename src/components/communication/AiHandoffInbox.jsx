import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { AuthContext } from "@/context/AuthContext";
import useCommunication from "@/hooks/useCommunication";
import AiHandoffBadge from "@/components/communication/AiHandoffBadge";
import "./AiHandoffInbox.scss";

const HANDOFF_PREFIX = "ai handoff";
const HANDOFF_MARKER = "[AI HANDOFF]";
const RESOLVE_AI_CHATBOT_HANDOFF = gql`
  mutation ResolveAiChatbotHandoff($input: ResolveAiChatbotHandoffInput!) {
    resolveAiChatbotHandoff(input: $input) {
      ok
      conversationId
      chatThreadId
      status
      alreadyClosed
      message
    }
  }
`;

const formatTime = (iso) => iso ? new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "";
const collectPermissionCodes = (user) => {
  const out = new Set();
  const push = (value) => {
    if (!value) return;
    if (typeof value === "string") out.add(value);
    else if (typeof value === "object") push(value.code || value.slug || value.name || value.permissionCode);
  };
  [user?.permissions, user?.permissionCodes, user?.effectivePermissions, user?.role?.permissions, user?.role?.directPermissions].forEach((list) => {
    if (Array.isArray(list)) list.forEach(push);
  });
  if (["admin", "manager"].includes(String(user?.roleName || user?.role?.slug || user?.role?.name || "").toLowerCase())) {
    out.add("ai.chatbot.moderate");
    out.add("ai.chatbot.handoff");
  }
  return out;
};
const hasAnyPermission = (user, codes) => {
  const permissions = collectPermissionCodes(user);
  return permissions.has("*") || codes.some((code) => permissions.has(code));
};
const isAiHandoffThread = (thread) => {
  const fields = [thread?.type, thread?.kind, thread?.source, thread?.metadata?.source, thread?.metadata?.type, thread?.payload?.type].map((v) => String(v || "").toLowerCase());
  if (fields.includes("ai_chatbot_handoff") || fields.includes("ai_chatbot")) return true;
  if (thread?.metadata?.handoff === true) return true;
  return String(thread?.subject || "").trim().toLowerCase().startsWith(HANDOFF_PREFIX);
};
const isAiHandoffNotification = (n) => String(n?.type || "").toLowerCase() === "ai_chatbot_handoff";
const TAB_ACTIVE = "active";
const TAB_RESOLVED = "resolved";

const resolveSenderLabel = (msg) => {
  const role = String(msg?.senderRole || "").toLowerCase();
  if (role === "guest" || role === "customer") return "Khách hàng";
  if (role === "assistant" || role === "ai" || role === "chatbot") return "AI chatbot";
  if (["staff", "manager", "admin"].includes(role)) return msg?.senderName || "Nhân viên";
  if (role === "system") return "Hệ thống";
  return msg?.senderName || msg?.senderRole || "Hệ thống";
};
const runBestEffort = (result) => { if (result && typeof result.catch === "function") result.catch(() => {}); };
const resolveRestaurantId = ({ propRestaurantId, user }) => {
  if (propRestaurantId) return String(propRestaurantId);
  if (user?.restaurantForStaff) return String(user.restaurantForStaff);
  if (Array.isArray(user?.refRestaurants) && user.refRestaurants[0]) return String(user.refRestaurants[0]);
  if (user?.restaurantId) return String(user.restaurantId);
  return null;
};

export default function AiHandoffInbox({ restaurantId: propRestaurantId = null }) {
  const { user } = useContext(AuthContext) || {};
  const canViewHandoff = hasAnyPermission(user, ["ai.chatbot.handoff", "ai.chatbot.moderate"]);
  const canResolveHandoff = hasAnyPermission(user, ["ai.chatbot.handoff"]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [reply, setReply] = useState("");
  const [warning, setWarning] = useState("");
  const [actionError, setActionError] = useState("");
  const [resolvedThreadIds, setResolvedThreadIds] = useState(() => new Set());
  const [activeTab, setActiveTab] = useState(TAB_ACTIVE);
  const [resolveHandoff, { loading: resolving }] = useMutation(RESOLVE_AI_CHATBOT_HANDOFF);
  const restaurantId = useMemo(() => resolveRestaurantId({ propRestaurantId, user }), [propRestaurantId, user]);

  const activeCommunication = useCommunication({ restaurantId, status: "open", notificationsEnabled: canViewHandoff });
  const resolvedCommunication = useCommunication({ restaurantId, status: "closed", notificationsEnabled: false });
  const { threads: activeThreads, threadsLoading: activeThreadsLoading, notifications, notificationsLoading, thread: activeThread, threadLoading: activeThreadLoading, loadThread: loadActiveThread, sendMessage, sendMessageState, markThreadRead, markNotificationRead, refetchThreads: refetchActiveThreads, refetchNotifications } = activeCommunication;
  const { threads: resolvedThreads, threadsLoading: resolvedThreadsLoading, thread: resolvedThread, threadLoading: resolvedThreadLoading, loadThread: loadResolvedThread, refetchThreads: refetchResolvedThreads } = resolvedCommunication;

  const notificationItems = useMemo(() => (notifications || []).filter(isAiHandoffNotification).map((n) => ({ kind: "notification", id: `notif_${n.id}`, notificationId: n.id, threadId: n?.payload?.threadId || null, unread: !n.readAt, preview: n?.payload?.messagePreview || n?.payload?.title || "Yêu cầu hỗ trợ từ chatbot", time: n.createdAt, restaurantId: n.restaurantId })), [notifications]);
  const threadItems = useMemo(() => (activeThreads || []).filter(isAiHandoffThread).map((t) => ({ kind: "thread", id: `thread_${t.id}`, notificationId: null, threadId: t.id, unread: Number(t.unreadCount || 0) > 0, preview: t.lastMessagePreview || t.subject || "Yêu cầu hỗ trợ từ AI", time: t.updatedAt || t.lastMessageAt, restaurantId: t.restaurantId })), [activeThreads]);
  const resolvedItems = useMemo(() => (resolvedThreads || []).filter(isAiHandoffThread).map((t) => ({ kind: "thread", id: `resolved_thread_${t.id}`, notificationId: null, threadId: t.id, unread: false, preview: t.lastMessagePreview || t.subject || "Handoff AI", time: t.updatedAt || t.lastMessageAt, restaurantId: t.restaurantId })).sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)), [resolvedThreads]);
  const mergedItems = useMemo(() => {
    const map = new Map();
    for (const item of [...notificationItems, ...threadItems]) {
      const key = item.threadId || item.id;
      if (!map.has(key)) map.set(key, item);
      else {
        const current = map.get(key);
        map.set(key, { ...current, unread: current.unread || item.unread, notificationId: current.notificationId || item.notificationId, time: current.time || item.time });
      }
    }
    return [...map.values()].filter((item) => !resolvedThreadIds.has(String(item.threadId || ""))).sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  }, [notificationItems, threadItems, resolvedThreadIds]);

  const currentItems = activeTab === TAB_RESOLVED ? resolvedItems : mergedItems;
  const thread = activeTab === TAB_RESOLVED ? resolvedThread : activeThread;
  const threadLoading = activeTab === TAB_RESOLVED ? resolvedThreadLoading : activeThreadLoading;
  const loadThread = activeTab === TAB_RESOLVED ? loadResolvedThread : loadActiveThread;
  const isThreadClosed = String(thread?.status || "").toLowerCase() === "closed";
  const isActiveView = activeTab === TAB_ACTIVE;
  const isLoading = isActiveView ? activeThreadsLoading || notificationsLoading : resolvedThreadsLoading;
  const hasHandoffMarker = Array.isArray(thread?.messages) && String(thread.messages?.[0]?.content || "").includes(HANDOFF_MARKER);

  useEffect(() => { setSelectedItem(null); setReply(""); setWarning(""); setActionError(""); }, [activeTab]);

  const openItem = async (item) => {
    setWarning(""); setActionError(""); setSelectedItem(item);
    const threadId = item?.threadId || null;
    if (!threadId) { setWarning("Thiếu thông tin hội thoại để gửi phản hồi. Vui lòng tải lại trang hoặc chọn yêu cầu khác."); return; }
    try {
      const { data } = await loadThread({ variables: { id: threadId } });
      if (!data?.chatThread) setActionError("Không thể tải hội thoại hoặc bạn không có quyền truy cập.");
    } catch (error) {
      setActionError(error?.message || "Không thể tải hội thoại hoặc bạn không có quyền truy cập.");
    }
    if (item.notificationId) runBestEffort(markNotificationRead({ variables: { id: item.notificationId } }));
    runBestEffort(markThreadRead({ variables: { threadId } }));
    runBestEffort(refetchActiveThreads?.());
    runBestEffort(refetchResolvedThreads?.());
    runBestEffort(refetchNotifications?.());
  };

  const onSend = async (event) => {
    event.preventDefault();
    const content = reply.trim();
    const threadId = thread?.id || selectedItem?.threadId;
    if (!canViewHandoff || !content || !threadId || isThreadClosed || activeTab === TAB_RESOLVED) return;
    setActionError("");
    try {
      await sendMessage({ variables: { input: { threadId, content } } });
      setReply("");
      await loadThread({ variables: { id: threadId } });
      runBestEffort(refetchActiveThreads?.());
      runBestEffort(refetchResolvedThreads?.());
    } catch (error) {
      setActionError(error?.message || "Không thể gửi phản hồi lúc này.");
    }
  };

  const onResolve = async () => {
    const threadId = thread?.id || selectedItem?.threadId || null;
    if (!canResolveHandoff || !threadId || isThreadClosed || activeTab === TAB_RESOLVED) return;
    setActionError("");
    try {
      const { data } = await resolveHandoff({ variables: { input: { chatThreadId: threadId } } });
      if (!data?.resolveAiChatbotHandoff?.ok) throw new Error(data?.resolveAiChatbotHandoff?.message || "Không thể kết thúc hỗ trợ.");
      setResolvedThreadIds((current) => new Set(current).add(String(threadId)));
      setReply("");
      await loadThread({ variables: { id: threadId } });
      runBestEffort(refetchActiveThreads?.());
      runBestEffort(refetchResolvedThreads?.());
      runBestEffort(refetchNotifications?.());
    } catch (error) {
      setActionError(error?.message || "Không thể kết thúc hỗ trợ lúc này.");
    }
  };

  if (!restaurantId) return <div className="ai-handoff-inbox__panel"><div className="ai-handoff-inbox__content">Chưa xác định được nhà hàng để tải yêu cầu hỗ trợ.</div></div>;
  if (!canViewHandoff) return <div className="ai-handoff-inbox__panel"><div className="ai-handoff-inbox__content">Bạn không có quyền xử lý handoff AI chatbot.</div></div>;

  return (
    <div className="ai-handoff-inbox">
      <section className="ai-handoff-inbox__panel">
        <div className="ai-handoff-inbox__panel-header"><h2>Yêu cầu hỗ trợ từ AI</h2><div className="ai-handoff-inbox__tabs"><button type="button" className={activeTab === TAB_ACTIVE ? "active" : ""} onClick={() => setActiveTab(TAB_ACTIVE)}>Đang xử lý</button><button type="button" className={activeTab === TAB_RESOLVED ? "active" : ""} onClick={() => setActiveTab(TAB_RESOLVED)}>Đã xử lý</button></div></div>
        {isLoading ? <div className="ai-handoff-inbox__content"><div className="ai-handoff-inbox__skeleton" role="status"><span /><span /><span /></div></div> : currentItems.length === 0 ? <div className="ai-handoff-inbox__content"><div className="ai-handoff-inbox__empty"><strong>Chưa có yêu cầu hỗ trợ từ chatbot</strong><p>Khi khách cần nhân viên hỗ trợ, hội thoại sẽ xuất hiện ở đây để bạn tiếp nhận nhanh.</p></div></div> : <div className="ai-handoff-inbox__list">{currentItems.map((item) => <button key={item.id} type="button" className={`ai-handoff-inbox__item ${selectedItem?.id === item.id ? "active" : ""}`} onClick={() => openItem(item)}><div className="ai-handoff-inbox__item-meta"><AiHandoffBadge /><span>{formatTime(item.time)}</span></div><p className="ai-handoff-inbox__preview">{item.preview}</p><div className="ai-handoff-inbox__item-footer"><span>{item.restaurantId ? `NH: ${String(item.restaurantId).slice(-6)}` : "Không rõ nhà hàng"}</span><span>{item.unread ? <><span className="ai-handoff-inbox__dot" />Chưa đọc</> : "Đã đọc"}</span></div></button>)}</div>}
      </section>
      <section className="ai-handoff-inbox__panel">
        <div className="ai-handoff-inbox__panel-header"><h2>Chi tiết hội thoại</h2>{(hasHandoffMarker || isAiHandoffThread(thread)) && <AiHandoffBadge />}</div>
        <div className="ai-handoff-inbox__content">
          {warning && <div className="ai-handoff-inbox__message">{warning}</div>}
          {actionError && <div className="ai-handoff-inbox__message">{actionError}<div><button type="button" onClick={() => selectedItem && openItem(selectedItem)}>Thử lại</button></div></div>}
          {!selectedItem ? <div className="ai-handoff-inbox__message">Chọn một yêu cầu cần hỗ trợ để xem chi tiết.</div> : threadLoading ? <div className="ai-handoff-inbox__message">Đang tải hội thoại...</div> : !thread ? <div className="ai-handoff-inbox__message">Không có dữ liệu hội thoại.</div> : (thread.messages || []).map((msg, index) => { const isSummary = index === 0 && String(msg?.content || "").includes(HANDOFF_MARKER); return <div key={`${msg.createdAt || "na"}_${index}`} className={`ai-handoff-inbox__message ${isSummary ? "is-handoff-summary" : ""}`}><strong>{resolveSenderLabel(msg)}</strong><div>{msg.content}</div><small>{formatTime(msg.createdAt)}</small></div>; })}
        </div>
        <form className="ai-handoff-inbox__reply" onSubmit={onSend}>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} aria-label="Nội dung phản hồi cho khách" disabled={activeTab === TAB_RESOLVED || isThreadClosed || !canViewHandoff} placeholder={isThreadClosed ? "Phiên hỗ trợ đã đóng" : "Nhập phản hồi cho khách..."} />
          <button type="submit" disabled={activeTab === TAB_RESOLVED || isThreadClosed || !canViewHandoff || !reply.trim() || !!sendMessageState?.loading}>Gửi phản hồi</button>
          <button type="button" onClick={onResolve} disabled={activeTab === TAB_RESOLVED || !selectedItem || isThreadClosed || resolving || !canResolveHandoff}>{activeTab === TAB_RESOLVED || isThreadClosed ? "Đã xử lý" : resolving ? "Đang xử lý..." : "Đánh dấu đã xử lý"}</button>
          {!canResolveHandoff ? <small>Bạn cần quyền ai.chatbot.handoff để đánh dấu đã xử lý.</small> : null}
          {isThreadClosed ? <small>Phiên hỗ trợ này đã được đóng.</small> : null}
          <small>Sau khi đóng phiên hỗ trợ, khách có thể tiếp tục trò chuyện với AI hoặc tạo yêu cầu hỗ trợ mới khi cần.</small>
        </form>
      </section>
    </div>
  );
}
