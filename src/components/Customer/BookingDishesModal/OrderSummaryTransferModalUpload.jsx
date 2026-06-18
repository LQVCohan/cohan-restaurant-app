import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { io } from "socket.io-client";
import Modal from "../../common/Modal";
import { AuthContext } from "../../../context/AuthContext";
import { formatCurrency } from "../../../utils/formatters";
import { getToken } from "../../../lib/authStorage";
import { useAvatarUploadLocal } from "@/hooks/useAvatarUploadLocal";
import {
  buildDiscountPricingInput,
  getShippingFeeForDiscountPreview,
  mapCartItemToOrderItemInput,
  mapDeliveryMethodToOrderType,
} from "../../../utils/discountPreviewPayload";
import "./OrderSummaryModal.scss";
import "./OrderSummaryTransferUpload.scss";

const ORDER_VAT_RATE = 0.1;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const PROOF_MAX_FILES = 3;
const PROOF_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const CREATE_CHECKOUT_ORDERS = gql`
  mutation CreateCheckoutOrders($input: CreateCheckoutOrdersInput!) {
    createCheckoutOrders(input: $input) {
      checkout { checkoutCode grandTotal orderIds }
      orders { id orderCode parentOrderCode restaurantId orderType totals { grandTotal } currentStatus }
    }
  }
`;

const CREATE_CUSTOMER_TRANSFER_PAYMENT = gql`
  mutation CreateCustomerTransferPayment($input: CreateCustomerTransferPaymentInput!) {
    createCustomerTransferPayment(input: $input) {
      id createdAt amount currency reference status callbackStatus metadata expiresAt
      transfer { status rejectReason rejectedCount maxRejectedCount lastRejectedReason proofImages proofNote submittedAt verifiedAt rejectedAt pausedAt resumedAt proofCycleStartedAt }
    }
  }
`;

const SUBMIT_TRANSFER_PROOF = gql`
  mutation SubmitTransferProof($input: SubmitTransferProofInput!) {
    submitTransferProof(input: $input) {
      id createdAt status callbackStatus expiresAt
      transfer { status rejectReason rejectedCount maxRejectedCount lastRejectedReason proofImages proofNote submittedAt verifiedAt rejectedAt pausedAt resumedAt proofCycleStartedAt }
    }
  }
`;

const SYNC_PAYMENT_STATUS = gql`
  mutation SyncPaymentStatus($paymentId: ID!) {
    syncPaymentStatus(paymentId: $paymentId) {
      id createdAt status callbackStatus expiresAt
      transfer { status rejectReason rejectedCount maxRejectedCount lastRejectedReason proofImages proofNote submittedAt verifiedAt rejectedAt pausedAt resumedAt proofCycleStartedAt }
    }
  }
`;

const defaultShipping = (user = {}) => ({
  fullName: user?.fullName || "",
  phone: user?.phone || "",
  email: user?.email || "",
  address: "",
  note: "",
  deliveryMethod: "delivery",
  deliveryTime: "asap",
});

const groupByRestaurant = (orders = []) => {
  const map = new Map();
  orders.forEach((order) => {
    const rid = order?.restaurantId;
    if (!rid) return;
    if (!map.has(rid)) map.set(rid, []);
    map.get(rid).push(order);
  });
  return Array.from(map.entries()).map(([restaurantId, groupedOrders]) => ({ restaurantId, orders: groupedOrders }));
};

const calcTotal = (items = []) => {
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const modifiers = items.reduce((sum, item) => sum + Number(item.modifiersPrice || 0) * Number(item.quantity || 1), 0);
  const beforeTax = subtotal + modifiers;
  const tax = Math.round(beforeTax * ORDER_VAT_RATE);
  return { subtotal, modifiers, tax, total: beforeTax + tax };
};

const isShippingValid = (shipping) => {
  const nameOk = String(shipping.fullName || "").trim().length >= 2;
  const phoneOk = /^(\+?\d{7,15})$/.test(String(shipping.phone || "").trim());
  const email = String(shipping.email || "").trim();
  const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const addressOk = shipping.deliveryMethod !== "delivery" || String(shipping.address || "").trim().length > 5;
  return nameOk && phoneOk && emailOk && addressOk;
};

