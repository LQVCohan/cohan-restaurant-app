import React, { useEffect, useMemo, useState } from "react";
import { MessageCircle, PhoneCall, Search } from "lucide-react";
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

export default function ContactsView({ restaurantId, focusThreadId = null, onFocusHandled }) {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeThreadId, setActiveThreadId] = useState(null);
  const { showNotification } = useNotification();
  const { user } = React.useContext(AuthContext) || {};

  const {
    threads,
    threadsLoading,
    thread,
    loadThread,
    openThread,
    sendMessage,
    sendMessageState,
    markThreadRead,
    refetchThreads,
  } = useCommunication({ restaurantId });

  useEffect(() => {
    if (!focusThreadId) return;
    setActiveThreadId(focusThreadId);
    loadThread({ variables: { id: focusThreadId } });
    onFocusHandled?.();
  }, [focusThreadId, loadThread, onFocusHandled]);

  const contacts = useMemo(
    () =>
      (threads || []).map((item) => ({
        id: item.id,
        name: item.subject || `Hội thoại ${item.channel || "support"}`,
        role: item.targetRole || item.channel || "support",
        dept: item.targetRole || item.channel || "support",
        lastMsg: item.lastMessagePreview || "(Chưa có tin nhắn)",
        unreadCount: Number(item.unreadCount || 0),
        status: "online",
      })),
    [threads],
  );

  const filteredContacts = contacts.filter((contact) => {
    const normalizedSearch = searchQuery.toLowerCase();
    const matchesTab = activeTab === "all" || contact.dept === activeTab;
    const matchesSearch =
      contact.name.toLowerCase().includes(normalizedSearch) ||
      contact.role.toLowerCase().includes(normalizedSearch);
    return matchesTab && matchesSearch;
  });

  const openExistingThread = async (threadId) => {
    setActiveThreadId(threadId);
    await loadThread({ variables: { id: threadId } });
    await markThreadRead({ variables: { threadId } });
    refetchThreads?.();
  };

  const openRoleThread = async (role) => {
    if (!restaurantId) {
      showNotification("Chưa xác định được nhà hàng làm việc.", "warning");
      return;
    }
    const { data } = await openThread({
      variables: {
        input: {
          restaurantId,
          channel: "other",
          targetRole: role,
          subject: `Trao đổi với ${role}`,
        },
      },
    });
    const threadId = data?.openChatThread?.id;
    if (threadId) await openExistingThread(threadId);
  };

  const handleSend = async (content) => {
    if (!activeThreadId) return;
    await sendMessage({
      variables: { input: { threadId: activeThreadId, content } },
    });
    await loadThread({ variables: { id: activeThreadId } });
    refetchThreads?.();
  };

  return (
    <div className="staff-pos-contacts">
      <div className="search-section">
        <label className="search-bar">
          <Search className="search-icon" size={20} aria-hidden="true" />
          <span className="sr-only">Tìm nhân viên hoặc bộ phận</span>
          <input
            type="search"
            placeholder="Tìm nhân viên / bộ phận..."
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
        <article className="contact-card contact-card--management">
          <div className="contact-info-wrap">
            <div className="info-text">
              <h4>Quản lý nhà hàng</h4>
              <p className="last-msg">Mở hội thoại nội bộ với quản lý</p>
            </div>
          </div>
          <div className="contact-actions">
            <button
              type="button"
              className="action-btn btn-chat"
              onClick={() => openRoleThread("management")}
              aria-label="Nhắn tin cho quản lý"
            >
              <MessageCircle size={18} aria-hidden="true" />
            </button>
            <button type="button" className="action-btn btn-call" aria-label="Gọi quản lý">
              <PhoneCall size={18} aria-hidden="true" />
            </button>
          </div>
        </article>

        {threadsLoading ? <div className="empty-state">Đang tải hội thoại...</div> : null}
        {!threadsLoading && filteredContacts.length === 0 ? (
          <div className="empty-state">Chưa có hội thoại phù hợp.</div>
        ) : (
          filteredContacts.map((contact) => (
            <article key={contact.id} className="contact-card">
              <button
                type="button"
                className="contact-card__open"
                onClick={() => openExistingThread(contact.id)}
                aria-label={`Mở hội thoại ${contact.name}`}
              >
                <div className="contact-info-wrap">
                  <div className="avatar-wrapper">
                    <div className="avatar">
                      {(contact.name || "C").charAt(0).toUpperCase()}
                    </div>
                    <span className={`status-indicator ${contact.status}`} aria-hidden="true" />
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
                  <span className="unread-pill" aria-label={`${contact.unreadCount} tin chưa đọc`}>
                    {contact.unreadCount}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="action-btn btn-chat"
                  onClick={() => openExistingThread(contact.id)}
                  aria-label={`Nhắn tin trong hội thoại ${contact.name}`}
                >
                  <MessageCircle size={18} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <ChatThreadPanel
        open={Boolean(activeThreadId)}
        title={thread?.subject || "Trao đổi"}
        meId={user?.id}
        messages={thread?.messages || []}
        sending={sendMessageState.loading}
        onClose={() => setActiveThreadId(null)}
        onSend={handleSend}
      />
    </div>
  );
}
