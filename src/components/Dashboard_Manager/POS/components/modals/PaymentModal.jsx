// src/components/Dashboard_Manager/POS/components/panels/modals/PaymentModal.jsx
import React, { useState, useEffect, memo } from "react";
import s from "./PaymentModal.module.scss";
import { formatPrice } from "@/utils/formatters";
import useOrderManagement from "@/hooks/useOrderManagement";
import { usePos } from "@/context/PosContext";
import { useRestaurantCurrency } from "@/hooks/useRestaurantCurrency";
import { convertCurrencyAmount } from "@/utils/currency";
import useModalKeyboardClose from "./useModalKeyboardClose";

const QRCodePlaceholder = ({ value }) => (
  <div className={s.qrImage}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width="140"
      height="140"
    >
      <rect width="100" height="100" fill="#f0f9ff" />
      <text
        x="50"
        y="50"
        dy=".3em"
        textAnchor="middle"
        fontSize="10"
        fill="#0c4a6e"
      >
        QR Placeholder
      </text>
      <text
        x="50"
        y="65"
        dy=".3em"
        textAnchor="middle"
        fontSize="8"
        fill="#0284c7"
      >
        {value}
      </text>
    </svg>
  </div>
);

function PaymentModal({
  isOpen,
  order,
  table,
  onClose,
  onConfirm,
  onComplete,
  totalAmount,
}) {
  const [method, setMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [isConfirming, setIsConfirming] = useState(false);

  const pos = usePos?.() || null;
  const restaurantId =
    table?.restaurantId ||
    table?.restaurant_id ||
    pos?.currentTable?.restaurantId ||
    null;

  const { activeCurrency, setActiveCurrency, usdToVndRate } =
    useRestaurantCurrency(restaurantId);
  const { validatePayment, confirmPayment, payLoading } = useOrderManagement(pos);

  const busy = Boolean(payLoading);
  const convertedTotalAmount = convertCurrencyAmount(
    Number(totalAmount || 0),
    "VND",
    activeCurrency,
    usdToVndRate,
  );

  const changeAmount = Math.max(0, (Number(paidAmount) || 0) - convertedTotalAmount);

  useEffect(() => {
    if (method === "card" || method === "transfer") setPaidAmount(convertedTotalAmount || 0);
    else setPaidAmount(0);
    setIsConfirming(false);
  }, [method, isOpen, convertedTotalAmount]);

  const handleSuggestion = (v) => setPaidAmount(v === "exact" ? convertedTotalAmount || 0 : v);
  const handleShowConfirm = () => !busy && setIsConfirming(true);

  const mapNote = () =>
    method === "cash"
      ? `Khách đưa ${formatPrice(paidAmount, { currency: activeCurrency })} - Thối lại ${formatPrice(
          changeAmount,
          { currency: activeCurrency },
        )}`
      : `Thanh toán ${method.toUpperCase()}`;

  const suggestions = (() => {
    const total = Number(convertedTotalAmount || 0);
    if (total <= 0) return [50000, 100000, 200000];
    const sgs = new Set();
    sgs.add(Math.ceil(total / 1000) * 1000);
    if (total < 100000) {
      sgs.add(100000);
      sgs.add(200000);
      sgs.add(500000);
    } else if (total < 500000) {
      sgs.add(Math.ceil(total / 100000) * 100000);
      sgs.add(500000);
      sgs.add(1000000);
    } else {
      sgs.add(Math.ceil(total / 100000) * 100000);
      sgs.add(1000000);
      sgs.add(2000000);
    }
    return Array.from(sgs)
      .filter((v) => v >= total)
      .slice(0, 3);
  })();

  const executePayment = async () => {
    if (busy) return;
    if (!restaurantId) {
      alert("Thiếu restaurantId. Vui lòng chọn bàn và lưu đơn trước.");
      return;
    }

    const check = validatePayment({
      method,
      paidAmount: Number(paidAmount || 0),
      total: Number(convertedTotalAmount || 0),
    });
    if (!check.ok) {
      alert(check.message);
      return;
    }

    const paidAmountVnd = convertCurrencyAmount(
      Number(paidAmount || 0),
      activeCurrency,
      "VND",
      usdToVndRate,
    );

    const res = await confirmPayment({
      restaurantId,
      method,
      paidAmount: paidAmountVnd,
      note: mapNote(),
    });

    if (!res?.success) {
      alert(res?.message || "Thanh toán thất bại.");
      return;
    }

    onConfirm?.(method, paidAmount);
    onComplete?.({
      orderId: order?.[0]?.orderId || order?.[0]?.id || null,
      method,
      paidAmount: Number(paidAmount || 0),
      total: Number(convertedTotalAmount || 0),
      change: changeAmount,
      currency: activeCurrency,
      status: "COMPLETED",
      server: res?.data || null,
    });

    setIsConfirming(false);
    onClose?.();
  };

  const isCash = method === "cash";
  const isTransfer = method === "transfer";
  const disableConfirm =
    busy || (isCash && Number(paidAmount || 0) < Number(convertedTotalAmount || 0));
  useModalKeyboardClose({ isOpen, onClose, disabled: busy || isConfirming });
  if (!isOpen) return null;

  return (
    <div
      className={s.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={s.modal} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
        <button className={s.closeButton} onClick={onClose} disabled={busy}>
          &times;
        </button>

        <h3 className={s.title}>🧾 Thanh Toán Hóa Đơn</h3>
        <p className={s.orderInfo}>
          Bàn: <b>{table?.code || "..."}</b> | Hóa đơn: <b>{order?.[0]?.orderCode || "..."}</b>
        </p>

        <div className={s.group}>
          <label className={s.label}>Tiền tệ hóa đơn</label>
          <div className={s.grid}>
            {["VND", "USD"].map((cur) => (
              <button
                key={cur}
                className={`${s.btn} ${activeCurrency === cur ? s.active : ""}`}
                onClick={() => {
                  const nextPaid = convertCurrencyAmount(
                    Number(paidAmount || 0),
                    activeCurrency,
                    cur,
                    usdToVndRate,
                  );
                  setActiveCurrency(cur);
                  setPaidAmount(nextPaid);
                }}
                disabled={isConfirming || busy}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>

        <div className={s.mainContent}>
          <div className={s.leftPanel}>
            <h4 className={s.panelTitle}>Chi tiết Hóa đơn</h4>
            <div className={s.itemsList}>
              {Array.isArray(order) && order.length > 0 ? (
                order.map((item, index) => (
                  <div key={item._lineId || item.dishId || index} className={s.itemRow}>
                    <div className={s.itemInfo}>
                      <span className={s.itemName}>
                        {item.quantity} x {item.name}
                      </span>
                      <span className={s.itemPrice}>
                        {formatPrice(
                          convertCurrencyAmount(
                            (item.price || 0) + (item.modifiersPrice || 0),
                            "VND",
                            activeCurrency,
                            usdToVndRate,
                          ),
                          { currency: activeCurrency },
                        )}
                      </span>
                    </div>
                    <div className={s.itemTotal}>
                      {formatPrice(
                        convertCurrencyAmount(
                          ((item.price || 0) + (item.modifiersPrice || 0)) * (item.quantity || 0),
                          "VND",
                          activeCurrency,
                          usdToVndRate,
                        ),
                        { currency: activeCurrency },
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className={s.itemRow}>
                  <span className={s.itemName}>Chưa có món nào...</span>
                </div>
              )}
            </div>
          </div>

          <div className={s.rightPanel}>
            <div className={s.summary}>
              <div className={`${s.row} ${s.totalRow}`}>
                <span className={s.label}>Khách cần trả</span>
                <span className={s.totalAmount}>
                  {formatPrice(convertedTotalAmount || 0, { currency: activeCurrency })}
                </span>
              </div>
            </div>

            <div className={s.group}>
              <label className={s.label}>Chọn phương thức</label>
              <div className={s.grid}>
                {["cash", "card", "transfer"].map((m) => (
                  <button
                    key={m}
                    className={`${s.btn} ${method === m ? s.active : ""}`}
                    onClick={() => setMethod(m)}
                    disabled={isConfirming || busy}
                  >
                    {m === "cash" ? "Tiền mặt" : m === "card" ? "Thẻ" : "Chuyển khoản"}
                  </button>
                ))}
              </div>
            </div>

            {isTransfer && (
              <div className={s.transferInfo}>
                <div className={s.paymentDetails}>
                  <div className={s.detailItem}>
                    <span>Ngân hàng:</span> <b>Vietcombank</b>
                  </div>
                  <div className={s.detailItem}>
                    <span>Số TK:</span> <b>1234567890</b>
                  </div>
                  <div className={s.detailItem}>
                    <span>Số tiền:</span>{" "}
                    <b>{formatPrice(convertedTotalAmount || 0, { currency: activeCurrency })}</b>
                  </div>
                </div>
                <div className={s.qrCode}>
                  <QRCodePlaceholder
                    value={formatPrice(convertedTotalAmount || 0, { currency: activeCurrency })}
                  />
                </div>
              </div>
            )}

            {isCash && (
              <div className={s.group}>
                <label className={s.label}>Số tiền khách đưa</label>
                <input
                  type="number"
                  className={s.input}
                  value={paidAmount || ""}
                  onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
                  placeholder="0"
                  autoFocus
                  disabled={isConfirming || busy}
                />
                <div className={s.suggestions}>
                  {suggestions.map((val) => (
                    <button
                      key={val}
                      className={s.suggestionBtn}
                      onClick={() => handleSuggestion(val)}
                      disabled={isConfirming || busy}
                    >
                      {formatPrice(val, { currency: activeCurrency })}
                    </button>
                  ))}
                </div>
                <div className={`${s.row} ${s.changeRow}`}>
                  <span className={s.label}>Tiền thối lại</span>
                  <span className={s.changeAmount}>
                    {formatPrice(changeAmount, { currency: activeCurrency })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={s.actions}>
          {!isConfirming ? (
            <>
              <button className={s.secondary} onClick={onClose} disabled={busy}>
                Quay lại
              </button>
              <button className={s.success} onClick={handleShowConfirm} disabled={disableConfirm}>
                Hoàn tất thanh toán
              </button>
            </>
          ) : (
            <>
              <button className={s.secondary} onClick={() => setIsConfirming(false)} disabled={busy}>
                Quay lại
              </button>
              <button className={`${s.success} ${busy ? s.loading : ""}`} onClick={executePayment} disabled={busy}>
                {busy ? <span className={s.spinner}></span> : "XÁC NHẬN"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(PaymentModal);