const getTransferTiming = (session = {}, nowMs = Date.now()) => {
  const startedRaw = session?.transfer?.proofCycleStartedAt || session?.transfer?.resumedAt || session?.createdAt;
  const startMs = startedRaw ? new Date(startedRaw).getTime() : NaN;
  const expiresMs = session?.expiresAt ? new Date(session.expiresAt).getTime() : NaN;
  const totalMs = Number.isFinite(startMs) && Number.isFinite(expiresMs) ? Math.max(expiresMs - startMs, 0) : 0;
  const remainingMs = Number.isFinite(expiresMs) ? Math.max(expiresMs - nowMs, 0) : 0;
  return { totalMs, remainingMs, halfTimeReached: totalMs > 0 && remainingMs <= totalMs * 0.5 };
};

const resolveTransferStatus = (session = {}, nowMs = Date.now()) => {
  const paymentStatus = String(session?.status || "").toLowerCase();
  const transferStatus = String(session?.transfer?.status || "INSTRUCTIONS_SHOWN").toUpperCase();
  if (paymentStatus === "success" || transferStatus === "VERIFIED") return "VERIFIED";
  if (["SUBMITTED", "VERIFYING"].includes(transferStatus)) return transferStatus;
  if (transferStatus === "FAILED") return "FAILED";
  if (transferStatus === "EXPIRED" || paymentStatus === "expired") return "EXPIRED";
  if (session?.expiresAt && new Date(session.expiresAt).getTime() <= nowMs && ["INSTRUCTIONS_SHOWN", "REJECTED"].includes(transferStatus)) return "EXPIRED";
  return transferStatus || "INSTRUCTIONS_SHOWN";
};

const shouldPollTransferSession = (session = {}) => !["VERIFIED", "FAILED", "EXPIRED"].includes(resolveTransferStatus(session));

const TRANSFER_STEPS = [
  { key: "order", label: "Xác nhận đơn" },
  { key: "transfer", label: "Quét QR / chuyển khoản" },
  { key: "proof", label: "Gửi bằng chứng" },
  { key: "verify", label: "Chờ xác minh" },
];

const transferStatusLabel = {
  INSTRUCTIONS_SHOWN: "Chưa gửi bằng chứng",
  SUBMITTED: "Đã gửi bằng chứng, đang chờ xác minh",
  VERIFYING: "Đang xác minh",
  VERIFIED: "Đã xác minh thanh toán",
  REJECTED: "Cần gửi lại bằng chứng",
  FAILED: "Thanh toán chưa hợp lệ",
  EXPIRED: "Phiên thanh toán hết hạn",
};

const transferStatusDescription = {
  INSTRUCTIONS_SHOWN: "Hệ thống đang tự kiểm tra giao dịch. Khi thanh toán được ghi nhận, đơn của bạn sẽ được xác nhận ngay.",
  SUBMITTED: "Đã nhận minh chứng. Thời gian chờ đã tạm dừng để nhà hàng kiểm tra.",
  VERIFYING: "Nhà hàng đang kiểm tra giao dịch. Vui lòng chờ trong ít phút.",
  VERIFIED: "Thanh toán đã được xác minh. Nhà hàng đã nhận đơn và đang xử lý.",
  REJECTED: "Bằng chứng chưa hợp lệ. Vui lòng gửi lại ảnh rõ hơn hoặc đúng thông tin chuyển khoản.",
  FAILED: "Thanh toán chưa hợp lệ. Vui lòng kiểm tra lại thông tin hoặc liên hệ nhà hàng.",
  EXPIRED: "Phiên thanh toán đã hết hạn vì hệ thống chưa ghi nhận giao dịch và chưa có minh chứng thanh toán. Đơn của bạn đã được hủy.",
};

const parseProofUrls = (value = "") => String(value || "").split(/\n|,/).map((item) => item.trim()).filter((item) => /^https?:\/\//i.test(item));

const activeTransferStepIndex = (status) => {
  if (status === "VERIFIED") return TRANSFER_STEPS.length;
  if (status === "INSTRUCTIONS_SHOWN") return 1;
  if (status === "SUBMITTED" || status === "VERIFYING") return 3;
  if (status === "REJECTED" || status === "FAILED") return 2;
  return -1;
};

const formatFileSize = (size = 0) => {
  const bytes = Number(size || 0);
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const validateProofFile = (file) => {
  if (!file?.type?.startsWith("image/")) throw new Error("Chỉ hỗ trợ ảnh PNG, JPG, JPEG hoặc WebP cho minh chứng chuyển khoản.");
  if (file.size > PROOF_MAX_FILE_SIZE_BYTES) throw new Error("Mỗi ảnh minh chứng tối đa 10MB. Vui lòng chọn ảnh nhỏ hơn.");
};

const buildProofFileEntry = (file) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  file,
  name: file.name,
  size: file.size,
  previewUrl: URL.createObjectURL(file),
  progress: 0,
  uploadedUrl: "",
  status: "ready",
});

