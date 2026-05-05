import React, { useContext, useEffect, useMemo, useState } from "react";
import styles from "./POSLayout.module.scss";
import LeftPanel from "./LeftPanel";
import CenterPanel from "./CenterPanel";
import RightPanel from "./RightPanel";
import PosProvider from "../../../../../context/PosContext";
import { AuthContext } from "../../../../../context/AuthContext";
export default function POSLayout() {
  // sau bạn truyền từ router cũng được
  const { user, restaurants } = useContext(AuthContext) || {};

  const lockKey = useMemo(
    () => `pos_locked_restaurant_id:${user?.id || "anonymous"}`,
    [user?.id],
  );

  const restaurantOptions = useMemo(() => {
    return (Array.isArray(restaurants) ? restaurants : [])
      .map((restaurant) => ({
        id: String(restaurant?.id || restaurant?._id || ""),
        name:
          restaurant?.name ||
          restaurant?.location ||
          `Nhà hàng ${String(restaurant?.id || restaurant?._id || "").slice(-4)}`,
        city: restaurant?.address?.city || "",
      }))
      .filter((restaurant) => restaurant.id);
  }, [restaurants]);

  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    if (!restaurantOptions.length) {
      setSelectedRestaurantId("");
      setIsLocked(false);
      return;
    }

    const storedId = localStorage.getItem(lockKey);
    const storedIsValid =
      storedId &&
      restaurantOptions.some(
        (restaurant) => restaurant.id === String(storedId),
      );

    if (storedIsValid) {
      setSelectedRestaurantId(String(storedId));
      setIsLocked(true);
      return;
    }

    if (storedId && !storedIsValid) {
      localStorage.removeItem(lockKey);
    }

    if (restaurantOptions.length === 1) {
      setSelectedRestaurantId(restaurantOptions[0].id);
    } else {
      setSelectedRestaurantId("");
    }

    setIsLocked(false);
  }, [restaurantOptions, lockKey]);

  const restaurantId = selectedRestaurantId || null;

  const selectedRestaurant = restaurantOptions.find(
    (restaurant) => restaurant.id === restaurantId,
  );

  const handleRestaurantChange = (event) => {
    setSelectedRestaurantId(event.target.value);
  };

  const handleToggleLock = () => {
    if (!restaurantId) {
      alert("Vui lòng chọn nhà hàng trước khi khóa POS.");
      return;
    }

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
      <div className={styles.restaurantBar}>
        <div className={styles.restaurantBarInfo}>
          <span className={styles.restaurantBarLabel}>Nhà hàng POS</span>

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

          {selectedRestaurant && (
            <span className={styles.restaurantHint}>
              Đang dùng: {selectedRestaurant.name}
            </span>
          )}
        </div>

        <button
          type="button"
          className={`${styles.lockButton} ${isLocked ? styles.locked : ""}`}
          onClick={handleToggleLock}
          disabled={!restaurantId}
        >
          {isLocked ? "Đổi nhà hàng" : "Khóa nhà hàng"}
        </button>
      </div>
      {!restaurantId ? (
        <div className={styles.emptyState}>
          Vui lòng chọn nhà hàng để mở POS.
        </div>
      ) : (
        <PosProvider restaurantId={restaurantId}>
          <div className={styles.shell}>
            {/* Cột trái: bàn */}
            <div className={styles.leftCol}>
              <div className={styles.card}>
                <LeftPanel />
              </div>
            </div>

            {/* Cột giữa: menu */}
            <div className={styles.centerCol}>
              <div className={styles.card}>
                <CenterPanel />
              </div>
            </div>

            {/* Cột phải: order hiện tại */}
            <div className={styles.rightCol}>
              <div className={styles.card}>
                <RightPanel />
              </div>
            </div>
          </div>
        </PosProvider>
      )}
    </div>
  );
}
