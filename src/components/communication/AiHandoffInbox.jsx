import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import useCommunication from "@/hooks/useCommunication";
import { hasAnyPermission } from "@/utils/frontendPermissionAccess";
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

const formatTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : "";

const isAiHandoffThread = (thread) => {
  const fields = [
    thread?.type,
    thread?.kind,
    thread?.source,
    thread?.metadata?.source,
    thread?.metadata?.type,
    thread?.payload?.type,
  ].map((value) => String(value || "").toLowerCase());

  if (fields.includes("ai_chatbot_handoff") || fields.includes("ai_chatbot")) {
    return true;
  }
  if (thread?.metadata?.handoff === true) return true;

  return String(thread?.subject || "")
    .trim()
    .toLowerCase()
    .startsWith(HANDOFF_PREFIX);
};

const isAiHandoffNotification = (notification) =>
  String(notification?.type || "").toLowerCase() === "ai_chatbot_handoff";

const TAB_ACTIVE = "active";
const TAB_RESOLVED = "resolved";

const resolveSenderLabel = (message) => {
  const role = String(message?.senderRole || "").toLowerCase();
  if (role === "guest" || role === "customer") return "Khách hàng";
  if (role === "assistant" || role === "ai" || role === "chatbot") {
    return "Trợ lý tự động";
  }
  if (["staff", "manager", "admin"].includes(role)) {
    return message?.senderName || "Nhân viên";
  }
  if (role === "system") return "Hệ thống";
  return message?.senderName || message?.senderRole || "Hệ thống";
};

const runBestEffort = (result) => {
  if (result && typeof result.catch === "function") result.catch(() => {});
};

const getRestaurantId = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value.id || value._id || value.restaurantId || "");
};

const resolveRestaurantId = ({
  propRestaurantId,
  selectedRestaurantId,
  activeRestaurantId,
  activeRestaurant,
  restaurants,
  user,
}) => {
  const fromProp = getRestaurantId(propRestaurantId);
  if (fromProp) return fromProp;

  const fromSelected = getRestaurantId(selectedRestaurantId);
  if (fromSelected) return fromSelected;

  const fromActiveId = getRestaurantId(activeRestaurantId);
  if (fromActiveId) return fromActiveId;

  const fromActiveRestaurant = getRestaurantId(activeRestaurant);
  if (fromActiveRestaurant) return fromActiveRestaurant;

  const fromStaff = getRestaurantId(user?.restaurantForStaff);
  if (fromStaff) return fromStaff;

  const fromContextRestaurants = getRestaurantId(restaurants?.[0]);
  if (fromContextRestaurants) return fromContextRestaurants;

  return getRestaurantId(user?.restaurantId) || null;
};