const revokeProofPreview = (entry) => {
  if (entry?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(entry.previewUrl);
};

const TransferInfoRow = ({ label, value, copyKey, important = false, onCopy, copied }) => (
  <div className={`transfer-info-row ${important ? "is-important" : ""}`}>
    <span className="transfer-info-label">{label}</span>
    <strong className="transfer-info-value">{value || "Đang cập nhật"}</strong>
    {value ? <button type="button" className="transfer-copy-btn" onClick={() => onCopy(value, copyKey)}>{copied === copyKey ? "Đã sao chép" : "Sao chép"}</button> : null}
  </div>
);

export default function OrderSummaryTransferModalUpload({ isOpen, onClose, items = [], onSuccess }) {
  const { user } = useContext(AuthContext) || {};
  const userId = user?.id || user?._id;
  const { upload } = useAvatarUploadLocal();
  const [shipping, setShipping] = useState(() => defaultShipping(user));
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [view, setView] = useState("summary");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [transferSessions, setTransferSessions] = useState([]);
  const [proofBySession, setProofBySession] = useState({});
  const [loading, setLoading] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [submittingProofBySession, setSubmittingProofBySession] = useState({});
  const [refreshingSessionId, setRefreshingSessionId] = useState("");
  const [copiedField, setCopiedField] = useState("");
  const transferSessionIdsRef = useRef(new Set());
  const proofBySessionRef = useRef({});

  const [createCheckoutOrders] = useMutation(CREATE_CHECKOUT_ORDERS);
  const [createCustomerTransferPayment] = useMutation(CREATE_CUSTOMER_TRANSFER_PAYMENT);
  const [submitTransferProof] = useMutation(SUBMIT_TRANSFER_PROOF);
  const [syncPaymentStatus] = useMutation(SYNC_PAYMENT_STATUS);

  const totals = useMemo(() => calcTotal(items), [items]);

  useEffect(() => { proofBySessionRef.current = proofBySession; }, [proofBySession]);
  useEffect(() => () => { Object.values(proofBySessionRef.current || {}).forEach((form) => (form?.files || []).forEach(revokeProofPreview)); }, []);

  const updateProofFile = useCallback((sessionId, fileId, patch) => {
    setProofBySession((prev) => {
      const form = prev[sessionId] || {};
      return { ...prev, [sessionId]: { ...form, files: (form.files || []).map((entry) => (entry.id === fileId ? { ...entry, ...patch } : entry)) } };
    });
  }, []);

  const handleProofChange = useCallback((sessionId, field, value) => {
    setProofBySession((prev) => ({ ...prev, [sessionId]: { ...(prev[sessionId] || {}), [field]: value } }));
  }, []);

  const handleProofFilesChange = useCallback((sessionId, event) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;
    setError("");
    setProofBySession((prev) => {
      const form = prev[sessionId] || {};
      const currentFiles = form.files || [];
      const availableSlots = PROOF_MAX_FILES - currentFiles.length;
      if (availableSlots <= 0) {
        setError(`Bạn chỉ có thể tải tối đa ${PROOF_MAX_FILES} ảnh minh chứng.`);
        return prev;
      }
      const accepted = [];
      for (const file of selectedFiles.slice(0, availableSlots)) {
        try {
          validateProofFile(file);
          accepted.push(buildProofFileEntry(file));
        } catch (err) {
          setError(err?.message || "Ảnh minh chứng không hợp lệ.");
        }
      }
      if (!accepted.length) return prev;
      return { ...prev, [sessionId]: { ...form, files: [...currentFiles, ...accepted] } };
    });
    event.target.value = "";
  }, []);

  const handleRemoveProofFile = useCallback((sessionId, fileId) => {
    setProofBySession((prev) => {
      const form = prev[sessionId] || {};
      const currentFiles = form.files || [];
      const removed = currentFiles.find((entry) => entry.id === fileId);
      revokeProofPreview(removed);
      return { ...prev, [sessionId]: { ...form, files: currentFiles.filter((entry) => entry.id !== fileId) } };
    });
  }, []);

  const clearProofForm = useCallback((sessionId) => {
    setProofBySession((prev) => {
      const form = prev[sessionId] || {};
      (form.files || []).forEach(revokeProofPreview);
      return { ...prev, [sessionId]: { files: [], manualUrls: "", note: "" } };
    });
  }, []);

  const copyToClipboard = useCallback(async (value, key) => {
    const text = String(value || "").trim();
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedField(key);
      window.setTimeout(() => setCopiedField((current) => (current === key ? "" : current)), 1400);
    } catch {
      setError("Không thể sao chép. Vui lòng sao chép thủ công.");
    }
  }, []);

  useEffect(() => {
    transferSessionIdsRef.current = new Set(transferSessions.map((session) => String(session?.id || session?._id || "")).filter(Boolean));
  }, [transferSessions]);

  const mergeTransferSessionUpdate = useCallback((updated) => {
    const updatedId = String(updated?.paymentSessionId || updated?.id || updated?._id || "");
    if (!updatedId) return;
    setTransferSessions((prev) => prev.map((session) => {
      const sessionId = String(session?.id || session?._id || "");
      if (sessionId !== updatedId) return session;
      return { ...session, ...updated, id: session.id || updated.id || updated.paymentSessionId, status: updated.status || session.status, transfer: { ...(session.transfer || {}), ...(updated.transfer || {}) } };
    }));
  }, []);

  useEffect(() => {
    if (!isOpen || view !== "transfer" || !userId || !transferSessions.length) return undefined;
    const token = getToken();
    if (!token) return undefined;
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"], auth: { token }, reconnection: true, reconnectionDelay: 2000, reconnectionAttempts: 10 });
    const handlePaymentEvent = (event) => {
      const paymentSessionId = String(event?.paymentSessionId || "");
      if (!paymentSessionId || !transferSessionIdsRef.current.has(paymentSessionId)) return;
      mergeTransferSessionUpdate(event);
    };
    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit("joinUserChannel", String(userId), (ack) => {
        if (!ack?.ok) console.warn("[SOCKET.IO] joinUserChannel failed:", ack?.code || "UNKNOWN");
      });
    });
    socket.on("paymentEvents", handlePaymentEvent);
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("connect_error", (err) => {
      setSocketConnected(false);
      console.warn("[SOCKET.IO] Payment channel connection error:", err?.message || err);
    });
    return () => {
      setSocketConnected(false);
      socket.off("paymentEvents", handlePaymentEvent);
      socket.emit("leaveUserChannel", String(userId));
      socket.disconnect();
    };
  }, [isOpen, view, userId, transferSessions.length, mergeTransferSessionUpdate]);

  useEffect(() => {
    if (!isOpen || view !== "transfer" || !transferSessions.length) return undefined;
    const pendingSessionIds = transferSessions.filter(shouldPollTransferSession).map((session) => String(session?.id || session?._id || "")).filter(Boolean);
    if (!pendingSessionIds.length) return undefined;
    const intervalId = window.setInterval(() => {
      pendingSessionIds.forEach((sessionId) => {
        syncPaymentStatus({ variables: { paymentId: sessionId } }).then((result) => mergeTransferSessionUpdate(result?.data?.syncPaymentStatus)).catch(() => {});
      });
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [isOpen, view, transferSessions, syncPaymentStatus, mergeTransferSessionUpdate]);

  const createCheckout = async (method) => {
    const checkoutItems = items.map((item) => mapCartItemToOrderItemInput(item, { includeCartHoldRef: true }));
    const result = await createCheckoutOrders({
      variables: { input: { orderType: mapDeliveryMethodToOrderType(shipping.deliveryMethod), items: checkoutItems, shipping, paymentMethod: method, pricing: buildDiscountPricingInput({ taxRate: ORDER_VAT_RATE, serviceRate: 0, shippingFee: getShippingFeeForDiscountPreview({ deliveryMethod: shipping.deliveryMethod, shippingFee: shipping.shippingFee }) }), idempotencyKey: `checkout-${Date.now()}`, note: shipping.note || undefined } },
    });
    return result?.data?.createCheckoutOrders;
  };

  const handleConfirm = async () => {
    setError("");
    if (!isShippingValid(shipping)) {
      setError("Vui lòng nhập họ tên, số điện thoại và địa chỉ giao hàng hợp lệ.");
      return;
    }
    if (!paymentMethod) {
      setError("Vui lòng chọn phương thức thanh toán.");
      return;
    }
    setLoading(true);
    try {
      const checkoutResult = await createCheckout(paymentMethod === "transfer" ? "transfer" : paymentMethod);
      const checkout = checkoutResult?.checkout;
      const orders = checkoutResult?.orders || [];
      setReceipt({ checkoutCode: checkout?.checkoutCode, orderIds: checkout?.orderIds || orders.map((order) => order.id), orderCodes: orders.map((order) => order.orderCode).filter(Boolean), orders, totalPaid: checkout?.grandTotal || totals.total, paymentMethod });
      onSuccess?.();
      if (paymentMethod === "transfer") {
        const sessions = [];
        for (const group of groupByRestaurant(orders)) {
          const payment = await createCustomerTransferPayment({ variables: { input: { restaurantId: group.restaurantId, orderIds: group.orders.map((order) => order.id) } } });
          sessions.push(payment?.data?.createCustomerTransferPayment);
        }
        setTransferSessions(sessions.filter(Boolean));
        setView("transfer");
      } else {
        setView("success");
      }
    } catch (err) {
      setError(err?.message || "Không thể tạo đơn. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProof = async (sessionId) => {
    const form = proofBySession[sessionId] || {};
    const localFiles = Array.isArray(form.files) ? form.files : [];
    const manualUrls = parseProofUrls(form.manualUrls);
    if (!localFiles.length && !manualUrls.length) {
      setError("Vui lòng tải lên ít nhất một ảnh minh chứng chuyển khoản.");
      return;
    }
    setSubmittingProofBySession((prev) => ({ ...prev, [sessionId]: true }));
    setError("");
    try {
      const uploadedUrls = [];
      for (const entry of localFiles) {
        if (entry.uploadedUrl) {
          uploadedUrls.push(entry.uploadedUrl);
          continue;
        }
        updateProofFile(sessionId, entry.id, { status: "uploading", progress: 1 });
        const url = await upload(entry.file, (progress) => updateProofFile(sessionId, entry.id, { progress: Math.max(1, Math.min(100, Number(progress) || 0)) }));
        updateProofFile(sessionId, entry.id, { status: "uploaded", progress: 100, uploadedUrl: url });
        uploadedUrls.push(url);
      }
      const proofImages = [...uploadedUrls, ...manualUrls].filter(Boolean).slice(0, PROOF_MAX_FILES);
      if (!proofImages.length) throw new Error("Không có ảnh minh chứng hợp lệ sau khi tải lên.");
      const result = await submitTransferProof({ variables: { input: { paymentSessionId: sessionId, proofImages, proofNote: form.note || "" } } });
      mergeTransferSessionUpdate(result?.data?.submitTransferProof);
      clearProofForm(sessionId);
    } catch (err) {
      setError(err?.message || "Không thể gửi bằng chứng chuyển khoản.");
    } finally {
      setSubmittingProofBySession((prev) => ({ ...prev, [sessionId]: false }));
    }
  };

  const refreshSession = async (sessionId) => {
    setRefreshingSessionId(sessionId);
    try {
      const result = await syncPaymentStatus({ variables: { paymentId: sessionId } });
      mergeTransferSessionUpdate(result?.data?.syncPaymentStatus);
    } finally {
      setRefreshingSessionId("");
    }
  };

  const renderSummary = () => (
    <>
      <div className="section"><h3>Thông tin nhận hàng</h3><input value={shipping.fullName} onChange={(e) => setShipping({ ...shipping, fullName: e.target.value })} placeholder="Họ tên" /><input value={shipping.phone} onChange={(e) => setShipping({ ...shipping, phone: e.target.value })} placeholder="Số điện thoại" /><input value={shipping.email} onChange={(e) => setShipping({ ...shipping, email: e.target.value })} placeholder="Email" /><input value={shipping.address} onChange={(e) => setShipping({ ...shipping, address: e.target.value })} placeholder="Địa chỉ giao hàng" /><textarea value={shipping.note} onChange={(e) => setShipping({ ...shipping, note: e.target.value })} placeholder="Ghi chú" /></div>
      <div className="section"><h3>Món đã chọn</h3>{items.map((item) => <div className="price-row" key={item.id || item.cartItemId || item.name}><span>{item.name} × {item.quantity || 1}</span><strong>{formatCurrency((Number(item.price || 0) + Number(item.modifiersPrice || 0)) * Number(item.quantity || 1))}</strong></div>)}</div>
      <div className="section"><h3>Phương thức thanh toán</h3><div className="payment-methods-grid">{[["cash", "Tiền mặt", "Thanh toán khi nhận hàng"], ["transfer", "Chuyển khoản / QR", "Gửi bằng chứng để nhà hàng xác minh"], ["wallet", "Ví nội bộ", "Thanh toán bằng số dư ví"]].map(([key, title, desc]) => <button key={key} type="button" className={`payment-method-card ${paymentMethod === key ? "selected" : ""}`} onClick={() => setPaymentMethod(key)}><div className="payment-info"><h4>{title}</h4><p>{desc}</p></div></button>)}</div></div>
      <div className="section"><div className="price-row"><span>Tạm tính</span><strong>{formatCurrency(totals.subtotal + totals.modifiers)}</strong></div><div className="price-row"><span>VAT 10%</span><strong>{formatCurrency(totals.tax)}</strong></div><div className="price-row total"><span>Tổng</span><strong>{formatCurrency(totals.total)}</strong></div></div>
    </>
  );

  const renderProofPanel = ({ session, sessionId, status, canSubmitProof, rejectedCount, maxRejectedCount, remainingAttempts, timing, needsResubmit, submittedProofImages, proofForm, previewUrls }) => {
    const localFiles = Array.isArray(proofForm.files) ? proofForm.files : [];
    const isSubmittingProof = Boolean(submittingProofBySession[sessionId]);
    const hasProofInput = localFiles.length > 0 || previewUrls.length > 0;
    return (
      <div className="transfer-proof-panel">
        <p className={`transfer-status-message transfer-status-message--${status.toLowerCase()}`}>{transferStatusDescription[status]}</p>
        {timing.halfTimeReached && timing.remainingMs > 0 && ["INSTRUCTIONS_SHOWN", "REJECTED"].includes(status) && <p className="transfer-reminder-banner">Phiên thanh toán sắp hết hạn. Nếu bạn chưa thanh toán, vui lòng chuyển khoản trong thời gian còn lại. Nếu bạn đã chuyển khoản nhưng hệ thống chưa ghi nhận, hãy tải ảnh minh chứng để nhà hàng hỗ trợ xác minh nhanh hơn.</p>}
        {status === "REJECTED" && rejectedCount > 0 && remainingAttempts > 0 && <p className={`transfer-rejected-warning ${remainingAttempts <= 1 ? "is-final" : ""}`}>Minh chứng chưa hợp lệ. Bạn còn {remainingAttempts} lần gửi lại. Vui lòng kiểm tra đúng số tiền, nội dung chuyển khoản và ảnh biên lai trước khi gửi lại.</p>}
        {rejectedCount >= maxRejectedCount && <p className="transfer-terminal-warning">Minh chứng đã bị từ chối quá 3 lần nên phiên thanh toán đã dừng để tránh giữ đơn quá lâu. Vui lòng tạo đơn mới hoặc liên hệ nhà hàng.</p>}
        {submittedProofImages.length > 0 && <div className="transfer-proof-submitted"><p className="transfer-proof-preview-title">Bằng chứng đã gửi</p><div className="transfer-proof-preview-list">{submittedProofImages.map((src, index) => <a key={`${src}-${index}`} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Bằng chứng đã gửi ${index + 1}`} loading="lazy" /></a>)}</div></div>}
        {(status === "SUBMITTED" || status === "VERIFYING") && <p className="transfer-proof-waiting">Đã nhận minh chứng. Thời gian chờ đã tạm dừng để nhà hàng kiểm tra.</p>}
        {needsResubmit && session.transfer?.rejectReason && <p className="transfer-reject-reason">Lý do từ chối: {session.transfer.rejectReason}</p>}
        {status !== "EXPIRED" && canSubmitProof && <><p className="transfer-proof-helper">Nếu bạn đã chuyển khoản, hãy tải ảnh minh chứng để nhà hàng kiểm tra thủ công và xử lý nhanh hơn.</p><div className="transfer-proof-grid"><label className="transfer-proof-upload-card"><span>Ảnh minh chứng chuyển khoản</span><input type="file" accept="image/*" multiple onChange={(event) => handleProofFilesChange(sessionId, event)} disabled={isSubmittingProof || localFiles.length >= PROOF_MAX_FILES} /><small>Tải tối đa {PROOF_MAX_FILES} ảnh, mỗi ảnh tối đa 10MB. Ảnh biên lai được giữ nguyên tỷ lệ để dễ đọc thông tin.</small></label>{localFiles.length > 0 && <div className="transfer-proof-preview transfer-proof-preview--files"><p className="transfer-proof-preview-title">Ảnh đã chọn</p><div className="transfer-proof-file-list">{localFiles.map((entry) => <div className="transfer-proof-file" key={entry.id}><img src={entry.previewUrl} alt={entry.name || "Ảnh minh chứng"} loading="lazy" /><div><strong>{entry.name || "Ảnh minh chứng"}</strong><span>{formatFileSize(entry.size)} · {entry.progress ? `${entry.progress}%` : "Sẵn sàng tải lên"}</span>{entry.status === "uploading" && <progress value={entry.progress || 1} max="100" />}</div><button type="button" onClick={() => handleRemoveProofFile(sessionId, entry.id)} disabled={isSubmittingProof}>Xóa</button></div>)}</div></div>}<label>Ghi chú cho nhà hàng<textarea placeholder="Ví dụ: Em đã chuyển khoản lúc 14:05, tên tài khoản Nguyễn Văn A" value={proofForm.note || ""} onChange={(e) => handleProofChange(sessionId, "note", e.target.value)} /></label><details className="transfer-proof-url-fallback"><summary>Dán URL ảnh thủ công nếu ảnh đã được tải lên nơi khác</summary><textarea placeholder={needsResubmit ? "Dán URL ảnh bằng chứng mới, mỗi dòng một ảnh" : "Dán URL ảnh bằng chứng, mỗi dòng một ảnh. Ví dụ: https://.../bien-lai.jpg"} value={proofForm.manualUrls || ""} onChange={(e) => handleProofChange(sessionId, "manualUrls", e.target.value)} /></details></div>{previewUrls.length > 0 && <div className="transfer-proof-preview"><p className="transfer-proof-preview-title">URL ảnh thủ công</p><div className="transfer-proof-preview-list">{previewUrls.map((src, index) => <a key={`${src}-${index}`} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Xem trước bằng chứng chuyển khoản ${index + 1}`} loading="lazy" /></a>)}</div></div>}</>}
        <div className="transfer-proof-actions">{canSubmitProof && status !== "EXPIRED" && <button type="button" className="transfer-proof-primary" disabled={isSubmittingProof || !hasProofInput || !canSubmitProof || ["VERIFIED", "SUBMITTED", "VERIFYING", "EXPIRED", "FAILED"].includes(status)} onClick={() => handleSubmitProof(sessionId)}>{isSubmittingProof ? "Đang tải & gửi..." : needsResubmit ? "Gửi lại minh chứng" : "Tải lên & gửi minh chứng"}</button>}<button type="button" className="transfer-proof-secondary" disabled={refreshingSessionId === sessionId} onClick={() => refreshSession(sessionId)}>{refreshingSessionId === sessionId ? "Đang kiểm tra..." : "Kiểm tra trạng thái"}</button></div>
      </div>
    );
  };

  const renderTransfer = () => (
    <section className="transfer-payment-workspace"><header className="transfer-payment-hero"><div><p className="transfer-payment-eyebrow">Thanh toán chuyển khoản</p><h3>Quét QR để hoàn tất thanh toán</h3><p>Hệ thống đang tự kiểm tra giao dịch. Khi thanh toán được ghi nhận, đơn của bạn sẽ được xác nhận ngay.</p></div><div className="transfer-payment-live"><span className="transfer-live-dot" /><span>{socketConnected ? "Đang cập nhật realtime" : "Đang dùng tự cập nhật dự phòng"}</span></div></header><ol className="transfer-payment-steps">{TRANSFER_STEPS.map((step, index) => { const firstSessionStatus = resolveTransferStatus(transferSessions[0] || {}); const activeIndex = activeTransferStepIndex(firstSessionStatus); const isDone = activeIndex === TRANSFER_STEPS.length || (activeIndex >= 0 && index < activeIndex); const isActive = activeIndex === index; return <li key={step.key} className={`transfer-step ${isDone ? "is-done" : ""} ${isActive ? "is-active" : ""}`}><span className="transfer-step-index">{index + 1}</span><span>{step.label}</span></li>; })}</ol><div className="transfer-session-list">{transferSessions.map((session) => { const bank = session?.metadata?.bankTransfer || {}; const status = resolveTransferStatus(session); const sessionId = String(session?.id || session?._id || ""); const orderCodes = Array.isArray(session?.metadata?.orderCodes) ? session.metadata.orderCodes.filter(Boolean) : []; const orderCodesText = orderCodes.join(", "); const proofForm = proofBySession[sessionId] || {}; const previewUrls = parseProofUrls(proofForm.manualUrls); const submittedProofImages = Array.isArray(session?.transfer?.proofImages) ? session.transfer.proofImages.filter(Boolean) : []; const needsResubmit = status === "REJECTED"; const rejectedCount = Number(session?.transfer?.rejectedCount || 0); const maxRejectedCount = Number(session?.transfer?.maxRejectedCount || 3); const remainingAttempts = Math.max(maxRejectedCount - rejectedCount, 0); const timing = getTransferTiming(session); const canSubmitProof = ["INSTRUCTIONS_SHOWN", "REJECTED"].includes(status) && rejectedCount < maxRejectedCount; const expiresAt = session?.expiresAt ? new Date(session.expiresAt) : null; const copyPrefix = `${sessionId}:`; return <article className={`transfer-session-card transfer-session-card--${status.toLowerCase()}`} key={sessionId}><header className="transfer-session-header"><div><p className="transfer-session-kicker">Phiên thanh toán {session.reference}</p><h4>{session?.metadata?.restaurantName || "Nhà hàng"}{orderCodesText ? ` · ${orderCodesText}` : ""}</h4></div><span className={`transfer-status-badge transfer-status-badge--${status.toLowerCase()}`}>{transferStatusLabel[status] || status}</span></header><div className="transfer-session-grid"><aside className="transfer-qr-card"><div className="transfer-qr-frame">{bank.qrImageUrl ? <img className="transfer-qr-image" src={bank.qrImageUrl} alt={`QR chuyển khoản ${session.reference}`} loading="lazy" /> : <div className="transfer-qr-placeholder">QR đang được cập nhật</div>}</div><p className="transfer-qr-caption">Quét QR bằng ứng dụng ngân hàng, kiểm tra đúng số tiền và nội dung trước khi chuyển.</p></aside><div className="transfer-bank-panel"><TransferInfoRow label="Số tiền" value={formatCurrency(session.amount)} copyKey={`${copyPrefix}amount`} important onCopy={() => copyToClipboard(session.amount, `${copyPrefix}amount`)} copied={copiedField} /><TransferInfoRow label="Ngân hàng" value={bank.bankName} copyKey={`${copyPrefix}bank`} onCopy={copyToClipboard} copied={copiedField} /><TransferInfoRow label="Số tài khoản" value={bank.bankAccountNumber} copyKey={`${copyPrefix}account`} onCopy={copyToClipboard} copied={copiedField} /><TransferInfoRow label="Chủ tài khoản" value={bank.accountName} copyKey={`${copyPrefix}owner`} onCopy={copyToClipboard} copied={copiedField} /><TransferInfoRow label="Nội dung chuyển khoản" value={bank.transferContent || session.reference} copyKey={`${copyPrefix}content`} important onCopy={copyToClipboard} copied={copiedField} /><TransferInfoRow label="Mã tham chiếu" value={session.reference} copyKey={`${copyPrefix}reference`} onCopy={copyToClipboard} copied={copiedField} />{expiresAt && <TransferInfoRow label="Hạn thanh toán" value={expiresAt.toLocaleString("vi-VN")} copyKey={`${copyPrefix}expires`} onCopy={copyToClipboard} copied={copiedField} />}{["INSTRUCTIONS_SHOWN", "REJECTED"].includes(status) && timing.remainingMs > 0 && <TransferInfoRow label="Còn lại" value={`${Math.floor(timing.remainingMs / 60000)}:${String(Math.floor((timing.remainingMs % 60000) / 1000)).padStart(2, "0")}`} copyKey={`${copyPrefix}remaining`} copied={copiedField} />}</div></div>{status === "VERIFIED" ? <div className="transfer-proof-actions transfer-proof-actions--verified"><button type="button" className="transfer-proof-primary" disabled>Đã xác minh</button></div> : renderProofPanel({ session, sessionId, status, canSubmitProof, rejectedCount, maxRejectedCount, remainingAttempts, timing, needsResubmit, submittedProofImages, proofForm, previewUrls })}</article>; })}</div></section>
  );

  const renderSuccess = () => <div className="section text-center"><h3>Đặt đơn thành công</h3><p>Mã đơn: {receipt?.checkoutCode}</p><p>Tổng tiền: {formatCurrency(receipt?.totalPaid || 0)}</p></div>;

  return <Modal isOpen={isOpen} onClose={onClose} title="Xác nhận đơn hàng" size="lg" className="order-summary-modal"><div className="order-summary-wrapper">{!!error && <div className="order-summary-error" role="alert">{error}</div>}<div className="order-summary-content">{view === "summary" && renderSummary()}{view === "transfer" && renderTransfer()}{view === "success" && renderSuccess()}</div><Modal.Footer><button className="btn btn--secondary" onClick={onClose}>Đóng</button>{view === "summary" && <button className="btn btn--success" disabled={loading} onClick={handleConfirm}>{loading ? "Đang xử lý..." : "Xác nhận đặt hàng"}</button>}{view !== "summary" && <button className="btn btn--primary" onClick={onClose}>Hoàn tất</button>}</Modal.Footer></div></Modal>;
}
