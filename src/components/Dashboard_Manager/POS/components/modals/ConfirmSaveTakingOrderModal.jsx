import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import { formatPrice } from "@/utils/formatters";
import useModalKeyboardClose from "./useModalKeyboardClose";

const BackdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 16,
};

const ModalStyle = {
  width: "min(640px, 100%)",
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  overflow: "hidden",
};

const HeaderStyle = {
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: "1px solid #eef2f7",
};

const TitleStyle = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
};

const CloseBtnStyle = {
  border: 0,
  background: "transparent",
  cursor: "pointer",
  padding: 6,
  borderRadius: 10,
  color: "#334155",
};

const BodyStyle = { padding: 16 };

const SectionStyle = {
  border: "1px solid #eef2f7",
  borderRadius: 14,
  padding: 12,
  background: "#f8fafc",
};

const SectionTitleStyle = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0f172a",
  margin: "0 0 10px 0",
};

const RowStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "6px 0",
  fontSize: 13,
  color: "#334155",
};

const LabelStyle = { color: "#64748b", flex: "0 0 140px" };
const ValueStyle = { fontWeight: 700, color: "#0f172a", textAlign: "right" };

const DividerStyle = { height: 1, background: "#e2e8f0", margin: "12px 0" };

const WarningStyle = {
  marginTop: 12,
  padding: 12,
  borderRadius: 12,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontSize: 13,
  lineHeight: 1.4,
};

const FooterStyle = {
  padding: 16,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  borderTop: "1px solid #eef2f7",
  background: "#fff",
};

const BtnBase = {
  height: 40,
  borderRadius: 12,
  padding: "0 14px",
  fontWeight: 800,
  cursor: "pointer",
  border: "1px solid transparent",
};

const BtnSecondary = {
  ...BtnBase,
  background: "#fff",
  borderColor: "#e2e8f0",
  color: "#0f172a",
};

const BtnPrimary = {
  ...BtnBase,
  background: "#0ea5e9",
  color: "#fff",
};

const BtnDisabled = {
  ...BtnPrimary,
  opacity: 0.55,
  cursor: "not-allowed",
};

const Chip = ({ children, tone = "slate" }) => {
  const map = {
    slate: { bg: "#e2e8f0", color: "#0f172a" },
    green: { bg: "#dcfce7", color: "#166534" },
    orange: { bg: "#ffedd5", color: "#9a3412" },
    blue: { bg: "#dbeafe", color: "#1e40af" },
  };
  const t = map[tone] || map.slate;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 900,
        background: t.bg,
        color: t.color,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
};

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path
      d="M18 6 6 18M6 6l12 12"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

const safeTrim = (v) => (v == null ? "" : String(v)).trim();

