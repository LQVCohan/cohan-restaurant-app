import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gql } from "@apollo/client";
import { useLazyQuery, useMutation, useQuery } from "@apollo/client/react";
import { Bot, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { useCart } from "@/context/CartProvider";
import { AuthContext } from "@/context/AuthContext";
import { OPEN_AI_CHATBOT_EVENT } from "@/utils/aiChatbotEvents";
import { getAiChatbotFeatureMatches, getAiChatbotUserRole } from "@/utils/aiChatbotFeatureMap";
import { openCustomerCart } from "@/utils/cartEvents";
import {
  buildCustomerCartPayload,
  buildMenuItemServingOptions,
  normalizeCartNote,
} from "@/utils/customerCartPayload";
import {
  buildFoodDetailPath,
  buildFoodDetailState,
} from "@/utils/customerFoodNavigation";
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
        description
        icon
        priority
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
  mutation SubmitAiChatbotAnswerFeedback(
    $input: SubmitAiChatbotAnswerFeedbackInput!
  ) {
    submitAiChatbotAnswerFeedback(input: $input) {
      id
      rating
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

const RATE_LIMIT_MESSAGE =
  "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.";

const STARTER_MESSAGES = [
  "Gợi ý món bán chạy cho tôi",
  "Tôi muốn đặt bàn",
  "Có mã giảm giá nào không?",
];
export const buildStarterMessages = ({ restaurantId, publicSettings }) => {
  if (publicSettings?.starterQuickReplies?.length)
    return publicSettings.starterQuickReplies;
  if (restaurantId)
    return [
      "Gợi ý món cho 2 người",
      "Món bán chạy",
      "Món dưới 100k",
      "Có món chay không?",
    ];
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
const CUSTOMER_MENU_ITEM_FOR_AI = gql`
  query CustomerMenuItemForAiChatbot($id: ID!, $restaurantId: ID) {
    customerMenuItem(id: $id, restaurantId: $restaurantId) {
      id
      name
      description
      basePrice
      thumbImage
      point
      labels
      dietTags
      allergenTags
      tasteProfile {
        containsOnion
        containsCilantro
        sugar
        spice
      }
      rate
      orderCounter
      avgPrepTimeMin
      restaurantId
      menuId
      categoryId
      status
      inventoryStatus
      stockWarnings
      servingVariants {
        key
        mode
        sellQty
        sellUnit
        name
        price
      }
    }
  }
`;
const PUBLIC_RESTAURANT_BY_ID_FOR_AI = gql`
  query PublicRestaurantByIdForAiChatbot($id: ID!) {
    publicRestaurant(id: $id) {
      id
      name
      canOrder
      openingStatus
      openingStatusReason
      address {
        line1
        district
        city
      }
    }
  }
`;
const MENU_ITEM_LIVE_STATE_FOR_AI = gql`
  query AiMenuItemLiveState($input: MenuItemLiveStateInput!) {
    menuItemLiveState(input: $input) {
      menuItemId
      restaurantId
      variantKey
      blocked
      blockReason
      isAvailable
      inventoryStatus
      maxAvailableQty
      viewerCount
      outOfStock
    }
  }
`;

const COMPACT_MENU_ANSWER =
  "Mình đã chọn một số món phù hợp bên dưới. Bạn có thể mở chi tiết hoặc thêm vào giỏ nếu món còn khả dụng.";

const PAGE_ROUTE_HINTS = [
  { pattern: /\/cart|gio-hang/i, label: "giỏ hàng" },
  { pattern: /\/checkout|thanh-toan/i, label: "thanh toán" },
  { pattern: /\/orders?|don-hang/i, label: "đơn hàng" },
  { pattern: /\/reservations?|dat-ban/i, label: "đặt bàn" },
  { pattern: /\/restaurants?|nha-hang/i, label: "nhà hàng" },
  { pattern: /\/foods?|menu|mon-an/i, label: "thực đơn" },
  { pattern: /\/profile|tai-khoan/i, label: "tài khoản" },
  { pattern: /\/manager/i, label: "quản lý" },
  { pattern: /\/staff/i, label: "nhân viên" },
];

const getRouteHint = (pathname = "") =>
  PAGE_ROUTE_HINTS.find((item) => item.pattern.test(pathname))?.label || "trang hiện tại";

const isFoodDetailRoute = (pathname = "") =>
  /(?:food|foods|menu|mon-an|dish|item)/i.test(pathname);

const getPathLastSegment = (pathname = "") => {
  const parts = String(pathname || "").split("/").filter(Boolean);
  return parts[parts.length - 1] || "";
};

const getAiCannotOrderMessage = (restaurant) => {
  if (!restaurant) return "Đang kiểm tra trạng thái nhận đơn của nhà hàng...";
  if (!restaurant?.canOrder) return "Nhà hàng hiện chưa bật nhận đặt món trực tuyến.";
  if (restaurant?.openingStatus && restaurant.openingStatus !== "open") {
    return restaurant.openingStatusReason || "Nhà hàng hiện ngoài giờ nhận đơn.";
  }
  return "";
};

const sourceTypeLabel = (type) => {
  if (type === "menuItem") return "Món ăn";
  if (type === "restaurant") return "Nhà hàng";
  if (type === "coupon") return "Ưu đãi";
  if (type === "order") return "Đơn hàng";
  if (type === "reservation") return "Đặt bàn";
  if (type === "knowledge") return "Tri thức";
  return "Nguồn";
};

const normalizeHistory = (messages) =>
  (messages || [])
    .filter((item) => ["user", "assistant"].includes(item.role) && item.content)
    .slice(-8)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: item.content,
    }));

const generateGuestId = () =>
  `guest_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;

const getHandoffStorageKey = (conversationId) =>
  conversationId ? `cohan_ai_handoff_${conversationId}` : "";

const formatSelectedQuantityUnit = ({ quantity, variant }) => {
  const unit = variant?.sellUnit ? ` ${variant.sellUnit}` : "";
  return `${quantity}${unit}`;
};

const statusClass = (enabled) =>
  enabled ? "ai-chatbot-status ai-chatbot-status--on" : "ai-chatbot-status";

const getMessageAvatarLabel = (item) => {
  if (item?.role === "staff") return "NV";
  if (item?.role === "assistant") return "AI";
  return "";
};

const getMessageSenderTitle = (item) => {
  if (item?.role === "staff") return item?.meta?.senderLabel || "Nhân viên";
  if (item?.role === "assistant") return "AI";
  return "";
};

const renderMessageAvatar = (item) => {
  const label = getMessageAvatarLabel(item);
  if (!label) return null;
  return (
    <span
      className={`ai-chatbot-message-avatar ai-chatbot-message-avatar--${item.role}`}
      title={getMessageSenderTitle(item)}
      aria-hidden="true"
    >
      {label}
    </span>
  );
};

const buildMenuSourceCards = (response) => {
  const sources = Array.isArray(response?.sources) ? response.sources : [];
  const menuSources = sources.filter(
    (source) => source?.type === "menuItem" && source?.id && source?.label,
  );
  const seen = new Set();
  return menuSources
    .filter((source) => {
      const key = String(source.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
};

const getSafeVisibleAiActions = ({ actions = [], handoffEnabled, limit = 6 }) => {
  const safe = [];
  const seen = new Set();
  for (const action of Array.isArray(actions) ? actions : []) {
    if (!action?.label) continue;
    if (action.type === "handoff" && !handoffEnabled) continue;
    const key = `${action.type || ""}:${action.href || ""}:${action.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    safe.push(action);
    if (safe.length >= limit) break;
  }
  return safe;
};

