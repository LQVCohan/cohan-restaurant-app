import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { RefreshCw, Search, ShieldCheck, Undo2, WalletCards } from "lucide-react";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import "./ManagerWalletPage.scss";

const CUSTOMER_WALLETS = gql`
  query CustomerWallets($restaurantId: ID, $search: String) {
    customers(restaurantId: $restaurantId, search: $search, includeGuests: false) {
      id
      fullName
      email
      phone
      status
      loyaltyPoints
      totalOrders
      totalSpending
      wallet { provider status balance currency updatedAt }
    }
  }
`;

const REFUND_TO_WALLET = gql`
  mutation RefundToWallet($input: RefundToWalletInput!) {
    refundToWallet(input: $input) {
      ok
      message
      amount
      refundId
      wallet { provider status balance currency updatedAt }
      transaction { id type amount balanceBefore balanceAfter status createdAt metadata }
    }
  }
`;

const ADJUST_WALLET_BALANCE = gql`
  mutation AdjustWalletBalance($input: AdjustWalletBalanceInput!) {
    adjustWalletBalance(input: $input) {
      ok
      message
      wallet { provider status balance currency updatedAt }
      transaction { id type amount balanceBefore balanceAfter status createdAt metadata }
    }
  }
`;

const fmt = (value = 0) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const Field = ({ label, children }) => (
  <label className="wallet-admin-field">
    <span>{label}</span>
    {children}
  </label>
);

function WalletActionModal({ mode, customer, restaurantId, onClose, onSubmit, loading }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [orderIdsText, setOrderIdsText] = useState("");
  const [direction, setDirection] = useState("credit");
  const amountNumber = Number(amount || 0);
  const isAdjust = mode === "adjust";
  const valid = customer?.id && amountNumber > 0 && reason.trim() && (isAdjust || restaurantId);

  const submit = () => {
    if (!valid) return;
    if (isAdjust) {
      onSubmit({
        userId: customer.id,
        amount: direction === "debit" ? -Math.abs(amountNumber) : Math.abs(amountNumber),
        reason: reason.trim(),
      });
      return;
    }
    const orderIds = orderIdsText
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    onSubmit({
      restaurantId,
      userId: customer.id,
      orderIds,
      amount: amountNumber,
      reason: reason.trim(),
      referenceType: "MANAGER_WALLET_REFUND",
    });
  };

  return (
    <div className="wallet-admin-modal-backdrop" role="dialog" aria-modal="true">
      <div className="wallet-admin-modal">
        <button type="button" className="wallet-admin-modal__close" onClick={onClose}>×</button>
        <p className="wallet-admin-eyebrow">{isAdjust ? "Điều chỉnh ví" : "Hoàn tiền về ví"}</p>
        <h3>{customer?.fullName || "Khách hàng"}</h3>
        <div className="wallet-admin-modal__summary">
          <span>Số dư hiện tại</span>
          <strong>{fmt(customer?.wallet?.balance)}</strong>
          <small>{customer?.phone || customer?.email || customer?.id}</small>
        </div>

        {isAdjust && (
          <Field label="Hướng điều chỉnh">
            <select value={direction} onChange={(event) => setDirection(event.target.value)}>
              <option value="credit">Cộng tiền vào ví</option>
              <option value="debit">Trừ tiền khỏi ví</option>
            </select>
          </Field>
        )}

        <Field label="Số tiền">
          <input type="number" min="1000" step="1000" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ví dụ: 50000" />
        </Field>

        {!isAdjust && (
          <Field label="Order ID liên quan, mỗi dòng một mã, có thể bỏ trống">
            <textarea value={orderIdsText} onChange={(event) => setOrderIdsText(event.target.value)} placeholder="Dán orderId nếu muốn gắn refund với đơn cụ thể" />
          </Field>
        )}

        <Field label="Lý do bắt buộc">
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder={isAdjust ? "Ví dụ: Điều chỉnh sai lệch sau đối soát" : "Ví dụ: Hoàn tiền do nhà hàng hủy món"} />
        </Field>

        <button type="button" className="wallet-admin-primary" disabled={!valid || loading} onClick={submit}>
          {loading ? "Đang xử lý..." : isAdjust ? "Xác nhận điều chỉnh" : "Hoàn tiền về ví"}
        </button>
      </div>
    </div>
  );
}

