import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
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

const fmt = (value, currency = "VND") =>
  Number(value || 0).toLocaleString("vi-VN", { style: "currency", currency });
const asDate = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "-");
const transferStatusOptions = ["SUBMITTED", "VERIFYING", "VERIFIED", "REJECTED"];

function TransferDecisionModal({ mode, payment, onClose, onSubmit }) {
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
            <label className="tx-field"><span>Ghi chú</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tuỳ chọn" /></label>
          </>
        ) : (
          <label className="tx-field"><span>Lý do từ chối</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        )}
        <button className={isVerify ? "btn-primary tx-submit" : "btn-danger-soft tx-submit"} disabled={!valid} onClick={() => onSubmit({ receivedAmount: Number(receivedAmount || 0), providerTransactionId, reason })}>
          {isVerify ? "Xác minh & release đơn" : "Từ chối bằng chứng"}
        </button>
      </div>
    </div>
  );
}

function TransferPaymentCard({ payment, canWrite, onVerify, onReject }) {
  const bank = payment?.metadata?.bankTransfer || {};
  const transfer = payment?.transfer || {};
  const proofImages = Array.isArray(transfer.proofImages) ? transfer.proofImages.filter(Boolean) : [];
  const status = String(transfer.status || payment.status || "PENDING").toUpperCase();
  return (
    <article className="tx-record-card">
      <div>
        <strong>{payment.reference}</strong>
        <span className={`badge ${status === "VERIFIED" ? "success" : status === "REJECTED" ? "danger" : "warning"}`}>{status}</span>
      </div>
      <p>{fmt(payment.amount, payment.currency || "VND")} · {bank.bankName || "bank_transfer"}</p>
      <small>Submitted {asDate(transfer.submittedAt || payment.updatedAt)} · Claimed paid {asDate(transfer.customerClaimedPaidAt)}</small>
      <div className="tx-readonly-summary">
        <span>Nội dung chuyển khoản</span>
        <strong>{bank.transferContent || payment.reference}</strong>
        <small>TK {bank.bankAccountNumber || bank.accountNumber || "-"} · {bank.accountName || "-"}</small>
      </div>
      {transfer.proofNote && <p>Ghi chú khách: {transfer.proofNote}</p>}
      {transfer.rejectReason && <p className="finance-error">Lý do từ chối: {transfer.rejectReason}</p>}
      <div className="tx-cards-grid tx-cards-grid--single">
        {proofImages.length ? proofImages.map((src, index) => (
          <a key={`${src}-${index}`} href={src} target="_blank" rel="noreferrer" className="tx-record-card">
            Ảnh bằng chứng #{index + 1}
          </a>
        )) : <div className="empty-note">Chưa có ảnh bằng chứng.</div>}
      </div>
      {canWrite && status !== "VERIFIED" && (
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
  const canWrite = Boolean(user);

  const variables = useMemo(() => ({ restaurantId, status: status || null, limit: 50 }), [restaurantId, status]);
  const { data, loading, error, refetch } = useQuery(GET_TRANSFER_PAYMENT_QUEUE, {
    skip: !restaurantId,
    variables,
    fetchPolicy: "network-only",
  });
  const mutationOptions = { onCompleted: () => refetch() };
  const [verifyTransferPayment] = useMutation(VERIFY_TRANSFER_PAYMENT, mutationOptions);
  const [rejectTransferPayment] = useMutation(REJECT_TRANSFER_PAYMENT, mutationOptions);

  const rows = data?.transferPaymentQueue || [];

  const submitDecision = async ({ receivedAmount, providerTransactionId, reason }) => {
    if (!decision?.payment?.id) return;
    if (decision.mode === "verify") {
      await verifyTransferPayment({ variables: { input: { paymentSessionId: decision.payment.id, receivedAmount, providerTransactionId, note: reason || "Verified from manager review UI" } } });
    } else {
      await rejectTransferPayment({ variables: { input: { paymentSessionId: decision.payment.id, reason } } });
    }
    setDecision(null);
  };

  return (
    <div className="finance-dashboard transactions-page">
      <header className="page-header finance-hero">
        <div className="header-left">
          <span className="eyebrow">Transfer review</span>
          <h1>Duyệt chuyển khoản</h1>
          <p>Xem bằng chứng chuyển khoản, xác minh payment và release đơn cho nhà hàng xử lý.</p>
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
          <button className="btn-secondary" onClick={() => refetch()}><RefreshCw size={16} /> Làm mới</button>
        </div>
      </header>

      {error && <div className="finance-error">Không thể tải queue chuyển khoản. Vui lòng thử lại.</div>}
      {loading && <div className="card-container">Đang tải queue chuyển khoản...</div>}
      {!loading && rows.length === 0 && <div className="card-container empty-note">Không có giao dịch chuyển khoản cần xử lý.</div>}
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
      {decision && <TransferDecisionModal mode={decision.mode} payment={decision.payment} onClose={() => setDecision(null)} onSubmit={submitDecision} />}
    </div>
  );
}
