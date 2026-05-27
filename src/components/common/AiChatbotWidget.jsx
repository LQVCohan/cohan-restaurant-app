import React, { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/context/CartProvider";
import { gql } from "@apollo/client";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client/react";
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
      answerMessageId
      actions {
        type
        label
        href
      }
      sources {
        type
        id
        label
        formattedPrice
        status
        isAvailable
        hasOptions
        hasVariants
        restaurantId
        basePrice
        currentPrice
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
const SUBMIT_AI_CHATBOT_FEEDBACK = gql`
  mutation SubmitAiChatbotAnswerFeedback($input: SubmitAiChatbotAnswerFeedbackInput!) {
    submitAiChatbotAnswerFeedback(input: $input) { id rating }
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
      conversationStatus
      handoffClosed
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

const RATE_LIMIT_MESSAGE = "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.";

const STARTER_MESSAGES = [
  "Gợi ý món bán chạy cho tôi",
  "Tôi muốn đặt bàn",
  "Có mã giảm giá nào không?",
];
export const buildStarterMessages = ({ restaurantId, publicSettings }) => {
  if (publicSettings?.starterQuickReplies?.length) return publicSettings.starterQuickReplies;
  if (restaurantId) return ["Gợi ý món cho 2 người", "Món bán chạy", "Món dưới 100k", "Có món chay không?"];
  return STARTER_MESSAGES;
};


const GUEST_ID_STORAGE_KEY = "cohan_ai_guest_id";

const Q_PUBLIC_AI_CHATBOT_SETTINGS = gql`
  query PublicAiChatbotSettings($restaurantId: ID) {
    publicAiChatbotSettings(restaurantId: $restaurantId) {
      enabled
      welcomeMessage
      starterQuickReplies
      handoffEnabled
      handoffUnavailableMessage
    }
  }
`;


const getConversationStorageKey = (restaurantId) => `cohan_ai_conversation_id:${restaurantId || "global"}`;
const getHandoffStorageKey = (conversationId) => `cohan_ai_handoff_requested:${conversationId}`;

const generateGuestId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const DEFAULT_WELCOME_MESSAGE = "Xin chào, mình là trợ lý A.I của Cohan Restaurant App. Mình có thể hỗ trợ bạn về menu, đặt bàn, đơn hàng, coupon và hướng dẫn sử dụng hệ thống.";

const INITIAL_MESSAGES = [
  {
    role: "assistant",
    content:
      DEFAULT_WELCOME_MESSAGE,
  },
];

export const extractRestaurantId = ({ params, pathname }) => {
  if (params?.id && pathname.includes("/restaurant/")) return params.id;
  if (params?.restaurantId) return params.restaurantId;
  return null;
};
export const getInputPlaceholder = (restaurantId) => (restaurantId ? "Hỏi AI gợi ý món, combo, giá, món chay..." : "Hỏi về món ăn, đặt bàn, đơn hàng...");

export const canAiAddMenuItemDirectly = (source) => {
  if (!source?.id) return false;
  if (source?.isAvailable === false || source?.status === "unavailable") return false;
  if (source?.hasOptions || source?.hasVariants) return false;
  const price = Number(source?.currentPrice || source?.basePrice || 0);
  if (!Number.isFinite(price) || price <= 0) return false;
  return true;
};

export const buildMenuSourceCards = (response) => {
  if (response?.intent !== "menu") return [];
  const seen = new Set();
  const cards = [];
  for (const source of response?.sources || []) {
    if (source?.type !== "menuItem" || !source?.id) continue;
    const id = String(source.id);
    if (seen.has(id)) continue;
    seen.add(id);
    cards.push(source);
    if (cards.length >= 4) break;
  }
  return cards;
};

const normalizeHistory = (messages) =>
  messages
    .filter((item) => ["user", "assistant"].includes(item.role))
    .slice(-8)
    .map((item) => ({ role: item.role, content: item.content }));

function AiChatbotWidget({ testOverrides = {} } = {}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [lastActions, setLastActions] = useState([]);
  const [lastQuickReplies, setLastQuickReplies] = useState(STARTER_MESSAGES);
  const [lastIntent, setLastIntent] = useState("");
  const [menuSourceCards, setMenuSourceCards] = useState([]);
  const [lastContextSummary, setLastContextSummary] = useState(null);
  const [askAiChatbot, { loading }] = useMutation(ASK_AI_CHATBOT);
  const [requestHandoff, { loading: handoffLoading }] = useMutation(REQUEST_AI_CHATBOT_HANDOFF);
  const [submitFeedback] = useMutation(SUBMIT_AI_CHATBOT_FEEDBACK);
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
  const [handoffClosed, setHandoffClosed] = useState(false);
  const [latestStaffReplyAt, setLatestStaffReplyAt] = useState("");
  const [isSendInFlight, setIsSendInFlight] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState({});
  const sendInFlightRef = useRef(false);
  const pollInFlightRef = useRef(false);
  const hasJoinedSocketRef = useRef(false);
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const cartApi = useCart();

  const restaurantId = useMemo(
    () => extractRestaurantId({ params, pathname: location.pathname }),
    [params, location.pathname],
  );

  const restaurantStorageKey = useMemo(() => getConversationStorageKey(restaurantId), [restaurantId]);
  const { data: publicSettingsData } = useQuery(Q_PUBLIC_AI_CHATBOT_SETTINGS, {
    variables: { restaurantId: restaurantId || null },
    fetchPolicy: "cache-first",
  });
  const publicSettings = publicSettingsData?.publicAiChatbotSettings;
  const chatbotEnabled = publicSettings?.enabled ?? true;
  const handoffEnabled = publicSettings?.handoffEnabled ?? true;
  const handoffUnavailableMessage = publicSettings?.handoffUnavailableMessage || "Hiện nhà hàng chưa bật hỗ trợ nhân viên qua chatbot. Vui lòng thử lại sau hoặc liên hệ nhà hàng.";
  const visibleActions = useMemo(
    () => (handoffEnabled ? lastActions : lastActions.filter((action) => action?.type !== "handoff")).filter((action) => action?.type !== "add_to_cart_candidate"),
    [handoffEnabled, lastActions],
  );

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
    setHandoffClosed(false);
  }, [conversationId]);

  useEffect(() => {
    if (publicSettings?.welcomeMessage) {
      setMessages((current) => {
        if (!current.length) return [{ role: "assistant", content: publicSettings.welcomeMessage }];
        const next = [...current];
        if (next[0]?.role === "assistant") next[0] = { ...next[0], content: publicSettings.welcomeMessage };
        return next;
      });
    }
    setLastQuickReplies(buildStarterMessages({ restaurantId, publicSettings }));
  }, [publicSettings?.welcomeMessage, publicSettings?.starterQuickReplies, restaurantId]);

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
    if ((!handoffRequested && !force) || !conversationId || !guestId || pollInFlightRef.current) return;
    pollInFlightRef.current = true;
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
      const guestReplies = data?.aiChatbotGuestReplies;
      appendGuestReplies(guestReplies?.replies || []);
      if (guestReplies?.handoffClosed || guestReplies?.conversationStatus === "closed") {
        setHandoffRequested(false);
        setHandoffClosed(true);
        if (typeof window !== "undefined" && conversationId) window.localStorage.removeItem(getHandoffStorageKey(conversationId));
        setMessages((current) =>
          current.some((m) => m?.meta?.type === "handoff_closed_notice")
            ? current
            : [...current, { role: "assistant", content: "Nhân viên đã kết thúc phiên hỗ trợ.", meta: { type: "handoff_closed_notice" } }]
        );
      }
    } catch {
      // best effort polling only
    } finally {
      pollInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!open || !handoffRequested || !conversationId || !guestId) return undefined;

    if (testOverrides?.disableSocket) return undefined;

    const socket = (testOverrides?.socketFactory || io)(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    const onStaffReply = (payload) => {
      appendGuestReplies(payload ? [payload] : []);
    };

    const onHandoffResolved = (payload) => {
      if (String(payload?.status || "") !== "closed") return;
      setHandoffRequested(false);
      setHandoffClosed(true);
      if (typeof window !== "undefined" && conversationId) window.localStorage.removeItem(getHandoffStorageKey(conversationId));
      setMessages((current) =>
        current.some((m) => m?.meta?.type === "handoff_closed_notice")
          ? current
          : [...current, { role: "assistant", content: payload?.message || "Nhân viên đã kết thúc phiên hỗ trợ.", meta: { type: "handoff_closed_notice" } }]
      );
    };

    socket.on("aiChatbotStaffReplyCreated", onStaffReply);
    socket.on("aiChatbotHandoffResolved", onHandoffResolved);

    socket.on("connect", () => {
      if (hasJoinedSocketRef.current) return;
      hasJoinedSocketRef.current = true;
      socket.emit("joinAiChatbotConversation", { conversationId, guestId }, () => {});
    });

    return () => {
      hasJoinedSocketRef.current = false;
      socket.off("aiChatbotStaffReplyCreated", onStaffReply);
      socket.off("aiChatbotHandoffResolved", onHandoffResolved);
      socket.emit("leaveAiChatbotConversation", { conversationId, guestId });
      socket.disconnect();
    };
  }, [open, handoffRequested, conversationId, guestId, testOverrides]);

  useEffect(() => {
    if (!open || !handoffRequested || !conversationId || !guestId) return undefined;
    if (testOverrides?.disablePolling) return undefined;
    const intervalMs = testOverrides?.pollIntervalMs || 6000;
    fetchGuestReplies();
    const timer = window.setInterval(fetchGuestReplies, intervalMs);
    return () => window.clearInterval(timer);
  }, [open, handoffRequested, conversationId, guestId, latestStaffReplyAt, testOverrides]);

  const sendMessage = async (rawMessage) => {
    const content = String(rawMessage || input).trim();
    if (!content || loading || guestSendLoading || handoffLoading || sendInFlightRef.current) return;
    if (!chatbotEnabled) { setMessages((c) => [...c, { role: "assistant", content: handoffUnavailableMessage }]); return; }
    sendInFlightRef.current = true;
    setIsSendInFlight(true);

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

      if (handoffRequested && conversationId && !handoffClosed) {
        const { data } = await sendGuestMessage({
          variables: { input: { conversationId, guestId: safeGuestId, content } },
        });
        const ok = data?.sendAiChatbotGuestMessage?.ok;
        if (!ok) {
          const safeContent = data?.sendAiChatbotGuestMessage?.message?.content || "Không thể gửi tin nhắn cho nhân viên lúc này. Vui lòng thử lại.";
          setMessages((current) => [...current, { role: "assistant", content: safeContent.includes("gửi quá nhanh") ? RATE_LIMIT_MESSAGE : safeContent }]);
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
      setLastQuickReplies(response?.quickReplies?.length ? response.quickReplies : buildStarterMessages({ restaurantId, publicSettings }));
      setLastContextSummary(response?.contextSummary || null);
      setLastIntent(response?.intent || "");
      setMenuSourceCards(buildMenuSourceCards(response));
    } catch (err) {
      const code = err?.graphQLErrors?.[0]?.extensions?.code;
      const msg = err?.graphQLErrors?.[0]?.message || err?.message || "";
      const safe = code === "RATE_LIMITED" || String(msg).includes("gửi quá nhanh")
        ? RATE_LIMIT_MESSAGE
        : (err?.message || "Hiện chatbot chưa kết nối được với hệ thống. Vui lòng thử lại sau hoặc liên hệ nhân viên hỗ trợ.");
      setMessages((current) => [...current, { role: "assistant", content: safe }]);
    } finally {
      sendInFlightRef.current = false;
      setIsSendInFlight(false);
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
    if (!handoffEnabled) { setMessages((c) => [...c, { role: "assistant", content: handoffUnavailableMessage }]); return; }
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
        setHandoffClosed(false);
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
                {item.role === "assistant" && item.meta?.conversationId ? <div className="ai-chatbot-actions" style={{ marginTop: 6 }}>
                  {feedbackSent[item.meta?.answerMessageId || index] ? <small>Cảm ơn bạn đã phản hồi!</small> : <>
                    <button type="button" onClick={async () => {
                      const key = item.meta?.answerMessageId || index;
                      if (feedbackSent[key]) return;
                      await submitFeedback({ variables: { input: { restaurantId, conversationId: item.meta?.conversationId, messageId: item.meta?.answerMessageId, guestId: guestId || undefined, question: messages[index-1]?.role === "user" ? messages[index-1]?.content : "", answer: item.content, rating: "helpful" } } });
                      setFeedbackSent((x) => ({ ...x, [key]: true }));
                    }}>Hữu ích</button>
                    <button type="button" onClick={async () => {
                      const key = item.meta?.answerMessageId || index;
                      if (feedbackSent[key]) return;
                      const reason = window.prompt("Lý do không hữu ích (không bắt buộc):", "") || "";
                      await submitFeedback({ variables: { input: { restaurantId, conversationId: item.meta?.conversationId, messageId: item.meta?.answerMessageId, guestId: guestId || undefined, question: messages[index-1]?.role === "user" ? messages[index-1]?.content : "", answer: item.content, rating: "not_helpful", reason } } });
                      setFeedbackSent((x) => ({ ...x, [key]: true }));
                    }}>Không hữu ích</button>
                  </>}
                </div> : null}
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
                {lastIntent === "menu"
                  ? `Đã tham chiếu ${lastContextSummary.menuItemCount || 0} món trong menu nhà hàng này.`
                  : `Đã tham chiếu ${lastContextSummary.menuItemCount || 0} món, ${lastContextSummary.couponCount || 0} coupon, ${lastContextSummary.orderCount || 0} đơn.`}
              </span>
            </div>
          ) : null}
          {menuSourceCards.length ? <div className="ai-chatbot-menu-cards">{menuSourceCards.map((s) => {
            const canAdd = canAiAddMenuItemDirectly(s) && Boolean(s?.restaurantId);
            return <div key={s.id} className="ai-chatbot-menu-card">
              <strong>{s.label}</strong>
              {s.formattedPrice ? <span className="ai-chatbot-menu-card__price">{s.formattedPrice}</span> : null}
              {(s.isAvailable === false || s.status === "unavailable") ? <span className="ai-chatbot-menu-card__status">Tạm hết món</span> : null}
              <div className="ai-chatbot-menu-card__actions">
                <button type="button" onClick={() => handleAction({ href: `/food/${s.id}` })}>Xem món</button>
                {canAdd ? <button type="button" onClick={() => {
                  if (!canAiAddMenuItemDirectly(s)) {
                    navigate(`/food/${s.id}`);
                    setOpen(false);
                    return;
                  }
                  if (!cartApi?.addToCart) {
                    navigate(`/food/${s.id}`);
                    setOpen(false);
                    return;
                  }
                  const price = Number(s.currentPrice || s.basePrice || 0);
                  if (!Number.isFinite(price) || price <= 0) {
                    navigate(`/food/${s.id}`);
                    setOpen(false);
                    return;
                  }
                  cartApi.addToCart({
                    id: s.id,
                    restaurantId: s.restaurantId,
                    name: s.label,
                    price,
                    quantity: 1,
                  });
                  setMessages((current) => [...current, { role: "assistant", content: `Đã thêm ${s.label} vào giỏ. Bạn có thể kiểm tra giỏ hàng trước khi đặt. Bạn muốn mình gợi ý thêm nước uống hoặc món kèm không?` }]);
                  setLastQuickReplies(["Gợi ý nước uống", "Gợi ý món kèm", "Xem giỏ hàng"]);
                }}>Thêm vào giỏ</button> : null}
              </div>
            </div>;
          })}</div> : null}

          {visibleActions.length ? (
            <div className="ai-chatbot-actions">
              {visibleActions.map((action, index) => (
                <button key={`${action.label}-${index}`} type="button" onClick={() => handleAction(action)}>
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}

          {lastQuickReplies.length ? (
            <div className="ai-chatbot-quick-replies">
              {lastQuickReplies.map((reply) => (
                <button key={reply} type="button" onClick={() => sendMessage(reply)} disabled={!chatbotEnabled || loading || guestSendLoading || handoffLoading || isSendInFlight}>
                  {reply}
                </button>
              ))}
            </div>
          ) : null}

          {handoffEnabled ? <div className="ai-chatbot-actions">
            <button
              type="button"
              onClick={handleRequestHandoff}
              disabled={!conversationId || handoffRequested || handoffLoading}
            >
              {handoffRequested ? "Đã yêu cầu nhân viên" : "Gặp nhân viên"}
            </button>
          </div> : null}

          {handoffRequested ? (
            <div className="ai-chatbot-context">
              <Sparkles size={14} />
              <span>Nhân viên đã được thông báo. Bạn có thể tiếp tục gửi tin nhắn, nhân viên sẽ xem lịch sử trước đó.</span>
            </div>
          ) : null}
          {handoffClosed ? (
            <div className="ai-chatbot-context">
              <Sparkles size={14} />
              <span>Nhân viên đã kết thúc phiên hỗ trợ.</span>
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
              placeholder={chatbotEnabled ? getInputPlaceholder(restaurantId) : "Chatbot đang tạm tắt cho nhà hàng này"}
              maxLength={500}
              disabled={!chatbotEnabled || loading || guestSendLoading || handoffLoading || isSendInFlight}
            />
            <button type="submit" disabled={!chatbotEnabled || loading || guestSendLoading || handoffLoading || isSendInFlight || !input.trim()} aria-label="Gửi tin nhắn">
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
