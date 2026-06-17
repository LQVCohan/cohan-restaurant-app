import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { RefreshCw, ShieldCheck, XCircle } from "lucide-react";
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
const fmt = (value, currency = "VND") =>
  Number(value || 0).toLocaleString("vi-VN", { style: "currency", currency });
const asDate = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "-");
const statusLabel = (value) => String(value || "-").replace(/_/g, " ");
const transferStatusOptions = ["SUBMITTED", "VERIFYING", "VERIFIED", "REJECTED"];

function TransferDecisionModal({ mode, payment, submitting, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  const [receivedAmount, setReceivedAmount] = useState(payment?.amount || "");
  const [providerTransactionId, setProviderTransactionId] = useState(payment?.providerTransactionId || payment?.reference || "");
  const isVerify = mode === "verify";
  const valid = isVerify ? Number(receivedAmount) > 0 : reason.trim().length >= 3;
  return (
    <div className="tx-modal-backdrop" role="dialog" aria-modal="true">
      <div className="tx-modal-card">
        <button className="drawer-close" onClick={onClose} aria-label="Đóng">×</button>
        <h3>{isVerify ? "Xác minh chuyển khoản" : "Từ chối chuyển khoản"}</h3>
        <div className="tx-readonly-summary">
          <span>Mã tham chiếu</span>
          <strong>{payment?.reference}</strong>
          <small>{fmt(payment?.amount, payment?.currency || "VND")}</small>
        </div>
        {isVerify ? (
          <>
            <label className="tx-field"><span>Số tiền nhận được</span><input type="number" min="1" value={receivedAmount} onChange={(event) => setReceivedAmount(event.target.value)} /></label>
            <label className="tx-field"><span>Mã giao dịch ngân hàng</span><input value={providerTransactionId} onChange={(event) => setProviderTransactionId(event.target.value)} /></label>
            <label className="tx-field"><span>Ghi chú xác minh</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tuỳ chọn" /></label>
          </>
        ) : (
          <label className="tx-field"><span>Lý do từ chối *</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Bắt buộc nhập lý do để khách biết cần bổ sung gì" /></label>
        )}
        <button className={isVerify ? "btn-primary tx-submit" : "btn-danger-soft tx-submit"} disabled={!valid || submitting} onClick={() => onSubmit({ receivedAmount: Number(receivedAmount || 0), providerTransactionId, reason })}>
          {submitting ? "Đang xử lý..." : isVerify ? "Xác minh & release đơn" : "Từ chối bằng chứng"}
        </button>
      </div>
    </div>
  );
}

function TransferPaymentCard({ payment, canWrite, onVerify, onReject }) {
  const bank = payment?.metadata?.bankTransfer || {};
  const transfer = payment?.transfer || {};
  const proofImages = Array.isArray(transfer.proofImages) ? transfer.proofImages.filter(Boolean) : [];
  const transferStatus = String(transfer.status || "PENDING").toUpperCase();
  const paymentStatus = String(payment.status || "pending").toUpperCase();
  const statusClass = transferStatus === "VERIFIED" ? "success" : transferStatus === "REJECTED" ? "danger" : "warning";
  const bankDetails = [bank.bankName, bank.bankAccountNumber || bank.accountNumber, bank.accountName].filter(Boolean);
  return (
    <article className="tx-record-card transfer-review-card">
      <div>
        <strong>{payment.reference}</strong>
        <span className={`badge ${statusClass}`}>{statusLabel(transferStatus)}</span>
      </div>
      <div className="transfer-review-card__amount">{fmt(payment.amount, payment.currency || "VND")}</div>
      <dl className="transfer-review-card__meta">
        <div><dt>Trạng thái thanh toán</dt><dd>{statusLabel(paymentStatus)}</dd></div>
        <div><dt>Mã tham chiếu</dt><dd>{payment.reference || "-"}</dd></div>
        <div><dt>Mã GD ngân hàng</dt><dd>{transfer.providerTransactionId || payment.providerTransactionId || "-"}</dd></div>
        <div><dt>Khách gửi bằng chứng</dt><dd>{asDate(transfer.submittedAt || payment.updatedAt)}</dd></div>
        <div><dt>Khách báo đã trả</dt><dd>{asDate(transfer.customerClaimedPaidAt)}</dd></div>
        {transfer.receivedAmount != null && <div><dt>Đã nhận</dt><dd>{fmt(transfer.receivedAmount, payment.currency || "VND")}</dd></div>}
      </dl>
      {(bank.transferContent || bankDetails.length > 0) && (
        <div className="tx-readonly-summary">
          {bank.transferContent && <><span>Nội dung chuyển khoản</span><strong>{bank.transferContent}</strong></>}
          {bankDetails.length > 0 && <small>{bankDetails.join(" · ")}</small>}
        </div>
      )}
      {transfer.proofNote && <p className="transfer-review-card__note">Ghi chú khách: {transfer.proofNote}</p>}
      {transfer.rejectReason && <p className="finance-error">Lý do từ chối: {transfer.rejectReason}</p>}
      <div className="transfer-proof-grid">
        {proofImages.length ? proofImages.map((src, index) => (
          <a key={`${src}-${index}`} href={src} target="_blank" rel="noreferrer" className="transfer-proof-thumb">
            <img src={src} alt={`Bằng chứng chuyển khoản ${index + 1}`} loading="lazy" />
            <span>Ảnh #{index + 1}</span>
          </a>
        )) : <div className="empty-note">Chưa có ảnh bằng chứng.</div>}
      </div>
      {canWrite && transferStatus !== "VERIFIED" && (
        <div className="tx-card-actions">
          <button onClick={() => onVerify(payment)}><ShieldCheck size={14} /> Xác minh</button>
          <button onClick={() => onReject(payment)}><XCircle size={14} /> Từ chối</button>
        </div>
      )}
    </article>
  );
}

export default function TransferPaymentReviewPage() {
  const { restaurants = [], user } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState(restaurants?.[0]?.id || "");
  const [status, setStatus] = useState("SUBMITTED");
  const [decision, setDecision] = useState(null);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const canWrite = hasPermission(user, "payment.write");

  const variables = useMemo(() => ({ restaurantId, status: status || null, limit: 50 }), [restaurantId, status]);
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
    <div className="finance-dashboard transactions-page">
      <header className="page-header finance-hero">
        <div className="header-left">
          <span className="eyebrow">Transfer review</span>
          <h1>Duyệt chuyển khoản</h1>
          <p>Xem bằng chứng chuyển khoản, xác minh payment và release đơn cho nhà hàng xử lý.</p>
          <p className="helper">
            Tự động làm mới mỗi 15 giây{lastRefreshedAt ? ` · cập nhật lần cuối ${lastRefreshedAt.toLocaleTimeString("vi-VN")}` : ""}{refreshing ? " · đang làm mới..." : ""}.
          </p>
        </div>
        <div className="header-actions finance-toolbar">
          <select className="btn-secondary" value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)}>
            <option value="">Chọn nhà hàng</option>
            {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
          </select>
          <select className="btn-secondary" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            {transferStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <button className="btn-secondary" onClick={handleManualRefresh} disabled={initialLoading}><RefreshCw size={16} /> Làm mới</button>
        </div>
      </header>

      {notice && <div className={notice.type === "success" ? "finance-success" : "finance-error"}>{notice.text}</div>}
      {!canWrite && <div className="empty-note">Bạn có quyền xem queue, nhưng không có quyền payment.write nên thao tác xác minh/từ chối đã được ẩn.</div>}
      {error && <div className="finance-error">Không thể tải queue chuyển khoản. Vui lòng thử lại.</div>}
      {initialLoading && <div className="card-container transfer-review-state">Đang tải queue chuyển khoản...</div>}
      {!initialLoading && !error && rows.length === 0 && <div className="card-container empty-note transfer-review-state">Không có giao dịch chuyển khoản cần xử lý.</div>}
      <section className="tx-cards-grid">
        {rows.map((payment) => (
          <TransferPaymentCard
            key={payment.id}
            payment={payment}
            canWrite={canWrite}
            onVerify={(item) => setDecision({ mode: "verify", payment: item })}
            onReject={(item) => setDecision({ mode: "reject", payment: item })}
          />
        ))}
      </section>
      {decision && <TransferDecisionModal mode={decision.mode} payment={decision.payment} submitting={submitting} onClose={() => !submitting && setDecision(null)} onSubmit={submitDecision} />}
    </div>
  );
}