const formatSourcePrice = (source) => {
  if (source?.formattedPrice) return source.formattedPrice;
  const price = Number(source?.currentPrice ?? source?.basePrice ?? source?.price);
  if (!Number.isFinite(price) || price <= 0) return "";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
};

const formatMenuSourceStatus = (source) => {
  if (source?.isAvailable === false) return "Tạm hết";
  if (source?.status && source.status !== "available") return source.status;
  if (source?.hasOptions || source?.hasVariants) return "Có tùy chọn";
  return "Sẵn sàng";
};

function AiChatbotWidget({ restaurantId: restaurantIdProp, testOverrides = {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { user } = React.useContext(AuthContext) || {};
  const { addItem } = useCart();
  const routeRestaurantId =
    restaurantIdProp || params.restaurantId || params.id || params.restaurant || "";
  const [eventRestaurantId, setEventRestaurantId] = useState("");
  const restaurantId = eventRestaurantId || routeRestaurantId;
  const restaurantStorageKey = `cohan_ai_conversation_${restaurantId || "global"}`;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [guestId, setGuestId] = useState(() => {
    if (typeof window === "undefined") return generateGuestId();
    const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
    if (existing) return existing;
    const next = generateGuestId();
    window.localStorage.setItem(GUEST_ID_STORAGE_KEY, next);
    return next;
  });
  const [conversationId, setConversationId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(restaurantStorageKey) || "";
  });
  const [handoffRequested, setHandoffRequested] = useState(false);
  const [handoffClosed, setHandoffClosed] = useState(false);
  const [latestStaffReplyAt, setLatestStaffReplyAt] = useState("");
  const [isSendInFlight, setIsSendInFlight] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Xin chào! Mình là trợ lý COHAN. Bạn muốn gợi ý món, đặt bàn hay cần hỗ trợ đơn hàng?",
    },
  ]);
  const [lastActions, setLastActions] = useState([]);
  const [lastQuickReplies, setLastQuickReplies] = useState(STARTER_MESSAGES);
  const [lastContextSummary, setLastContextSummary] = useState(null);
  const [lastIntent, setLastIntent] = useState("");
  const [feedbackSent, setFeedbackSent] = useState({});
  const [selectedMenuItemSource, setSelectedMenuItemSource] = useState(null);
  const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedNote, setSelectedNote] = useState("");
  const [menuSourceCards, setMenuSourceCards] = useState([]);
  const [aiCartError, setAiCartError] = useState("");
  const [aiCartSuccess, setAiCartSuccess] = useState("");
  const [isAiCartAdding, setIsAiCartAdding] = useState(false);
  const sendInFlightRef = useRef(false);
  const pollInFlightRef = useRef(false);
  const hasJoinedSocketRef = useRef(false);

  const [askAiChatbot, { loading }] = useMutation(ASK_AI_CHATBOT);
  const [requestHandoff, { loading: handoffLoading }] = useMutation(
    REQUEST_AI_CHATBOT_HANDOFF,
  );
  const [sendGuestMessage, { loading: guestSendLoading }] = useMutation(
    SEND_AI_CHATBOT_GUEST_MESSAGE,
  );
  const [loadGuestReplies] = useLazyQuery(Q_AI_CHATBOT_GUEST_REPLIES, {
    fetchPolicy: "network-only",
  });
  const [submitFeedback] = useMutation(SUBMIT_AI_CHATBOT_FEEDBACK);
  const { data: publicSettingsData } = useQuery(Q_PUBLIC_AI_CHATBOT_SETTINGS, {
    variables: { restaurantId: restaurantId || undefined },
    fetchPolicy: "cache-and-network",
  });
  const publicSettings = publicSettingsData?.publicAiChatbotSettings;

  const buildAiPageContext = useCallback(
    (latestMessage = "") => {
      const pathname = location.pathname || "";
      const searchParams = new URLSearchParams(location.search || "");
      const routeHint = getRouteHint(pathname);
      const maybeFoodId = isFoodDetailRoute(pathname)
        ? params.foodId || params.menuItemId || params.itemId || getPathLastSegment(pathname)
        : "";
      return {
        pathname,
        routeHint,
        restaurantId: restaurantId || undefined,
        foodId: maybeFoodId || undefined,
        orderId: params.orderId || params.id || searchParams.get("orderId") || undefined,
        reservationId:
          params.reservationId || searchParams.get("reservationId") || undefined,
        userRole: getAiChatbotUserRole(user),
        cartItemCount: 0,
        featureMatches: getAiChatbotFeatureMatches({ pathname, message: latestMessage }),
      };
    },
    [location.pathname, location.search, params, restaurantId, user],
  );

  const selectedAiMenuItemId = selectedMenuItemSource?.id || "";
  const selectedAiRestaurantId = selectedMenuItemSource?.restaurantId || restaurantId;
  const { data: aiMenuItemData, loading: aiMenuItemLoading, error: aiMenuItemError } = useQuery(
    CUSTOMER_MENU_ITEM_FOR_AI,
    {
      variables: { id: selectedAiMenuItemId, restaurantId: selectedAiRestaurantId || undefined },
      skip: !selectedAiMenuItemId,
      fetchPolicy: "cache-and-network",
    },
  );
  const selectedAiMenuItem = aiMenuItemData?.customerMenuItem;
  const aiServingOptions = useMemo(
    () => buildMenuItemServingOptions(selectedAiMenuItem),
    [selectedAiMenuItem],
  );
  useEffect(() => {
    if (!selectedAiMenuItem || selectedVariantKey) return;
    const fallback = selectedMenuItemSource?.servingVariants?.[0]?.key || aiServingOptions?.[0]?.key || "standard";
    setSelectedVariantKey(fallback);
  }, [aiServingOptions, selectedAiMenuItem, selectedMenuItemSource, selectedVariantKey]);

  const selectedVariant = aiServingOptions.find((item) => item.key === selectedVariantKey);
  const { data: aiRestaurantData } = useQuery(PUBLIC_RESTAURANT_BY_ID_FOR_AI, {
    variables: { id: selectedAiRestaurantId },
    skip: !selectedAiRestaurantId,
    fetchPolicy: "cache-and-network",
  });
  const aiRestaurant = aiRestaurantData?.publicRestaurant;
  const { data: aiLiveStateData } = useQuery(MENU_ITEM_LIVE_STATE_FOR_AI, {
    variables: {
      input: {
        menuItemId: selectedAiMenuItem?.id,
        restaurantId: selectedAiMenuItem?.restaurantId,
        variantKey: selectedVariantKey || undefined,
        quantity: selectedQuantity,
      },
    },
    skip:
      !selectedAiMenuItem?.id ||
      !selectedAiMenuItem?.restaurantId ||
      !selectedVariantKey,
    fetchPolicy: "network-only",
  });
  const aiLiveState = aiLiveStateData?.menuItemLiveState;
  const aiLiveStateReady = Boolean(aiLiveState);
  const aiMaxAvailableQty = Number(aiLiveState?.maxAvailableQty || 0);
  const aiQuantityExceedsAvailable =
    aiLiveStateReady &&
    aiMaxAvailableQty > 0 &&
    selectedQuantity > aiMaxAvailableQty;
  const aiOutOfStock =
    aiLiveStateReady && (!!aiLiveState?.outOfStock || aiMaxAvailableQty < 1);
  const aiCannotOrderMessage = getAiCannotOrderMessage(aiRestaurant);
  const selectedQuantityUnitText = formatSelectedQuantityUnit({
    quantity: selectedQuantity,
    variant: selectedVariant,
  });
  const selectedVariantHasUnit = Boolean(selectedVariant?.sellUnit);
  const aiAddDisabled =
    !selectedAiMenuItem ||
    !selectedVariantKey ||
    isAiCartAdding ||
    !user?.id ||
    !aiRestaurant?.canOrder ||
    !aiLiveStateReady ||
    !!aiLiveState?.blocked ||
    aiOutOfStock ||
    aiQuantityExceedsAvailable;
  const chatbotEnabled = publicSettings?.enabled ?? true;
  const handoffEnabled = publicSettings?.handoffEnabled ?? true;
  const handoffUnavailableMessage =
    publicSettings?.handoffUnavailableMessage ||
    "Hiện nhà hàng chưa bật hỗ trợ nhân viên qua chatbot. Vui lòng thử lại sau hoặc liên hệ nhà hàng.";
  const visibleActions = useMemo(
    () => getSafeVisibleAiActions({ actions: lastActions, handoffEnabled, limit: 6 }),
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
    if (!conversationId || typeof window === "undefined")
      return setHandoffRequested(false);
    setHandoffRequested(
      window.localStorage.getItem(getHandoffStorageKey(conversationId)) === "1",
    );
    setHandoffClosed(false);
  }, [conversationId]);

  useEffect(() => {
    if (publicSettings?.welcomeMessage) {
      setMessages((current) => {
        if (!current.length)
          return [
            { role: "assistant", content: publicSettings.welcomeMessage },
          ];
        const next = [...current];
        if (next[0]?.role === "assistant")
          next[0] = { ...next[0], content: publicSettings.welcomeMessage };
        return next;
      });
    }
    setLastQuickReplies(buildStarterMessages({ restaurantId, publicSettings }));
  }, [
    publicSettings?.welcomeMessage,
    publicSettings?.starterQuickReplies,
    restaurantId,
  ]);

  useEffect(() => {
    const latest = [...messages]
      .reverse()
      .find((item) => item?.role === "staff" && item?.meta?.createdAt)
      ?.meta?.createdAt;
    setLatestStaffReplyAt(latest || "");
  }, [messages]);

  const appendGuestReplies = (replies = []) => {
    if (!Array.isArray(replies) || replies.length === 0) return;
    setMessages((current) => {
      const existing = new Set(
        current
          .filter((item) => item?.role === "staff")
          .map(
            (item) =>
              item?.meta?.replyId ||
              `${item?.meta?.createdAt || ""}_${item?.content || ""}`,
          ),
      );

      const incoming = [];
      for (const reply of replies) {
        const key =
          reply?.id || `${reply?.createdAt || ""}_${reply?.content || ""}`;
        if (!reply?.content || existing.has(key)) continue;
        existing.add(key);
        incoming.push({
          role: "staff",
          content: reply.content,
          meta: {
            senderLabel: reply.senderLabel || "Nhân viên",
            createdAt: reply.createdAt,
            replyId: key,
          },
        });
      }

      return incoming.length ? [...current, ...incoming] : current;
    });
  };

  const fetchGuestReplies = async ({ force = false } = {}) => {
    if (
      (!handoffRequested && !force) ||
      !conversationId ||
      !guestId ||
      pollInFlightRef.current
    )
      return;
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
      if (
        guestReplies?.handoffClosed ||
        guestReplies?.conversationStatus === "closed"
      ) {
        setHandoffRequested(false);
        setHandoffClosed(true);
        if (typeof window !== "undefined" && conversationId)
          window.localStorage.removeItem(getHandoffStorageKey(conversationId));
        setMessages((current) =>
          current.some((m) => m?.meta?.type === "handoff_closed_notice")
            ? current
            : [
                ...current,
                {
                  role: "assistant",
                  content: "Nhân viên đã kết thúc phiên hỗ trợ.",
                  meta: { type: "handoff_closed_notice" },
                },
              ],
        );
      }
    } catch {
      // best effort polling only
    } finally {
      pollInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!open || !handoffRequested || !conversationId || !guestId)
      return undefined;

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
      if (typeof window !== "undefined" && conversationId)
        window.localStorage.removeItem(getHandoffStorageKey(conversationId));
      setMessages((current) =>
        current.some((m) => m?.meta?.type === "handoff_closed_notice")
          ? current
          : [
              ...current,
              {
                role: "assistant",
                content:
                  payload?.message || "Nhân viên đã kết thúc phiên hỗ trợ.",
                meta: { type: "handoff_closed_notice" },
              },
            ],
      );
    };

    socket.on("aiChatbotStaffReplyCreated", onStaffReply);
    socket.on("aiChatbotHandoffResolved", onHandoffResolved);

    socket.on("connect", () => {
      if (hasJoinedSocketRef.current) return;
      hasJoinedSocketRef.current = true;
      socket.emit(
        "joinAiChatbotConversation",
        { conversationId, guestId },
        () => {},
      );
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
    if (!open || !handoffRequested || !conversationId || !guestId)
      return undefined;
    if (testOverrides?.disablePolling) return undefined;
    const intervalMs = testOverrides?.pollIntervalMs || 6000;
    fetchGuestReplies();
    const timer = window.setInterval(fetchGuestReplies, intervalMs);
    return () => window.clearInterval(timer);
  }, [
    open,
    handoffRequested,
    conversationId,
    guestId,
    latestStaffReplyAt,
    testOverrides,
  ]);

  const sendMessage = async (rawMessage, { restaurantIdOverride } = {}) => {
    const content = String(rawMessage || input).trim();
    if (
      !content ||
      loading ||
      guestSendLoading ||
      handoffLoading ||
      sendInFlightRef.current
    )
      return;
    if (!chatbotEnabled) {
      setMessages((c) => [
        ...c,
        { role: "assistant", content: handoffUnavailableMessage },
      ]);
      return;
    }
    sendInFlightRef.current = true;
    setIsSendInFlight(true);

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setInput("");
    setLastQuickReplies([]);

    try {
      let safeGuestId = guestId;
      if (!safeGuestId && typeof window !== "undefined") {
        safeGuestId =
          window.localStorage.getItem(GUEST_ID_STORAGE_KEY) ||
          generateGuestId();
        window.localStorage.setItem(GUEST_ID_STORAGE_KEY, safeGuestId);
        setGuestId(safeGuestId);
      }

      if (handoffRequested && conversationId && !handoffClosed) {
        const { data } = await sendGuestMessage({
          variables: {
            input: { conversationId, guestId: safeGuestId, content },
          },
        });
        const ok = data?.sendAiChatbotGuestMessage?.ok;
        if (!ok) {
          const safeContent =
            data?.sendAiChatbotGuestMessage?.message?.content ||
            "Không thể gửi tin nhắn cho nhân viên lúc này. Vui lòng thử lại.";
          setMessages((current) => [
            ...current,
            {
              role: "assistant",
              content: safeContent.includes("gửi quá nhanh")
                ? RATE_LIMIT_MESSAGE
                : safeContent,
            },
          ]);
        }
        return;
      }

      const { data } = await askAiChatbot({
        variables: {
          input: {
            message: content,
            restaurantId: restaurantIdOverride || restaurantId,
            history: normalizeHistory(messages),
            guestId: safeGuestId || undefined,
            conversationId: conversationId || undefined,
            pageContext: buildAiPageContext(content),
          },
        },
      });
      const response = data?.askAiChatbot;
      if (response?.conversationId && typeof window !== "undefined") {
        window.localStorage.setItem(
          restaurantStorageKey,
          response.conversationId,
        );
        setConversationId(response.conversationId);
      }
      const answer =
        response?.answer ||
        "Mình chưa xử lý được câu hỏi này. Bạn có thể hỏi lại ngắn gọn hơn hoặc mở trung tâm hỗ trợ.";

      const nextMenuCards = buildMenuSourceCards(response);
      const displayAnswer =
        response?.intent === "menu" && nextMenuCards.length
          ? COMPACT_MENU_ANSWER
          : answer;

      setMessages((current) => [
        ...current,
        { role: "assistant", content: displayAnswer, meta: response },
      ]);
      setLastActions(response?.actions || []);
      setLastQuickReplies(
        response?.quickReplies?.length
          ? response.quickReplies
          : buildStarterMessages({ restaurantId, publicSettings }),
      );
      setLastContextSummary(response?.contextSummary || null);
      setLastIntent(response?.intent || "");
      setMenuSourceCards(nextMenuCards);
    } catch (err) {
      const code = err?.graphQLErrors?.[0]?.extensions?.code;
      const msg = err?.graphQLErrors?.[0]?.message || err?.message || "";
      const safe =
        code === "RATE_LIMITED" || String(msg).includes("gửi quá nhanh")
          ? RATE_LIMIT_MESSAGE
          : err?.message ||
            "Hiện chatbot chưa kết nối được với hệ thống. Vui lòng thử lại sau hoặc liên hệ nhân viên hỗ trợ.";
      setMessages((current) => [
        ...current,
        { role: "assistant", content: safe },
      ]);
    } finally {
      sendInFlightRef.current = false;
      setIsSendInFlight(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onOpenChatbot = (event) => {
      const detail = event?.detail || {};
      const nextMessage = String(detail?.message || "").trim();
      const shouldAutoSend = Boolean(detail?.autoSend);
      const nextRestaurantId = String(detail?.restaurantId || "").trim();

      setOpen(true);
      if (!nextMessage) return;

      if (nextRestaurantId) setEventRestaurantId(nextRestaurantId);
      setInput(nextMessage);
      if (
        shouldAutoSend &&
        !loading &&
        !guestSendLoading &&
        !handoffLoading &&
        !sendInFlightRef.current
      ) {
        sendMessage(nextMessage, {
          restaurantIdOverride: nextRestaurantId || restaurantId,
        });
      }
    };

    window.addEventListener(OPEN_AI_CHATBOT_EVENT, onOpenChatbot);
    return () =>
      window.removeEventListener(OPEN_AI_CHATBOT_EVENT, onOpenChatbot);
  }, [loading, guestSendLoading, handoffLoading, sendMessage]);

  const buildAiFoodDetailTarget = (source) => {
    const targetRestaurantId = source?.restaurantId || restaurantId;
    const href = buildFoodDetailPath(source?.id, {
      restaurantId: targetRestaurantId,
      timeSlot: source?.timeSlot,
      categoryId: source?.categoryId,
    });

    const state = buildFoodDetailState(
      {
        id: source?.id,
        name: source?.label,
        basePrice: source?.basePrice || source?.currentPrice,
        restaurantId: targetRestaurantId,
        categoryId: source?.categoryId,
        menuId: source?.menuId,
        status: source?.status,
        inventoryStatus: source?.inventoryStatus,
        servingVariants: source?.servingVariants || source?.variants || [],
        thumbImage: source?.image || source?.thumbImage,
      },
      {
        restaurantId: targetRestaurantId,
        timeSlot: source?.timeSlot,
        categoryId: source?.categoryId,
      },
    );

    return { href, state };
  };

  const handleAction = (action) => {
    if (action?.type === "openCart") {
      openCustomerCart();
      setOpen(false);
      return;
    }
    if (action?.type === "handoff") {
      handleRequestHandoff();
      return;
    }
    if (action?.type === "search") {
      const searchText = String(action.href || action.label || "").trim();
      if (searchText) sendMessage(searchText);
      return;
    }
    if (!action?.href) return;
    const safeHref = String(action.href || "").trim();
    if (/^(?:javascript|data|mailto|tel):/i.test(safeHref) || safeHref.startsWith("//")) return;
    if (!(safeHref.startsWith("/") && !safeHref.startsWith("//")) && !/^https?:\/\//i.test(safeHref)) return;
    if (/^https?:\/\//i.test(safeHref)) {
      window.open(safeHref, "_blank", "noopener,noreferrer");
      return;
    }
    navigate(safeHref);
    setOpen(false);
  };
  const handleRequestHandoff = async () => {
    if (!handoffEnabled) {
      setMessages((c) => [
        ...c,
        { role: "assistant", content: handoffUnavailableMessage },
      ]);
      return;
    }
    if (!conversationId || handoffRequested || handoffLoading) return;
    try {
      const latestUserMessage =
        [...messages].reverse().find((m) => m.role === "user")?.content || "";
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
          window.localStorage.setItem(
            getHandoffStorageKey(conversationId),
            "1",
          );
        }
        setHandoffRequested(true);
        setHandoffClosed(false);
        fetchGuestReplies({ force: true });
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result?.message || "Đã gửi yêu cầu gặp nhân viên.",
        },
      ]);
    } catch (err) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            err?.message || "Không thể gửi yêu cầu gặp nhân viên lúc này.",
        },
      ]);
    }
  };
  const onSelectMenuItem = (source) => {
    setSelectedMenuItemSource(source);
    setSelectedVariantKey("");
    setSelectedQuantity(1);
    setSelectedNote("");
    setAiCartError("");
    setAiCartSuccess("");
  };

  const handleAddAiCart = async () => {
    setAiCartError("");
    setAiCartSuccess("");
    if (!selectedAiMenuItem || !selectedVariant) return;
    if (!user?.id) {
      setAiCartError("Vui lòng đăng nhập để thêm món vào giỏ.");
      return;
    }
    if (!aiRestaurant?.canOrder) {
      setAiCartError(getAiCannotOrderMessage(aiRestaurant));
      return;
    }
    if (!aiLiveStateReady || aiLiveState?.blocked || aiOutOfStock || aiQuantityExceedsAvailable) {
      setAiCartError(aiLiveState?.blockReason || "Món hiện chưa thể thêm vào giỏ.");
      return;
    }
    try {
      setIsAiCartAdding(true);
      const payload = buildCustomerCartPayload({
        menuItem: selectedAiMenuItem,
        quantity: selectedQuantity,
        note: normalizeCartNote(selectedNote),
        variant: selectedVariant,
      });
      await addItem(payload);
      setAiCartSuccess("Đã thêm món vào giỏ.");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Đã thêm ${selectedAiMenuItem.name} vào giỏ.`,
        },
      ]);
    } catch (err) {
      setAiCartError(err?.message || "Không thể thêm món vào giỏ lúc này.");
    } finally {
      setIsAiCartAdding(false);
    }
  };

  if (!open) {
    return (
      <div className="ai-chatbot-widget">
        <button
          className="ai-chatbot-toggle"
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Mở ChatBot A.I"
        >
          <MessageCircle size={23} />
          <span>AI</span>
        </button>
      </div>
    );
  }

  return (
    <div className="ai-chatbot-widget">
      <section
        className={`ai-chatbot-panel ${selectedMenuItemSource ? "is-expanded" : ""}`}
        aria-label="ChatBot A.I hỗ trợ nhà hàng"
      >
        <header className="ai-chatbot-header">
          <div className="ai-chatbot-title">
            <span className="ai-chatbot-avatar">
              <Bot size={20} />
            </span>
            <div>
              <strong>ChatBot A.I</strong>
              <small>
                {restaurantId
                  ? "Đang hiểu ngữ cảnh nhà hàng này"
                  : "Hỗ trợ khách hàng & vận hành"}
              </small>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng chatbot"
          >
            <X size={18} />
          </button>
        </header>

        <div className="ai-chatbot-body">
          <div className="ai-chatbot-messages">
            {messages.map((item, index) => (
              <div
                key={`${item.role}-${index}`}
                className={`ai-chatbot-message ${item.role}`}
              >
                {renderMessageAvatar(item)}
                <div className="ai-chatbot-message-content">
                  {item.role === "staff" ? (
                    <small>{item?.meta?.senderLabel || "Nhân viên"}</small>
                  ) : null}
                  <p>{item.content}</p>
                  {item.meta?.isFallback ? (
                    <span className="ai-chatbot-note">
                      Fallback dữ liệu hệ thống
                    </span>
                  ) : null}
                  {item.role === "assistant" && item.meta?.conversationId ? (
                    <div
                      className="ai-chatbot-actions"
                      style={{ marginTop: 6 }}
                    >
                      {feedbackSent[item.meta?.answerMessageId || index] ? (
                        <small>Cảm ơn bạn đã phản hồi!</small>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={async () => {
                              const key = item.meta?.answerMessageId || index;
                              if (feedbackSent[key]) return;
                              await submitFeedback({
                                variables: {
                                  input: {
                                    restaurantId,
                                    conversationId: item.meta?.conversationId,
                                    messageId: item.meta?.answerMessageId,
                                    guestId: guestId || undefined,
                                    question:
                                      messages[index - 1]?.role === "user"
                                        ? messages[index - 1]?.content
                                        : "",
                                    answer: item.content,
                                    rating: "helpful",
                                  },
                                },
                              });
                              setFeedbackSent((x) => ({ ...x, [key]: true }));
                            }}
                          >
                            Hữu ích
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const key = item.meta?.answerMessageId || index;
                              if (feedbackSent[key]) return;
                              const reason =
                                window.prompt(
                                  "Lý do không hữu ích (không bắt buộc):",
                                  "",
                                ) || "";
                              await submitFeedback({
                                variables: {
                                  input: {
                                    restaurantId,
                                    conversationId: item.meta?.conversationId,
                                    messageId: item.meta?.answerMessageId,
                                    guestId: guestId || undefined,
                                    question:
                                      messages[index - 1]?.role === "user"
                                        ? messages[index - 1]?.content
                                        : "",
                                    answer: item.content,
                                    rating: "not_helpful",
                                    reason,
                                  },
                                },
                              });
                              setFeedbackSent((x) => ({ ...x, [key]: true }));
                            }}
                          >
                            Không hữu ích
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="ai-chatbot-message assistant loading">
                <span className="ai-chatbot-message-avatar ai-chatbot-message-avatar--assistant" title="AI" aria-hidden="true">
                  AI
                </span>
                <span className="ai-chatbot-loading-dot" />
                <span className="ai-chatbot-loading-dot" />
                <span className="ai-chatbot-loading-dot" />
              </div>
            ) : null}
          </div>

          {selectedMenuItemSource ? (
            <div className="ai-chatbot-menu-detail">
              {aiMenuItemLoading ? <p>Đang tải chi tiết món...</p> : null}
              {aiMenuItemError ? (
                <p>
                  Không thể tải chi tiết món. Bạn có thể bấm Xem chi tiết món.
                </p>
              ) : null}
              {selectedAiMenuItem ? (
                <>
                  <h4>{selectedAiMenuItem.name}</h4>
                  <p className="ai-chatbot-menu-card__price">
                    {new Intl.NumberFormat("vi-VN", {
                      style: "currency",
                      currency: "VND",
                    }).format(
                      Number(
                        selectedVariant?.price ||
                          selectedAiMenuItem.basePrice ||
                          0,
                      ),
                    )}
                  </p>
                  <div className="ai-chatbot-menu-detail__variants">
                    {aiServingOptions.map((variant) => (
                      <button
                        key={variant.key}
                        type="button"
                        className={`ai-chatbot-menu-detail__variant ${selectedVariantKey === variant.key ? "is-selected" : ""}`}
                        onClick={() => {
                          setSelectedVariantKey(variant.key);
                          setSelectedQuantity(1);
                        }}
                      >
                        {variant.name}
                      </button>
                    ))}
                  </div>
                  <div className="ai-chatbot-menu-detail__quantity">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedQuantity((q) => Math.max(1, q - 1))
                      }
                    >
                      -
                    </button>
                    <span>{selectedQuantityUnitText}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedQuantity((q) => {
                          const max = Number(
                            aiLiveState?.maxAvailableQty || 0,
                          );
                          if (max > 0) return Math.min(max, q + 1);
                          return q + 1;
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                  {selectedVariantHasUnit ? (
                    <p className="ai-chatbot-menu-detail__helper">
                      Món này đang tính theo đơn vị của tùy chọn. Chọn gói
                      100g nếu muốn mua lẻ dưới 1kg.
                    </p>
                  ) : null}
                  <textarea
                    className="ai-chatbot-menu-detail__note"
                    placeholder="Ví dụ: ít cay, không hành..."
                    maxLength={180}
                    value={selectedNote}
                    onChange={(e) => setSelectedNote(e.target.value)}
                  />
                  {!user?.id ? (
                    <p className="ai-chatbot-menu-detail__error">
                      Vui lòng đăng nhập để thêm món vào giỏ.
                    </p>
                  ) : null}
                  {user?.id && !aiLiveStateReady ? (
                    <p className="ai-chatbot-menu-detail__error">
                      Đang kiểm tra tồn món...
                    </p>
                  ) : null}
                  {user?.id && aiLiveStateReady && aiOutOfStock ? (
                    <p className="ai-chatbot-menu-detail__error">
                      Món đã hết hàng.
                    </p>
                  ) : null}
                  {user?.id &&
                  aiLiveStateReady &&
                  aiQuantityExceedsAvailable ? (
                    <p className="ai-chatbot-menu-detail__error">
                      Số lượng vượt quá số suất còn có thể đặt.
                    </p>
                  ) : null}
                  {user?.id && aiCannotOrderMessage ? (
                    <p className="ai-chatbot-menu-detail__error">
                      {aiCannotOrderMessage}
                    </p>
                  ) : null}
                  {aiCartError ? (
                    <p className="ai-chatbot-menu-detail__error">
                      {aiCartError}
                    </p>
                  ) : null}
                  {aiCartSuccess ? (
                    <p className="ai-chatbot-menu-detail__success">
                      {aiCartSuccess}
                    </p>
                  ) : null}
                </>
              ) : null}
              <div className="ai-chatbot-menu-card__actions ai-chatbot-menu-detail__actions">
                <button
                  type="button"
                  disabled={aiAddDisabled}
                  onClick={handleAddAiCart}
                >
                  Thêm vào giỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = buildAiFoodDetailTarget(
                      selectedMenuItemSource,
                    );
                    navigate(target.href, { state: target.state });
                    setOpen(false);
                  }}
                >
                  Xem chi tiết món
                </button>
                {aiCartSuccess ? (
                  <button type="button" onClick={() => openCustomerCart()}>
                    Xem giỏ hàng
                  </button>
                ) : null}
                <button type="button" onClick={() => setSelectedMenuItemSource(null)}>
                  Đóng
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {lastContextSummary ? (
          <div className="ai-chatbot-context">
            <Sparkles size={15} />
            <span>
              Đã xét {lastContextSummary.restaurantCount || 0} nhà hàng, {lastContextSummary.menuItemCount || 0} món
              {lastIntent ? ` · ý định: ${lastIntent}` : ""}
            </span>
          </div>
        ) : null}

        {menuSourceCards.length ? (
          <div className="ai-chatbot-menu-cards" aria-label="Món gợi ý">
            {menuSourceCards.map((source) => {
              const price = formatSourcePrice(source);
              const status = formatMenuSourceStatus(source);
              return (
                <article key={source.id} className="ai-chatbot-menu-card">
                  <div>
                    <span className={statusClass(source?.isAvailable !== false)}>
                      {status}
                    </span>
                    <h4>{source.label}</h4>
                    {price ? <p>{price}</p> : null}
                    <small>{sourceTypeLabel(source.type)}</small>
                  </div>
                  <div className="ai-chatbot-menu-card__actions">
                    <button type="button" onClick={() => onSelectMenuItem(source)}>
                      Thêm vào giỏ
                    </button>
                    <button
                      type="button"
                      className="ai-chatbot-button--ghost"
                      onClick={() => {
                        const target = buildAiFoodDetailTarget(source);
                        navigate(target.href, { state: target.state });
                        setOpen(false);
                      }}
                    >
                      Xem món
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {visibleActions.length ? (
          <div className="ai-chatbot-actions">
            {visibleActions.map((action, idx) => (
              <button
                key={`${action.type || "action"}-${action.label}-${idx}`}
                type="button"
                onClick={() => handleAction(action)}
                title={action.description || ""}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}

        {lastQuickReplies?.length ? (
          <div className="ai-chatbot-quick-replies">
            {lastQuickReplies.slice(0, 4).map((reply) => (
              <button key={reply} type="button" onClick={() => sendMessage(reply)}>
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
            placeholder={handoffRequested ? "Nhắn với nhân viên..." : "Hỏi về món ăn, đặt bàn, ưu đãi..."}
            disabled={loading || guestSendLoading || handoffLoading || isSendInFlight}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || guestSendLoading || handoffLoading || isSendInFlight}
            aria-label="Gửi câu hỏi"
          >
            <Send size={17} />
          </button>
        </form>
      </section>
    </div>
  );
}

export default AiChatbotWidget;
