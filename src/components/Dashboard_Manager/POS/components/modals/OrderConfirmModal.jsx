import React, { useEffect, useMemo } from "react";
import cls from "./OrderConfirmModal.module.scss";

export default function OrderConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isSaving = false,

  orderType = "dine_in", // "dine_in" | "delivery" | "takeaway"
  orderCode = "",
  tableCode = "",
  newItems: newItemsProp = null,
  currentOrder = [],
  totals = null,

  shippingInfo = null,
  deliveryCustomer = null,

  note = "",
}) {
  const isDelivery = orderType === "delivery";
  const isTakeaway = orderType === "takeaway";

  const typeKey = isDelivery ? "Ship" : isTakeaway ? "Take" : "Dine";
  const badgeText = isDelivery ? "SHIP" : isTakeaway ? "TAKE" : "DINE";

  // ✅ lấy đúng món mới (draft) từ currentOrder
  const newItems = useMemo(() => {
    if (Array.isArray(newItemsProp)) return newItemsProp;
    return (currentOrder || []).filter((it) => it?.isNew);
  }, [newItemsProp, currentOrder]);

  const hasItems = newItems.length > 0;

  // ✅ chỉ cần customer cho off-premise
  const customerName = useMemo(() => {
    const n =
      shippingInfo?.fullName ||
      deliveryCustomer?.fullName ||
      deliveryCustomer?.name ||
      "";
    return String(n || "").trim();
  }, [
    shippingInfo?.fullName,
    deliveryCustomer?.fullName,
    deliveryCustomer?.name,
  ]);

  const customerPhone = useMemo(() => {
    const p = shippingInfo?.phone || deliveryCustomer?.phone || "";
    return String(p || "").trim();
  }, [shippingInfo?.phone, deliveryCustomer?.phone]);

  const customerEmail = useMemo(() => {
    const e = shippingInfo?.email || deliveryCustomer?.email || "";
    return String(e || "").trim();
  }, [shippingInfo?.email, deliveryCustomer?.email]);

  const address = useMemo(() => {
    const a = shippingInfo?.address || "";
    return String(a || "").trim();
  }, [shippingInfo?.address]);

  const hasCustomer = !!(customerName || customerPhone || customerEmail);
  const hasAddress = !!address;

  // ✅ rule save:
  // - dine_in: chỉ cần có món mới
  // - takeaway: cần customer
  // - delivery: cần customer + address
  const canSave = useMemo(() => {
    if (!hasItems) return false;
    if (isDelivery) return hasCustomer && hasAddress;
    if (isTakeaway) return hasCustomer;
    return true; // dine_in
  }, [hasItems, isDelivery, isTakeaway, hasCustomer, hasAddress]);

  const moneyTotal = useMemo(() => {
    const t =
      totals?.total ?? totals?.grandTotal ?? totals?.totals?.grandTotal ?? 0;
    return Number(t || 0);
  }, [totals]);

  const countText = useMemo(
    () => String(newItems.length || 0),
    [newItems.length]
  );

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }

      if (e.key === "Enter") {
        const tag = (e.target?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea") return;

        if (canSave && !isSaving) {
          e.preventDefault();
          onConfirm?.();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, canSave, isSaving, onClose, onConfirm]);

  if (!isOpen) return null;

  const Check = ({ ok }) => (
    <span
      className={`${cls.checkIcon} ${ok ? cls.checkIconOk : cls.checkIconBad}`}
      aria-hidden="true"
    >
      {ok ? "✓" : "✕"}
    </span>
  );

  return (
    <div
      className={cls.overlay}
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`${cls.modal} ${cls["accent" + typeKey]}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={cls.header}>
          <div className={cls.titleWrap}>
            <div className={cls.title}>
              Xác nhận lưu đơn {badgeText}
              {orderCode ? ` · ${orderCode}` : ""}
            </div>
            <div className={cls.subTitle}>
              {isDelivery
                ? "Đơn giao đi (bắt buộc có địa chỉ)"
                : isTakeaway
                ? "Đơn mang đi (không bắt buộc địa chỉ)"
                : "Đơn tại bàn"}
              {tableCode ? ` · Table: ${tableCode}` : ""}
            </div>
          </div>

          <span className={`${cls.badge} ${cls["badge" + typeKey]}`}>
            {badgeText}
          </span>
        </div>

        <div className={cls.body}>
          <div className={cls.section}>
            <div className={cls.sectionTitle}>Checklist</div>

            <div className={cls.checklist}>
              <div
                className={`${cls.checkItem} ${
                  hasItems ? cls.checkItemOk : cls.checkItemBad
                }`}
              >
                <Check ok={hasItems} />
                <div className={cls.checkText}>
                  <div className={cls.checkTitle}>Có món mới để lưu</div>
                  <div className={cls.checkDesc}>
                    Hiện có <b>{countText}</b> món draft (isNew).
                  </div>
                </div>
              </div>

              {/* ✅ Chỉ OFF-PREMISE mới cần khách */}
              {(isDelivery || isTakeaway) && (
                <div
                  className={`${cls.checkItem} ${
                    hasCustomer ? cls.checkItemOk : cls.checkItemBad
                  }`}
                >
                  <Check ok={hasCustomer} />
                  <div className={cls.checkText}>
                    <div className={cls.checkTitle}>
                      Có thông tin khách hàng
                    </div>
                    <div className={cls.checkDesc}>
                      Tối thiểu tên/SĐT/email để tạo đơn.
                    </div>
                  </div>
                </div>
              )}

              {isDelivery && (
                <div
                  className={`${cls.checkItem} ${
                    hasAddress ? cls.checkItemOk : cls.checkItemBad
                  }`}
                >
                  <Check ok={hasAddress} />
                  <div className={cls.checkText}>
                    <div className={cls.checkTitle}>Có địa chỉ giao hàng</div>
                    <div className={cls.checkDesc}>
                      Đơn SHIP bắt buộc phải có địa chỉ.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ✅ Thông tin khách chỉ cần show cho off-premise (đỡ rối UI) */}
          {(isDelivery || isTakeaway) && (
            <div className={cls.section}>
              <div className={cls.sectionTitle}>Thông tin khách</div>

              <div className={cls.row}>
                <div className={cls.label}>Tên</div>
                <div className={cls.value}>{customerName || "—"}</div>
              </div>
              <div className={cls.row}>
                <div className={cls.label}>SĐT</div>
                <div className={cls.value}>{customerPhone || "—"}</div>
              </div>
              <div className={cls.row}>
                <div className={cls.label}>Email</div>
                <div className={cls.value}>{customerEmail || "—"}</div>
              </div>

              {isDelivery && (
                <div style={{ marginTop: 8 }}>
                  <div className={cls.sectionTitle} style={{ marginBottom: 6 }}>
                    Địa chỉ giao hàng
                  </div>
                  <div className={cls.address}>
                    {address || "Chưa có địa chỉ"}
                  </div>
                </div>
              )}
            </div>
          )}

          {!!note && (
            <div className={cls.section}>
              <div className={cls.sectionTitle}>Ghi chú</div>
              <div className={cls.address}>{note}</div>
            </div>
          )}

          {hasItems && (
            <div className={cls.section}>
              <div className={cls.sectionTitle}>Món sẽ lưu</div>
              <div className={cls.itemList}>
                {newItems.map((item, idx) => (
                  <div
                    key={item._lineId || item.dishId || item.id || idx}
                    className={cls.itemRow}
                  >
                    <div className={cls.itemInfo}>
                      <span className={cls.itemName}>{item.name}</span>
                      {(item.method || item.cookingOption) && (
                        <span className={cls.itemMeta}>
                          {item.method || item.cookingOption}
                        </span>
                      )}
                    </div>
                    <span className={cls.itemQty}>x{item.quantity || 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={cls.summary}>
            <div className={cls.totalRow}>
              <span>Tổng cộng</span>
              <span>{moneyTotal.toLocaleString("vi-VN")}₫</span>
            </div>
          </div>
        </div>

        <div className={cls.footer}>
          <button
            type="button"
            className={`${cls.btn} ${cls.btnCancel}`}
            onClick={onClose}
            disabled={isSaving}
            title="ESC"
          >
            Hủy (Esc)
          </button>

          <button
            type="button"
            className={`${cls.btn} ${cls.btnConfirm} ${
              cls["btnConfirm" + typeKey]
            }`}
            onClick={onConfirm}
            disabled={!canSave || isSaving}
            title="Enter"
          >
            Xác nhận (Enter)
          </button>
        </div>
      </div>
    </div>
  );
}
