import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  RefreshCw,
  Search,
  ShieldCheck,
  Undo2,
  WalletCards,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import { hasAnyPermission } from "@/utils/frontendPermissionAccess";
import "./ManagerWalletPage.scss";

const CUSTOMER_WALLETS = gql`
  query CustomerWallets($restaurantId: ID, $search: String) {
    customers(
      restaurantId: $restaurantId
      search: $search
      includeGuests: false
    ) {
      id
      fullName
      email
      phone
      status
      loyaltyPoints
      totalOrders
      totalSpending
      wallet {
        provider
        status
        balance
        currency
        updatedAt
      }
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
      wallet {
        provider
        status
        balance
        currency
        updatedAt
      }
      transaction {
        id
        type
        amount
        balanceBefore
        balanceAfter
        status
        createdAt
        metadata
      }
    }
  }
`;

const ADJUST_WALLET_BALANCE = gql`
  mutation AdjustWalletBalance($input: AdjustWalletBalanceInput!) {
    adjustWalletBalance(input: $input) {
      ok
      message
      wallet {
        provider
        status
        balance
        currency
        updatedAt
      }
      transaction {
        id
        type
        amount
        balanceBefore
        balanceAfter
        status
        createdAt
        metadata
      }
    }
  }
`;

const fmt = (value = 0) =>
  `${Number(value || 0).toLocaleString("vi-VN")}đ`;
const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString("vi-VN") : "Chưa cập nhật";
const walletOf = (customer = {}) =>
  customer.wallet || {
    balance: 0,
    currency: "VND",
    provider: "cohan_wallet",
    status: "active",
  };

const WALLET_STATUS_LABELS = {
  active: "Đang hoạt động",
  inactive: "Ngưng hoạt động",
  locked: "Tạm khóa",
  suspended: "Tạm khóa",
};

const WALLET_PROVIDER_LABELS = {
  cohan_wallet: "Ví Cohan",
  sandbox: "Ví thử nghiệm",
};

const friendlyWalletError = (message = "") => {
  const text = String(message || "").toLowerCase();
  if (text.includes("negative")) return "Số dư ví không được âm.";
  if (text.includes("invalid wallet amount")) {
    return "Số tiền ví không hợp lệ.";
  }
  if (text.includes("invalid restaurantid") || text.includes("restaurant")) {
    return "Vui lòng chọn đúng nhà hàng trước khi thao tác.";
  }
  if (
    text.includes("exactly one refund order") ||
    text.includes("refund order is required")
  ) {
    return "Hoàn tiền về ví phải gắn với đúng một đơn hàng.";
  }
  if (text.includes("customer does not belong")) {
    return "Khách hàng không thuộc phạm vi nhà hàng đã chọn.";
  }
  if (text.includes("forbidden")) {
    return "Bạn chưa có quyền thực hiện thao tác này.";
  }
  return "Không thể cập nhật ví khách hàng. Vui lòng thử lại.";
};

const getWalletStatusLabel = (status) =>
  WALLET_STATUS_LABELS[String(status || "active").toLowerCase()] ||
  "Đang hoạt động";
const getWalletProviderLabel = (provider) =>
  WALLET_PROVIDER_LABELS[
    String(provider || "cohan_wallet").toLowerCase()
  ] || "Ví Cohan";

const Field = ({ label, helper, children }) => (
  <label className="wallet-admin-field">
    <span>{label}</span>
    {children}
    {helper && <small>{helper}</small>}
  </label>
);

