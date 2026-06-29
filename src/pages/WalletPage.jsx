import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  CreditCard,
  History,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./WalletPage.scss";

const MY_WALLET = gql`
  query MyCohanWallet {
    myWallet {
      balance
      currency
      status
      lifetimeTopup
      lifetimePayment
      lifetimeRefund
      lifetimeAdjustment
      transactionCount
      wallet { provider status balance currency updatedAt }
    }
    myWalletTransactions(input: { limit: 50 }) {
      id
      type
      amount
      currency
      balanceBefore
      balanceAfter
      status
      referenceType
      referenceId
      orderIds
      metadata
      createdAt
    }
  }
`;

const CREATE_WALLET_TOPUP = gql`
  mutation CreateWalletTopup($input: WalletTopupInput!) {
    createWalletTopup(input: $input) {
      ok
      message
      wallet { provider status balance currency updatedAt }
      transaction { id type amount balanceAfter status createdAt metadata }
    }
  }
`;

const formatVND = (value = 0) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
const formatDateTime = (value) => {
  if (!value) return "Chưa có dữ liệu";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa có dữ liệu" : date.toLocaleString("vi-VN");
};

const typeMeta = {
  TOPUP: { label: "Nạp ví", icon: ArrowDownLeft, tone: "success" },
  PAYMENT: { label: "Thanh toán", icon: ArrowUpRight, tone: "payment" },
  REFUND: { label: "Hoàn tiền", icon: ArrowDownLeft, tone: "refund" },
  ADJUSTMENT: { label: "Điều chỉnh", icon: RefreshCw, tone: "adjust" },
};

export default function WalletPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery(MY_WALLET, { fetchPolicy: "cache-and-network" });
  const [topupAmount, setTopupAmount] = useState(100000);
  const [notice, setNotice] = useState("");
  const [createTopup, { loading: toppingUp }] = useMutation(CREATE_WALLET_TOPUP, {
    onCompleted: (result) => {
      setNotice(result?.createWalletTopup?.message || "Đã nạp ví thành công.");
      refetch();
    },
    onError: (err) => setNotice(err?.message || "Không thể nạp ví."),
  });

  const summary = data?.myWallet;
  const transactions = data?.myWalletTransactions || [];
  const quickAmounts = [50000, 100000, 200000, 500000];
  const walletUpdatedAt = summary?.wallet?.updatedAt;

  const stats = useMemo(
    () => [
      { label: "Đã nạp", value: formatVND(summary?.lifetimeTopup), icon: ArrowDownLeft },
      { label: "Đã thanh toán", value: formatVND(summary?.lifetimePayment), icon: ArrowUpRight },
      { label: "Đã hoàn", value: formatVND(summary?.lifetimeRefund), icon: RefreshCw },
      { label: "Giao dịch", value: summary?.transactionCount || transactions.length || 0, icon: History },
    ],
    [summary, transactions.length],
  );

  const handleTopup = () => {
    const amount = Number(topupAmount || 0);
    if (!(amount >= 1000)) {
      setNotice("Số tiền nạp tối thiểu là 1.000đ.");
      return;
    }
    createTopup({ variables: { input: { amount, provider: "sandbox", metadata: { source: "customer_wallet_page" } } } });
  };

  return (
    <main className="wallet-page">
      <section className="wallet-page__hero" aria-labelledby="wallet-title">
        <button type="button" className="wallet-page__back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} /> Quay lại
        </button>
        <div className="wallet-page__brand">
          <div className="wallet-page__icon" aria-hidden="true"><WalletCards size={28} /></div>
          <div>
            <p>Ví Cohan Balance</p>
            <h1 id="wallet-title">{formatVND(summary?.balance)}</h1>
            <span>{summary?.status === "active" ? "Đang hoạt động" : summary?.status || "Đang khởi tạo"}</span>
          </div>
        </div>
        <div className="wallet-page__secure">
          <ShieldCheck size={18} aria-hidden="true" /> Số dư được ghi nhận bằng lịch sử giao dịch
        </div>
      </section>

      {(loading || error || notice) && (
        <div
          className={`wallet-page__notice ${error ? "wallet-page__notice--error" : ""}`}
          role={error ? "alert" : "status"}
          aria-live="polite"
        >
          {loading && !error ? "Đang đồng bộ ví..." : error?.message || notice}
        </div>
      )}

      <div className="wallet-page__layout">
        <section className="wallet-page__panel wallet-page__topup" aria-labelledby="wallet-topup-title">
          <p className="wallet-page__eyebrow">Nạp ví demo/sandbox</p>
          <h2 id="wallet-topup-title">Nạp tiền vào Cohan Balance</h2>
          <p>Ở bản MVP, nạp ví chạy chế độ sandbox. Khi đấu cổng thật, số dư chỉ cộng sau callback hợp lệ.</p>
          <div className="wallet-page__quick-amounts" aria-label="Chọn nhanh số tiền nạp">
            {quickAmounts.map((amount) => (
              <button key={amount} type="button" className={Number(topupAmount) === amount ? "active" : ""} onClick={() => setTopupAmount(amount)}>
                {formatVND(amount)}
              </button>
            ))}
          </div>
          <label className="wallet-page__amount-input">
            Số tiền nạp
            <input type="number" min="1000" step="1000" value={topupAmount} onChange={(event) => setTopupAmount(event.target.value)} />
          </label>
          <button type="button" className="wallet-page__primary" onClick={handleTopup} disabled={toppingUp}>
            <CreditCard size={18} aria-hidden="true" /> {toppingUp ? "Đang nạp..." : "Nạp ví sandbox"}
          </button>
        </section>

        <section className="wallet-page__stats" aria-label="Tổng quan ví">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.label}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            );
          })}
          <article className="wallet-page__updated-card">
            <Clock3 size={18} aria-hidden="true" />
            <span>Cập nhật gần nhất</span>
            <strong>{formatDateTime(walletUpdatedAt)}</strong>
          </article>
        </section>
      </div>

      <section className="wallet-page__panel wallet-page__history" aria-labelledby="wallet-history-title">
        <div className="wallet-page__history-header">
          <div>
            <p className="wallet-page__eyebrow">Lịch sử ví</p>
            <h2 id="wallet-history-title">Giao dịch gần đây</h2>
          </div>
          <button type="button" onClick={() => refetch()} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true" /> Làm mới
          </button>
        </div>

        {!transactions.length ? (
          <div className="wallet-page__empty">Chưa có giao dịch ví nào.</div>
        ) : (
          <div className="wallet-page__transactions">
            {transactions.map((tx) => {
              const meta = typeMeta[tx.type] || typeMeta.ADJUSTMENT;
              const Icon = meta.icon;
              const sign = tx.type === "PAYMENT" ? "-" : "+";
              return (
                <article className={`wallet-page__transaction wallet-page__transaction--${meta.tone}`} key={tx.id}>
                  <div className="wallet-page__transaction-icon" aria-hidden="true"><Icon size={18} /></div>
                  <div>
                    <strong>{meta.label}</strong>
                    <span>{formatDateTime(tx.createdAt)}</span>
                    {tx.referenceType && <small>{tx.referenceType}</small>}
                  </div>
                  <div className="wallet-page__transaction-amount">
                    <strong>{sign}{formatVND(tx.amount)}</strong>
                    <span>Sau GD: {formatVND(tx.balanceAfter)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
