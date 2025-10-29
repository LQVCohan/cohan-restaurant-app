import React, { useState } from "react";
import s from "./PaymentModal.module.scss";
import { formatPrice } from "../../utils/format";

export function PaymentModal({ isOpen, totals, onComplete, onClose }) {
  const [method, setMethod] = useState("cash");
  const [paid, setPaid] = useState(0);

  if (!isOpen) return null;
  const change = Math.max(0, paid - (totals?.total || 0));

  return (
    <div className={s.backdrop}>
      <div className={s.modal}>
        <h3 className={s.title}>Thanh toán</h3>
        <div className={s.group}>
          <label>Phương thức:</label>
          <div className={s.grid}>
            {["cash", "card", "transfer"].map((m) => (
              <button
                key={m}
                className={`${s.btn} ${method === m ? s.active : ""}`}
                onClick={() => setMethod(m)}
              >
                {m === "cash"
                  ? "Tiền mặt"
                  : m === "card"
                  ? "Thẻ"
                  : "Chuyển khoản"}
              </button>
            ))}
          </div>
        </div>

        <div className={s.group}>
          <label>Số tiền khách đưa:</label>
          <input
            type="number"
            className={s.input}
            value={paid}
            onChange={(e) => setPaid(Number(e.target.value) || 0)}
          />
        </div>

        <div className={s.row}>
          <span>Tổng tiền:</span>
          <span>{formatPrice(totals?.total || 0)}</span>
        </div>
        <div className={s.row}>
          <span>Tiền thừa:</span>
          <span>{formatPrice(change)}</span>
        </div>

        {/* Hiển thị thông tin chuyển khoản nếu phương thức thanh toán là chuyển khoản */}
        {method === "transfer" && (
          <div className={s.transferInfo}>
            <h4>Thông tin chuyển khoản</h4>
            <div className={s.paymentDetails}>
              <div className={s.detailItem}>
                <span>Số tài khoản:</span>
                <span>1234567890</span>
              </div>
              <div className={s.detailItem}>
                <span>Ngân hàng:</span>
                <span>Vietcombank</span>
              </div>
              <div className={s.detailItem}>
                <span>Chủ tài khoản:</span>
                <span>Golden Dragon Restaurant</span>
              </div>
            </div>
            <div className={s.qrCode}>
              <img
                src="https://via.placeholder.com/150" // Bạn có thể thay bằng mã QR thực tế
                alt="QR Code"
                className={s.qrImage}
              />
              <p>Quét mã QR để thanh toán</p>
            </div>
          </div>
        )}

        <div className={s.actions}>
          <button className={s.secondary} onClick={onClose}>
            Hủy
          </button>
          <button
            className={s.success}
            onClick={() => onComplete?.({ method, paid, change })}
          >
            Hoàn tất
          </button>
        </div>
      </div>
    </div>
  );
}
