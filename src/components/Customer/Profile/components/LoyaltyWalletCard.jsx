import React from "react";
import { Gift, TrendingUp, WalletCards } from "lucide-react";
import "./LoyaltyWalletCard.scss";

const formatVND = (value = 0) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value || 0));

const getTier = (points = 0) => {
  const value = Number(points || 0);
  if (value >= 3000) return { label: "Diamond", next: null, progress: 100 };
  if (value >= 1500) return { label: "Gold", next: "Diamond", progress: Math.min(100, Math.round((value / 3000) * 100)) };
  if (value >= 500) return { label: "Silver", next: "Gold", progress: Math.min(100, Math.round((value / 1500) * 100)) };
  return { label: "Member", next: "Silver", progress: Math.min(100, Math.round((value / 500) * 100)) };
};

export default function LoyaltyWalletCard({ user }) {
  const points = Number(user?.loyaltyPoints || 0);
  const totalOrders = Number(user?.totalOrders || 0);
  const totalSpending = Number(user?.totalSpending || 0);
  const wallet = user?.wallet || null;
  const tier = getTier(points);

  return (
    <section className="loyalty-wallet-card" aria-label="Điểm thưởng và ví khách hàng">
      <div className="loyalty-wallet-card__hero">
        <div className="loyalty-wallet-card__icon"><Gift size={22} /></div>
        <div>
          <p className="loyalty-wallet-card__eyebrow">Thành viên Cohan</p>
          <h2>{tier.label}</h2>
          <span>{points.toLocaleString("vi-VN")} điểm thưởng</span>
        </div>
      </div>

      <div className="loyalty-wallet-card__progress">
        <div className="loyalty-wallet-card__progress-bar"><span style={{ width: `${tier.progress}%` }} /></div>
        <p>{tier.next ? `Còn gần hơn tới hạng ${tier.next}` : "Bạn đang ở hạng cao nhất hiện tại."}</p>
      </div>

      <div className="loyalty-wallet-card__stats">
        <article>
          <TrendingUp size={18} />
          <span>Tổng đơn</span>
          <strong>{totalOrders.toLocaleString("vi-VN")}</strong>
        </article>
        <article>
          <WalletCards size={18} />
          <span>Chi tiêu</span>
          <strong>{formatVND(totalSpending)}</strong>
        </article>
        <article>
          <WalletCards size={18} />
          <span>Ví</span>
          <strong>{wallet?.status ? `${wallet.status}` : "Chưa kích hoạt"}</strong>
          {wallet?.balance != null && <small>{formatVND(wallet.balance)}</small>}
        </article>
      </div>
    </section>
  );
}