export default function ConfirmSaveOrderModal({
  isOpen,
  onClose,
  onConfirm,

  orderType, // "delivery" | "takeaway"
  orderCode,
  tableCode,

  items = [],
  totals = {},

  customer, // { name, phone, email }
  shippingInfo, // { fullName, phone, email, address, note }
  note,

  isSaving = false,
}) {
  const isDelivery = orderType === "delivery";
  const isTakeaway = orderType === "takeaway";

  const derived = useMemo(() => {
    const cName = safeTrim(customer?.name || shippingInfo?.fullName);
    const cPhone = safeTrim(customer?.phone || shippingInfo?.phone);
    const cEmail = safeTrim(customer?.email || shippingInfo?.email);
    const addr = safeTrim(shippingInfo?.address);
    const n = safeTrim(note || shippingInfo?.note);

    const itemCount = Array.isArray(items) ? items.length : 0;
    const hasItems = itemCount > 0;

    const problems = [];
    if (!hasItems) problems.push("Đơn đang trống, không thể lưu.");
    if (!cName || !cPhone)
      problems.push("Thiếu thông tin khách (cần Tên + SĐT).");
    if (isDelivery && !addr) problems.push("Đơn giao hàng cần địa chỉ giao.");

    const ok = problems.length === 0;

    return {
      cName,
      cPhone,
      cEmail,
      addr,
      n,
      itemCount,
      hasItems,
      ok,
      problems,
    };
  }, [items, customer, shippingInfo, note, isDelivery]);
  useModalKeyboardClose({ isOpen, onClose, disabled: isSaving });

  if (!isOpen) return null;

  const typeChip = isDelivery ? (
    <Chip tone="orange">GIAO ĐI</Chip>
  ) : isTakeaway ? (
    <Chip tone="blue">MANG VỀ</Chip>
  ) : (
    <Chip>ĐƠN</Chip>
  );

  const total = Number(totals?.total ?? totals?.grandTotal ?? 0);
  const subtotal = Number(totals?.subtotal ?? 0);
  const tax = Number(totals?.tax ?? 0);
  const service = Number(totals?.service ?? 0);
  const discount = Number(totals?.discount ?? 0);

  const handleBackdropClick = () => {
    if (isSaving) return;
    onClose?.();
  };

  const handleConfirm = async () => {
    if (!derived.ok || isSaving) return;
    await onConfirm?.();
  };

  return createPortal(
    <div style={BackdropStyle} onMouseDown={handleBackdropClick}>
      <div
        style={ModalStyle}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={HeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={TitleStyle}>Xác nhận lưu đơn</h3>
            {typeChip}
          </div>

          <button
            style={CloseBtnStyle}
            onClick={onClose}
            disabled={isSaving}
            title="Đóng"
          >
            <IconClose />
          </button>
        </div>

        <div style={BodyStyle}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={SectionStyle}>
              <div style={SectionTitleStyle}>Thông tin đơn</div>
              <div style={RowStyle}>
                <div style={LabelStyle}>Mã đơn</div>
                <div style={ValueStyle}>{orderCode || "—"}</div>
              </div>
              <div style={RowStyle}>
                <div style={LabelStyle}>Table code</div>
                <div style={ValueStyle}>{tableCode || "—"}</div>
              </div>
              <div style={RowStyle}>
                <div style={LabelStyle}>Số món</div>
                <div style={ValueStyle}>{derived.itemCount}</div>
              </div>
            </div>

            <div style={SectionStyle}>
              <div style={SectionTitleStyle}>Khách hàng</div>
              <div style={RowStyle}>
                <div style={LabelStyle}>Tên</div>
                <div style={ValueStyle}>{derived.cName || "—"}</div>
              </div>
              <div style={RowStyle}>
                <div style={LabelStyle}>SĐT</div>
                <div style={ValueStyle}>{derived.cPhone || "—"}</div>
              </div>
              <div style={RowStyle}>
                <div style={LabelStyle}>Email</div>
                <div style={ValueStyle}>{derived.cEmail || "—"}</div>
              </div>

              {isDelivery && (
                <>
                  <div style={DividerStyle} />
                  <div style={RowStyle}>
                    <div style={LabelStyle}>Địa chỉ giao</div>
                    <div
                      style={{
                        ...ValueStyle,
                        maxWidth: 360,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {derived.addr || "—"}
                    </div>
                  </div>
                </>
              )}

              {derived.n ? (
                <>
                  <div style={DividerStyle} />
                  <div style={RowStyle}>
                    <div style={LabelStyle}>Ghi chú</div>
                    <div
                      style={{
                        ...ValueStyle,
                        maxWidth: 360,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {derived.n}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div style={SectionStyle}>
              <div style={SectionTitleStyle}>Tổng tiền</div>
              <div style={RowStyle}>
                <div style={LabelStyle}>Tạm tính</div>
                <div style={ValueStyle}>{formatPrice(subtotal)}</div>
              </div>
              {discount ? (
                <div style={RowStyle}>
                  <div style={LabelStyle}>Giảm giá</div>
                  <div style={{ ...ValueStyle, color: "#b91c1c" }}>
                    -{formatPrice(discount)}
                  </div>
                </div>
              ) : null}
              {service ? (
                <div style={RowStyle}>
                  <div style={LabelStyle}>Phí phục vụ</div>
                  <div style={ValueStyle}>{formatPrice(service)}</div>
                </div>
              ) : null}
              {tax ? (
                <div style={RowStyle}>
                  <div style={LabelStyle}>Thuế</div>
                  <div style={ValueStyle}>{formatPrice(tax)}</div>
                </div>
              ) : null}
              <div style={DividerStyle} />
              <div style={{ ...RowStyle, fontSize: 14 }}>
                <div
                  style={{ ...LabelStyle, color: "#0f172a", fontWeight: 900 }}
                >
                  Tổng cộng
                </div>
                <div style={{ ...ValueStyle, fontSize: 16 }}>
                  {formatPrice(total)}
                </div>
              </div>
            </div>

            {!derived.ok && (
              <div style={WarningStyle}>
                <div style={{ fontWeight: 900, marginBottom: 6 }}>
                  Chưa thể lưu vì:
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {derived.problems.map((p, idx) => (
                    <li key={idx} style={{ margin: "4px 0" }}>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div style={FooterStyle}>
          <button style={BtnSecondary} onClick={onClose} disabled={isSaving}>
            Hủy
          </button>

          <button
            style={derived.ok && !isSaving ? BtnPrimary : BtnDisabled}
            onClick={handleConfirm}
            disabled={!derived.ok || isSaving}
            title={!derived.ok ? "Thiếu thông tin để lưu" : ""}
          >
            {isSaving ? "Đang lưu..." : "Xác nhận lưu"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