export default function ManagerWalletPage() {
  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
  } = useManagerRestaurantSelection();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");

  const { data, loading, error, refetch } = useQuery(CUSTOMER_WALLETS, {
    variables: { restaurantId: selectedRestaurantId || null, search: search.trim() || null },
    skip: restaurantsLoading,
    fetchPolicy: "cache-and-network",
  });

  const [refundToWallet, refundState] = useMutation(REFUND_TO_WALLET, {
    onCompleted: (res) => {
      setNotice(res?.refundToWallet?.message || "Đã hoàn tiền về ví.");
      setModal(null);
      refetch();
    },
    onError: (err) => setNotice(err?.message || "Không thể hoàn tiền về ví."),
  });

  const [adjustWallet, adjustState] = useMutation(ADJUST_WALLET_BALANCE, {
    onCompleted: (res) => {
      setNotice(res?.adjustWalletBalance?.message || "Đã điều chỉnh ví.");
      setModal(null);
      refetch();
    },
    onError: (err) => setNotice(err?.message || "Không thể điều chỉnh ví."),
  });

  const customers = data?.customers || [];
  const totals = useMemo(() => {
    return customers.reduce(
      (acc, item) => {
        acc.balance += Number(item?.wallet?.balance || 0);
        acc.active += item?.wallet?.status === "active" ? 1 : 0;
        acc.count += 1;
        return acc;
      },
      { balance: 0, active: 0, count: 0 },
    );
  }, [customers]);

  const modalLoading = refundState.loading || adjustState.loading;

  return (
    <div className="wallet-admin-page">
      <header className="wallet-admin-hero">
        <div>
          <p className="wallet-admin-eyebrow">Cohan Wallet Operations</p>
          <h1>Ví khách hàng</h1>
          <p>Quản lý số dư ví, hoàn tiền từ nhà hàng và điều chỉnh sai lệch có lý do/audit.</p>
        </div>
        <div className="wallet-admin-hero__badge">
          <ShieldCheck size={18} /> Refund về ví thay vì trả tiền mặt thủ công
        </div>
      </header>

      <section className="wallet-admin-toolbar">
        <select value={selectedRestaurantId || ""} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
          <option value="">Tất cả nhà hàng có quyền</option>
          {restaurantOptions.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
          ))}
        </select>
        <div className="wallet-admin-search">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm khách theo tên, SĐT, email" />
        </div>
        <button type="button" onClick={() => refetch()} disabled={loading}>
          <RefreshCw size={16} /> Làm mới
        </button>
      </section>

      {notice && <div className="wallet-admin-notice">{notice}</div>}
      {error && <div className="wallet-admin-notice wallet-admin-notice--error">{error.message}</div>}

      <section className="wallet-admin-stats">
        <article><WalletCards size={18} /><span>Tổng số dư</span><strong>{fmt(totals.balance)}</strong></article>
        <article><ShieldCheck size={18} /><span>Ví active</span><strong>{totals.active}/{totals.count}</strong></article>
        <article><Undo2 size={18} /><span>Khách đang hiển thị</span><strong>{customers.length}</strong></article>
      </section>

      <section className="wallet-admin-table-card">
        <div className="wallet-admin-table-card__header">
          <h2>Danh sách ví khách hàng</h2>
          <span>{loading ? "Đang tải..." : `${customers.length} khách`}</span>
        </div>
        <div className="wallet-admin-table">
          {customers.map((customer) => (
            <article key={customer.id} className="wallet-admin-row">
              <div>
                <strong>{customer.fullName || "Khách hàng"}</strong>
                <span>{customer.phone || customer.email || customer.id}</span>
                <small>{customer.totalOrders || 0} đơn · {fmt(customer.totalSpending)} · {customer.loyaltyPoints || 0} điểm</small>
              </div>
              <div className="wallet-admin-balance">
                <strong>{fmt(customer?.wallet?.balance)}</strong>
                <span>{customer?.wallet?.status || "active"} · {customer?.wallet?.provider || "cohan_wallet"}</span>
              </div>
              <div className="wallet-admin-actions">
                <button type="button" onClick={() => setModal({ mode: "refund", customer })}>Hoàn về ví</button>
                <button type="button" onClick={() => setModal({ mode: "adjust", customer })}>Điều chỉnh</button>
              </div>
            </article>
          ))}
          {!customers.length && !loading && <div className="wallet-admin-empty">Chưa tìm thấy khách hàng phù hợp.</div>}
        </div>
      </section>

      {modal && (
        <WalletActionModal
          mode={modal.mode}
          customer={modal.customer}
          restaurantId={selectedRestaurantId}
          loading={modalLoading}
          onClose={() => setModal(null)}
          onSubmit={(input) => {
            if (modal.mode === "adjust") adjustWallet({ variables: { input } });
            else refundToWallet({ variables: { input } });
          }}
        />
      )}
    </div>
  );
}
