import React, { useContext, useMemo } from "react";
import {
  X,
  Clock,
  ChefHat,
  AlertTriangle,
  Printer,
  Camera,
  Minus,
  Trash2,
  Tag,
  Scissors,
  Banknote,
  CheckCircle2,
  ShoppingBag,
  ShieldAlert,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { getStaffOrderingPermissions } from "../staffOrderingPermissions";
import "./CartBottomSheet.scss";

const NO_PERMISSION_MESSAGE =
  "Vai trò hiện tại không có quyền thực hiện thao tác này.";
const READONLY_MESSAGE =
  "Vai trò hiện tại chỉ có quyền xem và thao tác trong phạm vi được phân công.";

function getStaffCartPayableTotal({ discountBreakdown, fallbackTotal }) {
  return Number(
    discountBreakdown?.grandTotal ??
      discountBreakdown?.finalTotal ??
      fallbackTotal ??
      0,
  );
}
function getStaffCartLineTotal(item) {
  const price = Number(item?.price || 0);
  const variant = item?.servingVariant || {};
  const mode = String(variant?.mode || "").toUpperCase();

  if (mode === "BY_WEIGHT") {
    const grams = Number(item?.weightGrams || 0);
    if (!Number.isFinite(grams) || grams <= 0) return 0;

    const sellQty = Number(variant?.sellQty || 1);
    const safeSellQty = Number.isFinite(sellQty) && sellQty > 0 ? sellQty : 1;

    const sellUnit = String(variant?.sellUnit || "kg").toLowerCase();
    const soldAmount = sellUnit === "g" ? grams : grams / 1000;

    return Math.round(price * (soldAmount / safeSellQty));
  }

  return Math.round(price * Number(item?.quantity || 1));
}
export default function CartBottomSheet({
  cart = [],
  setCart,
  onClose,
  table,
  onSendKitchen,
  onOpenProofCapture,
  onCheckout,
  onAdjustPersistedItemQuantity,
  onRequestItemVoid,
  onRemindItem,
  checkoutEnabled = true,
  sending = false,
  sendActionLabel = "Gửi Bếp",
  discountEnabled = false,
  voucherCode = "",
  onVoucherCodeChange,
  onApplyVoucher,
  discountBreakdown,
  discountError,
  discountLoading = false,
}) {
  const { user } = useContext(AuthContext) || {};
  const isRemoteOrder = table?.id === "remote_order";
  const permissions = useMemo(() => {
    return getStaffOrderingPermissions(user, { isRemoteOrder });
  }, [isRemoteOrder, user]);

  const handleRequestVoid = (item) => {
    if (!permissions.canRequestItemVoid) {
      alert(NO_PERMISSION_MESSAGE);
      return;
    }

    const maxQty = Number(item.quantity || 1);
    const rawQty = window.prompt(
      `Nhập số lượng muốn hủy/giảm cho [${item.name}] (tối đa ${maxQty}):`,
      "1",
    );

    if (rawQty == null) return;

    const quantity = Number(rawQty);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > maxQty) {
      alert("Số lượng hủy không hợp lệ.");
      return;
    }

    const reason = window.prompt(`Nhập lý do hủy/giảm món [${item.name}]:`);
    if (!reason || !reason.trim()) return;

    onRequestItemVoid?.(item, {
      quantity,
      reason: reason.trim(),
    });
  };

  const handleSend = () => {
    if (!permissions.canCreateOrder) {
      alert(NO_PERMISSION_MESSAGE);
      return;
    }
    onSendKitchen?.();
  };

  const handleCheckout = () => {
    if (!permissions.canRequestPayment) {
      alert(NO_PERMISSION_MESSAGE);
      return;
    }
    onCheckout?.();
  };

  const handlePersistedQuantityAdjust = (item, delta) => {
    if (!permissions.canAdjustItemQuantity) {
      alert(NO_PERMISSION_MESSAGE);
      return;
    }
    onAdjustPersistedItemQuantity?.(item, delta);
  };

  const handleRemind = (item) => {
    if (!permissions.canRemindItems) {
      alert(NO_PERMISSION_MESSAGE);
      return;
    }
    onRemindItem?.(item);
  };

  const totalPrice = cart.reduce(
    (sum, item) => sum + getStaffCartLineTotal(item),
    0,
  );

  return (
    <div className="staff-pos-cart-overlay" onClick={onClose}>
      <div
        className="staff-pos-cart-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drag-indicator">
          <div className="drag-handle"></div>
        </div>

        <div className="sheet-header">
          <div className="header-info">
            <h3>Order: {table?.name || "Chưa chọn bàn"}</h3>
            <p className="subtitle">{cart.length} món đang chọn</p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {permissions.isReadOnlyRole && (
          <div className="staff-inline-state">{READONLY_MESSAGE}</div>
        )}

        <div className="sheet-body">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <div className="empty-icon-wrap">
                <ShoppingBag size={48} />
              </div>
              <p>Chưa có món nào trong order</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className={`cart-item ${item.status}`}>
                <div className="item-main">
                  <div className="item-info-left">
                    <span className="qty">{item.quantity}</span>
                    <div className="name-wrap">
                      <span className="name">{item.name}</span>
                      <span className="prep-text">
                        {item.prep} {item.prep && item.serveOrder ? "•" : ""}{" "}
                        {item.serveOrder}
                      </span>
                    </div>
                  </div>
                  <div className="item-price">
                    {getStaffCartLineTotal(item).toLocaleString("vi-VN")}đ
                  </div>
                </div>

                <div className="item-tools">
                  <div className="status-badges">
                    {item.voidRequests?.some((r) => r.status === "pending") && (
                      <span className="badge badge-void">
                        <AlertTriangle size={12} /> Chờ duyệt hủy
                      </span>
                    )}

                    {Number(item.cancelledQuantity || 0) > 0 && (
                      <span className="badge badge-void">
                        <AlertTriangle size={12} /> Đã hủy{" "}
                        {item.cancelledQuantity}
                      </span>
                    )}
                    {String(item?.servingVariant?.mode || "").toUpperCase() ===
                      "BY_WEIGHT" &&
                      (!Number.isFinite(Number(item.weightGrams)) ||
                        Number(item.weightGrams) <= 0) && (
                        <span className="badge badge-proof-required">
                          <ShieldAlert size={12} /> Thiếu cân nặng
                        </span>
                      )}
                    {item.status === "pending" &&
                      !["confirmed", "preparing", "ready", "served"].includes(
                        item.orderStatus,
                      ) && (
                        <span className="badge badge-warning">
                          <Clock size={12} /> Bếp chưa nhận
                        </span>
                      )}

                    {item.status === "pending" &&
                      ["confirmed", "preparing"].includes(item.orderStatus) && (
                        <span className="badge badge-cooking">
                          <ChefHat size={12} /> Bếp đã nhận
                        </span>
                      )}
                    {item.status === "cooking" && (
                      <span className="badge badge-cooking">
                        <ChefHat size={12} /> Đang chế biến
                      </span>
                    )}
                    {item.status === "void_pending" && (
                      <span className="badge badge-void">
                        <AlertTriangle size={12} /> Chờ duyệt hủy
                      </span>
                    )}
                    {item.requiresProof && !item.hasPhoto && (
                      <span className="badge badge-proof-required">
                        <ShieldAlert size={12} /> Cần ảnh
                      </span>
                    )}
                    {item.hasPhoto && (
                      <span className="badge badge-proof-ok">
                        <Camera size={12} /> {item.proofImages?.length || 0} ảnh
                      </span>
                    )}
                  </div>
                  {String(item?.servingVariant?.mode || "").toUpperCase() ===
                    "BY_WEIGHT" && (
                    <div className="weight-input-row">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Nhập cân nặng (gram)"
                        value={item.weightGrams ?? ""}
                        disabled={!permissions.canEditPendingItem}
                        onChange={(e) => {
                          if (!permissions.canEditPendingItem) {
                            alert(NO_PERMISSION_MESSAGE);
                            return;
                          }
                          const raw = e.target.value;
                          setCart((prev) =>
                            (prev || []).map((c) =>
                              c.id === item.id
                                ? {
                                    ...c,
                                    weightGrams:
                                      raw === "" ? null : Number(raw),
                                  }
                                : c,
                            ),
                          );
                        }}
                      />
                    </div>
                  )}

                  <div className="actions">
                    <button
                      className={`btn-icon ${item.hasPhoto ? "active-cam" : ""}`}
                      disabled={!permissions.canCaptureProof}
                      onClick={() => {
                        if (!permissions.canCaptureProof) {
                          alert(NO_PERMISSION_MESSAGE);
                          return;
                        }
                        onOpenProofCapture?.(item);
                      }}
                    >
                      <Camera size={16} />
                    </button>
                    {item.status === "pending" && !item.persisted ? (
                      permissions.canCreateOrder && (
                        <button
                          className="btn-icon btn-minus"
                          onClick={() => {
                            if (!permissions.canEditPendingItem) {
                              alert(NO_PERMISSION_MESSAGE);
                              return;
                            }
                            setCart((prev) =>
                              (prev || []).flatMap((c) => {
                                if (c.id !== item.id) return [c];
                                const nextQty = Number(c.quantity || 1) - 1;
                                return nextQty > 0
                                  ? [{ ...c, quantity: nextQty }]
                                  : [];
                              }),
                            );
                          }}
                        >
                          <Minus size={16} />
                        </button>
                      )
                    ) : item.status === "pending" && item.persisted ? (
                      permissions.canAdjustItemQuantity && (
                        <button
                          className="btn-icon btn-minus"
                          onClick={() =>
                            handlePersistedQuantityAdjust(item, -1)
                          }
                        >
                          <Minus size={16} />
                        </button>
                      )
                    ) : item.status !== "void_pending" ? (
                      <>
                        {permissions.canRequestItemVoid && (
                          <button
                            className="btn-icon btn-void"
                            onClick={() => handleRequestVoid(item)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {permissions.canRemindItems && (
                          <button
                            className="btn-icon"
                            onClick={() => handleRemind(item)}
                            title="Nhắc món"
                          >
                            <Clock size={16} />
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sheet-footer">
          <div className="summary-row">
            <span className="summary-label">Tổng thanh toán:</span>
            <span className="summary-total">
              {getStaffCartPayableTotal({
                discountBreakdown,
                fallbackTotal: totalPrice,
              }).toLocaleString("vi-VN")}
              đ
            </span>
          </div>

          <div className="billing-actions">
            {discountEnabled ? (
              <div className="staff-discount-box">
                <div className="staff-discount-row">
                  <input
                    className="staff-discount-input"
                    value={voucherCode}
                    placeholder="Nhập mã coupon"
                    disabled={!permissions.canApplyVoucher}
                    onChange={(event) => {
                      if (!permissions.canApplyVoucher) {
                        alert(NO_PERMISSION_MESSAGE);
                        return;
                      }
                      onVoucherCodeChange?.(event.target.value);
                    }}
                  />
                  <button
                    className="btn-sub"
                    type="button"
                    disabled={
                      discountLoading ||
                      !voucherCode.trim() ||
                      !permissions.canApplyVoucher
                    }
                    onClick={() => {
                      if (!permissions.canApplyVoucher) {
                        alert(NO_PERMISSION_MESSAGE);
                        return;
                      }
                      onApplyVoucher?.();
                    }}
                  >
                    <Tag size={16} />{" "}
                    {discountLoading ? "Đang kiểm..." : "Áp dụng"}
                  </button>
                </div>

                {discountError && (
                  <div className="staff-discount-error">{discountError}</div>
                )}

                {discountBreakdown && (
                  <div className="staff-discount-success">
                    Đã áp dụng. Giảm{" "}
                    {Number(
                      discountBreakdown.totalDiscount || 0,
                    ).toLocaleString("vi-VN")}
                    đ
                  </div>
                )}
              </div>
            ) : (
              <button
                className="btn-sub disabled"
                type="button"
                disabled
                title="Ưu đãi chỉ áp dụng cho đơn giao hàng/mang về"
              >
                <Tag size={16} /> Thêm Ưu Đãi
              </button>
            )}

            <button
              className="btn-sub disabled"
              type="button"
              disabled
              title="Chức năng tách bill sẽ được bổ sung ở phiên bản sau"
            >
              <Scissors size={16} /> Tách Bill
            </button>

            <button
              className="btn-sub disabled"
              type="button"
              disabled
              title="Chức năng in tạm tính sẽ được bổ sung ở phiên bản sau"
            >
              <Printer size={16} /> In Tạm Tính
            </button>
          </div>

          <div className="main-actions">
            <button
              className="btn-primary btn-send-kitchen"
              disabled={cart.length === 0 || sending || !permissions.canCreateOrder}
              onClick={handleSend}
            >
              <CheckCircle2 size={20} />{" "}
              {sending ? "Đang gửi..." : sendActionLabel}
            </button>
            <button
              className="btn-primary btn-checkout"
              disabled={
                cart.length === 0 ||
                !checkoutEnabled ||
                !permissions.canRequestPayment
              }
              onClick={handleCheckout}
              title={
                permissions.canRequestPayment
                  ? checkoutEnabled
                    ? "Yêu cầu thanh toán"
                    : "Chưa hỗ trợ thanh toán cho ngữ cảnh này"
                  : READONLY_MESSAGE
              }
            >
              <Banknote size={20} /> Thanh Toán
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
