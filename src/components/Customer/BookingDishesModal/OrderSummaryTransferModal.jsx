import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { io } from "socket.io-client";
import Modal from "../../common/Modal";
import { AuthContext } from "../../../context/AuthContext";
import { formatCurrency } from "../../../utils/formatters";
import { getToken } from "../../../lib/authStorage";
import {
  buildDiscountPricingInput,
  getShippingFeeForDiscountPreview,
  mapCartItemToOrderItemInput,
  mapDeliveryMethodToOrderType,
} from "../../../utils/discountPreviewPayload";
import "./OrderSummaryModal.scss";

const ORDER_VAT_RATE = 0.1;
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

const CREATE_CHECKOUT_ORDERS = gql`
  mutation CreateCheckoutOrders($input: CreateCheckoutOrdersInput!) {
    createCheckoutOrders(input: $input) {
      checkout { checkoutCode grandTotal orderIds }
      orders {
        id
        orderCode
        parentOrderCode
        restaurantId
        orderType
        totals { grandTotal }
        currentStatus
      }
    }
  }
`;

const CREATE_CUSTOMER_TRANSFER_PAYMENT = gql`
  mutation CreateCustomerTransferPayment($input: CreateCustomerTransferPaymentInput!) {
    createCustomerTransferPayment(input: $input) {
      id
      amount
      currency
      reference
      status
      callbackStatus
      metadata
      expiresAt
      transfer { status rejectReason proofImages submittedAt verifiedAt rejectedAt }
    }
  }
`;

const SUBMIT_TRANSFER_PROOF = gql`
  mutation SubmitTransferProof($input: SubmitTransferProofInput!) {
    submitTransferProof(input: $input) {
      id
      status
      callbackStatus
      expiresAt
      transfer { status rejectReason proofImages submittedAt verifiedAt rejectedAt }
    }
  }
`;