function WalletActionModal({
  mode,
  customer,
  restaurantId,
  onClose,
  onSubmit,
  loading,
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [orderIdsText, setOrderIdsText] = useState("");
  const [direction, setDirection] = useState("credit");
  const amountNumber = Number(amount || 0);
  const isAdjust = mode === "adjust";
  const wallet = walletOf(customer);
  const orderIds = orderIdsText
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const valid = Boolean(
    customer?.id &&
      restaurantId &&
      amountNumber > 0 &&
      reason.trim() &&
      (isAdjust || orderIds.length === 1),
  );

  const submit = () => {
    if (!valid) return;
    if (isAdjust) {
      onSubmit({
        restaurantId,
        userId: customer.id,
        amount:
          direction === "debit"
            ? -Math.abs(amountNumber)
            : Math.abs(amountNumber),
        reason: reason.trim(),
      });
      return;
    }
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
        <button
          type="button"
          className="wallet-admin-modal__close"
          onClick={onClose}
          aria-label="Đóng"
        >
          ×
        </button>
        <p className="wallet-admin-eyebrow">
          {isAdjust ? "Điều chỉnh số dư" : "Hoàn tiền về ví"}
        </p>
        <h3>{customer?.fullName || "Khách hàng"}</h3>
        <div className="wallet-admin-modal__summary">
          <span>Số dư hiện tại</span>
          <strong>{fmt(wallet.balance)}</strong>
          <small>{customer?.phone || customer?.email || customer?.id}</small>
        </div>

        {isAdjust && (
          <Field label="Hướng điều chỉnh">
            <select
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
            >
              <option value="credit">Cộng tiền vào ví</option>
              <option value="debit">Trừ tiền khỏi ví</option>
            </select>
          </Field>
        )}

        <Field
          label="Số tiền"
          helper="Nhập số tiền bằng VND, tối thiểu 1.000đ."
        >
          <input
            type="number"
            min="1000"
            step="1000"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Ví dụ: 50.000"
          />
        </Field>

        {!isAdjust && (
          <Field
            label="Mã đơn cần hoàn"
            helper="Bắt buộc nhập đúng một mã đơn thuộc nhà hàng đã chọn."
          >
            <textarea
              value={orderIdsText}
              onChange={(event) => setOrderIdsText(event.target.value)}
              placeholder="Dán một mã đơn"
            />
          </Field>
        )}

        <Field label="Lý do bắt buộc">
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              isAdjust
                ? "Ví dụ: Điều chỉnh sai lệch sau đối soát"
                : "Ví dụ: Hoàn tiền do nhà hàng hủy món"
            }
          />
        </Field>

        {!restaurantId && (
          <p className="wallet-admin-modal__warning">
            Vui lòng chọn một nhà hàng cụ thể trước khi thao tác.
          </p>
        )}
        {!isAdjust && orderIds.length > 1 && (
          <p className="wallet-admin-modal__warning">
            Mỗi lần hoàn tiền chỉ được gắn với một đơn hàng.
          </p>
        )}
        <button
          type="button"
          className="wallet-admin-primary"
          disabled={!valid || loading}
          onClick={submit}
        >
          {loading
            ? "Đang xử lý..."
            : isAdjust
              ? "Xác nhận điều chỉnh"
              : "Hoàn tiền về ví"}
        </button>
      </div>
    </div>
  );
}

