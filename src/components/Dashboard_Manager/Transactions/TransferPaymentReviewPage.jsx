import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ImageIcon,
  RefreshCw,
  SearchCheck,
  X,
  XCircle,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import { hasPermission } from "@/utils/frontendPermissionAccess";
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
    rejectedCount
    maxRejectedCount
  }
`;

export const GET_TRANSFER_PAYMENT_QUEUE = gql`
  query TransferPaymentQueue(
    $restaurantId: ID!
    $status: TransferVerificationStatus
    $statuses: [TransferVerificationStatus!]
    $limit: Int
  ) {
    transferPaymentQueue(
      restaurantId: $restaurantId
      status: $status
      statuses: $statuses
      limit: $limit
    ) {
      ${TRANSFER_PAYMENT_FIELDS}
    }
    transferPaymentQueueSummary(restaurantId: $restaurantId) {
      total
      actionable
      submitted
      verifying
      rejected
      verified
      failed
      expired
    }
  }
`;

export const VERIFY_TRANSFER_PAYMENT = gql`
  mutation VerifyTransferPayment($input: VerifyTransferPaymentInput!) {
    verifyTransferPayment(input: $input) {
      ${TRANSFER_PAYMENT_FIELDS}
    }
  }
`;

export const REJECT_TRANSFER_PAYMENT = gql`
  mutation RejectTransferPayment($input: RejectTransferPaymentInput!) {
    rejectTransferPayment(input: $input) {
      ${TRANSFER_PAYMENT_FIELDS}
    }
  }
