import React, { useEffect, useMemo, useRef, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useLocation } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Minus,
  Phone,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";

import Modal from "@/components/common/Modal";
import { formatCurrency } from "@/utils/formatters";
import {
  canCustomerOrderMenuItem,
  getMenuItemAvailability,
  shouldShowMenuItemToCustomer,
} from "@/utils/menuItemAvailability";

import "./TableOrderExperience.scss";

const TABLE_PATH_PATTERN = /^\/table\/([a-f\d]{24})\/([a-f\d]{24})\/?$/i;
const IDENTITY_CHOICE_PREFIX = "cohan:table-order:identity-choice";
const IDENTITY_TOKEN_PREFIX = "cohan:table-order:identity-token";

const TIME_SLOTS = [
  { id: "breakfast", label: "Sáng" },
  { id: "lunch", label: "Trưa" },
  { id: "dinner", label: "Tối" },
  { id: "late_night", label: "Đêm" },
];

const TABLE_ORDER_CONTEXT = gql`
  query PublicTableOrderContext(
    $restaurantId: ID!
    $tableId: ID!
    $token: String!
  ) {
    publicActiveTableSessionOrders(
      restaurantId: $restaurantId
      tableId: $tableId
      token: $token
    ) {
      tableId
      tableCode
      tableStatus
      canOrder
      orderBlockedReason
      session {
        id
        sessionStatus
        orderPaymentStatus
      }
      orders {
        id
        orderCode
        currentStatus
        createdAt
        totals { grandTotal }
        items {
          id
          name
          quantity
          unit
          status
          proofImages
          requiresProofImage
          proofUploaded
        }
      }
    }
  }
`;

const TABLE_MENU_CATEGORIES = gql`
  query PublicTableMenuCategories($restaurantId: ID!, $timeSlot: TimeSlot!) {
    customerMenuCategories(restaurantId: $restaurantId, timeSlot: $timeSlot) {
      id
      name
      order
      isActive
    }
  }
`;

const TABLE_MENU_ITEMS = gql`
  query PublicTableMenuItems($filter: MenuItemFilter!, $limit: Int) {
    menuItemsConnection(filter: $filter, limit: $limit) {
      edges {
        node {
          id
          restaurantId
          menuId
          categoryId
          name
          description
          basePrice
          defaultServingKey
          thumbImage
          status
          inventoryStatus
          maxAvailable
          stockWarnings
          avgPrepTimeMin
          servingVariants {
            key
            name
            mode
            price
            sellQty
            sellUnit
            isDefault
          }
        }
      }
    }
  }
`;

const TABLE_ITEM_MODIFIERS = gql`
  query PublicTableItemModifiers($restaurantId: ID!, $menuItemId: ID!) {
    customerModifierGroups(
      restaurantId: $restaurantId
      menuItemId: $menuItemId
    ) {
      id
      name
      selectionType
      required
      minSelected
      maxSelected
      options {
        id
        name
        isDefault
        priceRule { rule amount }
      }
    }
  }
`;

const REQUEST_TABLE_IDENTITY_OTP = gql`
  mutation RequestPublicTableIdentityOtp($input: PublicTableIdentityOtpInput!) {
    publicRequestTableIdentityOtp(input: $input) {
      ok
      message
      challengeToken
      maskedPhone
      demoOtp
    }
  }
`;

const VERIFY_TABLE_IDENTITY_OTP = gql`
  mutation VerifyPublicTableIdentityOtp($input: PublicTableIdentityVerifyInput!) {
    publicVerifyTableIdentityOtp(input: $input) {
      ok
      message
      requiresAccountConfirmation
      candidateToken
      identityToken
      maskedCustomerName
      linkedAsGuest
    }
  }
`;

const CONFIRM_TABLE_IDENTITY = gql`
  mutation ConfirmPublicTableIdentity($input: PublicTableIdentityConfirmInput!) {
    publicConfirmTableIdentity(input: $input) {
      ok
      message
      identityToken
    }
  }
`;

const SUBMIT_TABLE_ORDER = gql`
  mutation SubmitPublicTableOrder($input: PublicSubmitTableOrderInput!) {
    publicSubmitTableOrder(input: $input) {
      ok
      message
      order {
        id
        orderCode
        currentStatus
        createdAt
        totals { grandTotal }
        items {
          id
          name
          quantity
          unit
          status
          proofImages
          requiresProofImage
          proofUploaded
        }
      }
    }
  }
`;

const getInitialTimeSlot = () => {
  const hour = new Date().getHours();
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 22) return "dinner";
  return "late_night";
};