export default function AiHandoffInbox({
  restaurantId: propRestaurantId = null,
}) {
  const {
    user,
    activeRestaurant,
    activeRestaurantId,
    restaurants = [],
    restaurantsLoading = false,
  } = useContext(AuthContext) || {};
  const location = useLocation();
  const requestedThreadId = useMemo(
    () => new URLSearchParams(location.search).get("threadId") || "",
    [location.search],
  );
  const openedThreadIdRef = useRef("");

  const canViewHandoff = hasAnyPermission(user, [
    "ai.chatbot.handoff",
    "ai.chatbot.moderate",
  ]);
  const canResolveHandoff = hasAnyPermission(user, ["ai.chatbot.handoff"]);

  const [selectedItem, setSelectedItem] = useState(null);
  const [reply, setReply] = useState("");
  const [warning, setWarning] = useState("");
  const [actionError, setActionError] = useState("");
  const [resolvedThreadIds, setResolvedThreadIds] = useState(() => new Set());
  const [activeTab, setActiveTab] = useState(TAB_ACTIVE);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  const [resolveHandoff, { loading: resolving }] = useMutation(
    RESOLVE_AI_CHATBOT_HANDOFF,
  );

  const restaurantId = useMemo(
    () =>
      resolveRestaurantId({
        propRestaurantId,
        selectedRestaurantId,
        activeRestaurantId,
        activeRestaurant,
        restaurants,
        user,
      }),
    [
      propRestaurantId,
      selectedRestaurantId,
      activeRestaurantId,
      activeRestaurant,
      restaurants,
      user,
    ],
  );

  const activeCommunication = useCommunication({
    restaurantId,
    status: "open",
    notificationsEnabled: canViewHandoff && !!restaurantId,
  });

  const resolvedCommunication = useCommunication({
    restaurantId,
    status: "closed",
    notificationsEnabled: false,
  });

  const {
    threads: activeThreads,
    threadsLoading: activeThreadsLoading,
    notifications,
    notificationsLoading,
    thread: activeThread,
    threadLoading: activeThreadLoading,
    loadThread: loadActiveThread,
    sendMessage,
    sendMessageState,
    markThreadRead,
    markNotificationRead,
    refetchThreads: refetchActiveThreads,
    refetchNotifications,
  } = activeCommunication;

  const {
    threads: resolvedThreads,
    threadsLoading: resolvedThreadsLoading,
    thread: resolvedThread,
    threadLoading: resolvedThreadLoading,
    loadThread: loadResolvedThread,
    refetchThreads: refetchResolvedThreads,
  } = resolvedCommunication;

  const notificationItems = useMemo(
    () =>
      (notifications || []).filter(isAiHandoffNotification).map((item) => ({
        kind: "notification",
        id: `notif_${item.id}`,
        notificationId: item.id,
        threadId: item?.payload?.threadId || null,
        unread: !item.readAt,
        preview:
          item?.payload?.messagePreview ||
          item?.payload?.title ||
          "Yêu cầu cần hỗ trợ",
        time: item.createdAt,
        restaurantId: item.restaurantId,
      })),
    [notifications],
  );

  const threadItems = useMemo(
    () =>
      (activeThreads || []).filter(isAiHandoffThread).map((item) => ({
        kind: "thread",
        id: `thread_${item.id}`,
        notificationId: null,
        threadId: item.id,
        unread: Number(item.unreadCount || 0) > 0,
        preview:
          item.lastMessagePreview || item.subject || "Yêu cầu cần hỗ trợ",
        time: item.updatedAt || item.lastMessageAt,
        restaurantId: item.restaurantId,
      })),
    [activeThreads],
  );

  const resolvedItems = useMemo(
    () =>
      (resolvedThreads || [])
        .filter(isAiHandoffThread)
        .map((item) => ({
          kind: "thread",
          id: `resolved_thread_${item.id}`,
          notificationId: null,
          threadId: item.id,
          unread: false,
          preview:
            item.lastMessagePreview || item.subject || "Yêu cầu cần hỗ trợ",
          time: item.updatedAt || item.lastMessageAt,
          restaurantId: item.restaurantId,
        }))
        .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)),
    [resolvedThreads],
  );

  const mergedItems = useMemo(() => {
    const map = new Map();

    for (const item of [...notificationItems, ...threadItems]) {
      const key = item.threadId || item.id;
      if (!map.has(key)) {
        map.set(key, item);
      } else {
        const current = map.get(key);
        map.set(key, {
          ...current,
          unread: current.unread || item.unread,
          notificationId: current.notificationId || item.notificationId,
          time: current.time || item.time,
        });
      }
    }

    return [...map.values()]
      .filter((item) => !resolvedThreadIds.has(String(item.threadId || "")))
      .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
  }, [notificationItems, threadItems, resolvedThreadIds]);

  const currentItems = activeTab === TAB_RESOLVED ? resolvedItems : mergedItems;
  const thread = activeTab === TAB_RESOLVED ? resolvedThread : activeThread;
  const threadLoading =
    activeTab === TAB_RESOLVED ? resolvedThreadLoading : activeThreadLoading;
  const loadThread =
    activeTab === TAB_RESOLVED ? loadResolvedThread : loadActiveThread;
  const isThreadClosed =
    String(thread?.status || "").toLowerCase() === "closed";
  const isActiveView = activeTab === TAB_ACTIVE;
  const isLoading = isActiveView
    ? activeThreadsLoading || notificationsLoading
    : resolvedThreadsLoading;
  const hasHandoffMarker =
    Array.isArray(thread?.messages) &&
    String(thread.messages?.[0]?.content || "").includes(HANDOFF_MARKER);

  useEffect(() => {
    setSelectedItem(null);
    setReply("");
    setWarning("");
    setActionError("");
  }, [activeTab]);

  useEffect(() => {
    openedThreadIdRef.current = "";
    setActiveTab(TAB_ACTIVE);
    setSelectedItem(null);
    setReply("");
    setWarning("");
    setActionError("");
    setResolvedThreadIds(new Set());
  }, [restaurantId]);

  const openItem = async (item) => {
    setWarning("");
    setActionError("");
    setSelectedItem(item);

    const threadId = item?.threadId || null;
    if (!threadId) {
      setWarning(
        "Thiếu thông tin hội thoại để gửi phản hồi. Vui lòng tải lại trang hoặc chọn yêu cầu khác.",
      );
      return;
    }

    try {
      const { data } = await loadThread({ variables: { id: threadId } });
      if (!data?.chatThread) {
        setActionError(
          "Không thể tải hội thoại hoặc bạn không có quyền truy cập.",
        );
      }
    } catch (error) {
      setActionError(
        error?.message ||
          "Không thể tải hội thoại hoặc bạn không có quyền truy cập.",
      );
    }

    if (item.notificationId) {
      runBestEffort(
        markNotificationRead({ variables: { id: item.notificationId } }),
      );
    }

    runBestEffort(markThreadRead({ variables: { threadId } }));
    runBestEffort(refetchActiveThreads?.());
    runBestEffort(refetchResolvedThreads?.());
    runBestEffort(refetchNotifications?.());
  };

  useEffect(() => {
    if (
      !requestedThreadId ||
      openedThreadIdRef.current === requestedThreadId
    ) {
      return;
    }

    const activeItem = mergedItems.find(
      (candidate) => String(candidate.threadId || "") === requestedThreadId,
    );
    if (activeItem) {
      if (activeTab !== TAB_ACTIVE) {
        setActiveTab(TAB_ACTIVE);
        return;
      }
      openedThreadIdRef.current = requestedThreadId;
      void openItem(activeItem);
      return;
    }

    const resolvedItem = resolvedItems.find(
      (candidate) => String(candidate.threadId || "") === requestedThreadId,
    );
    if (!resolvedItem) return;
    if (activeTab !== TAB_RESOLVED) {
      setActiveTab(TAB_RESOLVED);
      return;
    }
    openedThreadIdRef.current = requestedThreadId;
    void openItem(resolvedItem);
  }, [activeTab, mergedItems, openItem, requestedThreadId, resolvedItems]);

  const onSend = async (event) => {
    event.preventDefault();

    const content = reply.trim();
    const threadId = thread?.id || selectedItem?.threadId;
    if (
      !canResolveHandoff ||
      !content ||
      !threadId ||
      isThreadClosed ||
      activeTab === TAB_RESOLVED
    ) {
      return;
    }

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
    if (
      !canResolveHandoff ||
      !threadId ||
      isThreadClosed ||
      activeTab === TAB_RESOLVED
    ) {
      return;
    }

    setActionError("");
    try {
      const { data } = await resolveHandoff({
        variables: { input: { chatThreadId: threadId } },
      });
      if (!data?.resolveAiChatbotHandoff?.ok) {
        throw new Error(
          data?.resolveAiChatbotHandoff?.message ||
            "Không thể kết thúc hỗ trợ.",
        );
      }

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

  if (!restaurantId) {
    return (
      <div className="ai-handoff-inbox ai-handoff-inbox--single">
        <div className="ai-handoff-inbox__panel">
          <div className="ai-handoff-inbox__content">
            <div className="ai-handoff-inbox__empty">
              <strong>
                {restaurantsLoading
                  ? "Đang tải danh sách nhà hàng..."
                  : "Chưa xác định được nhà hàng"}
              </strong>
              <p>
                {restaurantsLoading
                  ? "Vui lòng chờ hệ thống tải dữ liệu nhà hàng của tài khoản quản lý."
                  : "Vui lòng đảm bảo tài khoản quản lý đã được gán nhà hàng để tải yêu cầu hỗ trợ."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canViewHandoff) {
    return (
      <div className="ai-handoff-inbox ai-handoff-inbox--single">
        <div className="ai-handoff-inbox__panel">
          <div className="ai-handoff-inbox__content">
            <div className="ai-handoff-inbox__empty">
              <strong>Không có quyền xử lý bàn giao hỗ trợ</strong>
              <p>Bạn chưa được cấp quyền xử lý yêu cầu hỗ trợ.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-handoff-inbox">
      <section className="ai-handoff-inbox__panel">
        <div className="ai-handoff-inbox__panel-header">
          <div>
            <p className="ai-handoff-inbox__eyebrow">Bàn giao hỗ trợ</p>
            <h2>Yêu cầu cần hỗ trợ</h2>
          </div>

          <div className="ai-handoff-inbox__header-actions">
            <label className="ai-handoff-inbox__restaurant-select">
              <span>Nhà hàng</span>
              <select
                value={restaurantId || ""}
                disabled={!!propRestaurantId || !restaurants.length}
                onChange={(event) => setSelectedRestaurantId(event.target.value)}
              >
                {!restaurants.length ? (
                  <option value={restaurantId || ""}>
                    {restaurantId
                      ? `Nhà hàng ${String(restaurantId).slice(-6)}`
                      : "Chưa có nhà hàng"}
                  </option>
                ) : null}

                {restaurants.map((restaurant) => {
                  const id = getRestaurantId(restaurant);
                  return (
                    <option key={id} value={id}>
                      {restaurant.name || `Nhà hàng ${String(id).slice(-6)}`}
                    </option>
                  );
                })}
              </select>
            </label>

            <div className="ai-handoff-inbox__tabs">
              <button
                type="button"
                className={activeTab === TAB_ACTIVE ? "active" : ""}
                onClick={() => setActiveTab(TAB_ACTIVE)}
              >
                Đang xử lý
              </button>
              <button
                type="button"
                className={activeTab === TAB_RESOLVED ? "active" : ""}
                onClick={() => setActiveTab(TAB_RESOLVED)}
              >
                Đã xử lý
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="ai-handoff-inbox__content">
            <div className="ai-handoff-inbox__skeleton" role="status">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : currentItems.length === 0 ? (
          <div className="ai-handoff-inbox__content">
            <div className="ai-handoff-inbox__empty">
              <strong>
                {activeTab === TAB_RESOLVED
                  ? "Chưa có yêu cầu đã xử lý"
                  : "Chưa có yêu cầu cần hỗ trợ"}
              </strong>
              <p>
                {activeTab === TAB_RESOLVED
                  ? "Các phiên hỗ trợ đã hoàn tất sẽ xuất hiện tại đây."
                  : "Khi khách cần nhân viên hỗ trợ, yêu cầu sẽ xuất hiện ở đây để bạn tiếp nhận nhanh."}
              </p>
            </div>
          </div>
        ) : (
          <div className="ai-handoff-inbox__list">
            {currentItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ai-handoff-inbox__item ${
                  selectedItem?.id === item.id ? "active" : ""
                }`}
                onClick={() => openItem(item)}
              >
                <div className="ai-handoff-inbox__item-meta">
                  <AiHandoffBadge />
                  <span>{formatTime(item.time)}</span>
                </div>

                <p className="ai-handoff-inbox__preview">{item.preview}</p>

                <div className="ai-handoff-inbox__item-footer">
                  <span>
                    {item.restaurantId
                      ? `NH: ${String(item.restaurantId).slice(-6)}`
                      : "Không rõ nhà hàng"}
                  </span>

                  <span>
                    {item.unread ? (
                      <>
                        <span className="ai-handoff-inbox__dot" />
                        Chưa đọc
                      </>
                    ) : (
                      "Đã đọc"
                    )}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="ai-handoff-inbox__panel">
        <div className="ai-handoff-inbox__panel-header">
          <div>
            <p className="ai-handoff-inbox__eyebrow">Chi tiết hội thoại</p>
            <h2>Chi tiết hội thoại</h2>
          </div>

          {(hasHandoffMarker || isAiHandoffThread(thread)) && (
            <AiHandoffBadge />
          )}
        </div>

        <div className="ai-handoff-inbox__content">
          {warning && (
            <div className="ai-handoff-inbox__message">{warning}</div>
          )}

          {actionError && (
            <div className="ai-handoff-inbox__message">
              {actionError}
              <div>
                <button
                  type="button"
                  onClick={() => selectedItem && openItem(selectedItem)}
                >
                  Thử lại
                </button>
              </div>
            </div>
          )}

          {!selectedItem ? (
            <div className="ai-handoff-inbox__message">
              Chọn một yêu cầu cần hỗ trợ để xem chi tiết.
            </div>
          ) : threadLoading ? (
            <div className="ai-handoff-inbox__message">
              Đang tải hội thoại...
            </div>
          ) : !thread ? (
            <div className="ai-handoff-inbox__message">
              Không có dữ liệu hội thoại.
            </div>
          ) : (
            (thread.messages || []).map((message, index) => {
              const isSummary =
                index === 0 &&
                String(message?.content || "").includes(HANDOFF_MARKER);

              return (
                <div
                  key={`${message.createdAt || "na"}_${index}`}
                  className={`ai-handoff-inbox__message ${
                    isSummary ? "is-handoff-summary" : ""
                  }`}
                >
                  <strong>{resolveSenderLabel(message)}</strong>
                  <div>{message.content}</div>
                  <small>{formatTime(message.createdAt)}</small>
                </div>
              );
            })
          )}
        </div>

        <form className="ai-handoff-inbox__reply" onSubmit={onSend}>
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            aria-label="Nội dung phản hồi cho khách"
            disabled={
              activeTab === TAB_RESOLVED || isThreadClosed || !canResolveHandoff
            }
            placeholder={
              !canResolveHandoff
                ? "Bạn chỉ có quyền xem hội thoại"
                : isThreadClosed
                  ? "Phiên hỗ trợ đã đóng"
                  : "Nhập phản hồi cho khách..."
            }
          />

          <button
            type="submit"
            disabled={
              activeTab === TAB_RESOLVED ||
              isThreadClosed ||
              !canResolveHandoff ||
              !reply.trim() ||
              !!sendMessageState?.loading
            }
          >
            Gửi phản hồi
          </button>

          <button
            type="button"
            onClick={onResolve}
            disabled={
              activeTab === TAB_RESOLVED ||
              !selectedItem ||
              isThreadClosed ||
              resolving ||
              !canResolveHandoff
            }
          >
            {activeTab === TAB_RESOLVED || isThreadClosed
              ? "Đã xử lý"
              : resolving
                ? "Đang xử lý..."
                : "Đánh dấu đã xử lý"}
          </button>

          {!canResolveHandoff ? (
            <small>Bạn chỉ có quyền xem hội thoại bàn giao.</small>
          ) : null}

          {isThreadClosed ? (
            <small>Phiên hỗ trợ này đã được đóng.</small>
          ) : null}

          <small>
            Sau khi đóng phiên hỗ trợ, khách có thể tiếp tục trò chuyện với hệ thống hỗ trợ
            hoặc tạo yêu cầu mới khi cần.
          </small>
        </form>
      </section>
    </div>
  );
}