`;

const POLL_INTERVAL_MS = 15000;
export const ALL_REVIEW_STATUSES = ["SUBMITTED", "VERIFYING", "REJECTED", "VERIFIED", "FAILED", "EXPIRED"];
export const REVIEW_FILTERS = [
  { value: "ACTIONABLE", label: "Cần xử lý", statuses: ["SUBMITTED", "VERIFYING"], summaryKey: "actionable" },
  { value: "SUBMITTED", label: "Chờ xác minh", summaryKey: "submitted" },
  { value: "VERIFYING", label: "Đang kiểm tra", summaryKey: "verifying" },
  { value: "REJECTED", label: "Cần gửi lại", summaryKey: "rejected" },
  { value: "VERIFIED", label: "Đã xác minh", summaryKey: "verified" },
  { value: "FAILED", label: "Không hợp lệ", summaryKey: "failed" },
  { value: "EXPIRED", label: "Hết hạn", summaryKey: "expired" },
  { value: "ALL", label: "Tất cả", statuses: ALL_REVIEW_STATUSES, summaryKey: "total" },
];

const EMPTY_SUMMARY = {
  total: 0,
  actionable: 0,
  submitted: 0,
  verifying: 0,
  rejected: 0,
  verified: 0,
  failed: 0,
  expired: 0,
};

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

const formatCurrency = (value, currency = "VND") => {
  try {
    return Number(value || 0).toLocaleString("vi-VN", { style: "currency", currency: currency || "VND" });
  } catch {
    return `${Number(value || 0).toLocaleString("vi-VN")} ${currency || "VND"}`;
  }
};

const formatDate = (value, fallback = "Chưa có dữ liệu") => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString("vi-VN");
};

const formatTime = (value) => {
  if (!value) return "Chưa tải";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa tải"
    : date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
};

const getRestaurantId = (restaurant) => String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? "");
const resolveStatus = (payment = {}) => String(payment?.transfer?.status || payment?.status || "SUBMITTED").toUpperCase();
const getOrderCodesText = (payment = {}) => {
  const codes = payment?.metadata?.orderCodes;
  return Array.isArray(codes) ? codes.filter(Boolean).join(", ") : "";
};
const getCustomerName = (payment = {}) => payment?.metadata?.customerName || payment?.metadata?.customer?.name || "Khách hàng";
const getRestaurantName = (payment = {}, restaurants = []) => {
  const fromMeta = payment?.metadata?.restaurantName;
  if (fromMeta) return fromMeta;
  return restaurants.find((restaurant) => getRestaurantId(restaurant) === String(payment.restaurantId))?.name || "Nhà hàng";
};

function TransferDecisionModal({ mode, payment, submitting, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [receivedAmount, setReceivedAmount] = useState(payment?.amount || "");
  const [providerTransactionId, setProviderTransactionId] = useState(payment?.providerTransactionId || "");
  const isVerify = mode === "verify";
  const valid = isVerify ? Number(receivedAmount) > 0 : reason.trim().length >= 3;
  const titleId = `transfer-review-${mode}-title`;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, submitting]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!valid || submitting) return;
    onSubmit({
      receivedAmount: Number(receivedAmount || 0),
      providerTransactionId: providerTransactionId.trim(),
      reason: reason.trim(),
    });
  };

  return (
    <div
      className="transfer-review-modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}
    >
      <form
        className="transfer-review-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={handleSubmit}
      >
        <button className="transfer-review-modal-close" type="button" onClick={onClose} disabled={submitting} aria-label="Đóng">
          <X size={18} />
        </button>
        <span className="transfer-review-modal-eyebrow">{isVerify ? "Xác minh thanh toán" : "Yêu cầu gửi lại"}</span>
        <h3 id={titleId}>{isVerify ? "Đối chiếu chuyển khoản" : "Từ chối bằng chứng"}</h3>
        <div className="transfer-review-modal-summary">
          <span>{payment?.reference}</span>
          <strong>{formatCurrency(payment?.amount, payment?.currency || "VND")}</strong>
        </div>

        {isVerify ? (
          <>
            <label className="transfer-review-field">
              <span>Số tiền thực nhận</span>
              <input
                type="number"
                min="1"
                inputMode="decimal"
                value={receivedAmount}
                onChange={(event) => setReceivedAmount(event.target.value)}
                autoFocus
              />
            </label>
            <label className="transfer-review-field">
              <span>Mã giao dịch ngân hàng</span>
              <input
                value={providerTransactionId}
                onChange={(event) => setProviderTransactionId(event.target.value)}
                placeholder="Nhập mã nếu có"
              />
            </label>
            <label className="transfer-review-field">
              <span>Ghi chú xác minh</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ví dụ: Đã khớp sao kê ngân hàng"
              />
            </label>
          </>
        ) : (
          <>
            <label className="transfer-review-field">
              <span>Lý do từ chối *</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Ví dụ: Ảnh mờ, thiếu nội dung hoặc số tiền chưa khớp"
                autoFocus
                required
                minLength={3}
              />
            </label>
            <p className="transfer-review-helper">Khách sẽ thấy nội dung này trước khi gửi lại bằng chứng.</p>
          </>
        )}

        <button
          type="submit"
          className={isVerify ? "transfer-review-primary" : "transfer-review-danger-soft"}
          disabled={!valid || submitting}
        >
          {submitting ? "Đang xử lý..." : isVerify ? "Xác minh và mở đơn" : "Từ chối bằng chứng"}
        </button>
      </form>
    </div>
  );
}

function TransferProofLightbox({ imageUrl, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="transfer-proof-lightbox" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="transfer-proof-lightbox__content" role="dialog" aria-modal="true" aria-label="Bằng chứng chuyển khoản">
        <button type="button" onClick={onClose} aria-label="Đóng ảnh bằng chứng">
          <X size={18} />
        </button>
        <img src={imageUrl} alt="Bằng chứng chuyển khoản phóng to" />
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="transfer-review-detail-row">
      <dt>{label}</dt>
      <dd>{value || "-"}</dd>
    </div>
  );
}

function TransferPaymentCard({ payment, canWrite, restaurants, onVerify, onReject, onPreview }) {
  const bank = payment?.metadata?.bankTransfer || {};
  const transfer = payment?.transfer || {};
  const proofImages = Array.isArray(transfer.proofImages) ? transfer.proofImages.filter(Boolean) : [];
  const status = resolveStatus(payment);
  const orderCodesText = getOrderCodesText(payment);
  const submittedAtText = formatDate(transfer.submittedAt || payment.updatedAt, "Chưa có thời gian gửi");
  const canDecide = canWrite && ["SUBMITTED", "VERIFYING"].includes(status);
  const receivedAmount = transfer.receivedAmount == null ? null : Number(transfer.receivedAmount || 0);
  const varianceAmount = transfer.varianceAmount == null ? null : Number(transfer.varianceAmount || 0);
  const rejectedCount = Number(transfer.rejectedCount || 0);
  const maxRejectedCount = Number(transfer.maxRejectedCount || 0);
  const bankLabel = bank.bankName || bank.bankCode || "";

  return (
    <article className={`transfer-review-card transfer-review-card--${status.toLowerCase()}`} aria-label={`Giao dịch ${payment.reference}`}>
      <header className="transfer-review-card-header">
        <div>
          <p className="transfer-review-reference">{payment.reference}</p>
          <h3>{formatCurrency(payment.amount, payment.currency || "VND")}</h3>
          <p className="transfer-review-subtitle">
            {orderCodesText || "Chưa có mã đơn"}
            <span aria-hidden="true">•</span>
            {submittedAtText}
          </p>
        </div>
        <span className={`transfer-review-status transfer-review-status--${transferStatusTone[status] || "muted"}`}>
          {transferStatusLabel[status] || status}
        </span>
      </header>

      <div className="transfer-review-card-body">
        <dl className="transfer-review-detail-list">
          <DetailRow label="Khách hàng" value={getCustomerName(payment)} />
          <DetailRow label="Nhà hàng" value={getRestaurantName(payment, restaurants)} />
          {bankLabel && <DetailRow label="Ngân hàng" value={bankLabel} />}
          <DetailRow label="Nội dung chuyển khoản" value={bank.transferContent || payment.reference} />
          <DetailRow label="Ghi chú khách gửi" value={transfer.proofNote || "Không có ghi chú"} />
          <DetailRow label="Mã giao dịch" value={transfer.providerTransactionId || payment.providerTransactionId || "Chưa có"} />
          {transfer.rejectReason && <DetailRow label="Lý do từ chối" value={transfer.rejectReason} />}
          {maxRejectedCount > 0 && rejectedCount > 0 && <DetailRow label="Số lần từ chối" value={`${rejectedCount}/${maxRejectedCount}`} />}
          {receivedAmount != null && <DetailRow label="Tiền thực nhận" value={formatCurrency(receivedAmount, payment.currency || "VND")} />}
          {varianceAmount != null && <DetailRow label="Chênh lệch" value={formatCurrency(varianceAmount, payment.currency || "VND")} />}
        </dl>

        <section className="transfer-review-proof-panel" aria-label="Ảnh bằng chứng">
          <div className="transfer-review-proof-heading">
            <ImageIcon size={17} />
            <span>{proofImages.length} ảnh bằng chứng</span>
          </div>
          <div className="transfer-review-proof-list">
            {proofImages.length ? proofImages.map((url, index) => (
              <button
                type="button"
                className="transfer-review-proof-thumb"
                onClick={() => onPreview(url)}
                key={`${url}-${index}`}
                aria-label={`Xem ảnh bằng chứng ${index + 1}`}
              >
                <img src={url} alt={`Bằng chứng chuyển khoản ${index + 1}`} loading="lazy" />
              </button>
            )) : (
              <div className="transfer-review-empty-proof">
                <ImageIcon size={22} />
                <span>Chưa có ảnh bằng chứng</span>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="transfer-review-card-actions">
        {canDecide && (
          <>
            <button type="button" className="transfer-review-primary" onClick={() => onVerify(payment)}>
              <CheckCircle2 size={17} /> Xác minh thanh toán
            </button>
            <button type="button" className="transfer-review-danger-soft" onClick={() => onReject(payment)}>
              <XCircle size={17} /> Từ chối bằng chứng
            </button>
          </>
        )}
        {status === "REJECTED" && <p>Đang chờ khách gửi lại bằng chứng.</p>}
        {status === "VERIFIED" && <p>Thanh toán đã khớp, đơn đã được mở để xử lý.</p>}
        {status === "FAILED" && <p>Đã đạt giới hạn từ chối bằng chứng.</p>}
        {status === "EXPIRED" && <p>Phiên thanh toán đã hết hạn.</p>}
      </footer>
    </article>
  );
}

function QueueState({ icon: Icon, title, description, actionLabel, onAction, loading = false }) {
  return (
    <div className="transfer-review-state" role="status">
      <span className="transfer-review-state__icon">
        <Icon size={24} className={loading ? "is-spinning" : ""} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {actionLabel && onAction && (
        <button type="button" className="transfer-review-refresh" onClick={onAction}>
          <RefreshCw size={16} /> {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function TransferPaymentReviewPage() {
  const { user } = useContext(AuthContext) || {};
  const restaurantScope = useManagerRestaurantSelection();
  const restaurants = restaurantScope.restaurantOptions || [];
  const restaurantId = restaurantScope.selectedRestaurantId || "";
  const selectedRestaurant = restaurantScope.selectedRestaurant
    || restaurants.find((restaurant) => getRestaurantId(restaurant) === restaurantId)
    || null;
  const [activeFilter, setActiveFilter] = useState("ACTIONABLE");
  const [decision, setDecision] = useState(null);
  const [previewImage, setPreviewImage] = useState("");
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const canWrite = hasPermission(user, "payment.write");

  const selectedFilter = REVIEW_FILTERS.find((filter) => filter.value === activeFilter) || REVIEW_FILTERS[0];
  const queryStatus = selectedFilter.statuses ? null : selectedFilter.value;
  const queryStatuses = selectedFilter.statuses || null;
  const variables = useMemo(
    () => ({ restaurantId, status: queryStatus, statuses: queryStatuses, limit: 50 }),
    [restaurantId, queryStatus, queryStatuses],
  );
  const { data, loading, error, refetch } = useQuery(GET_TRANSFER_PAYMENT_QUEUE, {
    skip: !restaurantId,
    variables,
    fetchPolicy: "network-only",
    pollInterval: restaurantId ? POLL_INTERVAL_MS : 0,
    notifyOnNetworkStatusChange: true,
  });
  const [verifyTransferPayment] = useMutation(VERIFY_TRANSFER_PAYMENT);
  const [rejectTransferPayment] = useMutation(REJECT_TRANSFER_PAYMENT);

  const rows = data?.transferPaymentQueue || [];
  const summary = data?.transferPaymentQueueSummary || EMPTY_SUMMARY;
  const hasLoadedQueue = Array.isArray(data?.transferPaymentQueue);
  const initialLoading = Boolean(restaurantId && loading && !hasLoadedQueue);
  const refreshing = Boolean(restaurantId && loading && hasLoadedQueue);
  const scopeLoading = restaurantScope.restaurantsLoading;

  useEffect(() => {
    if (hasLoadedQueue) setLastRefreshedAt(new Date());
  }, [data?.transferPaymentQueue, data?.transferPaymentQueueSummary, hasLoadedQueue]);

  useEffect(() => {
    setNotice(null);
    setDecision(null);
    setPreviewImage("");
  }, [restaurantId]);

  const handleManualRefresh = async () => {
    if (!restaurantId || loading) return;
    setNotice(null);
    try {
      await refetch();
      setLastRefreshedAt(new Date());
    } catch (refreshError) {
      setNotice({ type: "error", text: refreshError?.message || "Không thể làm mới danh sách chuyển khoản." });
    }
  };

  const submitDecision = async ({ receivedAmount, providerTransactionId, reason }) => {
    if (!decision?.payment?.id) return;
    setSubmitting(true);
    setNotice(null);
    try {
      if (decision.mode === "verify") {
        await verifyTransferPayment({
          variables: {
            input: {
              paymentSessionId: decision.payment.id,
              receivedAmount,
              providerTransactionId: providerTransactionId || null,
              note: reason || "Xác minh từ màn hình duyệt chuyển khoản",
            },
          },
        });
        setNotice({ type: "success", text: "Đã xác minh chuyển khoản và mở đơn cho nhà hàng." });
      } else {
        await rejectTransferPayment({
          variables: { input: { paymentSessionId: decision.payment.id, reason } },
        });
        setNotice({ type: "success", text: "Đã từ chối bằng chứng và gửi lý do cho khách." });
      }
      setDecision(null);
      try {
        await refetch();
      } catch {
        setNotice({
          type: "warning",
          text: "Giao dịch đã được xử lý nhưng danh sách chưa thể làm mới. Hệ thống sẽ tự thử lại.",
        });
      }
    } catch (mutationError) {
      setNotice({ type: "error", text: mutationError?.message || "Không thể cập nhật giao dịch chuyển khoản." });
    } finally {
      setSubmitting(false);
    }
  };

  const summaryItems = [
    { key: "actionable", label: "Cần xử lý", icon: Clock3, value: summary.actionable },
    { key: "verifying", label: "Đang kiểm tra", icon: SearchCheck, value: summary.verifying },
    { key: "rejected", label: "Cần gửi lại", icon: XCircle, value: summary.rejected },
    { key: "verified", label: "Đã xác minh", icon: CheckCircle2, value: summary.verified },
  ];

  return (
    <section className="transfer-review-page transfer-review-page--polished" aria-busy={initialLoading || refreshing}>
      <header className="transfer-review-header">
        <div className="transfer-review-header-copy">
          <p className="transfer-review-eyebrow">Thanh toán và đối soát</p>
          <h2>Duyệt chuyển khoản</h2>
          <p>Kiểm tra bằng chứng, đối chiếu số tiền và mở đơn ngay khi thanh toán khớp.</p>
          <div className="transfer-review-context" aria-live="polite">
            <strong>{selectedRestaurant?.name || (scopeLoading ? "Đang xác định nhà hàng" : "Chưa chọn nhà hàng")}</strong>
            <span>Tự làm mới mỗi 15 giây</span>
            <span>Cập nhật {formatTime(lastRefreshedAt)}{refreshing ? " · đang đồng bộ" : ""}</span>
          </div>
        </div>
        <button
          className="transfer-review-refresh"
          type="button"
          onClick={handleManualRefresh}
          disabled={!restaurantId || loading}
        >
          <RefreshCw size={17} className={refreshing ? "is-spinning" : ""} />
          {refreshing ? "Đang làm mới" : "Làm mới"}
        </button>
      </header>

      <section className="transfer-review-summary-strip" aria-label="Tổng quan chuyển khoản">
        {summaryItems.map(({ key, label, icon: Icon, value }) => (
          <article key={key}>
            <Icon size={18} />
            <div>
              <span>{label}</span>
              <strong>{Number(value || 0)}</strong>
            </div>
          </article>
        ))}
      </section>

      <nav className="transfer-review-tabs" aria-label="Lọc trạng thái chuyển khoản">
        {REVIEW_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={activeFilter === filter.value ? "is-active" : ""}
            onClick={() => setActiveFilter(filter.value)}
            aria-pressed={activeFilter === filter.value}
          >
            <span>{filter.label}</span>
            <strong>{Number(summary[filter.summaryKey] || 0)}</strong>
          </button>
        ))}
      </nav>

      {notice && (
        <div
          className={`transfer-review-notice ${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          {notice.type === "error" || notice.type === "warning" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{notice.text}</span>
        </div>
      )}
      {!canWrite && restaurantId && (
        <div className="transfer-review-notice warning" role="status">
          <AlertTriangle size={18} />
          <span>Bạn có thể xem dữ liệu nhưng chưa có quyền xác minh hoặc từ chối chuyển khoản.</span>
        </div>
      )}
      {error && hasLoadedQueue && (
        <div className="transfer-review-notice error" role="alert">
          <AlertTriangle size={18} />
          <span>Không thể đồng bộ dữ liệu mới. Danh sách gần nhất vẫn đang được hiển thị.</span>
        </div>
      )}

      {scopeLoading && !restaurantId && (
        <QueueState
          icon={RefreshCw}
          title="Đang xác định phạm vi nhà hàng"
          description="Hệ thống đang tải chuỗi và chi nhánh bạn được phép quản lý."
          loading
        />
      )}
      {!scopeLoading && !restaurantId && (
        <QueueState
          icon={AlertTriangle}
          title="Chưa chọn nhà hàng"
          description="Chọn một chi nhánh ở thanh quản trị phía trên để xem hàng đợi chuyển khoản."
        />
      )}
      {initialLoading && (
        <QueueState
          icon={RefreshCw}
          title="Đang tải giao dịch"
          description="Đang lấy dữ liệu chuyển khoản mới nhất từ hệ thống."
          loading
        />
      )}
      {restaurantId && error && !hasLoadedQueue && (
        <QueueState
          icon={AlertTriangle}
          title="Không thể tải hàng đợi"
          description="Kiểm tra kết nối hoặc quyền truy cập nhà hàng rồi thử lại."
          actionLabel="Thử lại"
          onAction={handleManualRefresh}
        />
      )}
      {restaurantId && !initialLoading && !error && hasLoadedQueue && rows.length === 0 && (
        <QueueState
          icon={SearchCheck}
          title={`Không có giao dịch ${selectedFilter.label.toLowerCase()}`}
          description={`Nhà hàng hiện có ${Number(summary.total || 0)} giao dịch trong toàn bộ hàng đợi.`}
          actionLabel="Làm mới"
          onAction={handleManualRefresh}
        />
      )}

      {rows.length > 0 && (
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
      )}

      {previewImage && <TransferProofLightbox imageUrl={previewImage} onClose={() => setPreviewImage("")} />}
      {decision && (
        <TransferDecisionModal
          mode={decision.mode}
          payment={decision.payment}
          submitting={submitting}
          onClose={() => !submitting && setDecision(null)}
          onSubmit={submitDecision}
        />
      )}
    </section>
  );
}
