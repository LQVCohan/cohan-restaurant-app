import React, { useMemo, useState } from "react";
import Modal from "../../../common/Modal";
import Button from "../../../common/Button";
import Input from "../../../common/Input";
import "./PaymentModal.scss";

const METHODS = [
  { id: "cash", name: "Tiền mặt", icon: "💵" },
  { id: "card", name: "Thẻ", icon: "💳" },
  { id: "qr", name: "QR", icon: "📱" },
  { id: "transfer", name: "Chuyển khoản", icon: "🏦" },
];

export default function PaymentModal({
  open,
  onClose,
  lines = [],
  vat = 0.1,
  discount = 0,
  onConfirm,
}) {
  const [method, setMethod] = useState("cash");
  const [cashGiven, setCashGiven] = useState("");
  const [customer, setCustomer] = useState({ name: "", phone: "" });

  const sums = useMemo(() => {
    const sub = lines.reduce((acc, l) => acc + (l.lineTotal || 0), 0);
    const vatAmt = Math.max(0, Math.round(sub * vat));
    const total = Math.max(0, sub + vatAmt - discount);
    return { sub, vatAmt, total };
  }, [lines, vat, discount]);

  const cashNumber = Number(cashGiven || 0);
  const change = Math.max(0, cashNumber - sums.total);
  const insufficient = cashNumber > 0 && cashNumber < sums.total;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thanh toán"
      size="lg"
      footer={
        <div className="payment-actions">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="success"
            onClick={() =>
              onConfirm?.({
                method,
                customer,
                cashGiven: cashNumber,
                change,
                total: sums.total,
              })
            }
          >
            Xác nhận
          </Button>
        </div>
      }
    >
      <div className="payment-form">
        <div className="payment-summary">
          <h4>Tổng kết</h4>
          <div className="summary-details">
            <div className="summary-row">
              <span>Tạm tính</span>
              <strong>{sums.sub.toLocaleString("vi-VN")}₫</strong>
            </div>
            <div className="summary-row">
              <span>VAT ({Math.round(vat * 100)}%)</span>
              <strong>{sums.vatAmt.toLocaleString("vi-VN")}₫</strong>
            </div>
            {discount ? (
              <div className="summary-row">
                <span>Giảm giá</span>
                <strong>-{discount.toLocaleString("vi-VN")}₫</strong>
              </div>
            ) : null}
            <div className="summary-row total-row">
              <span>Tổng cộng</span>
              <strong>{sums.total.toLocaleString("vi-VN")}₫</strong>
            </div>
          </div>
        </div>

        <div className="payment-methods">
          <h4>Phương thức</h4>
          <div className="methods-grid">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`method-btn ${method === m.id ? "selected" : ""}`}
                onClick={() => setMethod(m.id)}
              >
                <div style={{ fontSize: 28 }}>{m.icon}</div>
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        </div>

        {method === "cash" ? (
          <div className="cash-payment">
            <div className="cash-input-section">
              <Input
                label="Tiền khách đưa"
                value={cashGiven}
                onChange={(e) => setCashGiven(e.target.value)}
                placeholder="VD: 500000"
                type="number"
              />
              <Button onClick={() => setCashGiven(String(sums.total))}>
                = Tổng cộng
              </Button>
            </div>

            <div className="change-calculation">
              <div
                className={`change-row ${insufficient ? "insufficient" : ""}`}
              >
                <span>Thiếu</span>
                <strong>
                  {Math.max(0, sums.total - cashNumber).toLocaleString("vi-VN")}
                  ₫
                </strong>
              </div>
              <div className="change-row change">
                <span>Tiền thừa</span>
                <strong>{change.toLocaleString("vi-VN")}₫</strong>
              </div>
            </div>
          </div>
        ) : null}

        <div className="customer-info">
          <h4>Thông tin khách hàng (tuỳ chọn)</h4>
          <div className="customer-fields">
            <Input
              label="Tên khách"
              value={customer.name}
              onChange={(e) =>
                setCustomer((s) => ({ ...s, name: e.target.value }))
              }
              placeholder="Nguyễn Văn A"
            />
            <Input
              label="SĐT"
              value={customer.phone}
              onChange={(e) =>
                setCustomer((s) => ({ ...s, phone: e.target.value }))
              }
              placeholder="09xx xxx xxx"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
