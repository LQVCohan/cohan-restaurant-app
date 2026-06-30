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
import EligibleGiftSuggestionPanel from "./EligibleGiftSuggestionPanel";
import DiscountCouponDock from "./DiscountCouponDock";
import PosDiscountSummaryOverlay from "./PosDiscountSummaryOverlay";
import ThirdPartyShippingPanel from "./ThirdPartyShippingPanel";
import TransferQueueBell from "./TransferQueueBell";
import PosProvider, { usePos } from "../../../../../context/PosContext";
import { AuthContext } from "../../../../../context/AuthContext";
import useManagerRestaurantSelection from "../../../../../hooks/useManagerRestaurantSelection";

function POSContent({ restaurantId }) {
  const { loadPaymentRequestToPOS } = usePos();

  const handleOpenPayment = async (orderId) => {
    if (!orderId) return;
    await loadPaymentRequestToPOS?.({ orderId, orderType: "dine_in" });
  };

  return (
    <div className={styles.shell}>
      <div className={styles.leftCol}>
        <div className={styles.card}>
          <LeftPanel />
        </div>
      </div>

      <div className={styles.centerCol}>
        <div className={styles.card}>
          <CenterPanel />
        </div>
      </div>

      <div className={styles.rightCol}>
        <div className={styles.card} style={{ position: "relative" }}>
          <CustomerRequestQueuePanel
            restaurantId={restaurantId}
            onOpenPayment={handleOpenPayment}
          />
          <TablePaymentRequestNotice />
          <EligibleGiftSuggestionPanel />
          <RightPanel />
          <DiscountCouponDock />
          <ThirdPartyShippingPanel />
          <PosDiscountSummaryOverlay />
        </div>
      </div>
    </div>
  );
}

export default function POSLayout() {
  const { user } = useContext(AuthContext) || {};
  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    selectedRestaurant,
    loading,
  } = useManagerRestaurantSelection();

  const lockKey = useMemo(
    () => `pos_locked_restaurant_id:${user?.id || "anonymous"}`,
    [user?.id],
  );

  const [isLocked, setIsLocked] = useState(false);
  const [lockError, setLockError] = useState("");

  useEffect(() => {
    if (!restaurantOptions.length) {
      setSelectedRestaurantId("");
      setIsLocked(false);
      return;
    }

    const hasOption = (id) => restaurantOptions.some((restaurant) => restaurant.id === String(id));
    const storedId = localStorage.getItem(lockKey);
    const requestedId = new URLSearchParams(window.location.search || "").get("restaurantId");
    const currentIsValid = selectedRestaurantId && hasOption(selectedRestaurantId);
    const storedIsValid = storedId && hasOption(storedId);
    const requestedIsValid = requestedId && hasOption(requestedId);

    if (storedId && !storedIsValid) localStorage.removeItem(lockKey);

    if (currentIsValid) {
      const locked = storedIsValid && String(storedId) === String(selectedRestaurantId);
      if (storedIsValid && !locked) localStorage.removeItem(lockKey);
      setIsLocked(Boolean(locked));
      return;
    }

    if (requestedIsValid) {
      setSelectedRestaurantId(String(requestedId));
      setIsLocked(false);
      return;
    }

    if (storedIsValid) {
      setSelectedRestaurantId(String(storedId));
      setIsLocked(true);
      return;
    }

    setSelectedRestaurantId(restaurantOptions.length === 1 ? restaurantOptions[0].id : "");
    setIsLocked(false);
  }, [restaurantOptions, lockKey, selectedRestaurantId, setSelectedRestaurantId]);

  const restaurantId = selectedRestaurantId || null;

  const handleRestaurantChange = (event) => {
    setSelectedRestaurantId(event.target.value);
    setLockError("");
    setIsLocked(false);
    localStorage.removeItem(lockKey);
  };

  const handleToggleLock = () => {
    if (!restaurantId) {
      setLockError("Vui lòng chọn nhà hàng trước khi khóa POS.");
      return;
    }

    setLockError("");

    if (isLocked) {
      localStorage.removeItem(lockKey);
      setIsLocked(false);
      return;
    }

    localStorage.setItem(lockKey, restaurantId);
    setIsLocked(true);
  };

  return (
    <div className={styles.page}>
      <style>{`[class*="transferReviewPanel"]{display:none!important;}`}</style>
      <div className={styles.restaurantBar}>
        <div className={styles.restaurantBarInfo}>
          <div className={styles.restaurantHead}>
            <span className={styles.restaurantBarLabel}><Store size={16} /> Nhà hàng POS</span>
            <span className={`${styles.statusBadge} ${isLocked ? styles.badgeLocked : styles.badgeLive}`}>
              <CheckCircle2 size={13} />
              {isLocked ? "Nhà hàng đã khóa" : "POS đang hoạt động"}
            </span>
          </div>

          <select
            className={styles.restaurantSelect}
            value={selectedRestaurantId}
            onChange={handleRestaurantChange}
            disabled={isLocked}
          >
            <option value="">-- Chọn nhà hàng --</option>
            {restaurantOptions.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
                {restaurant.city ? ` - ${restaurant.city}` : ""}
              </option>
            ))}
          </select>
          <div className={styles.restaurantHint}>
            Đang chọn: <strong>{selectedRestaurant?.name || "Chưa chọn"}</strong>
          </div>
          {lockError && (
            <div className={styles.restaurantHint} role="alert">
              {lockError}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexShrink: 0 }}>
          <TransferQueueBell restaurantId={restaurantId} />
          <button
            type="button"
            className={`${styles.lockButton} ${isLocked ? styles.locked : ""}`}
            onClick={handleToggleLock}
            disabled={!restaurantId}
          >
            {isLocked ? <Unlock size={15} /> : <Lock size={15} />}
            {isLocked ? "Đổi nhà hàng" : "Khóa nhà hàng"}
          </button>
        </div>
      </div>
      {loading ? (
        <div className={styles.emptyState}>Đang tải nhà hàng POS...</div>
      ) : !restaurantId ? (
        <div className={styles.emptyState}>
          Vui lòng chọn nhà hàng để mở POS.
        </div>
      ) : (
        <PosProvider key={restaurantId} restaurantId={restaurantId}>
          <PosMenuAvailabilityRealtimeNotice restaurantId={restaurantId} />
          <PosReservationRealtimeNotice restaurantId={restaurantId} />
          <POSContent restaurantId={restaurantId} />
        </PosProvider>
      )}
    </div>
  );
}
