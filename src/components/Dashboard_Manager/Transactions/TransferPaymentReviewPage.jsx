import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { RefreshCw } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { hasPermission } from "@/utils/frontendPermissionAccess";
import "../Finance/FinanceDashboard.scss";

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
  query TransferPaymentQueue($restaurantId: ID!, $status: TransferVerificationStatus, $limit: Int) {
    transferPaymentQueue(restaurantId: $restaurantId, status: $status, limit: $limit) {
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
  { value: "SUBMITTED", label: "Đã gửi proof" },
  { value: "VERIFYING", label: "Đang xác minh" },
  { value: "REJECTED", label: "Đã từ chối" },
  { value: "VERIFIED", label: "Đã xác minh" },
  { value: "FAILED", label: "Thất bại" },
  { value: "EXPIRED", label: "Hết hạn" },
  { value: "ALL", label: "Tất cả" },
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

const formatCurrency = (value, currency = "VND") =>
  Number(value || 0).toLocaleString("vi-VN", { style: "currency", currency });
const formatDate = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "Chưa gửi proof");
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
        <h3>{isVerify ? "Xác minh thanh toán" : "Từ chối bằng chứng"}</h3>
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
              <input value={providerTransactionId} onChange={(event) => setProviderTransactionId(event.target.value)} />
            </label>
            <label className="transfer-review-field">
              <span>Ghi chú xác minh</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tuỳ chọn" />
            </label>
          </>
        ) : (
          <>
            <label className="transfer-review-field">
              <span>Lý do từ chối *</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <p className="transfer-review-helper">Lý do này sẽ hiển thị cho khách để họ gửi lại bằng chứng đúng hơn.</p>
          </>
        )}
        <button
          type="button"
          className={isVerify ? "transfer-review-primary" : "transfer-review-danger-soft"}
          disabled={!valid || submitting}
          onClick={() => onSubmit({ receivedAmount: Number(receivedAmount || 0), providerTransactionId, reason })}
        >
          {submitting ? "Đang xử lý..." : isVerify ? "Xác minh & release đơn" : "Từ chối proof"}
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

        <span className={`transfer-review-status transfer-review-status--${status.toLowerCase()}`}>
          {transferStatusLabel[status] || status}
        </span>
      </header>

      <div className="transfer-review-grid">
        <div className="transfer-review-detail-list">
          <DetailRow label="Khách hàng" value={getCustomerName(payment)} />
          <DetailRow label="Nhà hàng" value={getRestaurantName(payment, restaurants)} />
          <DetailRow label="Nội dung CK" value={bank.transferContent || payment.reference} />
          <DetailRow label="Ghi chú proof" value={transfer.proofNote || "Không có ghi chú"} />
          <DetailRow label="Mã giao dịch" value={transfer.providerTransactionId || payment.providerTransactionId || "Chưa có"} />
        </div>
        <div className="transfer-review-proof-list">
          {proofImages.length ? proofImages.map((url, index) => (
            <button type="button" className="transfer-review-proof-thumb" onClick={() => onPreview(url)} key={`${url}-${index}`}>
              <img src={url} alt={`Bằng chứng ${index + 1}`} loading="lazy" />
            </button>
          )) : <p className="transfer-review-empty-proof">Chưa có ảnh bằng chứng.</p>}
        </div>
      </div>

      <footer className="transfer-review-card-actions">
        {canDecide && (
          <>
            <button type="button" className="transfer-review-primary" onClick={() => onVerify(payment)}>Xác minh thanh toán</button>
            <button type="button" className="transfer-review-danger-soft" onClick={() => onReject(payment)}>Từ chối proof</button>
          </>
        )}
        {status === "REJECTED" && <p>Đã từ chối. Khách có thể gửi lại bằng chứng.</p>}
        {status === "VERIFIED" && <p>Đã release đơn</p>}
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
  const queryStatus = selectedFilter.value === "ACTIONABLE" ? "SUBMITTED" : selectedFilter.value === "ALL" ? null : selectedFilter.value;
  const variables = useMemo(() => ({ restaurantId, status: queryStatus, limit: 50 }), [restaurantId, queryStatus]);
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
        await verifyTransferPayment({ variables: { input: { paymentSessionId: decision.payment.id, receivedAmount, providerTransactionId, note: reason || "Verified from manager review UI" } } });
        setNotice({ type: "success", text: "Đã xác minh chuyển khoản và làm mới queue." });
      } else {
        await rejectTransferPayment({ variables: { input: { paymentSessionId: decision.payment.id, reason: reason.trim() } } });
        setNotice({ type: "success", text: "Đã từ chối bằng chứng chuyển khoản và làm mới queue." });
      }
      setDecision(null);
    } catch (err) {
      setNotice({ type: "error", text: err?.message || "Không thể cập nhật giao dịch chuyển khoản." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="transfer-review-page">
      <header className="transfer-review-header">
        <div>
          <p className="transfer-review-eyebrow">Đối soát chuyển khoản</p>
          <h2>Thanh toán QR / Chuyển khoản</h2>
          <p>Xác minh bằng chứng thanh toán trước khi release đơn cho nhà hàng.</p>
          <p className="transfer-review-helper">
            Tự động làm mới mỗi 15 giây{lastRefreshedAt ? ` · cập nhật lần cuối ${lastRefreshedAt.toLocaleTimeString("vi-VN")}` : ""}{refreshing ? " · đang làm mới..." : ""}.
          </p>
        </div>

        <div className="transfer-review-header-actions">
          {restaurants.length > 1 && (
            <select value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)}>
              {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </select>
          )}
          <button className="transfer-review-refresh" type="button" onClick={handleManualRefresh} disabled={initialLoading}>
            <RefreshCw size={16} /> Làm mới
          </button>
        </div>
      </header>

      <div className="transfer-review-tabs">
        {REVIEW_FILTERS.map((filter) => (
          <button key={filter.value} type="button" className={activeFilter === filter.value ? "is-active" : ""} onClick={() => setActiveFilter(filter.value)}>
            {filter.label}
          </button>
        ))}
      </div>
      {activeFilter === "ACTIONABLE" && <p className="transfer-review-filter-helper">API hiện truy vấn một trạng thái; tab Cần xử lý ưu tiên danh sách đã gửi proof.</p>}

      {notice && <div className={notice.type === "success" ? "transfer-review-notice success" : "transfer-review-notice error"}>{notice.text}</div>}
      {!canWrite && <div className="transfer-review-notice warning">Bạn có quyền xem queue, nhưng không có quyền payment.write nên thao tác xác minh/từ chối đã được ẩn.</div>}
      {error && <div className="transfer-review-notice error">Không thể tải queue chuyển khoản. Vui lòng thử lại.</div>}
      {initialLoading && <div className="transfer-review-state">Đang tải queue chuyển khoản...</div>}
      {!initialLoading && !error && rows.length === 0 && <div className="transfer-review-state">Không có giao dịch chuyển khoản cần xử lý.</div>}

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
