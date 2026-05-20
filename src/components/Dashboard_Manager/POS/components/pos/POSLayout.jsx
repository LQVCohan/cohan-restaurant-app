import React, { useContext, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Lock, Store, Unlock } from "lucide-react";
import styles from "./POSLayout.module.scss";
import LeftPanel from "./LeftPanel";
import CenterPanel from "./CenterPanel";
import RightPanel from "./RightPanel";
import TablePaymentRequestNotice from "./TablePaymentRequestNotice";
import PosMenuAvailabilityRealtimeNotice from "./PosMenuAvailabilityRealtimeNotice";
import PosReservationRealtimeNotice from "./PosReservationRealtimeNotice";
import CustomerRequestQueuePanel from "./CustomerRequestQueuePanel";
import PosProvider, { usePos } from "../../../../../context/PosContext";
import { AuthContext } from "../../../../../context/AuthContext";

function POSBody({ restaurantId }) {
  const { loadPaymentRequestToPOS } = usePos();
  const openOrder = async (orderId) => {
    if (!orderId) return;
    await loadPaymentRequestToPOS?.({ orderId, orderType: "dine_in" });
  };
  return (
    <div className={styles.shell}>
      <div className={styles.leftCol}><div className={styles.card}><LeftPanel /></div></div>
      <div className={styles.centerCol}><div className={styles.card}><CenterPanel /></div></div>
      <div className={styles.rightCol}><div className={styles.card}>
        <CustomerRequestQueuePanel restaurantId={restaurantId} onOpenOrder={openOrder} onOpenPayment={openOrder} />
        <TablePaymentRequestNotice />
        <RightPanel />
      </div></div>
    </div>
  );
}

export default function POSLayout() {
  const { user, restaurants } = useContext(AuthContext) || {};
  const lockKey = useMemo(() => `pos_locked_restaurant_id:${user?.id || "anonymous"}`, [user?.id]);
  const restaurantOptions = useMemo(() => (Array.isArray(restaurants) ? restaurants : []).map((restaurant) => ({ id: String(restaurant?.id || restaurant?._id || ""), name: restaurant?.name || restaurant?.location || `Nhà hàng ${String(restaurant?.id || restaurant?._id || "").slice(-4)}`, city: restaurant?.address?.city || "" })).filter((restaurant) => restaurant.id), [restaurants]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  useEffect(() => {
    if (!restaurantOptions.length) return void (setSelectedRestaurantId(""), setIsLocked(false));
    const storedId = localStorage.getItem(lockKey);
    const storedIsValid = storedId && restaurantOptions.some((restaurant) => restaurant.id === String(storedId));
    if (storedIsValid) return void (setSelectedRestaurantId(String(storedId)), setIsLocked(true));
    if (storedId && !storedIsValid) localStorage.removeItem(lockKey);
    setSelectedRestaurantId(restaurantOptions.length === 1 ? restaurantOptions[0].id : "");
    setIsLocked(false);
  }, [restaurantOptions, lockKey]);
  const restaurantId = selectedRestaurantId || null;
  const selectedRestaurant = restaurantOptions.find((restaurant) => restaurant.id === restaurantId);

  return <div className={styles.page}><div className={styles.restaurantBar}><div className={styles.restaurantBarInfo}><div className={styles.restaurantHead}><span className={styles.restaurantBarLabel}><Store size={16} /> Nhà hàng POS</span><span className={`${styles.statusBadge} ${isLocked ? styles.badgeLocked : styles.badgeLive}`}><CheckCircle2 size={13} />{isLocked ? "Nhà hàng đã khóa" : "POS đang hoạt động"}</span></div>
    <select className={styles.restaurantSelect} value={selectedRestaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)} disabled={isLocked}><option value="">-- Chọn nhà hàng --</option>{restaurantOptions.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}{restaurant.city ? ` - ${restaurant.city}` : ""}</option>)}</select>
    <div className={styles.restaurantHint}>Đang chọn: <strong>{selectedRestaurant?.name || "Chưa chọn"}</strong></div></div>
    <button type="button" className={`${styles.lockButton} ${isLocked ? styles.locked : ""}`} onClick={() => { if (!restaurantId) return alert("Vui lòng chọn nhà hàng trước khi khóa POS."); if (isLocked) { localStorage.removeItem(lockKey); setIsLocked(false); return; } localStorage.setItem(lockKey, restaurantId); setIsLocked(true); }} disabled={!restaurantId}>{isLocked ? <Unlock size={15} /> : <Lock size={15} />}{isLocked ? "Đổi nhà hàng" : "Khóa nhà hàng"}</button></div>
    {!restaurantId ? <div className={styles.emptyState}>Vui lòng chọn nhà hàng để mở POS.</div> : <PosProvider restaurantId={restaurantId}><PosMenuAvailabilityRealtimeNotice restaurantId={restaurantId} /><PosReservationRealtimeNotice restaurantId={restaurantId} /><POSBody restaurantId={restaurantId} /></PosProvider>}
  </div>;
}
