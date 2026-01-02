// src/pages/OrderManagement/components/ItemModal.jsx
import React from "react";
import {
  X,
  ChefHat,
  StickyNote,
  BookOpen,
  Loader2,
  Receipt,
} from "lucide-react";
import { gql, useQuery } from "@apollo/client";
import styles from "./ItemModal.module.scss";

// 1. GraphQL Query
const GET_RECIPE_DETAILS = gql`
  query GetRecipeById($id: ID!) {
    recipe(id: $id) {
      id
      name
      notes
    }
  }
`;

// 2. Sub-component: Recipe Display
const RecipeDetails = ({ recipeId }) => {
  const { data, loading, error } = useQuery(GET_RECIPE_DETAILS, {
    variables: { id: recipeId },
    skip: !recipeId,
  });

  if (!recipeId) {
    return (
      <div className={styles.stateBox}>
        <span>Món này chưa được liên kết công thức.</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.stateBox}>
        <Loader2 size={18} className={styles.spinner} />
        <span>Đang tải hướng dẫn chế biến...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.stateBox} ${styles.error}`}>
        <p>Không thể tải công thức. Vui lòng thử lại.</p>
      </div>
    );
  }

  const recipeNotes = data?.recipe?.notes;

  if (!recipeNotes) {
    return (
      <div className={styles.stateBox}>
        <span>Chưa có hướng dẫn cụ thể cho món này.</span>
      </div>
    );
  }

  return (
    <div className={styles.recipeContent}>
      <p className={styles.recipeText}>{recipeNotes}</p>
    </div>
  );
};

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

  return (
    <div className={styles.overlay} onClick={onClose}>
      {/* Ngăn click propagation để không đóng modal khi click vào nội dung */}
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2>
            <Receipt size={20} />
            Chi tiết Order
          </h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Section: Basic Info */}
          <div className={styles.infoSection}>
            <div className={styles.itemName}>{item.name}</div>

            <div className={styles.gridInfo}>
              <div className={styles.row}>
                <label>Số lượng</label>
                <span>x{item.quantity}</span>
              </div>

              <div className={styles.row}>
                <label>Đơn giá</label>
                <span>{formatCurrency(item.price)}</span>
              </div>

              <div className={styles.row}>
                <label>Trạng thái</label>
                <div>
                  <span
                    className={`${styles.badge} ${styles[item.status] || ""}`}
                  >
                    {getStatusLabel(item.status)}
                  </span>
                </div>
              </div>

              <div className={styles.row}>
                <label>Thành tiền</label>
                <span className={styles.priceHighlight}>
                  {formatCurrency(totalPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Customer Note (Ghi chú từ khách/waiter) */}
          {item.note && (
            <div className={styles.noteBlock}>
              <h4>
                <StickyNote />
                Ghi chú đặc biệt
              </h4>
              <div className={styles.noteContent}>"{item.note}"</div>
            </div>
          )}

          {/* Section: Recipe (Dành cho bếp) */}
          <div className={styles.recipeBlock}>
            <h4>
              <ChefHat />
              Hướng dẫn chế biến (Bếp)
            </h4>
            <RecipeDetails recipeId={item.recipeId} />
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button onClick={onClose} className={styles.btnAction}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemModal;
