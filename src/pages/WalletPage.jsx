import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CircleCheck,
  Clock3,
  CreditCard,
  History,
  RefreshCw,
  ShieldCheck,
  Smartphone,
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
      paymentSession { id provider reference amount status payUrl qrCodeUrl deeplink createdAt }
    }
  }
`;

const PAYMENT_SESSION = gql`
  query WalletPaymentSession($id: ID!) {
    paymentSession(id: $id) {
      id
      provider
      reference
      amount
      status
      payUrl
      qrCodeUrl
      deeplink
      createdAt
    }
  }
`;

const numberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatVND = (value = 0) => `${numberFormatter.format(Number(value || 0))}đ`;
const formatDateTime = (value) => {
  if (!value) return "Chưa có dữ liệu";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa có dữ liệu"
    : dateTimeFormatter.format(date);
};

const typeMeta = {
  TOPUP: { label: "Nạp ví", icon: ArrowDownLeft, tone: "success" },
  PAYMENT: { label: "Thanh toán", icon: ArrowUpRight, tone: "payment" },
  REFUND: { label: "Hoàn tiền", icon: ArrowDownLeft, tone: "refund" },
  ADJUSTMENT: { label: "Điều chỉnh", icon: RefreshCw, tone: "adjust" },
};

const providerOptions = [
  {
    value: "momo",
    label: "MoMo",
    description: "Thanh toán nhanh bằng ví điện tử",
    icon: Smartphone,
  },
  {
    value: "vnpay",
    label: "VNPAY",
    description: "Thẻ ngân hàng và cổng Sandbox",
    icon: CreditCard,
  },
];

const paymentStatusLabels = {
  pending: "Đang chờ thanh toán",
  success: "Thanh toán thành công",
  failed: "Thanh toán thất bại",
  expired: "Phiên đã hết hạn",
  cancelled: "Phiên đã hủy",
};

export default function WalletPage() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery(MY_WALLET, {
    fetchPolicy: "cache-and-network",
  });
  const [topupAmount, setTopupAmount] = useState(100000);
  const [topupProvider, setTopupProvider] = useState("");
  const [notice, setNotice] = useState("");
  const [activePayment, setActivePayment] = useState(null);
  const [createTopup, { loading: toppingUp }] = useMutation(
    CREATE_WALLET_TOPUP,
    {
      onCompleted: (result) => {
        const session = result?.createWalletTopup?.paymentSession;
        setActivePayment(session || null);
        setNotice(result?.createWalletTopup?.message || "Đã tạo phiên nạp ví.");
        if (!session) refetch();
      },
      onError: (err) => setNotice(err?.message || "Không thể nạp ví."),
    },
  );

  const { data: paymentData, startPolling, stopPolling } = useQuery(
    PAYMENT_SESSION,
    {
      variables: { id: activePayment?.id || "000000000000000000000000" },
      skip: !activePayment?.id,
      fetchPolicy: "network-only",
    },
  );
  const summary = data?.myWallet;
  const transactions = data?.myWalletTransactions || [];
  const quickAmounts = [50000, 100000, 200000, 500000];
  const walletUpdatedAt = summary?.wallet?.updatedAt;
  const currentPayment = paymentData?.paymentSession || activePayment;

  useEffect(() => {
    if (!activePayment?.id) return undefined;
    startPolling(4000);
    return () => stopPolling();
  }, [activePayment?.id, startPolling, stopPolling]);

  useEffect(() => {
    const status = String(currentPayment?.status || "").toLowerCase();
    if (!status || status === "pending") return;
    stopPolling();
    if (status === "success") {
      setNotice("Đã nạp ví thành công.");
      refetch();
    } else {
      setNotice(`Phiên nạp ví ${status}. Vui lòng thử lại.`);
    }
  }, [currentPayment?.status, stopPolling, refetch]);

  const stats = useMemo(
    () => [
      {
        label: "Tổng đã nạp",
        value: formatVND(summary?.lifetimeTopup),
        icon: ArrowDownLeft,
      },
      {
        label: "Đã thanh toán",
        value: formatVND(summary?.lifetimePayment),
        icon: ArrowUpRight,
      },
      {
        label: "Đã hoàn tiền",
        value: formatVND(summary?.lifetimeRefund),
        icon: RefreshCw,
      },
      {
        label: "Số giao dịch",
        value: summary?.transactionCount || transactions.length || 0,
        icon: History,
      },
    ],
    [summary, transactions.length],
  );

  const handleTopup = () => {
    const amount = Number(topupAmount || 0);
    if (!["momo", "vnpay"].includes(topupProvider)) {
      setNotice("Vui lòng chọn MoMo hoặc VNPAY trước khi tạo phiên thanh toán.");
      return;
    }
    if (!(amount >= 1000)) {
      setNotice("Số tiền nạp tối thiểu là 1.000đ.");
      return;
    }
    createTopup({
      variables: {
        input: {
          amount,
          provider: topupProvider,
          metadata: { source: "customer_wallet_page" },
        },
      },
    });
  };

  const noticeTone = error
    ? "error"
    : notice.toLowerCase().includes("thành công")
      ? "success"
      : "info";
  const paymentStatus = String(currentPayment?.status || "pending").toLowerCase();

  return (
    <div className="wallet-page" aria-labelledby="wallet-title">
      <div className="wallet-page__shell">
        <section className="wallet-page__hero" aria-labelledby="wallet-title">
          <div className="wallet-page__hero-toolbar">
            <button
              type="button"
              className="wallet-page__back"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              Quay lại
            </button>
            <span className="wallet-page__status-pill">
              <span aria-hidden="true" />
              {summary?.status === "active"
                ? "Ví đang hoạt động"
                : summary?.status || "Đang khởi tạo"}
            </span>
          </div>

          <div className="wallet-page__hero-content">
            <div className="wallet-page__brand">
              <div className="wallet-page__icon" aria-hidden="true">
                <WalletCards size={30} />
              </div>
              <div>
                <p>Ví Cohan Balance</p>
                <h1 id="wallet-title">{formatVND(summary?.balance)}</h1>
                <span>Sẵn sàng thanh toán tại các nhà hàng COHAN</span>
              </div>
            </div>

            <div className="wallet-page__secure">
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <strong>Số dư được đối soát</strong>
                <span>Mọi thay đổi đều có lịch sử giao dịch đi kèm.</span>
              </div>
            </div>
          </div>
        </section>

        {(loading || error || notice) && (
          <div
            className={`wallet-page__notice wallet-page__notice--${noticeTone}`}
            role={error ? "alert" : "status"}
            aria-live="polite"
          >
            {loading && !error ? "Đang đồng bộ ví…" : error?.message || notice}
          </div>
        )}

        <div className="wallet-page__layout">
          <section
            className="wallet-page__panel wallet-page__topup"
            aria-labelledby="wallet-topup-title"
          >
            <header className="wallet-page__section-heading">
              <p className="wallet-page__eyebrow">Nạp ví an toàn</p>
              <h2 id="wallet-topup-title">Nạp tiền vào Cohan Balance</h2>
              <p>
                Chọn cổng thanh toán và số tiền. Số dư chỉ được cộng sau khi
                nhà cung cấp xác nhận giao dịch thành công.
              </p>
            </header>

            <form
              className="wallet-page__topup-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleTopup();
              }}
            >
              <fieldset
                className="wallet-page__providers"
                aria-describedby="wallet-provider-help"
              >
                <legend>Cổng thanh toán</legend>
                <div className="wallet-page__provider-grid">
                  {providerOptions.map((provider) => {
                    const ProviderIcon = provider.icon;
                    const selected = topupProvider === provider.value;
                    return (
                      <label
                        key={provider.value}
                        className={`wallet-page__provider${selected ? " is-selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="walletTopupProvider"
                          value={provider.value}
                          checked={selected}
                          onChange={(event) => {
                            setTopupProvider(event.target.value);
                            setNotice("");
                          }}
                        />
                        <span className="wallet-page__provider-icon" aria-hidden="true">
                          <ProviderIcon size={21} />
                        </span>
                        <span className="wallet-page__provider-copy">
                          <strong>{provider.label}</strong>
                          <small>{provider.description}</small>
                        </span>
                        <CircleCheck
                          className="wallet-page__provider-check"
                          size={20}
                          aria-hidden="true"
                        />
                      </label>
                    );
                  })}
                </div>
                <p id="wallet-provider-help">
                  VNPAY hỗ trợ thẻ ngân hàng trong môi trường Sandbox hiện tại.
                </p>
              </fieldset>

              <div className="wallet-page__amount-section">
                <div className="wallet-page__field-heading">
                  <label htmlFor="wallet-topup-amount">Số tiền nạp</label>
                  <span>Tối thiểu 1.000đ</span>
                </div>

                <div
                  className="wallet-page__quick-amounts"
                  aria-label="Chọn nhanh số tiền nạp"
                >
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className={Number(topupAmount) === amount ? "active" : ""}
                      aria-pressed={Number(topupAmount) === amount}
                      onClick={() => {
                        setTopupAmount(amount);
                        setNotice("");
                      }}
                    >
                      {formatVND(amount)}
                    </button>
                  ))}
                </div>

                <div className="wallet-page__amount-control">
                  <input
                    id="wallet-topup-amount"
                    name="walletTopupAmount"
                    type="number"
                    min="1000"
                    step="1000"
                    inputMode="numeric"
                    autoComplete="off"
                    value={topupAmount}
                    onChange={(event) => {
                      setTopupAmount(event.target.value);
                      setNotice("");
                    }}
                  />
                  <span>VND</span>
                </div>
              </div>

              <button
                type="submit"
                className="wallet-page__primary"
                disabled={toppingUp || !topupProvider}
              >
                <CreditCard size={19} aria-hidden="true" />
                {toppingUp ? "Đang tạo phiên…" : "Tạo phiên thanh toán"}
              </button>
            </form>

            {currentPayment && (
              <section
                className={`wallet-page__payment-session wallet-page__payment-session--${paymentStatus}`}
                aria-labelledby="wallet-payment-session-title"
                aria-live="polite"
              >
                <div className="wallet-page__payment-session-copy">
                  <p>Phiên thanh toán</p>
                  <h3 id="wallet-payment-session-title">
                    {currentPayment.provider?.toUpperCase() || "Cổng thanh toán"}
                  </h3>
                  <dl>
                    <div>
                      <dt>Số tiền</dt>
                      <dd>{formatVND(currentPayment.amount)}</dd>
                    </div>
                    <div>
                      <dt>Mã tham chiếu</dt>
                      <dd>{currentPayment.reference || "Đang tạo"}</dd>
                    </div>
                    <div>
                      <dt>Trạng thái</dt>
                      <dd>
                        {paymentStatusLabels[paymentStatus] || currentPayment.status}
                      </dd>
                    </div>
                  </dl>
                </div>

                {currentPayment.qrCodeUrl && (
                  <img
                    src={currentPayment.qrCodeUrl}
                    alt={`QR thanh toán ${currentPayment.provider}`}
                    width="164"
                    height="164"
                  />
                )}

                <div className="wallet-page__payment-actions">
                  {currentPayment.payUrl && (
                    <a
                      className="wallet-page__pay-link"
                      href={currentPayment.payUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở trang thanh toán
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </a>
                  )}
                  {currentPayment.deeplink && (
                    <a
                      className="wallet-page__pay-link wallet-page__pay-link--secondary"
                      href={currentPayment.deeplink}
                    >
                      Mở ứng dụng
                    </a>
                  )}
                </div>
              </section>
            )}
          </section>

          <aside
            className="wallet-page__panel wallet-page__summary"
            aria-labelledby="wallet-summary-title"
          >
            <header className="wallet-page__summary-header">
              <div>
                <p className="wallet-page__eyebrow">Tổng quan ví</p>
                <h2 id="wallet-summary-title">Dòng tiền của bạn</h2>
              </div>
              <WalletCards size={24} aria-hidden="true" />
            </header>

            <div className="wallet-page__stats">
              {stats.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.label}
                    aria-label={`${item.label}: ${item.value}`}
                  >
                    <span className="wallet-page__stat-icon" aria-hidden="true">
                      <Icon size={18} />
                    </span>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                );
              })}
            </div>

            <div
              className="wallet-page__updated-card"
              aria-label={`Cập nhật gần nhất: ${formatDateTime(walletUpdatedAt)}`}
            >
              <Clock3 size={18} aria-hidden="true" />
              <div>
                <span>Cập nhật gần nhất</span>
                <strong>{formatDateTime(walletUpdatedAt)}</strong>
              </div>
            </div>

            <div className="wallet-page__summary-note">
              <ShieldCheck size={18} aria-hidden="true" />
              <p>
                COHAN chỉ cập nhật số dư khi cổng thanh toán phản hồi thành công.
              </p>
            </div>
          </aside>
        </div>

        <section
          className="wallet-page__panel wallet-page__history"
          aria-labelledby="wallet-history-title"
        >
          <div className="wallet-page__history-header">
            <div>
              <p className="wallet-page__eyebrow">Lịch sử ví</p>
              <h2 id="wallet-history-title">Giao dịch gần đây</h2>
            </div>
            <button type="button" onClick={() => refetch()} disabled={loading}>
              <RefreshCw size={16} aria-hidden="true" />
              {loading ? "Đang làm mới…" : "Làm mới"}
            </button>
          </div>

          {!transactions.length ? (
            <div className="wallet-page__empty" role="status">
              <span className="wallet-page__empty-icon" aria-hidden="true">
                <History size={24} />
              </span>
              <strong>Chưa có giao dịch ví</strong>
              <p>
                Các lần nạp, thanh toán và hoàn tiền sẽ xuất hiện tại đây để bạn
                dễ đối soát.
              </p>
              <a href="#wallet-topup-title">Nạp tiền đầu tiên</a>
            </div>
          ) : (
            <div
              className="wallet-page__transactions"
              role="list"
              aria-label="Danh sách giao dịch ví"
            >
              {transactions.map((tx) => {
                const meta = typeMeta[tx.type] || typeMeta.ADJUSTMENT;
                const Icon = meta.icon;
                const sign = tx.type === "PAYMENT" ? "-" : "+";
                return (
                  <article
                    className={`wallet-page__transaction wallet-page__transaction--${meta.tone}`}
                    key={tx.id}
                    role="listitem"
                  >
                    <div className="wallet-page__transaction-icon" aria-hidden="true">
                      <Icon size={18} />
                    </div>
                    <div className="wallet-page__transaction-copy">
                      <strong>{meta.label}</strong>
                      <span>{formatDateTime(tx.createdAt)}</span>
                      {tx.referenceType && <small>{tx.referenceType}</small>}
                    </div>
                    <div className="wallet-page__transaction-amount">
                      <strong>
                        {sign}
                        {formatVND(tx.amount)}
                      </strong>
                      <span>Số dư sau giao dịch: {formatVND(tx.balanceAfter)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
