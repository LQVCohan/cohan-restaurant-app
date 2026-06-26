import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { CheckCircle2, Clock3, ImageIcon, RefreshCw, SearchCheck, XCircle } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { hasPermission } from "@/utils/frontendPermissionAccess";
import "../Finance/FinanceDashboard.scss";
import "./TransferPaymentReviewPagePolish.scss";

const TRANSFER_PAYMENT_FIELDS = `
  id
  restaurantId
  reference
  amount
  currency
  status
  callbackStatus
  providerTransactionId
  metadata
  createdAt
  updatedAt
  transfer {
    status
    submittedAt
    proofImages
    proofNote
    customerClaimedPaidAt
    verifiedAt
    rejectedAt
    rejectReason
    providerTransactionId
    receivedAmount
    varianceAmount
  }
`;

const GET_TRANSFER_PAYMENT_QUEUE = gql`
  query TransferPaymentQueue($restaurantId: ID!, $status: TransferVerificationStatus, $statuses: [TransferVerificationStatus!], $limit: Int) {
    transferPaymentQueue(restaurantId: $restaurantId, status: $status, statuses: $statuses, limit: $limit) {
      ${TRANSFER_PAYMENT_FIELDS}
    }
  }
`;

const VERIFY_TRANSFER_PAYMENT = gql`
  mutation VerifyTransferPayment($input: VerifyTransferPaymentInput!) {
    verifyTransferPayment(input: $input) {
      ${TRANSFER_PAYMENT_FIELDS}
    }
  }
`;

const REJECT_TRANSFER_PAYMENT = gql`
  mutation RejectTransferPayment($input: RejectTransferPaymentInput!) {
    rejectTransferPayment(input: $input) {
      ${TRANSFER_PAYMENT_FIELDS}
    }
  }
`;

const POLL_INTERVAL_MS = 15000;
const REVIEW_FILTERS = [
  { value: "ACTIONABLE", label: "Cần xử lý", statuses: ["SUBMITTED", "VERIFYING"] },
  { value: "SUBMITTED", label: "Chờ xác minh" },
  { value: "VERIFYING", label: "Đang kiểm tra" },
  { value: "REJECTED", label: "Cần gửi lại" },
  { value: "VERIFIED", label: "Đã xác minh" },
  { value: "FAILED", label: "Không hợp lệ" },
  { value: "EXPIRED", label: "Hết hạn" },
  { value: "ALL", label: "Tất cả" },
];

const transferStatusLabel = {
  INSTRUCTIONS_SHOWN: "Chưa gửi bằng chứng",
  SUBMITTED: "Chờ xác minh",
  VERIFYING: "Đang kiểm tra",
  VERIFIED: "Đã xác minh",
  REJECTED: "Cần gửi lại bằng chứng",
  FAILED: "Không hợp lệ",
  EXPIRED: "Hết hạn",
};

const transferStatusTone = {
  SUBMITTED: "warning",
  VERIFYING: "info",
  VERIFIED: "success",
  REJECTED: "danger",
  FAILED: "danger",
  EXPIRED: "muted",
  INSTRUCTIONS_SHOWN: "muted",
};

const formatCurrency = (value, currency = "VND") =>
  Number(value || 0).toLocaleString("vi-VN", { style: "currency", currency });
const formatDate = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "Chưa gửi bằng chứng");
const formatTime = (value) => (value ? value.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "Chưa có dữ liệu");
const resolveStatus = (payment = {}) => String(payment?.transfer?.status || payment?.status || "SUBMITTED").toUpperCase();
const getOrderCodesText = (payment = {}) => {
  const codes = payment?.metadata?.orderCodes;
  return Array.isArray(codes) ? codes.filter(Boolean).join(", ") : "";
};
const getCustomerName = (payment = {}) => payment?.metadata?.customerName || payment?.metadata?.customer?.name || "Khách hàng";
const getRestaurantName = (payment = {}, restaurants = []) => {
  const fromMeta = payment?.metadata?.restaurantName;
  if (fromMeta) return fromMeta;
  return restaurants.find((restaurant) => String(restaurant.id) === String(payment.restaurantId))?.name || "Nhà hàng";
};