const SYNC_PAYMENT_STATUS = gql`
  mutation SyncPaymentStatus($paymentId: ID!) {
    syncPaymentStatus(paymentId: $paymentId) {
      id
      status
      callbackStatus
      expiresAt
      transfer { status rejectReason verifiedAt rejectedAt }
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

const isTransferSessionExpired = (session = {}) => {
  if (!session?.expiresAt) return false;
  const expiresAtMs = new Date(session.expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now();
};

const resolveTransferStatus = (session = {}) => {
  if (isTransferSessionExpired(session) && String(session?.status || "").toLowerCase() !== "success") return "EXPIRED";
  if (String(session?.status || "").toLowerCase() === "success") return "VERIFIED";
  return String(session?.transfer?.status || "INSTRUCTIONS_SHOWN").toUpperCase();
};

const shouldPollTransferSession = (session = {}) => {
  const status = resolveTransferStatus(session);
  return !["VERIFIED", "REJECTED", "FAILED", "EXPIRED"].includes(status);
};

const transferStatusLabel = {
  INSTRUCTIONS_SHOWN: "Chưa gửi bằng chứng",
  SUBMITTED: "Đã gửi bằng chứng, đang chờ xác minh",
  VERIFYING: "Đang xác minh",
  VERIFIED: "Đã xác minh thanh toán",
  REJECTED: "Cần gửi lại bằng chứng",
  FAILED: "Thanh toán chưa hợp lệ",
  EXPIRED: "Phiên thanh toán hết hạn",
};

export default function OrderSummaryTransferModal({ isOpen, onClose, items = [], onSuccess }) {
  const { user } = useContext(AuthContext) || {};
  const userId = user?.id || user?._id;
  const [shipping, setShipping] = useState(() => defaultShipping(user));
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [view, setView] = useState("summary");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [transferSessions, setTransferSessions] = useState([]);
  const [proofBySession, setProofBySession] = useState({});
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState("");
  const transferSessionIdsRef = useRef(new Set());

  const [createCheckoutOrders] = useMutation(CREATE_CHECKOUT_ORDERS);
  const [createCustomerTransferPayment] = useMutation(CREATE_CUSTOMER_TRANSFER_PAYMENT);
  const [submitTransferProof] = useMutation(SUBMIT_TRANSFER_PROOF);
  const [syncPaymentStatus] = useMutation(SYNC_PAYMENT_STATUS);

  const totals = useMemo(() => calcTotal(items), [items]);

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
      return {
        ...session,
        ...updated,
        id: session.id || updated.id || updated.paymentSessionId,
        status: updated.status || session.status,
        transfer: { ...(session.transfer || {}), ...(updated.transfer || {}) },
      };
    }));
  }, []);

  useEffect(() => {
    if (!isOpen || view !== "transfer" || !userId || !transferSessions.length) return undefined;
    const token = getToken();
    if (!token) return undefined;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      auth: { token },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    const handlePaymentEvent = (event) => {
      const paymentSessionId = String(event?.paymentSessionId || "");
      if (!paymentSessionId || !transferSessionIdsRef.current.has(paymentSessionId)) return;
      mergeTransferSessionUpdate(event);
    };

    socket.on("connect", () => {
      socket.emit("joinUserChannel", String(userId), (ack) => {
        if (!ack?.ok) {
          console.warn("[SOCKET.IO] joinUserChannel failed:", ack?.code || "UNKNOWN");
        }
      });
    });
    socket.on("paymentEvents", handlePaymentEvent);
    socket.on("connect_error", (err) => {
      console.warn("[SOCKET.IO] Payment channel connection error:", err?.message || err);
    });

    return () => {
      socket.off("paymentEvents", handlePaymentEvent);
      socket.emit("leaveUserChannel", String(userId));
      socket.disconnect();
    };
  }, [isOpen, view, userId, transferSessions.length, mergeTransferSessionUpdate]);

  useEffect(() => {
    if (!isOpen || view !== "transfer" || !transferSessions.length) return undefined;
    const pendingSessionIds = transferSessions
      .filter(shouldPollTransferSession)
      .map((session) => String(session?.id || session?._id || ""))
      .filter(Boolean);

    if (!pendingSessionIds.length) return undefined;

    const intervalId = window.setInterval(() => {
      pendingSessionIds.forEach((sessionId) => {
        syncPaymentStatus({ variables: { paymentId: sessionId } })
          .then((result) => mergeTransferSessionUpdate(result?.data?.syncPaymentStatus))
          .catch(() => {});
      });
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [isOpen, view, transferSessions, syncPaymentStatus, mergeTransferSessionUpdate]);

  const createCheckout = async (method) => {
    const checkoutItems = items.map((item) => mapCartItemToOrderItemInput(item, { includeCartHoldRef: true }));
    const result = await createCheckoutOrders({
      variables: {
        input: {
          orderType: mapDeliveryMethodToOrderType(shipping.deliveryMethod),
          items: checkoutItems,
          shipping,
          paymentMethod: method,
          pricing: buildDiscountPricingInput({
            taxRate: ORDER_VAT_RATE,
            serviceRate: 0,
            shippingFee: getShippingFeeForDiscountPreview({ deliveryMethod: shipping.deliveryMethod, shippingFee: shipping.shippingFee }),
          }),
          idempotencyKey: `checkout-${Date.now()}`,
          note: shipping.note || undefined,
        },
      },
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
      const nextReceipt = {
        checkoutCode: checkout?.checkoutCode,
        orderIds: checkout?.orderIds || orders.map((order) => order.id),
        orderCodes: orders.map((order) => order.orderCode).filter(Boolean),
        orders,
        totalPaid: checkout?.grandTotal || totals.total,
        paymentMethod,
      };
      setReceipt(nextReceipt);
      onSuccess?.();

      if (paymentMethod === "transfer") {
        const sessions = [];
        for (const group of groupByRestaurant(orders)) {
          const payment = await createCustomerTransferPayment({
            variables: {
              input: {
                restaurantId: group.restaurantId,
                orderIds: group.orders.map((order) => order.id),
              },
            },
          });
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

  const handleProofChange = (sessionId, field, value) => {
    setProofBySession((prev) => ({ ...prev, [sessionId]: { ...(prev[sessionId] || {}), [field]: value } }));
  };

  const handleSubmitProof = async (sessionId) => {
    const form = proofBySession[sessionId] || {};
    const proofImages = String(form.images || "").split(/\n|,/).map((value) => value.trim()).filter(Boolean);
    if (!proofImages.length) {
      setError("Vui lòng nhập ít nhất một URL ảnh bằng chứng chuyển khoản.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await submitTransferProof({
        variables: { input: { paymentSessionId: sessionId, proofImages, proofNote: form.note || "" } },
      });
      const updated = result?.data?.submitTransferProof;
      mergeTransferSessionUpdate(updated);
      setProofBySession((prev) => ({
        ...prev,
        [sessionId]: { images: "", note: "" },
      }));
    } catch (err) {
      setError(err?.message || "Không thể gửi bằng chứng chuyển khoản.");
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async (sessionId) => {
    setLoading(true);
    try {
      const result = await syncPaymentStatus({ variables: { paymentId: sessionId } });
      const updated = result?.data?.syncPaymentStatus;
      mergeTransferSessionUpdate(updated);
    } finally {
      setLoading(false);
    }
  };

  const renderSummary = () => (
    <>
      <div className="section">
        <h3>Thông tin nhận hàng</h3>
        <input value={shipping.fullName} onChange={(e) => setShipping({ ...shipping, fullName: e.target.value })} placeholder="Họ tên" />
        <input value={shipping.phone} onChange={(e) => setShipping({ ...shipping, phone: e.target.value })} placeholder="Số điện thoại" />
        <input value={shipping.email} onChange={(e) => setShipping({ ...shipping, email: e.target.value })} placeholder="Email" />
        <input value={shipping.address} onChange={(e) => setShipping({ ...shipping, address: e.target.value })} placeholder="Địa chỉ giao hàng" />
        <textarea value={shipping.note} onChange={(e) => setShipping({ ...shipping, note: e.target.value })} placeholder="Ghi chú" />
      </div>

      <div className="section">
        <h3>Món đã chọn</h3>
        {items.map((item) => (
          <div className="price-row" key={item.id || item.cartItemId || item.name}>
            <span>{item.name} × {item.quantity || 1}</span>
            <strong>{formatCurrency((Number(item.price || 0) + Number(item.modifiersPrice || 0)) * Number(item.quantity || 1))}</strong>
          </div>
        ))}
      </div>

      <div className="section">
        <h3>Phương thức thanh toán</h3>
        <div className="payment-methods-grid">
          {[
            ["cash", "Tiền mặt", "Thanh toán khi nhận hàng"],
            ["transfer", "Chuyển khoản / QR", "Gửi bằng chứng để nhà hàng xác minh"],
            ["wallet", "Ví nội bộ", "Thanh toán bằng số dư ví"],
          ].map(([key, title, desc]) => (
            <button key={key} type="button" className={`payment-method-card ${paymentMethod === key ? "selected" : ""}`} onClick={() => setPaymentMethod(key)}>
              <div className="payment-info"><h4>{title}</h4><p>{desc}</p></div>
            </button>
          ))}
        </div>
      </div>

      <div className="section">
        <div className="price-row"><span>Tạm tính</span><strong>{formatCurrency(totals.subtotal + totals.modifiers)}</strong></div>
        <div className="price-row"><span>VAT 10%</span><strong>{formatCurrency(totals.tax)}</strong></div>
        <div className="price-row total"><span>Tổng</span><strong>{formatCurrency(totals.total)}</strong></div>
      </div>
    </>
  );

  const renderTransfer = () => (
    <div className="section">
      <h3>Chuyển khoản đang chờ xác minh</h3>
      <p>Đơn đã được tạo. Vui lòng chuyển khoản đúng nội dung rồi gửi ảnh bằng chứng. Đơn chỉ được xem là đã thanh toán sau khi nhà hàng xác minh.</p>
      {transferSessions.map((session) => {
        const bank = session?.metadata?.bankTransfer || {};
        const status = resolveTransferStatus(session);
        const needsResubmit = status === "REJECTED";
        const canSubmitProof = status !== "VERIFIED" && status !== "SUBMITTED" && status !== "EXPIRED";
        const sessionId = String(session?.id || session?._id || "");
        const expiresAt = session?.expiresAt ? new Date(session.expiresAt) : null;
        const copyButton = (value, key) => (
          <button type="button" className="btn btn--secondary btn--xs" onClick={() => copyToClipboard(value, `${sessionId}:${key}`)}>
            {copiedField === `${sessionId}:${key}` ? "Đã sao chép" : "Sao chép"}
          </button>
        );
        return (
          <div className="restaurant-group-card" key={sessionId}>
            <h4>Mã chuyển khoản: {session.reference}</h4>
            <ol className="transfer-steps">
              <li>Xác nhận đơn hàng</li>
              <li>Quét QR hoặc chuyển đúng số tiền</li>
              <li>Gửi bằng chứng thanh toán</li>
              <li>Chờ nhà hàng xác minh realtime</li>
            </ol>
            <p>Số tiền: <strong>{formatCurrency(session.amount)}</strong> {copyButton(session.amount, "amount")}</p>
            {bank.qrImageUrl && <img className="transfer-qr-image" src={bank.qrImageUrl} alt={`QR chuyển khoản ${session.reference}`} loading="lazy" />}
            <p>Ngân hàng: {bank.bankName || "Đang cập nhật"}</p>
            <p>Số tài khoản: <strong>{bank.bankAccountNumber || "Đang cập nhật"}</strong> {copyButton(bank.bankAccountNumber, "account")}</p>
            <p>Chủ tài khoản: {bank.accountName || "Đang cập nhật"}</p>
            <p>Nội dung: <strong>{bank.transferContent || session.reference}</strong> {copyButton(bank.transferContent || session.reference, "content")}</p>
            <p>Tham chiếu: <strong>{session.reference}</strong> {copyButton(session.reference, "reference")}</p>
            {expiresAt && <p>Hạn thanh toán: <strong>{expiresAt.toLocaleString("vi-VN")}</strong></p>}
            <p>Trạng thái: <strong>{transferStatusLabel[status] || status}</strong></p>
            {status === "EXPIRED" && <p className="order-summary-error">Phiên thanh toán đã hết hạn. Vui lòng tạo đơn hoặc phiên thanh toán mới.</p>}
            {needsResubmit && (
              <p className="order-summary-error">
                Chưa thể xác minh bằng chứng{session.transfer?.rejectReason ? `: ${session.transfer.rejectReason}` : "."} Vui lòng gửi lại ảnh rõ hơn hoặc đúng thông tin chuyển khoản.
              </p>
            )}
            {canSubmitProof && (
              <>
                <textarea placeholder={needsResubmit ? "Dán URL ảnh bằng chứng mới, mỗi dòng một ảnh" : "Dán URL ảnh bằng chứng, mỗi dòng một ảnh. Ví dụ: https://.../bien-lai.jpg"} value={proofBySession[sessionId]?.images || ""} onChange={(e) => handleProofChange(sessionId, "images", e.target.value)} />
                {!!proofBySession[sessionId]?.images && (
                  <div className="transfer-proof-preview">
                    {String(proofBySession[sessionId].images).split(/\n|,/).map((src) => src.trim()).filter(Boolean).map((src) => (
                      <img key={src} src={src} alt="Xem trước bằng chứng chuyển khoản" loading="lazy" />
                    ))}
                  </div>
                )}
                <textarea placeholder="Ghi chú chuyển khoản" value={proofBySession[sessionId]?.note || ""} onChange={(e) => handleProofChange(sessionId, "note", e.target.value)} />
                <button className="btn btn--success" disabled={loading} onClick={() => handleSubmitProof(sessionId)}>{needsResubmit ? "Gửi lại bằng chứng chuyển khoản" : "Gửi bằng chứng chuyển khoản"}</button>
              </>
            )}
            {status === "SUBMITTED" && <p>Đã gửi bằng chứng. Đang chờ nhà hàng xác minh.</p>}
            <button className="btn btn--secondary" disabled={loading} onClick={() => refreshSession(sessionId)}>Kiểm tra trạng thái</button>
          </div>
        );
      })}
    </div>
  );

  const renderSuccess = () => (
    <div className="section text-center">
      <h3>Đặt đơn thành công</h3>
      <p>Mã đơn: {receipt?.checkoutCode}</p>
      <p>Tổng tiền: {formatCurrency(receipt?.totalPaid || 0)}</p>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Xác nhận đơn hàng" size="lg" className="order-summary-modal">
      <div className="order-summary-wrapper">
        {!!error && <div className="order-summary-error" role="alert">{error}</div>}
        <div className="order-summary-content">
          {view === "summary" && renderSummary()}
          {view === "transfer" && renderTransfer()}
          {view === "success" && renderSuccess()}
        </div>
        <Modal.Footer>
          <button className="btn btn--secondary" onClick={onClose}>Đóng</button>
          {view === "summary" && <button className="btn btn--success" disabled={loading} onClick={handleConfirm}>{loading ? "Đang xử lý..." : "Xác nhận đặt hàng"}</button>}
          {view !== "summary" && <button className="btn btn--primary" onClick={onClose}>Hoàn tất</button>}
        </Modal.Footer>
      </div>
    </Modal>
  );
}
