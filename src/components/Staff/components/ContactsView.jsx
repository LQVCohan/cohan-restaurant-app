import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { MessageCircle, Search, X } from "lucide-react";
import useCommunication from "@/hooks/useCommunication";
import { useNotification } from "@/hooks/useNotification";
import { AuthContext } from "@/context/AuthContext";
import ChatThreadPanel from "@/components/common/ChatThreadPanel";
import "./ContactsView.scss";

const tabs = [
  { id: "all", label: "Tất cả" },
  { id: "management", label: "Quản lý" },
  { id: "kitchen", label: "Bếp" },
  { id: "cashier", label: "Thu ngân" },
  { id: "support", label: "Khách hàng / Hỗ trợ" },
];

const roleLabels = {
  management: "Quản lý",
  manager: "Quản lý",
  kitchen: "Bếp",
  cashier: "Thu ngân",
  support: "Hỗ trợ khách hàng",
  order: "Đơn hàng",
  reservation: "Đặt bàn",
  other: "Nội bộ",
};

const normalizeDepartment = (value) => {
  const normalized = String(value || "support").toLowerCase();
  return normalized === "manager" ? "management" : normalized;
};

export default function ContactsView({
  restaurantId,
  focusThreadId = null,
  onFocusHandled,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeThreadId, setActiveThreadId] = useState(null);
  const handledFocusRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = useId();
  const { showNotification } = useNotification();
  const { user } = React.useContext(AuthContext) || {};

  const {
    threads,
    threadsLoading,
    thread,
    threadLoading,
    threadError,
    loadThread,
    openThread,
    sendMessage,
    sendMessageState,
    markThreadRead,
    refetchThreads,
  } = useCommunication({ restaurantId });

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    setActiveThreadId(null);
    handledFocusRef.current = null;
  }, [restaurantId]);

  useEffect(() => {
    const threadId = String(focusThreadId || "").trim();
    if (!threadId || handledFocusRef.current === threadId) return;
    handledFocusRef.current = threadId;
    setActiveThreadId(threadId);

    void (async () => {
      try {
        await loadThread({ variables: { id: threadId } });
        await markThreadRead({ variables: { threadId } });
        await refetchThreads?.();
      } catch (error) {
        showNotification(error?.message || "Không thể mở hội thoại.", "error");
        setActiveThreadId(null);
      }
    })();
    onFocusHandled?.();
  }, [
    focusThreadId,
    loadThread,
    markThreadRead,
    onFocusHandled,
    refetchThreads,
    showNotification,
  ]);

  const contacts = useMemo(
    () =>
      (threads || []).map((item) => {
        const rawRole = String(item.targetRole || item.channel || "support").toLowerCase();
        return {
          id: item.id,
          name: item.subject || `Hội thoại ${roleLabels[rawRole] || "hỗ trợ"}`,
          role: roleLabels[rawRole] || rawRole,
          dept: normalizeDepartment(rawRole),
          lastMsg: item.lastMessagePreview || "Chưa có tin nhắn",
          unreadCount: Number(item.unreadCount || 0),
        };
      }),
    [threads],
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredContacts = contacts.filter((contact) => {
    const matchesTab = activeTab === "all" || contact.dept === activeTab;
    const matchesSearch =
      contact.name.toLowerCase().includes(normalizedSearch) ||
      contact.role.toLowerCase().includes(normalizedSearch);
    return matchesTab && matchesSearch;
  });
  const showManagementShortcut =
    (activeTab === "all" || activeTab === "management") &&
    (!normalizedSearch ||
      "quản lý nhà hàng".includes(normalizedSearch) ||
      "quản lý".includes(normalizedSearch));

  const openExistingThread = async (threadId) => {
    setActiveThreadId(threadId);
    try {
      await loadThread({ variables: { id: threadId } });
      await markThreadRead({ variables: { threadId } });
      await refetchThreads?.();
    } catch (error) {
      showNotification(error?.message || "Không thể mở hội thoại.", "error");
      setActiveThreadId(null);
    }
  };

  const openManagerThread = async () => {
    if (!restaurantId) {
      showNotification("Chưa xác định được nhà hàng làm việc.", "warning");
      return;
    }

    try {
      const { data } = await openThread({
        variables: {
          input: {
            restaurantId,
            channel: "other",
            targetRole: "manager",
            subject: "Trao đổi với quản lý",
          },
        },
      });
      const threadId = data?.openChatThread?.id;
      if (threadId) await openExistingThread(threadId);
    } catch (error) {
      showNotification(error?.message || "Không thể mở hội thoại với quản lý.", "error");
    }
  };

  const handleSend = async (content) => {
    if (!activeThreadId) return;
    await sendMessage({
      variables: { input: { threadId: activeThreadId, content } },
    });
    await loadThread({ variables: { id: activeThreadId } });
    await refetchThreads?.();
  };

  return (
    <div
      className="staff-messenger-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <section
        className={`staff-messenger ${activeThreadId ? "is-thread-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={activeThreadId ? undefined : titleId}
        aria-label={activeThreadId ? "Hội thoại nhân viên" : undefined}
      >
        {activeThreadId ? (
          <ChatThreadPanel
            embedded
            open
            title={thread?.subject || "Trao đổi"}
            subtitle="Tin nhắn nội bộ"
            meId={user?.id}
            messages={thread?.messages || []}
            loading={threadLoading}
            error={threadError}
            sending={Boolean(sendMessageState?.loading)}
            onBack={() => setActiveThreadId(null)}
            onClose={onClose}
            onSend={handleSend}
          />
        ) : (
          <>
            <header className="staff-messenger__header">
              <div className="staff-messenger__title-wrap">
                <span className="staff-messenger__mark" aria-hidden="true">
                  <MessageCircle size={20} />
                </span>
                <div>
                  <h2 id={titleId}>Tin nhắn</h2>
                  <p>Trao đổi nội bộ và hỗ trợ khách hàng</p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="staff-messenger__close"
                onClick={onClose}
                aria-label="Đóng tin nhắn"
              >
                <X size={19} aria-hidden="true" />
              </button>
            </header>

            <div className="staff-pos-contacts">
              <div className="search-section">
                <label className="search-bar">
                  <Search className="search-icon" size={19} aria-hidden="true" />
                  <span className="sr-only">Tìm nhân viên hoặc bộ phận</span>
                  <input
                    type="search"
                    placeholder="Tìm hội thoại hoặc bộ phận..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </label>
              </div>

              <nav className="filter-scroll" aria-label="Lọc liên hệ theo bộ phận">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`filter-chip ${activeTab === tab.id ? "active" : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                    aria-pressed={activeTab === tab.id}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <div className="contact-list">
                {showManagementShortcut ? (
                  <article className="contact-card contact-card--management">
                    <button
                      type="button"
                      className="contact-card__open"
                      onClick={() => void openManagerThread()}
                      aria-label="Nhắn tin cho quản lý nhà hàng"
                    >
                      <div className="contact-info-wrap">
                        <div className="avatar">QL</div>
                        <div className="info-text">
                          <h4>Quản lý nhà hàng</h4>
                          <p className="last-msg">Mở hội thoại nội bộ với quản lý</p>
                        </div>
                      </div>
                    </button>
                    <MessageCircle size={18} aria-hidden="true" />
                  </article>
                ) : null}

                {threadsLoading ? (
                  <div className="empty-state">Đang tải hội thoại...</div>
                ) : null}
                {!threadsLoading && filteredContacts.length === 0 ? (
                  <div className="empty-state">Chưa có hội thoại phù hợp.</div>
                ) : (
                  filteredContacts.map((contact) => (
                    <article key={contact.id} className="contact-card">
                      <button
                        type="button"
                        className="contact-card__open"
                        onClick={() => void openExistingThread(contact.id)}
                        aria-label={`Mở hội thoại ${contact.name}`}
                      >
                        <div className="contact-info-wrap">
                          <div className="avatar">
                            {(contact.name || "C").charAt(0).toUpperCase()}
                          </div>
                          <div className="info-text">
                            <h4>{contact.name}</h4>
                            <span className="role">{contact.role}</span>
                            <p className="last-msg">{contact.lastMsg}</p>
                          </div>
                        </div>
                      </button>

                      <div className="contact-actions">
                        {contact.unreadCount > 0 ? (
                          <span
                            className="unread-pill"
                            aria-label={`${contact.unreadCount} tin chưa đọc`}
                          >
                            {contact.unreadCount}
                          </span>
                        ) : null}
                        <MessageCircle size={18} aria-hidden="true" />
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