function TransferDecisionModal({ mode, payment, submitting, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [receivedAmount, setReceivedAmount] = useState(payment?.amount || "");
  const [providerTransactionId, setProviderTransactionId] = useState(payment?.providerTransactionId || "");
  const isVerify = mode === "verify";
  const valid = isVerify ? Number(receivedAmount) > 0 : reason.trim().length >= 3;

  return (
    <div className="transfer-review-modal-backdrop" role="dialog" aria-modal="true">
      <div className="transfer-review-modal-card">
        <button className="transfer-review-modal-close" type="button" onClick={onClose} aria-label="Đóng">×</button>
        <span className="transfer-review-modal-eyebrow">{isVerify ? "Xác minh" : "Từ chối"}</span>
        <h3>{isVerify ? "Xác minh chuyển khoản" : "Từ chối bằng chứng chuyển khoản"}</h3>
        <div className="transfer-review-modal-summary">
          <span>{payment?.reference}</span>
          <strong>{formatCurrency(payment?.amount, payment?.currency || "VND")}</strong>
        </div>
        {isVerify ? (
          <>
            <label className="transfer-review-field">
              <span>Số tiền thực nhận</span>
              <input type="number" min="1" value={receivedAmount} onChange={(event) => setReceivedAmount(event.target.value)} />
            </label>
            <label className="transfer-review-field">
              <span>Mã giao dịch ngân hàng</span>
              <input value={providerTransactionId} onChange={(event) => setProviderTransactionId(event.target.value)} placeholder="Nhập mã nếu có" />
            </label>
            <label className="transfer-review-field">
              <span>Ghi chú xác minh</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Đã khớp sao kê Vietcombank" />
            </label>
          </>
        ) : (
          <>
            <label className="transfer-review-field">
              <span>Lý do từ chối *</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Ảnh mờ, thiếu nội dung chuyển khoản hoặc số tiền chưa khớp" />
            </label>
            <p className="transfer-review-helper">Khách sẽ thấy lý do này để gửi lại bằng chứng đúng hơn.</p>
          </>
        )}
        <button
          type="button"
          className={isVerify ? "transfer-review-primary" : "transfer-review-danger-soft"}
          disabled={!valid || submitting}
          onClick={() => onSubmit({ receivedAmount: Number(receivedAmount || 0), providerTransactionId, reason })}
        >
          {submitting ? "Đang xử lý..." : isVerify ? "Xác minh & mở đơn" : "Từ chối bằng chứng"}
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="transfer-review-detail-row">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function TransferPaymentCard({ payment, canWrite, restaurants, onVerify, onReject, onPreview }) {
  const bank = payment?.metadata?.bankTransfer || {};
  const transfer = payment?.transfer || {};
  const proofImages = Array.isArray(transfer.proofImages) ? transfer.proofImages.filter(Boolean) : [];
  const status = resolveStatus(payment);
  const orderCodesText = getOrderCodesText(payment);
  const submittedAtText = formatDate(transfer.submittedAt || payment.updatedAt);
  const canDecide = canWrite && ["SUBMITTED", "VERIFYING"].includes(status);
  const receivedAmount = transfer.receivedAmount == null ? null : Number(transfer.receivedAmount || 0);
  const varianceAmount = transfer.varianceAmount == null ? null : Number(transfer.varianceAmount || 0);

  return (
    <article className={`transfer-review-card transfer-review-card--${status.toLowerCase()}`}>
      <header className="transfer-review-card-header">
        <div>
          <p className="transfer-review-reference">{payment.reference}</p>
          <h3>{formatCurrency(payment.amount, payment.currency || "VND")}</h3>
          <p className="transfer-review-subtitle">
            {orderCodesText || "Chưa có mã đơn"} · {submittedAtText}
          </p>
        </div>

        <span className={`transfer-review-status transfer-review-status--${transferStatusTone[status] || "muted"}`}>
          {transferStatusLabel[status] || status}
        </span>
      </header>

      <div className="transfer-review-card-body">
        <div className="transfer-review-detail-list">
          <DetailRow label="Khách hàng" value={getCustomerName(payment)} />
          <DetailRow label="Nhà hàng" value={getRestaurantName(payment, restaurants)} />
          <DetailRow label="Nội dung chuyển khoản" value={bank.transferContent || payment.reference} />
          <DetailRow label="Ghi chú khách gửi" value={transfer.proofNote || "Không có ghi chú"} />
          <DetailRow label="Mã giao dịch" value={transfer.providerTransactionId || payment.providerTransactionId || "Chưa có"} />
          {receivedAmount != null && <DetailRow label="Tiền thực nhận" value={formatCurrency(receivedAmount, payment.currency || "VND")} />}
          {varianceAmount != null && <DetailRow label="Chênh lệch" value={formatCurrency(varianceAmount, payment.currency || "VND")} />}
        </div>
        <div className="transfer-review-proof-panel">
          <div className="transfer-review-proof-heading">
            <ImageIcon size={16} />
            <span>{proofImages.length} ảnh bằng chứng</span>
          </div>
          <div className="transfer-review-proof-list">
            {proofImages.length ? proofImages.map((url, index) => (
              <button type="button" className="transfer-review-proof-thumb" onClick={() => onPreview(url)} key={`${url}-${index}`}>
                <img src={url} alt={`Bằng chứng chuyển khoản ${index + 1}`} loading="lazy" />
              </button>
            )) : <p className="transfer-review-empty-proof">Chưa có ảnh bằng chứng.</p>}
          </div>
        </div>
      </div>

      <footer className="transfer-review-card-actions">
        {canDecide && (
          <>
            <button type="button" className="transfer-review-primary" onClick={() => onVerify(payment)}>Xác minh thanh toán</button>
            <button type="button" className="transfer-review-danger-soft" onClick={() => onReject(payment)}>Từ chối bằng chứng</button>
          </>
        )}
        {status === "REJECTED" && <p>Khách có thể gửi lại bằng chứng.</p>}
        {status === "VERIFIED" && <p>Đơn đã được mở cho nhà hàng xử lý.</p>}
        {["FAILED", "EXPIRED"].includes(status) && <p>{transferStatusLabel[status] || status}</p>}
      </footer>
    </article>
  );
}

export default function TransferPaymentReviewPage() {
  const { restaurants = [], user } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState(restaurants?.[0]?.id || "");
  const [activeFilter, setActiveFilter] = useState("ACTIONABLE");
  const [decision, setDecision] = useState(null);
  const [previewImage, setPreviewImage] = useState("");
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const canWrite = hasPermission(user, "payment.write");

  const selectedFilter = REVIEW_FILTERS.find((filter) => filter.value === activeFilter) || REVIEW_FILTERS[0];
  const queryStatus = selectedFilter.statuses || selectedFilter.value === "ALL" ? null : selectedFilter.value;
  const queryStatuses = selectedFilter.statuses || null;
  const variables = useMemo(() => ({ restaurantId, status: queryStatus, statuses: queryStatuses, limit: 50 }), [restaurantId, queryStatus, queryStatuses]);
  const { data, loading, error, refetch } = useQuery(GET_TRANSFER_PAYMENT_QUEUE, {
    skip: !restaurantId,
    variables,
    fetchPolicy: "network-only",
    pollInterval: restaurantId ? POLL_INTERVAL_MS : 0,
    notifyOnNetworkStatusChange: true,
  });
  const mutationOptions = { onCompleted: () => refetch() };
  const [verifyTransferPayment] = useMutation(VERIFY_TRANSFER_PAYMENT, mutationOptions);
  const [rejectTransferPayment] = useMutation(REJECT_TRANSFER_PAYMENT, mutationOptions);

  const rows = data?.transferPaymentQueue || [];
  const hasLoadedQueue = Boolean(data?.transferPaymentQueue);
  const initialLoading = loading && !hasLoadedQueue;
  const refreshing = loading && hasLoadedQueue;
  const summary = useMemo(() => rows.reduce((acc, payment) => {
    const status = resolveStatus(payment);
    acc.total += 1;
    if (["SUBMITTED", "VERIFYING"].includes(status)) acc.actionable += 1;
    if (status === "VERIFYING") acc.verifying += 1;
    if (status === "REJECTED") acc.rejected += 1;
    if (status === "VERIFIED") acc.verified += 1;
    return acc;
  }, { total: 0, actionable: 0, verifying: 0, rejected: 0, verified: 0 }), [rows]);

  useEffect(() => {
    if (data?.transferPaymentQueue) setLastRefreshedAt(new Date());
  }, [data?.transferPaymentQueue]);

  const handleManualRefresh = async () => {
    await refetch();
    setLastRefreshedAt(new Date());
  };

  const submitDecision = async ({ receivedAmount, providerTransactionId, reason }) => {
    if (!decision?.payment?.id) return;
    setSubmitting(true);
    setNotice(null);
    try {
      if (decision.mode === "verify") {
        await verifyTransferPayment({ variables: { input: { paymentSessionId: decision.payment.id, receivedAmount, providerTransactionId, note: reason || "Xác minh từ màn hình duyệt chuyển khoản" } } });
        setNotice({ type: "success", text: "Đã xác minh chuyển khoản và cập nhật danh sách." });
      } else {
        await rejectTransferPayment({ variables: { input: { paymentSessionId: decision.payment.id, reason: reason.trim() } } });
        setNotice({ type: "success", text: "Đã từ chối bằng chứng chuyển khoản và cập nhật danh sách." });
      }
      setDecision(null);
    } catch (err) {
      setNotice({ type: "error", text: err?.message || "Không thể cập nhật giao dịch chuyển khoản." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="transfer-review-page transfer-review-page--polished">
      <header className="transfer-review-header">
        <div className="transfer-review-header-copy">
          <p className="transfer-review-eyebrow">Thanh toán & đối soát</p>
          <h2>Thanh toán QR / Chuyển khoản</h2>
          <p>Xác minh bằng chứng chuyển khoản, xử lý lệch tiền và mở đơn cho nhà hàng ngay sau khi thanh toán khớp.</p>
          <div className="transfer-review-context-pills">
            <span>{restaurants.find((restaurant) => String(restaurant.id) === String(restaurantId))?.name || "Chưa chọn nhà hàng"}</span>
            <span>Tự làm mới mỗi 15 giây</span>
            <span>Cập nhật: {formatTime(lastRefreshedAt)}{refreshing ? " · đang làm mới" : ""}</span>
          </div>
        </div>

        <div className="transfer-review-header-actions">
          {restaurants.length > 1 && (
            <select value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)} aria-label="Chọn nhà hàng">
              {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </select>
          )}
          <button className="transfer-review-refresh" type="button" onClick={handleManualRefresh} disabled={initialLoading}>
            <RefreshCw size={16} /> Làm mới
          </button>
        </div>
      </header>

      <div className="transfer-review-summary-strip" aria-label="Tổng quan chuyển khoản">
        <article><Clock3 size={18} /><span>Cần xử lý</span><strong>{summary.actionable}</strong></article>
        <article><SearchCheck size={18} /><span>Đang kiểm tra</span><strong>{summary.verifying}</strong></article>
        <article><XCircle size={18} /><span>Cần gửi lại</span><strong>{summary.rejected}</strong></article>
        <article><CheckCircle2 size={18} /><span>Đã xác minh</span><strong>{summary.verified}</strong></article>
      </div>

      <div className="transfer-review-tabs">
        {REVIEW_FILTERS.map((filter) => (
          <button key={filter.value} type="button" className={activeFilter === filter.value ? "is-active" : ""} onClick={() => setActiveFilter(filter.value)}>
            {filter.label}
          </button>
        ))}
      </div>

      {notice && <div className={notice.type === "success" ? "transfer-review-notice success" : "transfer-review-notice error"}>{notice.text}</div>}
      {!canWrite && <div className="transfer-review-notice warning">Bạn có quyền xem danh sách, nhưng chưa có quyền xác minh hoặc từ chối chuyển khoản.</div>}
      {error && <div className="transfer-review-notice error">Không thể tải danh sách chuyển khoản. Vui lòng thử lại.</div>}
      {initialLoading && <div className="transfer-review-state transfer-review-state--loading">Đang tải danh sách chuyển khoản...</div>}
      {!initialLoading && !error && rows.length === 0 && <div className="transfer-review-state">Không có giao dịch chuyển khoản trong bộ lọc này.</div>}

      <div className="transfer-review-content">
        {rows.map((payment) => (
          <TransferPaymentCard
            key={payment.id}
            payment={payment}
            canWrite={canWrite}
            restaurants={restaurants}
            onVerify={(item) => setDecision({ mode: "verify", payment: item })}
            onReject={(item) => setDecision({ mode: "reject", payment: item })}
            onPreview={setPreviewImage}
          />
        ))}
      </div>

      {previewImage && (
        <div className="transfer-proof-lightbox" role="dialog" aria-modal="true">
          <button type="button" onClick={() => setPreviewImage("")}>Đóng</button>
          <img src={previewImage} alt="Xem bằng chứng chuyển khoản" />
        </div>
      )}
      {decision && <TransferDecisionModal mode={decision.mode} payment={decision.payment} submitting={submitting} onClose={() => !submitting && setDecision(null)} onSubmit={submitDecision} />}
    </section>
  );
}
