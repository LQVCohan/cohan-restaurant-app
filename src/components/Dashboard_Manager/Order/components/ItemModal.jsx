// src/pages/OrderManagement/components/ItemModal.jsx
import React from "react";
import { ChefHat, StickyNote } from "lucide-react";

import Modal from "../../../common/Modal";
import styles from "./ItemModal.module.scss";

// 3. Main Component
const ItemModal = ({ item, onClose }) => {
  if (!item) return null;

  // --- Helpers ---
  const getStatusLabel = (status) => {
    const map = {
      pending: "Chưa xác nhận",
      confirmed: "Đã xác nhận",
      preparing: "Đang chế biến",
      ready: "Sẵn sàng",
      served: "Đã phục vụ",
      cancelled: "Đã hủy",
    };
    return map[status] || status;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount || 0);
  };

  // Tính tổng tiền item
  const totalPrice = (item.price || 0) * (item.quantity || 1);
  const IngredientSnapshotDetails = ({ ingredients = [] }) => {
    if (!ingredients.length) {
      return (
        <div className={styles.stateBox}>
          <span>Chưa có thông tin nguyên liệu đã dùng cho món này.</span>
        </div>
      );
    }

    return (
      <div className={styles.recipeContent}>
        {ingredients.map((ing) => (
          <div key={ing.ingredientId} className={styles.ingredientLine}>
            <strong>{ing.name}</strong>
            <span>
              {Number(ing.quantity || 0).toLocaleString("vi-VN")} {ing.unit}
              {" · "}
              tương đương:{" "}
              {Number(ing.baseUnitQuantity || 0).toLocaleString("vi-VN")}
            </span>
          </div>
        ))}
      </div>
    );
  };
  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      title="Chi tiết món ăn"
      size="md"
      className={styles.modal}
    >
      <Modal.Body className={styles.body}>
        <div className={styles.infoSection}>
          <div className={styles.itemName}>{item.name}</div>

          <div className={styles.gridInfo}>
            <div className={styles.row}>
              <span className={styles.label}>Số lượng</span>
              <span>x{item.quantity}</span>
            </div>

            <div className={styles.row}>
              <span className={styles.label}>Đơn giá</span>
              <span>{formatCurrency(item.price)}</span>
            </div>

            <div className={styles.row}>
              <span className={styles.label}>Trạng thái</span>
              <div>
                <span
                  className={`${styles.badge} ${styles[item.status] || ""}`}
                >
                  {getStatusLabel(item.status)}
                </span>
              </div>
            </div>

            <div className={styles.row}>
              <span className={styles.label}>Thành tiền</span>
              <span className={styles.priceHighlight}>
                {formatCurrency(totalPrice)}
              </span>
            </div>
          </div>
        </div>

        {item.note && (
          <div className={styles.noteBlock}>
            <h4>
              <StickyNote aria-hidden="true" />
              Ghi chú đặc biệt
            </h4>
            <div className={styles.noteContent}>{item.note}</div>
          </div>
        )}

        <div className={styles.recipeBlock}>
          <h4>
            <ChefHat aria-hidden="true" />
            Nguyên liệu đã trừ kho
          </h4>
          <IngredientSnapshotDetails
            ingredients={item.ingredientsSnapshot || []}
          />
        </div>
      </Modal.Body>
      <Modal.Footer className={styles.footer}>
        <button type="button" onClick={onClose} className={styles.btnAction}>
          Đóng
        </button>
      </Modal.Footer>
    </Modal>
  );
};

export default ItemModal;
