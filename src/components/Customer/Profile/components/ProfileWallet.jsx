import React from "react";
import { gql, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import "./ProfileInfo.scss";

const MY_WALLET = gql`
  query ProfileWalletSummary {
    myWallet {
      wallet { provider status balance currency updatedAt }
    }
    myWalletTransactions(input: { limit: 5 }) {
      id
      type
      amount
      currency
      balanceAfter
      createdAt
    }
  }
`;

const money = (value, currency = "VND") =>
  `${Number(value || 0).toLocaleString("vi-VN")} ${currency || "VND"}`;

const transactionLabel = (type = "") => {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "TOPUP") return "Nạp ví";
  if (normalized === "PAYMENT") return "Thanh toán";
  if (normalized === "REFUND") return "Hoàn tiền";
  if (normalized === "ADJUSTMENT") return "Điều chỉnh";
  return normalized || "Giao dịch";
};

export default function ProfileWallet({ user }) {
  const navigate = useNavigate();
  const { data, loading, error } = useQuery(MY_WALLET, { fetchPolicy: "cache-and-network" });
  const wallet = data?.myWallet?.wallet || user?.wallet || {};
  const transactions = data?.myWalletTransactions || [];
  const walletCurrency = wallet?.currency || "VND";

  return (
    <div className="wallet-tab-shell fade-in">
      <section className={`wallet-panel ${wallet ? "has-wallet" : "is-empty"}`}>
        <div className="wallet-panel-header">
          <div>
            <span className="wallet-eyebrow">Cohan Balance</span>
            <h3>Ví Cohan</h3>
            <p>Số dư nội bộ dùng để thanh toán đơn hàng và nhận hoàn tiền nhanh.</p>
          </div>
          <span className="wallet-status-badge">{wallet?.status || "active"}</span>
        </div>

        {error && <div className="contact-modal-message">Không thể tải ví: {error.message}</div>}

        <div className="wallet-dashboard">
          <div className="wallet-balance-card">
            <span>Số dư khả dụng</span>
            <strong>{money(wallet?.balance, walletCurrency)}</strong>
            <small>Cập nhật sau khi cổng thanh toán xác nhận thành công</small>
          </div>

          <div className="wallet-control-card">
            <label>Nạp và quản lý ví</label>
            <p>Chọn MoMo/VNPAY, quét QR hoặc mở trang thanh toán tại trang ví.</p>
            <button className="btn-edit" type="button" onClick={() => navigate("/wallet")} disabled={loading}>
              Mở ví Cohan
            </button>
          </div>

          <div className="wallet-history-card">
            <div className="wallet-history-title">
              <strong>Lịch sử gần đây</strong>
              <span>{transactions.length} giao dịch</span>
            </div>
            {transactions.length === 0 ? (
              <p className="wallet-empty-line">Chưa có giao dịch nào.</p>
            ) : (
              <div className="wallet-transaction-list">
                {transactions.map((tx) => (
                  <div className="wallet-transaction-item" key={tx.id}>
                    <div>
                      <strong>{transactionLabel(tx.type)}</strong>
                      <span>{tx.createdAt ? new Date(tx.createdAt).toLocaleString("vi-VN") : "Chưa có thời gian"}</span>
                    </div>
                    <div className="wallet-transaction-amount">
                      {money(tx.amount, tx.currency || walletCurrency)}
                      <small>Số dư sau: {money(tx.balanceAfter, tx.currency || walletCurrency)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