const createIdempotencyKey = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `table-qr-${crypto.randomUUID()}`;
  }
  return `table-qr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const readSessionValue = (key) => {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
};

const writeSessionValue = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    // Session persistence is optional; the active page state remains usable.
  }
};

const getErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

const getModifierSelectionError = (groups = [], selected = {}) => {
  for (const group of groups) {
    const count = (selected[group.id] || []).length;
    if (group.selectionType === "single") {
      if (group.required && count < 1) return `Vui lòng chọn ${group.name}.`;
      if (count > 1) return `${group.name} chỉ cho phép một lựa chọn.`;
      continue;
    }
    const minimum = group.required
      ? Math.max(1, Number(group.minSelected || 0))
      : Number(group.minSelected || 0);
    const maximum = group.maxSelected == null ? null : Number(group.maxSelected);
    if (!group.required && count === 0) continue;
    if (count < minimum) return `Vui lòng chọn ít nhất ${minimum} lựa chọn cho ${group.name}.`;
    if (maximum != null && count > maximum) {
      return `Chỉ được chọn tối đa ${maximum} lựa chọn cho ${group.name}.`;
    }
  }
  return "";
};

const calculateConfiguredUnitPrice = (basePrice, groups = [], selected = {}) => {
  let setPrice = null;
  let delta = 0;
  for (const group of groups) {
    for (const optionId of selected[group.id] || []) {
      const option = (group.options || []).find(
        (candidate) => String(candidate.id) === String(optionId),
      );
      if (!option) continue;
      const amount = Number(option.priceRule?.amount || 0);
      if (option.priceRule?.rule === "SET") setPrice = amount;
      else delta += amount;
    }
  }
  return Math.max(0, Number(setPrice == null ? basePrice : setPrice) + delta);
};

const getLineTotal = (line) => {
  const unitPrice = Number(line.configuredUnitPrice || line.basePrice || 0);
  if (line.servingVariant?.mode === "BY_WEIGHT") {
    const grams = Number(line.weightGrams || 0);
    const sellQty = Number(line.servingVariant?.sellQty || 1);
    const sold = line.servingVariant?.sellUnit === "g" ? grams : grams / 1000;
    return Math.round(unitPrice * (sold / sellQty));
  }
  return Math.round(unitPrice * Number(line.quantity || 1));
};

function IdentityContent({
  step,
  phone,
  setPhone,
  otp,
  setOtp,
  demoOtp,
  maskedPhone,
  maskedCustomerName,
  error,
  busy,
  onChoosePhone,
  onSkip,
  onRequestOtp,
  onVerifyOtp,
  onConfirmAccount,
  onDeclineAccount,
  onBackToPhone,
}) {
  if (step === "choice") {
    return (
      <div className="table-identity-flow">
        <div className="table-identity-flow__icon" aria-hidden="true"><Sparkles /></div>
        <p className="table-identity-flow__lead">
          Bạn có muốn lưu các đợt gọi món của bàn này vào hồ sơ khách hàng không?
        </p>
        <ul className="table-identity-flow__benefits">
          <li><CheckCircle2 aria-hidden="true" /> Quản lý và xem lại order sau này.</li>
          <li><CheckCircle2 aria-hidden="true" /> Tích điểm sau khi hóa đơn thanh toán thành công.</li>
          <li><CheckCircle2 aria-hidden="true" /> Không cần mật khẩu trong bản demo khóa luận.</li>
        </ul>
        <div className="table-identity-flow__actions">
          <button type="button" className="table-order-primary" onClick={onChoosePhone}>
            <Phone aria-hidden="true" /> Nhập số điện thoại
          </button>
          <button type="button" className="table-order-secondary" onClick={onSkip}>
            Bỏ qua, không lưu tài khoản
          </button>
        </div>
        <p className="table-identity-flow__privacy">
          Bạn vẫn có thể xem bàn và gọi món khi bỏ qua. Order sẽ chỉ thuộc phiên bàn hiện tại.
        </p>
      </div>
    );
  }

  if (step === "phone") {
    return (
      <form className="table-identity-flow" onSubmit={onRequestOtp}>
        <div className="table-identity-flow__icon" aria-hidden="true"><Phone /></div>
        <label htmlFor="table-order-phone">Số điện thoại</label>
        <input
          id="table-order-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Ví dụ: 0912345678"
          disabled={busy}
          required
        />
        <p className="table-identity-flow__privacy">
          Số điện thoại chỉ dùng để liên kết order, tích điểm sau thanh toán và quản lý lịch sử.
        </p>
        {error ? <p className="table-order-error" role="alert">{error}</p> : null}
        <div className="table-identity-flow__actions">
          <button type="submit" className="table-order-primary" disabled={busy}>
            {busy ? "Đang tạo mã…" : "Tiếp tục với OTP demo"}
          </button>
          <button type="button" className="table-order-secondary" onClick={onSkip} disabled={busy}>
            Không lưu tài khoản
          </button>
        </div>
      </form>
    );
  }

  if (step === "otp") {
    return (
      <form className="table-identity-flow" onSubmit={onVerifyOtp}>
        <div className="table-identity-flow__icon" aria-hidden="true"><ShieldCheck /></div>
        <p className="table-identity-flow__lead">Nhập mã xác minh cho {maskedPhone || "số điện thoại"}.</p>
        {demoOtp ? (
          <div className="table-identity-flow__demo" role="note">
            <span>Mã OTP demo khóa luận</span>
            <strong>{demoOtp}</strong>
          </div>
        ) : null}
        <label htmlFor="table-order-otp">Mã OTP gồm 6 số</label>
        <input
          id="table-order-otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123456"
          disabled={busy}
          required
        />
        {error ? <p className="table-order-error" role="alert">{error}</p> : null}
        <div className="table-identity-flow__actions">
          <button type="submit" className="table-order-primary" disabled={busy || otp.length !== 6}>
            {busy ? "Đang xác minh…" : "Xác minh"}
          </button>
          <button type="button" className="table-order-secondary" onClick={onBackToPhone} disabled={busy}>
            Nhập lại số điện thoại
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="table-identity-flow">
      <div className="table-identity-flow__icon" aria-hidden="true"><UserRoundCheck /></div>
      <p className="table-identity-flow__lead">Số điện thoại khớp với tài khoản:</p>
      <div className="table-identity-flow__account">
        <strong>{maskedCustomerName || "Khách hàng COHAN"}</strong>
        <span>{maskedPhone}</span>
      </div>
      <p className="table-identity-flow__privacy">
        Chỉ liên kết khi đây là tài khoản của bạn. Nếu không đồng ý, order vẫn được gửi ở chế độ không lưu user.
      </p>
      {error ? <p className="table-order-error" role="alert">{error}</p> : null}
      <div className="table-identity-flow__actions">
        <button type="button" className="table-order-primary" onClick={onConfirmAccount} disabled={busy}>
          {busy ? "Đang liên kết…" : "Đúng, lưu vào tài khoản này"}
        </button>
        <button type="button" className="table-order-secondary" onClick={onDeclineAccount} disabled={busy}>
          Không phải tôi, tiếp tục ẩn danh
        </button>
      </div>
    </div>
  );
}

export default function TableOrderExperience() {
  const location = useLocation();
  const match = location.pathname.match(TABLE_PATH_PATTERN);
  const restaurantId = match?.[1] || "";
  const tableId = match?.[2] || "";
  const tableToken = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search],
  );
  const storageScope = `${restaurantId}:${tableId}`;
  const choiceKey = `${IDENTITY_CHOICE_PREFIX}:${storageScope}`;
  const identityKey = `${IDENTITY_TOKEN_PREFIX}:${storageScope}`;

  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [isIdentityOpen, setIsIdentityOpen] = useState(false);
  const [identityStep, setIdentityStep] = useState("choice");
  const [identityChoice, setIdentityChoice] = useState(() => readSessionValue(choiceKey));
  const [identityToken, setIdentityToken] = useState(() => readSessionValue(identityKey));
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [candidateToken, setCandidateToken] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [maskedCustomerName, setMaskedCustomerName] = useState("");
  const [identityError, setIdentityError] = useState("");

  const [timeSlot, setTimeSlot] = useState(getInitialTimeSlot);
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [selectedModifiers, setSelectedModifiers] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [weightGrams, setWeightGrams] = useState(500);
  const [itemNote, setItemNote] = useState("");
  const [itemError, setItemError] = useState("");
  const [cart, setCart] = useState([]);
  const [orderNote, setOrderNote] = useState("");
  const [submitKey, setSubmitKey] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitMessage, setSubmitMessage] = useState("");
  const promptHandledRef = useRef(false);

  const {
    data: contextData,
    loading: contextLoading,
    error: contextError,
    refetch: refetchContext,
  } = useQuery(TABLE_ORDER_CONTEXT, {
    variables: { restaurantId, tableId, token: tableToken },
    skip: !restaurantId || !tableId || !tableToken,
    fetchPolicy: "cache-and-network",
    pollInterval: 12000,
  });

  const tableContext = contextData?.publicActiveTableSessionOrders;
  const canOrder = Boolean(tableContext?.canOrder);

  const { data: categoryData } = useQuery(TABLE_MENU_CATEGORIES, {
    variables: { restaurantId, timeSlot },
    skip: !restaurantId || !isOrderOpen,
    fetchPolicy: "cache-and-network",
  });

  const categories = useMemo(
    () =>
      [...(categoryData?.customerMenuCategories || [])]
        .filter((category) => category?.id && category.isActive !== false)
        .sort(
          (left, right) =>
            Number(left.order || 0) - Number(right.order || 0) ||
            String(left.name || "").localeCompare(String(right.name || ""), "vi"),
        ),
    [categoryData?.customerMenuCategories],
  );

  useEffect(() => setCategoryId("all"), [timeSlot]);

  const menuFilter = useMemo(
    () => ({
      restaurantId,
      timeSlot,
      ...(categoryId !== "all" ? { categoryId } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      sort: "default",
    }),
    [categoryId, restaurantId, search, timeSlot],
  );

  const { data: menuData, loading: menuLoading, error: menuError } = useQuery(
    TABLE_MENU_ITEMS,
    {
      variables: { filter: menuFilter, limit: 100 },
      skip: !restaurantId || !isOrderOpen,
      fetchPolicy: "cache-and-network",
    },
  );

  const menuItems = useMemo(
    () =>
      (menuData?.menuItemsConnection?.edges || [])
        .map((edge) => edge?.node)
        .filter(Boolean)
        .filter(shouldShowMenuItemToCustomer),
    [menuData?.menuItemsConnection?.edges],
  );

  const { data: modifierData, loading: modifierLoading } = useQuery(
    TABLE_ITEM_MODIFIERS,
    {
      variables: { restaurantId, menuItemId: selectedItem?.id || "" },
      skip: !restaurantId || !selectedItem?.id,
      fetchPolicy: "network-only",
    },
  );
  const modifierGroups = modifierData?.customerModifierGroups || [];

  const [requestOtp, { loading: requestingOtp }] = useMutation(REQUEST_TABLE_IDENTITY_OTP);
  const [verifyOtp, { loading: verifyingOtp }] = useMutation(VERIFY_TABLE_IDENTITY_OTP);
  const [confirmIdentity, { loading: confirmingIdentity }] = useMutation(CONFIRM_TABLE_IDENTITY);
  const [submitTableOrder, { loading: submitting }] = useMutation(SUBMIT_TABLE_ORDER);
  const identityBusy = requestingOtp || verifyingOtp || confirmingIdentity;

  useEffect(() => {
    if (
      promptHandledRef.current ||
      contextLoading ||
      contextError ||
      !canOrder ||
      identityChoice ||
      identityToken
    ) {
      return;
    }
    promptHandledRef.current = true;
    setIdentityStep("choice");
    setIsIdentityOpen(true);
  }, [canOrder, contextError, contextLoading, identityChoice, identityToken]);

  useEffect(() => {
    if (!selectedItem) return;
    const variants = selectedItem.servingVariants || [];
    const defaultVariant =
      variants.find((variant) => variant.key === selectedItem.defaultServingKey) ||
      variants.find((variant) => variant.isDefault) ||
      variants[0];
    setSelectedVariantKey(defaultVariant?.key || "portion");
    setSelectedModifiers({});
    setQuantity(1);
    setWeightGrams(500);
    setItemNote("");
    setItemError("");
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem || !modifierGroups.length) return;
    const defaults = {};
    for (const group of modifierGroups) {
      const defaultOptions = (group.options || [])
        .filter((option) => option.isDefault)
        .map((option) => option.id);
      if (defaultOptions.length) {
        defaults[group.id] =
          group.selectionType === "single" ? [defaultOptions[0]] : defaultOptions;
      }
    }
    setSelectedModifiers(defaults);
  }, [modifierGroups, selectedItem]);

  const selectedVariant = useMemo(() => {
    if (!selectedItem) return null;
    const variants = selectedItem.servingVariants || [];
    return (
      variants.find((variant) => variant.key === selectedVariantKey) ||
      variants[0] || {
        key: selectedItem.defaultServingKey || "portion",
        name: "Phần tiêu chuẩn",
        mode: "PORTION",
        price: selectedItem.basePrice,
        sellQty: 1,
        sellUnit: "portion",
      }
    );
  }, [selectedItem, selectedVariantKey]);

  const configuredUnitPrice = useMemo(
    () =>
      calculateConfiguredUnitPrice(
        selectedVariant?.price ?? selectedItem?.basePrice ?? 0,
        modifierGroups,
        selectedModifiers,
      ),
    [modifierGroups, selectedItem?.basePrice, selectedModifiers, selectedVariant?.price],
  );

  const cartTotal = useMemo(
    () => cart.reduce((sum, line) => sum + getLineTotal(line), 0),
    [cart],
  );
  const cartQuantity = useMemo(
    () => cart.reduce((sum, line) => sum + Number(line.quantity || 1), 0),
    [cart],
  );

  const persistAnonymousChoice = () => {
    setIdentityChoice("anonymous");
    setIdentityToken("");
    writeSessionValue(choiceKey, "anonymous");
    writeSessionValue(identityKey, "");
  };

  const persistLinkedIdentity = (token) => {
    setIdentityChoice("linked");
    setIdentityToken(token);
    writeSessionValue(choiceKey, "linked");
    writeSessionValue(identityKey, token);
  };

  const closeIdentity = () => {
    if (!identityToken) persistAnonymousChoice();
    setIdentityError("");
    setIsIdentityOpen(false);
  };

  const openIdentity = () => {
    setIdentityStep("choice");
    setIdentityError("");
    setPhone("");
    setOtp("");
    setChallengeToken("");
    setCandidateToken("");
    setDemoOtp("");
    setMaskedPhone("");
    setMaskedCustomerName("");
    setIsIdentityOpen(true);
  };

  const handleRequestOtp = async (event) => {
    event.preventDefault();
    setIdentityError("");
    try {
      const result = await requestOtp({
        variables: {
          input: { restaurantId, tableId, token: tableToken, phone },
        },
      });
      const payload = result?.data?.publicRequestTableIdentityOtp;
      setChallengeToken(payload?.challengeToken || "");
      setMaskedPhone(payload?.maskedPhone || "");
      setDemoOtp(payload?.demoOtp || "");
      setOtp("");
      setIdentityStep("otp");
    } catch (error) {
      setIdentityError(getErrorMessage(error, "Không thể tạo OTP demo."));
    }
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    setIdentityError("");
    try {
      const result = await verifyOtp({
        variables: { input: { challengeToken, otp } },
      });
      const payload = result?.data?.publicVerifyTableIdentityOtp;
      if (payload?.requiresAccountConfirmation) {
        setCandidateToken(payload.candidateToken || "");
        setMaskedCustomerName(payload.maskedCustomerName || "");
        setIdentityStep("account");
        return;
      }
      if (payload?.identityToken) persistLinkedIdentity(payload.identityToken);
      setIsIdentityOpen(false);
    } catch (error) {
      setIdentityError(getErrorMessage(error, "Không thể xác minh OTP."));
    }
  };

  const handleConfirmAccount = async () => {
    setIdentityError("");
    try {
      const result = await confirmIdentity({
        variables: { input: { candidateToken, accept: true } },
      });
      const token = result?.data?.publicConfirmTableIdentity?.identityToken;
      if (!token) throw new Error("Không thể liên kết tài khoản.");
      persistLinkedIdentity(token);
      setIsIdentityOpen(false);
    } catch (error) {
      setIdentityError(getErrorMessage(error, "Không thể liên kết tài khoản."));
    }
  };

  const handleDeclineAccount = async () => {
    try {
      await confirmIdentity({
        variables: { input: { candidateToken, accept: false } },
      });
    } catch {
      // Declining is local-first; discarding the signed candidate is sufficient.
    }
    persistAnonymousChoice();
    setIsIdentityOpen(false);
  };

  const toggleModifier = (group, optionId) => {
    setSelectedModifiers((current) => {
      const selected = current[group.id] || [];
      if (group.selectionType === "single") {
        return { ...current, [group.id]: [optionId] };
      }
      const exists = selected.includes(optionId);
      const next = exists
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId];
      return { ...current, [group.id]: next };
    });
  };

  const addConfiguredItem = () => {
    if (!selectedItem || !selectedVariant) return;
    const modifierError = getModifierSelectionError(modifierGroups, selectedModifiers);
    if (modifierError) {
      setItemError(modifierError);
      return;
    }
    if (selectedVariant.mode === "BY_WEIGHT") {
      const grams = Number(weightGrams);
      if (!Number.isInteger(grams) || grams <= 0) {
        setItemError("Vui lòng nhập khối lượng dự kiến bằng gram.");
        return;
      }
    }

    const selectedModifierList = modifierGroups.flatMap((group) =>
      (selectedModifiers[group.id] || []).map((optionId) => ({
        groupId: group.id,
        optionId,
      })),
    );
    const cartLine = {
      localId: createIdempotencyKey(),
      dishId: selectedItem.id,
      menuId: selectedItem.menuId,
      categoryId: selectedItem.categoryId,
      name: selectedItem.name,
      unit: selectedVariant.sellUnit || "portion",
      image: selectedItem.thumbImage || null,
      basePrice: Number(selectedVariant.price ?? selectedItem.basePrice ?? 0),
      configuredUnitPrice,
      servingKey: selectedVariant.key || selectedItem.defaultServingKey || "portion",
      servingVariant: {
        key: selectedVariant.key || "portion",
        name: selectedVariant.name || "Phần tiêu chuẩn",
        mode: selectedVariant.mode || "PORTION",
        price: Number(selectedVariant.price ?? selectedItem.basePrice ?? 0),
        sellQty: Number(selectedVariant.sellQty || 1),
        sellUnit: selectedVariant.sellUnit || "portion",
      },
      quantity: selectedVariant.mode === "BY_WEIGHT" ? 1 : Math.max(1, Number(quantity || 1)),
      weightGrams: selectedVariant.mode === "BY_WEIGHT" ? Number(weightGrams) : null,
      selectedModifiers: selectedModifierList,
      note: itemNote.trim() || null,
      priority: "MEDIUM",
      status: "pending",
    };
    setCart((current) => [...current, cartLine]);
    setSubmitKey("");
    setSubmitMessage("");
    setSelectedItem(null);
  };

  const updateLineQuantity = (localId, delta) => {
    setCart((current) =>
      current.map((line) =>
        line.localId === localId && line.servingVariant?.mode !== "BY_WEIGHT"
          ? { ...line, quantity: Math.max(1, Math.min(20, Number(line.quantity || 1) + delta)) }
          : line,
      ),
    );
    setSubmitKey("");
  };

  const removeLine = (localId) => {
    setCart((current) => current.filter((line) => line.localId !== localId));
    setSubmitKey("");
  };

  const handleSubmitOrder = async () => {
    if (!cart.length || submitting) return;
    setSubmitError("");
    setSubmitMessage("");
    const activeKey = submitKey || createIdempotencyKey();
    if (!submitKey) setSubmitKey(activeKey);
    try {
      const items = cart.map(({ localId, configuredUnitPrice: _configured, ...line }) => line);
      const result = await submitTableOrder({
        variables: {
          input: {
            restaurantId,
            tableId,
            token: tableToken,
            identityToken: identityToken || null,
            items,
            note: orderNote.trim() || null,
            idempotencyKey: activeKey,
          },
        },
      });
      const payload = result?.data?.publicSubmitTableOrder;
      setSubmitMessage(payload?.message || "Đã gửi order chờ nhân viên xác nhận.");
      setCart([]);
      setOrderNote("");
      setSubmitKey("");
      await refetchContext?.();
    } catch (error) {
      setSubmitError(getErrorMessage(error, "Không thể gửi món. Vui lòng thử lại."));
    }
  };

  if (!restaurantId || !tableId || !tableToken) return null;
  if (contextError) return null;

  const proofItems = (tableContext?.orders || []).flatMap((order) =>
    (order.items || [])
      .filter((item) => item.requiresProofImage)
      .map((item) => ({ ...item, orderCode: order.orderCode })),
  );

  return (
    <>
      {canOrder ? (
        <button
          type="button"
          className="table-order-launcher"
          onClick={() => setIsOrderOpen(true)}
          aria-label={`Gọi món tại ${tableContext?.tableCode || "bàn này"}${cartQuantity ? `, giỏ có ${cartQuantity} món` : ""}`}
        >
          <span className="table-order-launcher__icon"><ShoppingBag aria-hidden="true" /></span>
          <span>
            <strong>Gọi món tại bàn</strong>
            <small>{cartQuantity ? `${cartQuantity} món · ${formatCurrency(cartTotal)}` : "Nhân viên xác nhận trước khi chuyển bếp"}</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
      ) : !contextLoading && tableContext?.orderBlockedReason ? (
        <div className="table-order-blocked" role="status">
          <ShoppingBag aria-hidden="true" />
          <span>{tableContext.orderBlockedReason}</span>
        </div>
      ) : null}

      <Modal
        isOpen={isIdentityOpen}
        onClose={closeIdentity}
        title="Lưu order và tích điểm"
        size="sm"
        className="table-identity-modal"
        zIndex={1180}
      >
        <IdentityContent
          step={identityStep}
          phone={phone}
          setPhone={setPhone}
          otp={otp}
          setOtp={setOtp}
          demoOtp={demoOtp}
          maskedPhone={maskedPhone}
          maskedCustomerName={maskedCustomerName}
          error={identityError}
          busy={identityBusy}
          onChoosePhone={() => { setIdentityStep("phone"); setIdentityError(""); }}
          onSkip={() => { persistAnonymousChoice(); setIsIdentityOpen(false); }}
          onRequestOtp={handleRequestOtp}
          onVerifyOtp={handleVerifyOtp}
          onConfirmAccount={handleConfirmAccount}
          onDeclineAccount={handleDeclineAccount}
          onBackToPhone={() => { setIdentityStep("phone"); setOtp(""); setIdentityError(""); }}
        />
      </Modal>

      <Modal
        isOpen={isOrderOpen}
        onClose={() => setIsOrderOpen(false)}
        title={`Gọi món · Bàn ${tableContext?.tableCode || "--"}`}
        size="xl"
        className="table-order-menu-modal"
        zIndex={1100}
      >
        <div className="table-order-menu">
          <section className="table-order-menu__identity" aria-label="Trạng thái lưu order">
            <div>
              <strong>{identityToken ? "Đang lưu vào hồ sơ khách" : "Đang gọi món ẩn danh"}</strong>
              <span>{identityToken ? "Điểm được tính sau khi thanh toán thành công." : "Order chỉ thuộc phiên bàn hiện tại."}</span>
            </div>
            <button type="button" onClick={openIdentity}>
              {identityToken ? "Đổi lựa chọn" : "Lưu order & tích điểm"}
            </button>
          </section>

          <section className="table-order-menu__filters" aria-label="Lọc thực đơn">
            <div className="table-order-menu__slots" role="group" aria-label="Khung giờ thực đơn">
              {TIME_SLOTS.map((slot) => (
                <button
                  type="button"
                  key={slot.id}
                  className={timeSlot === slot.id ? "is-active" : ""}
                  onClick={() => setTimeSlot(slot.id)}
                  aria-pressed={timeSlot === slot.id}
                >
                  {slot.label}
                </button>
              ))}
            </div>
            <label className="table-order-menu__search">
              <span>Tìm món</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tên món…"
              />
            </label>
            <div className="table-order-menu__categories" role="group" aria-label="Danh mục món">
              <button
                type="button"
                className={categoryId === "all" ? "is-active" : ""}
                onClick={() => setCategoryId("all")}
              >
                Tất cả
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={categoryId === category.id ? "is-active" : ""}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </section>

          <div className="table-order-menu__layout">
            <section className="table-order-menu__items" aria-busy={menuLoading}>
              {menuLoading ? <p className="table-order-state">Đang tải thực đơn…</p> : null}
              {menuError ? <p className="table-order-error" role="alert">Không thể tải thực đơn lúc này.</p> : null}
              {!menuLoading && !menuError && !menuItems.length ? (
                <p className="table-order-state">Chưa có món phù hợp với bộ lọc.</p>
              ) : null}
              {menuItems.map((item) => {
                const availability = getMenuItemAvailability(item);
                const orderable = canCustomerOrderMenuItem(item);
                const firstPrice = item.servingVariants?.[0]?.price ?? item.basePrice;
                return (
                  <article className="table-order-item-card" key={item.id}>
                    <img src={item.thumbImage || "/default-dishes.jpg"} alt="" loading="lazy" />
                    <div className="table-order-item-card__body">
                      <div>
                        <h3>{item.name}</h3>
                        <p>{item.description || "Món được chuẩn bị sau khi nhân viên xác nhận."}</p>
                      </div>
                      <div className="table-order-item-card__meta">
                        <strong>{formatCurrency(firstPrice || 0)}</strong>
                        {item.avgPrepTimeMin ? <span><Clock3 aria-hidden="true" /> {item.avgPrepTimeMin} phút</span> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        disabled={!orderable}
                        title={!orderable ? availability.customerMessage : undefined}
                      >
                        {orderable ? "Chọn món" : availability.label}
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>

            <aside className="table-order-cart" aria-label="Giỏ món tại bàn">
              <div className="table-order-cart__head">
                <div>
                  <span>Đợt gọi món</span>
                  <strong>{cartQuantity} món</strong>
                </div>
                <strong>{formatCurrency(cartTotal)}</strong>
              </div>
              {!cart.length ? (
                <div className="table-order-cart__empty">
                  <ShoppingBag aria-hidden="true" />
                  <p>Chọn món từ thực đơn để tạo một đợt order mới.</p>
                </div>
              ) : (
                <div className="table-order-cart__lines">
                  {cart.map((line) => (
                    <div className="table-order-cart-line" key={line.localId}>
                      <div>
                        <strong>{line.name}</strong>
                        <span>{line.servingVariant?.name}</span>
                        {line.weightGrams ? <span>{line.weightGrams} g dự kiến</span> : null}
                        {line.note ? <small>{line.note}</small> : null}
                      </div>
                      <div className="table-order-cart-line__right">
                        <strong>{formatCurrency(getLineTotal(line))}</strong>
                        {line.servingVariant?.mode === "BY_WEIGHT" ? (
                          <button type="button" onClick={() => removeLine(line.localId)}>Xóa</button>
                        ) : (
                          <div className="table-order-quantity">
                            <button type="button" onClick={() => updateLineQuantity(line.localId, -1)} aria-label={`Giảm ${line.name}`}><Minus /></button>
                            <span>{line.quantity}</span>
                            <button type="button" onClick={() => updateLineQuantity(line.localId, 1)} aria-label={`Tăng ${line.name}`}><Plus /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label className="table-order-cart__note">
                <span>Ghi chú chung</span>
                <textarea
                  value={orderNote}
                  onChange={(event) => setOrderNote(event.target.value.slice(0, 500))}
                  placeholder="Ví dụ: phục vụ cùng lúc…"
                  rows={3}
                />
              </label>
              {submitError ? <p className="table-order-error" role="alert">{submitError}</p> : null}
              {submitMessage ? <p className="table-order-success" role="status">{submitMessage}</p> : null}
              <button
                type="button"
                className="table-order-cart__submit"
                onClick={handleSubmitOrder}
                disabled={!cart.length || submitting || !canOrder}
              >
                {submitting ? "Đang giữ món và gửi…" : "Gửi order chờ nhân viên nhận"}
              </button>
              <p className="table-order-cart__help">
                Tồn kho được kiểm tra lại khi gửi. Order chỉ chuyển vào bếp sau khi nhân viên/POS xác nhận.
              </p>
            </aside>
          </div>

          {proofItems.length ? (
            <section className="table-order-proof-section" aria-labelledby="table-order-proof-title">
              <div>
                <span>Minh chứng cân ký</span>
                <h3 id="table-order-proof-title">Ảnh do nhân viên cập nhật</h3>
              </div>
              <div className="table-order-proof-grid">
                {proofItems.map((item) => (
                  <article key={`${item.orderCode}-${item.id}`}>
                    <strong>{item.name}</strong>
                    <span>{item.orderCode}</span>
                    {item.proofImages?.length ? (
                      <div>
                        {item.proofImages.map((src) => (
                          <a href={src} target="_blank" rel="noreferrer" key={src}>
                            <img src={src} alt={`Minh chứng cân ký ${item.name}`} loading="lazy" />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <small>Đang chờ nhân viên bổ sung ảnh cân ký.</small>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title={selectedItem ? `Chọn ${selectedItem.name}` : "Chọn món"}
        size="md"
        className="table-order-config-modal"
        zIndex={1160}
      >
        {selectedItem && selectedVariant ? (
          <div className="table-order-config">
            <div className="table-order-config__summary">
              <img src={selectedItem.thumbImage || "/default-dishes.jpg"} alt="" />
              <div>
                <strong>{selectedItem.name}</strong>
                <span>{formatCurrency(configuredUnitPrice)}</span>
              </div>
            </div>
            <fieldset>
              <legend>Khẩu phần</legend>
              {(selectedItem.servingVariants?.length
                ? selectedItem.servingVariants
                : [selectedVariant]
              ).map((variant) => (
                <label key={variant.key}>
                  <input
                    type="radio"
                    name="table-serving-variant"
                    value={variant.key}
                    checked={selectedVariantKey === variant.key}
                    onChange={() => setSelectedVariantKey(variant.key)}
                  />
                  <span>{variant.name || "Phần tiêu chuẩn"}</span>
                  <strong>{formatCurrency(variant.price ?? selectedItem.basePrice ?? 0)}</strong>
                </label>
              ))}
            </fieldset>

            {modifierLoading ? <p className="table-order-state">Đang tải tùy chọn…</p> : null}
            {modifierGroups.map((group) => (
              <fieldset key={group.id}>
                <legend>{group.name}{group.required ? " · Bắt buộc" : ""}</legend>
                {(group.options || []).map((option) => {
                  const selected = (selectedModifiers[group.id] || []).includes(option.id);
                  return (
                    <label key={option.id}>
                      <input
                        type={group.selectionType === "single" ? "radio" : "checkbox"}
                        name={`modifier-${group.id}`}
                        checked={selected}
                        onChange={() => toggleModifier(group, option.id)}
                      />
                      <span>{option.name}</span>
                      <strong>
                        {Number(option.priceRule?.amount || 0)
                          ? `${option.priceRule?.rule === "DELTA" && Number(option.priceRule.amount) > 0 ? "+" : ""}${formatCurrency(option.priceRule.amount)}`
                          : "Không đổi giá"}
                      </strong>
                    </label>
                  );
                })}
              </fieldset>
            ))}

            {selectedVariant.mode === "BY_WEIGHT" ? (
              <label className="table-order-config__field">
                <span>Khối lượng dự kiến (gram)</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={weightGrams}
                  onChange={(event) => setWeightGrams(event.target.value)}
                />
                <small>Nhân viên sẽ cập nhật ảnh minh chứng theo khối lượng thực tế.</small>
              </label>
            ) : (
              <div className="table-order-config__quantity">
                <span>Số lượng</span>
                <div className="table-order-quantity">
                  <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Giảm số lượng"><Minus /></button>
                  <strong>{quantity}</strong>
                  <button type="button" onClick={() => setQuantity((value) => Math.min(20, value + 1))} aria-label="Tăng số lượng"><Plus /></button>
                </div>
              </div>
            )}

            <label className="table-order-config__field">
              <span>Ghi chú cho món</span>
              <textarea
                value={itemNote}
                onChange={(event) => setItemNote(event.target.value.slice(0, 300))}
                placeholder="Ít cay, không hành…"
                rows={3}
              />
            </label>
            {itemError ? <p className="table-order-error" role="alert">{itemError}</p> : null}
            <button type="button" className="table-order-primary" onClick={addConfiguredItem}>
              Thêm vào đợt gọi món · {formatCurrency(
                getLineTotal({
                  basePrice: selectedItem.basePrice,
                  configuredUnitPrice,
                  servingVariant: selectedVariant,
                  quantity,
                  weightGrams,
                }),
              )}
            </button>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
