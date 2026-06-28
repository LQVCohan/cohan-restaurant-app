import React, { useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import "./ProfileInfo.scss";

const CREATE_WALLET = gql`
  mutation CreateMyWallet($input: CreateWalletInput!) {
    createMyWallet(input: $input) {
      id
      wallet {
        provider
        status
        balance
        currency
        createdAt
        updatedAt
      }
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

const MY_WALLET_TRANSACTIONS = gql`
  query MyWalletTransactions($limit: Int, $offset: Int) {
    myWalletTransactions(limit: $limit, offset: $offset) {
      id
      type
      amount
      currency
      balanceBefore
      balanceAfter
      status
      referenceType
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

export default function ProfileWallet({ user, refetchUser }) {
  const [topupAmount, setTopupAmount] = useState("100000");
  const [walletMessage, setWalletMessage] = useState("");
  const [createWallet, { loading: creatingWallet }] = useMutation(CREATE_WALLET);
  const [createWalletTopup, { loading: toppingUp }] = useMutation(CREATE_WALLET_TOPUP);
  const { data: txData, refetch: refetchTx } = useQuery(MY_WALLET_TRANSACTIONS, {
    variables: { limit: 8, offset: 0 },
    skip: !user?.wallet,
    fetchPolicy: "network-only",
  });

  const transactions = txData?.myWalletTransactions || [];
  const walletCurrency = user?.wallet?.currency || "VND";

  const handleCreateWallet = async () => {
    try {
      setWalletMessage("");
      await createWallet({ variables: { input: { provider: "internal", currency: "VND" } } });
      setWalletMessage("Đã tạo ví điện tử thành công!");
      await refetchUser?.();
      refetchTx?.();
    } catch (err) {
      console.error(err);
      setWalletMessage("Không thể tạo ví: " + err.message);
    }
  };

  const handleTopupWallet = async () => {
    const amount = Number(String(topupAmount || "").replace(/[^0-9]/g, ""));
    if (!(amount > 0)) {
      setWalletMessage("Vui lòng nhập số tiền nạp hợp lệ.");
      return;
    }
    try {
      setWalletMessage("");
      const result = await createWalletTopup({
        variables: {
          input: {
            amount,
            provider: "sandbox",
            metadata: { source: "customer_profile_wallet" },
          },
        },
      });
      setWalletMessage(result?.data?.createWalletTopup?.message || "Nạp ví thành công.");
      await refetchUser?.();
      refetchTx?.();
    } catch (err) {
      console.error(err);
      setWalletMessage("Không thể nạp ví: " + err.message);
    }
  };

  return (
    <div className="wallet-tab-shell fade-in">
      <section className={`wallet-panel ${user?.wallet ? "has-wallet" : "is-empty"}`}>
        <div className="wallet-panel-header">
          <div>
            <span className="wallet-eyebrow">Ví điện tử</span>
            <h3>{user?.wallet ? "FoodHub Wallet" : "Mở ví FoodHub"}</h3>
            <p>
              {user?.wallet
                ? "Quản lý số dư, nạp ví sandbox và lịch sử giao dịch trong cùng một khu vực."
                : "Tạo ví một lần để chuẩn bị cho thanh toán nhanh ở các đơn hàng sau."}
            </p>
          </div>
          {user?.wallet && <span className="wallet-status-badge">{user.wallet.status || "active"}</span>}
        </div>

        {walletMessage && <div className="contact-modal-message">{walletMessage}</div>}

        {user?.wallet ? (
          <div className="wallet-dashboard">
            <div className="wallet-balance-card">
              <span>Số dư khả dụng</span>
              <strong>{money(user.wallet.balance, walletCurrency)}</strong>
              <small>Nhà cung cấp: {user.wallet.provider || "Nội bộ"}</small>
            </div>

            <div className="wallet-control-card">
              <label>Nạp tiền vào ví</label>
              <div className="wallet-topup-row">
                <input
                  type="text"
                  className="form-input"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Số tiền nạp"
                />
                <button className="btn-edit" onClick={handleTopupWallet} disabled={toppingUp}>
                  {toppingUp ? "Đang nạp..." : "Nạp tiền"}
                </button>
              </div>
              <p>Nạp ví đang chạy sandbox để phục vụ demo luồng thanh toán.</p>
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
        ) : (
          <div className="wallet-empty-state">
            <div>
              <strong>Bạn chưa có ví điện tử</strong>
              <p>Ví FoodHub giúp lưu số dư, theo dõi giao dịch và chuẩn bị cho thanh toán nhanh.</p>
            </div>
            <button className="btn-save" onClick={handleCreateWallet} disabled={creatingWallet}>
              {creatingWallet ? "Đang tạo ví..." : "Tạo ví điện tử"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
