import React, { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useLazyQuery, useMutation } from "@apollo/client/react";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import "./AiChatbotWidget.scss";

const ASK_AI_CHATBOT = gql`
  mutation AskAiChatbot($input: AskAiChatbotInput!) {
    askAiChatbot(input: $input) {
      answer
      intent
      confidence
      quickReplies
      isFallback
      conversationId
      actions {
        type
        label
        href
      }
      sources {
        type
        id
        label
      }
      contextSummary {
        restaurantCount
        menuItemCount
        couponCount
        orderCount
        reservationCount
      }
      handoffSuggested
      handoffReason
      handoffMessage
    }
  }
`;
const REQUEST_AI_CHATBOT_HANDOFF = gql`
  mutation RequestAiChatbotHandoff($input: RequestAiChatbotHandoffInput!) {
    requestAiChatbotHandoff(input: $input) {
      ok
      conversationId
      handoffRequested
      chatThreadId
      notificationCount
      message
      alreadyRequested
    }
  }
`;

const SEND_AI_CHATBOT_GUEST_MESSAGE = gql`
  mutation SendAiChatbotGuestMessage($input: SendAiChatbotGuestMessageInput!) {
    sendAiChatbotGuestMessage(input: $input) {
      ok
      conversationId
      message {
        id
        role
        senderLabel
        content
        createdAt
      }
    }
  }
`;

const Q_AI_CHATBOT_GUEST_REPLIES = gql`
  query AiChatbotGuestReplies($input: GetAiChatbotGuestRepliesInput!) {
    aiChatbotGuestReplies(input: $input) {
      ok
      handoffRequested
      conversationId
      replies {
        id
        role
        senderLabel
        content
        createdAt
      }
    }
  }
`;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

const STARTER_MESSAGES = [
  "Gợi ý món bán chạy cho tôi",
  "Tôi muốn đặt bàn",
  "Có mã giảm giá nào không?",
];


const GUEST_ID_STORAGE_KEY = "cohan_ai_guest_id";

const getConversationStorageKey = (restaurantId) => `cohan_ai_conversation_id:${restaurantId || "global"}`;
const getHandoffStorageKey = (conversationId) => `cohan_ai_handoff_requested:${conversationId}`;

const generateGuestId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const INITIAL_MESSAGES = [
  {
    role: "assistant",
    content:
      "Xin chào, mình là trợ lý A.I của Cohan Restaurant App. Mình có thể hỗ trợ bạn về menu, đặt bàn, đơn hàng, coupon và hướng dẫn sử dụng hệ thống.",
  },
];

const extractRestaurantId = ({ params, pathname }) => {
  if (params?.id && pathname.includes("/restaurant/")) return params.id;
  if (params?.restaurantId) return params.restaurantId;
  return null;
};

const normalizeHistory = (messages) =>
  messages
    .filter((item) => ["user", "assistant"].includes(item.role))
    .slice(-8)
    .map((item) => ({ role: item.role, content: item.content }));

function AiChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [lastActions, setLastActions] = useState([]);
  const [lastQuickReplies, setLastQuickReplies] = useState(STARTER_MESSAGES);
  const [lastContextSummary, setLastContextSummary] = useState(null);
  const [askAiChatbot, { loading }] = useMutation(ASK_AI_CHATBOT);
  const [requestHandoff, { loading: handoffLoading }] = useMutation(REQUEST_AI_CHATBOT_HANDOFF);
  const [sendGuestMessage, { loading: guestSendLoading }] = useMutation(SEND_AI_CHATBOT_GUEST_MESSAGE);
  const [loadGuestReplies] = useLazyQuery(Q_AI_CHATBOT_GUEST_REPLIES, { fetchPolicy: "network-only" });
  const [guestId, setGuestId] = useState(() => {
    if (typeof window === "undefined") return "";
    const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = generateGuestId();
    window.localStorage.setItem(GUEST_ID_STORAGE_KEY, created);
    return created;
  });
  const [conversationId, setConversationId] = useState("");
  const [handoffRequested, setHandoffRequested] = useState(false);
  const [latestStaffReplyAt, setLatestStaffReplyAt] = useState("");
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const restaurantId = useMemo(
    () => extractRestaurantId({ params, pathname: location.pathname }),
    [params, location.pathname],
  );

  const restaurantStorageKey = useMemo(() => getConversationStorageKey(restaurantId), [restaurantId]);

  useEffect(() => {
    if (!guestId || typeof window === "undefined") return;
    if (!window.localStorage.getItem(GUEST_ID_STORAGE_KEY)) {
      window.localStorage.setItem(GUEST_ID_STORAGE_KEY, guestId);
    }
  }, [guestId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setConversationId(window.localStorage.getItem(restaurantStorageKey) || "");
  }, [restaurantStorageKey]);

  useEffect(() => {
    if (!conversationId || typeof window === "undefined") return setHandoffRequested(false);
    setHandoffRequested(window.localStorage.getItem(getHandoffStorageKey(conversationId)) === "1");
  }, [conversationId]);

  useEffect(() => {
    const latest = [...messages]
      .reverse()
      .find((item) => item?.role === "staff" && item?.meta?.createdAt)?.meta?.createdAt;
    setLatestStaffReplyAt(latest || "");
  }, [messages]);

  const appendGuestReplies = (replies = []) => {
    if (!Array.isArray(replies) || replies.length === 0) return;
    setMessages((current) => {
      const existing = new Set(
        current
          .filter((item) => item?.role === "staff")
          .map((item) => item?.meta?.replyId || `${item?.meta?.createdAt || ""}_${item?.content || ""}`),
      );

      const incoming = [];
      for (const reply of replies) {
        const key = reply?.id || `${reply?.createdAt || ""}_${reply?.content || ""}`;
        if (!reply?.content || existing.has(key)) continue;
        existing.add(key);
        incoming.push({
          role: "staff",
          content: reply.content,
          meta: { senderLabel: reply.senderLabel || "Nhân viên", createdAt: reply.createdAt, replyId: key },
        });
      }

      return incoming.length ? [...current, ...incoming] : current;
    });
  };

  const fetchGuestReplies = async ({ force = false } = {}) => {
    if ((!handoffRequested && !force) || !conversationId || !guestId) return;
    try {
      const { data } = await loadGuestReplies({
        variables: {
          input: {
            conversationId,
            guestId,
            after: latestStaffReplyAt || undefined,
            limit: 30,
          },
        },
      });
      appendGuestReplies(data?.aiChatbotGuestReplies?.replies || []);
    } catch {
      // best effort polling only
    }
  };

  useEffect(() => {
    if (!open || !handoffRequested || !conversationId || !guestId) return undefined;

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    const onStaffReply = (payload) => {
      appendGuestReplies(payload ? [payload] : []);
    };

    socket.on("aiChatbotStaffReplyCreated", onStaffReply);

    socket.on("connect", () => {
      socket.emit("joinAiChatbotConversation", { conversationId, guestId }, () => {});
    });

    return () => {
      socket.off("aiChatbotStaffReplyCreated", onStaffReply);
      socket.emit("leaveAiChatbotConversation", { conversationId, guestId });
      socket.disconnect();
    };
  }, [open, handoffRequested, conversationId, guestId]);

  useEffect(() => {
    if (!open || !handoffRequested || !conversationId || !guestId) return undefined;
    fetchGuestReplies();
    const timer = window.setInterval(fetchGuestReplies, 6000);
    return () => window.clearInterval(timer);
  }, [open, handoffRequested, conversationId, guestId, latestStaffReplyAt]);

  const sendMessage = async (rawMessage) => {
    const content = String(rawMessage || input).trim();
    if (!content || loading || guestSendLoading) return;

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLastQuickReplies([]);

    try {
      let safeGuestId = guestId;
      if (!safeGuestId && typeof window !== "undefined") {
        safeGuestId = window.localStorage.getItem(GUEST_ID_STORAGE_KEY) || generateGuestId();
        window.localStorage.setItem(GUEST_ID_STORAGE_KEY, safeGuestId);
        setGuestId(safeGuestId);
      }

      if (handoffRequested && conversationId) {
        const { data } = await sendGuestMessage({
          variables: { input: { conversationId, guestId: safeGuestId, content } },
        });
        const ok = data?.sendAiChatbotGuestMessage?.ok;
        if (!ok) {
          setMessages((current) => [
            ...current,
            { role: "assistant", content: "Không thể gửi tin nhắn cho nhân viên lúc này. Vui lòng thử lại." },
          ]);
        }
        return;
      }

      const { data } = await askAiChatbot({
        variables: {
          input: {
            message: content,
            restaurantId,
            history: normalizeHistory(messages),
            guestId: safeGuestId || undefined,
            conversationId: conversationId || undefined,
          },
        },
      });
      const response = data?.askAiChatbot;
      if (response?.conversationId && typeof window !== "undefined") {
        window.localStorage.setItem(restaurantStorageKey, response.conversationId);
        setConversationId(response.conversationId);
      }
      const answer =
        response?.answer ||
        "Mình chưa xử lý được câu hỏi này. Bạn có thể hỏi lại ngắn gọn hơn hoặc mở trung tâm hỗ trợ.";

      setMessages((current) => [...current, { role: "assistant", content: answer, meta: response }]);
      setLastActions(response?.actions || []);
      setLastQuickReplies(response?.quickReplies?.length ? response.quickReplies : STARTER_MESSAGES);
      setLastContextSummary(response?.contextSummary || null);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            err?.message ||
            "Hiện chatbot chưa kết nối được với hệ thống. Vui lòng thử lại sau hoặc liên hệ nhân viên hỗ trợ.",
        },
      ]);
    }
  };

  const handleAction = (action) => {
    if (!action?.href) return;
    if (action.href.startsWith("http")) {
      window.open(action.href, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(action.href);
    setOpen(false);
  };
  const handleRequestHandoff = async () => {
    if (!conversationId || handoffRequested || handoffLoading) return;
    try {
      const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
      const { data } = await requestHandoff({
        variables: {
          input: {
            conversationId,
            guestId: guestId || undefined,
            restaurantId: restaurantId || undefined,
            reason: "user_click",
            latestUserMessage,
          },
        },
      });
      const result = data?.requestAiChatbotHandoff;
      if (result?.ok && result?.handoffRequested) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(getHandoffStorageKey(conversationId), "1");
        }
        setHandoffRequested(true);
        fetchGuestReplies({ force: true });
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result?.message || "Đã gửi yêu cầu gặp nhân viên." },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: err?.message || "Không thể gửi yêu cầu gặp nhân viên lúc này." },
      ]);
    }
  };

  return (
    <div className="ai-chatbot-widget" aria-live="polite">
      {open ? (
        <section className="ai-chatbot-panel" aria-label="ChatBot A.I hỗ trợ nhà hàng">
          <header className="ai-chatbot-header">
            <div className="ai-chatbot-title">
              <span className="ai-chatbot-avatar"><Bot size={20} /></span>
              <div>
                <strong>ChatBot A.I</strong>
                <small>{restaurantId ? "Đang hiểu ngữ cảnh nhà hàng này" : "Hỗ trợ khách hàng & vận hành"}</small>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng chatbot">
              <X size={18} />
            </button>
          </header>

          <div className="ai-chatbot-messages">
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`ai-chatbot-message ${item.role}`}>
                {item.role === "staff" ? <small>{item?.meta?.senderLabel || "Nhân viên"}</small> : null}
                <p>{item.content}</p>
                {item.meta?.isFallback ? <span className="ai-chatbot-note">Fallback dữ liệu hệ thống</span> : null}
              </div>
            ))}
            {loading ? (
              <div className="ai-chatbot-message assistant loading">
                <span /> <span /> <span />
              </div>
            ) : null}
          </div>

          {lastContextSummary ? (
            <div className="ai-chatbot-context">
              <Sparkles size={14} />
              <span>
                Đã tham chiếu {lastContextSummary.menuItemCount || 0} món, {lastContextSummary.couponCount || 0} coupon, {lastContextSummary.orderCount || 0} đơn.
              </span>
            </div>
          ) : null}

          {lastActions.length ? (
            <div className="ai-chatbot-actions">
              {lastActions.map((action, index) => (
                <button key={`${action.label}-${index}`} type="button" onClick={() => handleAction(action)}>
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}

          {lastQuickReplies.length ? (
            <div className="ai-chatbot-quick-replies">
              {lastQuickReplies.map((reply) => (
                <button key={reply} type="button" onClick={() => sendMessage(reply)} disabled={loading || guestSendLoading}>
                  {reply}
                </button>
              ))}
            </div>
          ) : null}

          <div className="ai-chatbot-actions">
            <button
              type="button"
              onClick={handleRequestHandoff}
              disabled={!conversationId || handoffRequested || handoffLoading}
            >
              {handoffRequested ? "Đã yêu cầu nhân viên" : "Gặp nhân viên"}
            </button>
          </div>

          {handoffRequested ? (
            <div className="ai-chatbot-context">
              <Sparkles size={14} />
              <span>Nhân viên đã được thông báo. Bạn có thể tiếp tục gửi tin nhắn, nhân viên sẽ xem lịch sử trước đó.</span>
            </div>
          ) : null}

          <form
            className="ai-chatbot-input"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Hỏi về món ăn, đặt bàn, đơn hàng..."
              maxLength={500}
            />
            <button type="submit" disabled={loading || guestSendLoading || !input.trim()} aria-label="Gửi tin nhắn">
              <Send size={18} />
            </button>
          </form>
        </section>
      ) : (
        <button className="ai-chatbot-toggle" type="button" onClick={() => setOpen(true)} aria-label="Mở ChatBot A.I">
          <MessageCircle size={24} />
          <span>AI</span>
        </button>
      )}
    </div>
  );
}

export default AiChatbotWidget;
