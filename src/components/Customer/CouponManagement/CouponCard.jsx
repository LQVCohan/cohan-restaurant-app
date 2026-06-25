import React from "react";
import { Check, Gift, Info, Truck, Utensils } from "lucide-react";
import { formatCurrency, formatDate } from "./couponUtils";

const iconByCategory = { shipping: Truck, food: Utensils, table: Gift, order: Gift };

const getDisabledReason = (coupon) => {
  if (coupon.status === "expired") return "Coupon đã hết hạn";
  if (coupon.status === "out_of_usage") return "Coupon đã hết lượt";
  if (coupon.status === "used") return "Coupon đã được sử dụng";
  return "";
};

const CouponCard = ({ coupon, busy, onSave, onRemove, onUse, onDetail }) => {
  const Icon = iconByCategory[coupon.category] || Gift;
  const disabledReason = getDisabledReason(coupon);
  const canUse = !disabledReason && coupon.isSaved;
  const canSave = !disabledReason && !coupon.isSaved;

  return (
    <article className={`coupon-card coupon-card--${coupon.status}`}>
      <div className="coupon-card__accent"><Icon size={30} /></div>
      <div className="coupon-card__body">
        <div className="coupon-card__topline">
          <span className="coupon-card__category">{coupon.categoryLabel}</span>
          <span className={`coupon-card__status coupon-card__status--${coupon.status}`}>{coupon.statusLabel}</span>
        </div>
        <h3>{coupon.name}</h3>
        <p className="coupon-card__desc">{coupon.description}</p>
        <div className="coupon-card__code-row">
          <strong>{coupon.discountLabel}</strong>
          <code>{coupon.code || "Không có mã"}</code>
        </div>
        <dl className="coupon-card__meta">
          <div><dt>Hạn sử dụng</dt><dd>{formatDate(coupon.endAt)}</dd></div>
          <div><dt>Đơn tối thiểu</dt><dd>{Number(coupon.minOrderValue || 0) > 0 ? formatCurrency(coupon.minOrderValue) : "Không yêu cầu"}</dd></div>
          <div><dt>Giảm tối đa</dt><dd>{Number(coupon.maxDiscount || 0) > 0 ? formatCurrency(coupon.maxDiscount) : "Không giới hạn"}</dd></div>
          <div><dt>Loại đơn</dt><dd>{coupon.conditions.find((line) => line.startsWith("Loại đơn"))?.replace("Loại đơn áp dụng: ", "") || "Mọi loại đơn"}</dd></div>
        </dl>
        {coupon.usagePercent != null && (
          <div className="coupon-card__usage" aria-label={coupon.usageLabel}>
            <span style={{ width: `${coupon.usagePercent}%` }} />
          </div>
        )}
        <p className="coupon-card__usage-text">{coupon.usageLabel}</p>
        {disabledReason && <p className="coupon-card__disabled-reason">{disabledReason}</p>}
        <div className="coupon-card__actions">
          <button type="button" className="btn-secondary" onClick={() => onDetail(coupon)}><Info size={16} /> Điều kiện</button>
          {coupon.isSaved ? (
            <button type="button" className="btn-outline" disabled={busy} onClick={() => onRemove(coupon)}>Bỏ lưu</button>
          ) : (
            <button type="button" className="btn-primary" disabled={busy || !canSave} onClick={() => onSave(coupon)}>Lưu coupon</button>
          )}
          <button type="button" className="btn-primary btn-primary--dark" disabled={busy || !canUse} onClick={() => onUse(coupon)}>Dùng ngay {canUse && <Check size={15} />}</button>
        </div>
      </div>
    </article>
  );
};

export default CouponCard;
