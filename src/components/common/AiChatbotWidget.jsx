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
      viewerCount
      maxAvailableQty
      outOfStock
      blocked
      blockedUntil
      abuseWarning
      policyMessage
      holdTtlSeconds
      myCartQty
      myHoldExpiresAt
      reservedCartQty
    }
  }
`;
const ADD_CART_ITEM_FOR_AI = gql`
  mutation AddCartItemFromAiChatbot($input: AddCartItemInput!) {
    addCartItem(input: $input) {
      id
      totalQuantity
      totalAmount
      items {
        id
        restaurantId
        menuItemId
        name
        price
        quantity
        thumbImage
        note
        servingVariantKey
        holdExpiresAt
        holdStatus
      }
    }
  }
`;

const getConversationStorageKey = (restaurantId) =>
  `cohan_ai_conversation_id:${restaurantId || "global"}`;
const getHandoffStorageKey = (conversationId) =>
  `cohan_ai_handoff_requested:${conversationId}`;

const generateGuestId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const DEFAULT_WELCOME_MESSAGE =
  "Xin chào, mình là trợ lý A.I của Cohan Restaurant App. Mình có thể hỗ trợ bạn về menu, đặt bàn, đơn hàng, coupon và hướng dẫn sử dụng hệ thống.";

const INITIAL_MESSAGES = [
  {
    role: "assistant",
    content: DEFAULT_WELCOME_MESSAGE,
  },
];

export const extractRestaurantId = ({ params, pathname }) => {
  if (params?.id && pathname.includes("/restaurant/")) return params.id;
  if (params?.restaurantId) return params.restaurantId;
  return null;
};
export const getInputPlaceholder = (restaurantId) =>
  restaurantId
    ? "Hỏi AI gợi ý món, combo, giá, món chay..."
    : "Hỏi về món ăn, đặt bàn, đơn hàng...";

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

export const getSafeVisibleAiActions = ({ actions = [], handoffEnabled = true, limit = 6 } = {}) => {
  const allowedTypes = new Set(["link", "openCart", "handoff", "search"]);
  const seen = new Set();
  return (handoffEnabled
    ? actions
    : actions.filter((action) => action?.type !== "handoff")
  )
    .filter((action) => allowedTypes.has(action?.type))
    .filter((action) => action?.type !== "add_to_cart_candidate")
    .filter((action) => {
      const href = String(action?.href || "").trim();
      if (/^(?:javascript|data|mailto|tel):/i.test(href) || href.startsWith("//")) return false;
      if (["openCart", "handoff", "search"].includes(action?.type)) return true;
      return (href.startsWith("/") && !href.startsWith("//")) || /^https?:\/\//i.test(href);
    })
    .filter((action) => {
      const key = action?.type === "openCart" || action?.href ? `${action?.type}:${action?.href || ""}` : `${action?.type}:${String(action?.label || "").toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

const normalizeHistory = (messages) =>
  messages
    .filter((item) => ["user", "assistant"].includes(item.role))
    .slice(-8)
    .map((item) => ({ role: item.role, content: item.content }));

const COMPACT_MENU_ANSWER =
  "Mình tìm được vài món phù hợp. Bạn bấm Chọn món để chọn tùy chọn trước khi thêm vào giỏ.";

const OPENING_STATUS_LABELS = {
  open: "Đang mở cửa",
  closed: "Đã đóng cửa",
  closing_soon: "Sắp đóng cửa",
  opening_soon: "Sắp mở cửa",
  paused: "Tạm dừng nhận đơn",
};

const formatVariantUnit = (variant) => {
  const unit = String(variant?.sellUnit || "").trim();
  if (!unit) return "";
  const qty = Number(variant?.sellQty || 1);
  if (!Number.isFinite(qty) || qty <= 0) return unit;
  return `${qty}${unit}`;
};

const formatSelectedQuantityUnit = ({ quantity, variant }) => {
  const unitLabel = formatVariantUnit(variant);
  if (!unitLabel) return `Số lượng: ${quantity}`;
  const totalQty = Number(quantity || 0) * Number(variant?.sellQty || 1);
  const unit = String(variant?.sellUnit || "").trim();
  const totalLabel =
    Number.isFinite(totalQty) && unit
      ? `${Number(totalQty.toFixed(3))}${unit}`
      : "";
  return totalLabel && totalLabel !== unitLabel
    ? `Số lượng: ${quantity} x ${unitLabel} = ${totalLabel}`
    : `Số lượng: ${quantity} x ${unitLabel}`;
};

const getAiCannotOrderMessage = (restaurant) => {
  if (restaurant?.canOrder !== false) return "";
  const status = String(restaurant?.openingStatus || "").trim();
  const statusLabel = OPENING_STATUS_LABELS[status] || status;
  const reason =
    restaurant?.openingStatusReason ||
    (statusLabel ? `Trạng thái: ${statusLabel}` : "");
  return [
    "Nhà hàng hiện chưa nhận đặt món. Bạn vẫn có thể xem chi tiết món hoặc quay lại sau.",
    reason,
  ]
    .filter(Boolean)
    .join(" ");
};

function AiChatbotWidget({ testOverrides = {} } = {}) {
  const { user } = React.useContext(AuthContext);
  const { addToCart } = useCart();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [lastActions, setLastActions] = useState([]);
  const [lastQuickReplies, setLastQuickReplies] = useState(STARTER_MESSAGES);
  const [lastIntent, setLastIntent] = useState("");
  const [menuSourceCards, setMenuSourceCards] = useState([]);
  const [lastContextSummary, setLastContextSummary] = useState(null);
  const [selectedMenuItemSource, setSelectedMenuItemSource] = useState(null);
  const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedNote, setSelectedNote] = useState("");
  const [isAiCartAdding, setIsAiCartAdding] = useState(false);
  const [aiCartError, setAiCartError] = useState("");
  const [aiCartSuccess, setAiCartSuccess] = useState("");
  const [askAiChatbot, { loading }] = useMutation(ASK_AI_CHATBOT);
  const [requestHandoff, { loading: handoffLoading }] = useMutation(
    REQUEST_AI_CHATBOT_HANDOFF,
  );
  const [submitFeedback] = useMutation(SUBMIT_AI_CHATBOT_FEEDBACK);
  const [sendGuestMessage, { loading: guestSendLoading }] = useMutation(
    SEND_AI_CHATBOT_GUEST_MESSAGE,
  );
  const [loadGuestReplies] = useLazyQuery(Q_AI_CHATBOT_GUEST_REPLIES, {
    fetchPolicy: "network-only",
  });
  const [addCartItemForAi] = useMutation(ADD_CART_ITEM_FOR_AI);
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

  const [eventRestaurantId, setEventRestaurantId] = useState("");
  const routeRestaurantId = useMemo(
    () => extractRestaurantId({ params, pathname: location.pathname }),
    [params, location.pathname],
  );
  const restaurantId = eventRestaurantId || routeRestaurantId;
  const selectedRouteMenuItem = useMemo(() => {
    const query = new URLSearchParams(location.search || "");
    const id = params?.foodId || query.get("menuItemId") || "";
    return id ? { id, restaurantId: restaurantId || query.get("restaurantId") || null } : null;
  }, [params?.foodId, location.search, restaurantId]);
  const buildAiPageContext = useCallback((messageText = "") => {
    const userRole = getAiChatbotUserRole(user);
    const selectedMenuItem = selectedMenuItemSource || selectedRouteMenuItem;
    const effectiveRestaurantId = restaurantId || selectedMenuItem?.restaurantId || "";
    return {
      pathname: location.pathname,
      restaurantId: effectiveRestaurantId || null,
      selectedMenuItem: selectedMenuItem || null,
      userRole,
      featureMatches: getAiChatbotFeatureMatches({
        pathname: location.pathname,
        restaurantId: effectiveRestaurantId,
        selectedMenuItem,
        userRole,
        query: messageText,
      }),
    };
  }, [location.pathname, restaurantId, selectedMenuItemSource, selectedRouteMenuItem, user]);


  useEffect(() => {
    setEventRestaurantId("");
  }, [location.pathname]);
  const restaurantStorageKey = useMemo(
    () => getConversationStorageKey(restaurantId),
    [restaurantId],
  );
  const { data: publicSettingsData } = useQuery(Q_PUBLIC_AI_CHATBOT_SETTINGS, {
    variables: { restaurantId: restaurantId || null },
    fetchPolicy: "cache-first",
  });
  const publicSettings = publicSettingsData?.publicAiChatbotSettings;
  const {
    data: aiMenuItemData,
    loading: aiMenuItemLoading,
    error: aiMenuItemError,
  } = useQuery(CUSTOMER_MENU_ITEM_FOR_AI, {
    variables: {
      id: selectedMenuItemSource?.id,
      restaurantId:
        selectedMenuItemSource?.restaurantId || restaurantId || null,
    },
    skip: !selectedMenuItemSource?.id,
  });
  const selectedAiMenuItem = aiMenuItemData?.customerMenuItem || null;
  const { data: aiRestaurantData } = useQuery(PUBLIC_RESTAURANT_BY_ID_FOR_AI, {
    variables: {
      id:
        selectedMenuItemSource?.restaurantId ||
        selectedAiMenuItem?.restaurantId,
    },
    skip:
      !selectedMenuItemSource?.restaurantId &&
      !selectedAiMenuItem?.restaurantId,
  });
  const aiRestaurant = aiRestaurantData?.publicRestaurant || null;
  const aiServingOptions = useMemo(
    () => buildMenuItemServingOptions(selectedAiMenuItem),
    [selectedAiMenuItem],
  );
  useEffect(() => {
    if (!selectedMenuItemSource) return;
    if (!selectedVariantKey && aiServingOptions.length)
      setSelectedVariantKey(aiServingOptions[0].key);
  }, [selectedMenuItemSource, selectedVariantKey, aiServingOptions]);
  const selectedVariant = useMemo(
    () => aiServingOptions.find((v) => v.key === selectedVariantKey) || null,
    [aiServingOptions, selectedVariantKey],
  );
  const { data: aiLiveStateData } = useQuery(MENU_ITEM_LIVE_STATE_FOR_AI, {
    variables: {
      input: {
        restaurantId: selectedAiMenuItem?.restaurantId,
        menuItemId: selectedAiMenuItem?.id,
        servingVariantKey: selectedVariantKey,
        userId: user?.id,
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
    if (isAiCartAdding) return;
    if (!user?.id)
      return setAiCartError("Vui lòng đăng nhập để thêm món vào giỏ.");
    if (!aiLiveStateReady) return setAiCartError("Đang kiểm tra tồn món...");
    if (
      !selectedAiMenuItem?.id ||
      !selectedAiMenuItem?.restaurantId ||
      !selectedVariantKey ||
      selectedQuantity < 1
    )
      return;
    if (!aiRestaurant?.canOrder)
      return setAiCartError(
        aiCannotOrderMessage ||
          "Nhà hàng hiện chưa nhận đặt món. Bạn vẫn có thể xem chi tiết món hoặc quay lại sau.",
      );
    if (aiLiveState?.blocked)
      return setAiCartError("Món này hiện chưa thể thêm vào giỏ.");
    if (aiOutOfStock) return setAiCartError("Món đã hết hàng.");
    if (aiQuantityExceedsAvailable)
      return setAiCartError("Số lượng vượt quá số suất còn có thể đặt.");
    setIsAiCartAdding(true);
    setAiCartError("");
    setAiCartSuccess("");
    try {
      const selectedPrice = Number(
        selectedVariant?.price || selectedAiMenuItem?.basePrice || 0,
      );
      const note = selectedNote.trim() || null;
      const { data } = await addCartItemForAi({
        variables: {
          input: {
            userId: user.id,
            restaurantId: selectedAiMenuItem.restaurantId,
            menuItemId: selectedAiMenuItem.id,
            name: selectedAiMenuItem.name,
            price: selectedPrice,
            quantity: selectedQuantity,
            thumbImage: selectedAiMenuItem.thumbImage,
            note,
            servingVariantKey: selectedVariantKey || "portion",
          },
        },
      });
      const returnedItem = data?.addCartItem?.items?.find(
        (item) =>
          String(item?.menuItemId) === String(selectedAiMenuItem.id) &&
          String(item?.servingVariantKey) ===
            String(selectedVariantKey || "portion") &&
          normalizeCartNote(item?.note) === normalizeCartNote(note),
      );
      if (!data?.addCartItem?.id || !returnedItem?.id)
        throw new Error("Không thể đồng bộ giỏ hàng.");
      addToCart(
        buildCustomerCartPayload({
          item: selectedAiMenuItem,
          restaurant: aiRestaurant,
          selectedVariant: selectedVariant || aiServingOptions[0],
          quantity: selectedQuantity,
          note: returnedItem?.note ?? note,
          backendCartId: data.addCartItem.id,
          backendCartItemId: returnedItem.id,
          holdExpiresAt: returnedItem?.holdExpiresAt || null,
          holdStatus: returnedItem?.holdStatus || null,
        }),
      );
      setAiCartSuccess(`Đã thêm ${selectedAiMenuItem.name} vào giỏ hàng.`);
    } catch (error) {
      setAiCartError(error?.message || "Không thể thêm món vào giỏ.");
    } finally {
      setIsAiCartAdding(false);
    }
  };

  return (
    <div className="ai-chatbot-widget" aria-live="polite">
      {open ? (
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
              ))}
              {loading ? (
                <div className="ai-chatbot-message assistant loading">
                  <span /> <span /> <span />
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
                  <button
                    type="button"
                    onClick={() => setSelectedMenuItemSource(null)}
                  >
                    Quay lại gợi ý
                  </button>
                </div>
              </div>
            ) : (
              <>
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
                {menuSourceCards.length ? (
                  <div className="ai-chatbot-menu-cards">
                    {menuSourceCards.map((s) => (
                      <div key={s.id} className="ai-chatbot-menu-card">
                        <strong>{s.label}</strong>
                        {s.formattedPrice ? (
                          <span className="ai-chatbot-menu-card__price">
                            {s.formattedPrice}
                          </span>
                        ) : null}
                        {s.isAvailable === false ||
                        s.status === "unavailable" ? (
                          <span className="ai-chatbot-menu-card__status">
                            Tạm hết món
                          </span>
                        ) : null}
                        <div className="ai-chatbot-menu-card__actions">
                          <button
                            type="button"
                            onClick={() => {
                              const target = buildAiFoodDetailTarget(s);
                              navigate(target.href, { state: target.state });
                              setOpen(false);
                            }}
                          >
                            Xem món
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectMenuItem(s)}
                          >
                            Chọn món
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>

          {!selectedMenuItemSource && visibleActions.length ? (
            <div className="ai-chatbot-actions ai-chatbot-action-cards" aria-label="Hành động gợi ý">
              {visibleActions.map((action, index) => (
                <button
                  key={`${action.type}-${action.href || action.label}-${index}`}
                  type="button"
                  className={`ai-chatbot-action-card ${index === 0 ? "primary" : "secondary"}`}
                  onClick={() => handleAction(action)}
                >
                  {action.icon ? <span className="ai-chatbot-action-card__icon" aria-hidden="true">{action.icon}</span> : null}
                  <span className="ai-chatbot-action-card__text">
                    <strong>{action.label}</strong>
                    {action.description ? <small>{action.description}</small> : null}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {!selectedMenuItemSource && lastQuickReplies.length ? (
            <div className="ai-chatbot-quick-replies">
              {lastQuickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => sendMessage(reply)}
                  disabled={
                    !chatbotEnabled ||
                    loading ||
                    guestSendLoading ||
                    handoffLoading ||
                    isSendInFlight
                  }
                >
                  {reply}
                </button>
              ))}
            </div>
          ) : null}

          {!selectedMenuItemSource && handoffEnabled ? (
            <div className="ai-chatbot-actions">
              <button
                type="button"
                onClick={handleRequestHandoff}
                disabled={!conversationId || handoffRequested || handoffLoading}
              >
                {handoffRequested ? "Đã yêu cầu nhân viên" : "Gặp nhân viên"}
              </button>
            </div>
          ) : null}

          {!selectedMenuItemSource && handoffRequested ? (
            <div className="ai-chatbot-context">
              <Sparkles size={14} />
              <span>
                Nhân viên đã được thông báo. Bạn có thể tiếp tục gửi tin nhắn,
                nhân viên sẽ xem lịch sử trước đó.
              </span>
            </div>
          ) : null}
          {!selectedMenuItemSource && handoffClosed ? (
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
              placeholder={
                chatbotEnabled
                  ? getInputPlaceholder(restaurantId)
                  : "Chatbot đang tạm tắt cho nhà hàng này"
              }
              maxLength={500}
              disabled={
                !chatbotEnabled ||
                loading ||
                guestSendLoading ||
                handoffLoading ||
                isSendInFlight
              }
            />
            <button
              type="submit"
              disabled={
                !chatbotEnabled ||
                loading ||
                guestSendLoading ||
                handoffLoading ||
                isSendInFlight ||
                !input.trim()
              }
              aria-label="Gửi tin nhắn"
            >
              <Send size={18} />
            </button>
          </form>
        </section>
      ) : (
        <button
          className="ai-chatbot-toggle"
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Mở ChatBot A.I"
        >
          <MessageCircle size={24} />
          <span>AI</span>
        </button>
      )}
    </div>
  );
}

export default AiChatbotWidget;
