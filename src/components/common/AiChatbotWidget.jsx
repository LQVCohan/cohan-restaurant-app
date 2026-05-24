import React, { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
    }
  }
`;

const STARTER_MESSAGES = [
  "Gợi ý món bán chạy cho tôi",
  "Tôi muốn đặt bàn",
  "Có mã giảm giá nào không?",
];


const GUEST_ID_STORAGE_KEY = "cohan_ai_guest_id";

const getConversationStorageKey = (restaurantId) => `cohan_ai_conversation_id:${restaurantId || "global"}`;

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
  const [guestId, setGuestId] = useState(() => {
    if (typeof window === "undefined") return "";
    const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = generateGuestId();
    window.localStorage.setItem(GUEST_ID_STORAGE_KEY, created);
    return created;
  });
  const [conversationId, setConversationId] = useState("");
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

  const sendMessage = async (rawMessage) => {
    const content = String(rawMessage || input).trim();
    if (!content || loading) return;

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
                <button key={reply} type="button" onClick={() => sendMessage(reply)} disabled={loading}>
                  {reply}
                </button>
              ))}
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
            <button type="submit" disabled={loading || !input.trim()} aria-label="Gửi tin nhắn">
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