export default function ManagerWalletPage() {
  const { user } = useContext(AuthContext) || {};
  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
  } = useManagerRestaurantSelection();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState(null);

  const canRefund = hasAnyPermission(user, ["refund.write"]);
  const canAdjust = hasAnyPermission(user, ["payment.write"]);

  const { data, loading, error, refetch } = useQuery(CUSTOMER_WALLETS, {
    variables: {
      restaurantId: selectedRestaurantId || null,
      search: search.trim() || null,
    },
    skip: restaurantsLoading,
    fetchPolicy: "cache-and-network",
  });

  const [refundToWallet, refundState] = useMutation(REFUND_TO_WALLET, {
    onCompleted: (res) => {
      setNotice({
        type: "success",
        text: res?.refundToWallet?.message || "Đã hoàn tiền về ví.",
      });
      setModal(null);
      refetch();
    },
    onError: (err) =>
      setNotice({ type: "error", text: friendlyWalletError(err?.message) }),
  });

  const [adjustWallet, adjustState] = useMutation(ADJUST_WALLET_BALANCE, {
    onCompleted: (res) => {
      setNotice({
        type: "success",
        text:
          res?.adjustWalletBalance?.message || "Đã điều chỉnh số dư ví.",
      });
      setModal(null);
      refetch();
    },
    onError: (err) =>
      setNotice({ type: "error", text: friendlyWalletError(err?.message) }),
  });

  const customers = data?.customers || [];
  const selectedRestaurantName =
    restaurantOptions.find(
      (restaurant) =>
        String(restaurant.id) === String(selectedRestaurantId),
    )?.name || "Tất cả nhà hàng có quyền";
  const totals = useMemo(
    () =>
      customers.reduce(
        (acc, item) => {
          const wallet = walletOf(item);
          const balance = Number(wallet.balance || 0);
          acc.balance += balance;
          acc.active +=
            String(wallet.status || "active").toLowerCase() === "active"
              ? 1
              : 0;
          acc.withBalance += balance > 0 ? 1 : 0;
          acc.count += 1;
          const updatedAt = wallet.updatedAt
            ? new Date(wallet.updatedAt).getTime()
            : 0;
          acc.lastUpdatedAt = Math.max(
            acc.lastUpdatedAt,
            Number.isFinite(updatedAt) ? updatedAt : 0,
          );
          return acc;
        },
        {
          balance: 0,
          active: 0,
          withBalance: 0,
          count: 0,
          lastUpdatedAt: 0,
        },
      ),
    [customers],
  );
  const averageBalance = totals.count ? totals.balance / totals.count : 0;
  const modalLoading = refundState.loading || adjustState.loading;
  const actionsScoped = Boolean(selectedRestaurantId);

  return (
    <div className="wallet-admin-page wallet-admin-page--polished">
      <header className="wallet-admin-hero">
        <div className="wallet-admin-hero__copy">
          <p className="wallet-admin-eyebrow">Ví & hoàn tiền</p>
          <h1>Ví khách hàng</h1>
          <p>
            Quản lý số dư ví, hoàn tiền từ nhà hàng và điều chỉnh chênh lệch
            có lý do rõ ràng.
          </p>
          <div className="wallet-admin-context-pills">
            <span>{selectedRestaurantName}</span>
            <span>{totals.count} khách đang hiển thị</span>
            <span>
              Cập nhật gần nhất:{" "}
              {totals.lastUpdatedAt
                ? formatDateTime(totals.lastUpdatedAt)
                : "Chưa có dữ liệu"}
            </span>
          </div>
        </div>
        <div className="wallet-admin-hero__panel">
          <WalletCards size={22} />
          <span>Tổng số dư ví</span>
          <strong>{fmt(totals.balance)}</strong>
          <small>Hoàn tiền về ví giúp giảm xử lý tiền mặt thủ công.</small>
        </div>
      </header>

      <section className="wallet-admin-toolbar">
        <select
          value={selectedRestaurantId || ""}
          onChange={(event) => setSelectedRestaurantId(event.target.value)}
          aria-label="Chọn nhà hàng"
        >
          <option value="">Tất cả nhà hàng có quyền</option>
          {restaurantOptions.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </option>
          ))}
        </select>
        <div className="wallet-admin-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm khách theo tên, SĐT, email"
          />
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={loading || restaurantsLoading}
        >
          <RefreshCw size={16} /> Làm mới
        </button>
      </section>

      {notice && (
        <div className={`wallet-admin-notice wallet-admin-notice--${notice.type}`}>
          {notice.text}
        </div>
      )}
      {!actionsScoped && (canRefund || canAdjust) && (
        <div className="wallet-admin-notice wallet-admin-notice--warning">
          Chọn một nhà hàng cụ thể để hoàn tiền hoặc điều chỉnh số dư.
        </div>
      )}
      {!canRefund && !canAdjust && (
        <div className="wallet-admin-notice wallet-admin-notice--warning">
          Bạn có quyền xem ví, nhưng chưa có quyền hoàn tiền hoặc điều chỉnh
          số dư.
        </div>
      )}
      {error && (
        <div className="wallet-admin-notice wallet-admin-notice--error">
          Không thể tải danh sách ví khách hàng. Vui lòng thử lại.
        </div>
      )}

      <section className="wallet-admin-stats" aria-label="Tổng quan ví khách hàng">
        <article>
          <WalletCards size={18} />
          <span>Tổng số dư</span>
          <strong>{fmt(totals.balance)}</strong>
        </article>
        <article>
          <ShieldCheck size={18} />
          <span>Ví đang hoạt động</span>
          <strong>
            {totals.active}/{totals.count}
          </strong>
        </article>
        <article>
          <Undo2 size={18} />
          <span>Có số dư</span>
          <strong>{totals.withBalance}</strong>
        </article>
        <article>
          <WalletCards size={18} />
          <span>Số dư trung bình</span>
          <strong>{fmt(averageBalance)}</strong>
        </article>
      </section>

      <section className="wallet-admin-table-card">
        <div className="wallet-admin-table-card__header">
          <div>
            <p className="wallet-admin-eyebrow">Danh sách ví</p>
          </div>
          <span>{loading ? "Đang tải..." : `${customers.length} khách`}</span>
        </div>
        <div className="wallet-admin-table">
          {customers.map((customer) => {
            const wallet = walletOf(customer);
            return (
              <article key={customer.id} className="wallet-admin-row">
                <div className="wallet-admin-customer">
                  <strong>{customer.fullName || "Khách hàng"}</strong>
                  <span>{customer.phone || customer.email || customer.id}</span>
                  <small>
                    {customer.totalOrders || 0} đơn · {fmt(customer.totalSpending)}
                    {" · "}
                    {customer.loyaltyPoints || 0} điểm
                  </small>
                </div>
                <div className="wallet-admin-balance">
                  <strong>{fmt(wallet.balance)}</strong>
                  <span>
                    {getWalletStatusLabel(wallet.status)} ·{" "}
                    {getWalletProviderLabel(wallet.provider)}
                  </span>
                  <small>Cập nhật: {formatDateTime(wallet.updatedAt)}</small>
                </div>
                <div className="wallet-admin-actions">
                  {canRefund && (
                    <button
                      type="button"
                      disabled={!actionsScoped}
                      onClick={() =>
                        setModal({ mode: "refund", customer })
                      }
                    >
                      Hoàn về ví
                    </button>
                  )}
                  {canAdjust && (
                    <button
                      type="button"
                      disabled={!actionsScoped}
                      onClick={() =>
                        setModal({ mode: "adjust", customer })
                      }
                    >
                      Điều chỉnh
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {!customers.length && !loading && (
            <div className="wallet-admin-empty">
              Chưa tìm thấy khách hàng phù hợp.
            </div>
          )}
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
            if (modal.mode === "adjust") {
              adjustWallet({ variables: { input } });
            } else {
              refundToWallet({ variables: { input } });
            }
          }}
        />
      )}
    </div>
  );
}
