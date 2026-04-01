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
  { id: "support", label: "Customers/Support" },
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

  const contacts = useMemo(() => {
    return (threads || []).map((t) => ({
      id: t.id,
      name: t.subject || `Thread ${t.channel || "support"}`,
      role: t.targetRole || t.channel || "support",
      dept: t.targetRole || t.channel || "support",
      lastMsg: t.lastMessagePreview || "(Chưa có tin nhắn)",
      unreadCount: Number(t.unreadCount || 0),
      status: "online",
      avatarColor: "blue",
    }));
  }, [threads]);

  const filteredContacts = contacts.filter((c) => {
    const matchesTab = activeTab === "all" || c.dept === activeTab;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.role.toLowerCase().includes(searchQuery.toLowerCase());
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
      showNotification("Thiếu restaurant context", "warning");
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
    if (threadId) {
      await openExistingThread(threadId);
    }
  };

  const handleSend = async (content) => {
    if (!activeThreadId) return;
    await sendMessage({
      variables: {
        input: {
          threadId: activeThreadId,
          content,
        },
      },
    });
    await loadThread({ variables: { id: activeThreadId } });
    refetchThreads?.();
  };

  return (
    <div className="staff-pos-contacts">
      <div className="search-section">
        <div className="search-bar">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Tìm nhân viên / bộ phận..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-scroll">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`filter-chip ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="contact-list">
        <div className="contact-card">
          <div className="contact-info-wrap">
            <div className="info-text">
              <h4>Nhắn management</h4>
              <p className="last-msg">Mở thread nội bộ với quản lý</p>
            </div>
          </div>
          <div className="contact-actions">
            <button className="action-btn btn-chat" onClick={() => openRoleThread("management")}>
              <MessageCircle size={18} />
            </button>
            <button className="action-btn btn-call" aria-label="Gọi điện">
              <PhoneCall size={18} />
            </button>
          </div>
        </div>

        {threadsLoading && <div className="empty-state">Đang tải hội thoại...</div>}
        {!threadsLoading && filteredContacts.length === 0 ? (
          <div className="empty-state">Chưa có hội thoại cho nhà hàng này.</div>
        ) : (
          filteredContacts.map((c) => (
            <div key={c.id} className="contact-card" onClick={() => openExistingThread(c.id)}>
              <div className="contact-info-wrap">
                <div className="avatar-wrapper">
                  <div className={`avatar ${c.avatarColor}`}>{(c.name || "C").charAt(0).toUpperCase()}</div>
                  <span className={`status-indicator ${c.status}`}></span>
                </div>

                <div className="info-text">
                  <h4>{c.name}</h4>
                  <span className="role">{c.role}</span>
                  <p className="last-msg">{c.lastMsg}</p>
                </div>
              </div>

              <div className="contact-actions">
                {c.unreadCount > 0 && <span className="unread-pill">{c.unreadCount}</span>}
                <button className="action-btn btn-chat">
                  <MessageCircle size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <ChatThreadPanel
        open={!!activeThreadId}
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
