import React from "react";
import { ChefHat, CircleDollarSign, StickyNote, Utensils } from "lucide-react";

import Modal from "../../../common/Modal";
import styles from "./ItemModal.module.scss";

const STATUS_STEPS = ["pending", "preparing", "ready", "served"];
const STATUS_LABELS = {
  pending: "Chờ bếp nhận",
  confirmed: "Đã xác nhận",
  preparing: "Đang chế biến",
  ready: "Sẵn sàng giao",
  served: "Đã giao món",
  cancelled: "Đã hủy",
  returned: "Đã trả lại",
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(Number(amount || 0));

const IngredientDetails = ({ ingredients = [] }) => {
  if (!ingredients.length) {
    return (
      <div className={styles.stateBox}>
        Chưa có thông tin nguyên liệu cho món này.
      </div>
    );
  }

  return (
    <ul className={styles.ingredientList}>
      {ingredients.map((ingredient, index) => (
        <li key={ingredient.ingredientId || `${ingredient.name}-${index}`}>
          <span>{ingredient.name || "Nguyên liệu"}</span>
          <strong>
            {Number(ingredient.quantity || 0).toLocaleString("vi-VN")} {ingredient.unit || ""}
          </strong>
        </li>
      ))}
    </ul>
  );
};

const ItemModal = ({ item, onClose }) => {
  if (!item) return null;

  const quantity = Number(item.quantity || 1);
  const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
  const totalPrice = Number(item.lineSubtotal ?? unitPrice * quantity);
  const stepStatus = item.status === "confirmed" ? "pending" : item.status;
  const activeStepIndex = STATUS_STEPS.indexOf(stepStatus);
  const statusLabel = STATUS_LABELS[item.status] || "Chưa xác định";
  const cancellationReason =
    item.cancelReason || item.cancellationReason || item.voidReason || "";

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Chi tiết món ăn"
      size="md"
      className={styles.modal}
    >
      <Modal.Body className={styles.body}>
        <section className={styles.hero}>
          <span className={styles.heroIcon} aria-hidden="true">
            <Utensils />
          </span>
          <div>
            <span className={styles.eyebrow}>Món trong đơn</span>
            <h3>{item.name || "Món chưa đặt tên"}</h3>
            <span className={`${styles.statusBadge} ${styles[item.status] || ""}`}>
              {statusLabel}
            </span>
          </div>
        </section>

        {!["cancelled", "returned"].includes(stepStatus) ? (
          <ol className={styles.statusSteps} aria-label="Tiến độ chuẩn bị món">
            {STATUS_STEPS.map((step, index) => (
              <li
                key={step}
                className={`${index < activeStepIndex ? styles.done : ""} ${index === activeStepIndex ? styles.current : ""}`}
                aria-current={index === activeStepIndex ? "step" : undefined}
              >
                <span aria-hidden="true" />
                {STATUS_LABELS[step]}
              </li>
            ))}
          </ol>
        ) : null}

        <section className={styles.summary} aria-label="Số lượng và giá món">
          <div>
            <span>Số lượng</span>
            <strong>{quantity}</strong>
          </div>
          <div>
            <span>Đơn giá</span>
            <strong>{formatCurrency(unitPrice)}</strong>
          </div>
          <div className={styles.total}>
            <CircleDollarSign aria-hidden="true" />
            <span>Thành tiền</span>
            <strong>{formatCurrency(totalPrice)}</strong>
          </div>
        </section>

        {item.note ? (
          <section className={styles.noteBlock}>
            <h4><StickyNote aria-hidden="true" /> Lưu ý từ khách</h4>
            <p>{item.note}</p>
          </section>
        ) : null}

        {cancellationReason ? (
          <section className={styles.cancelReason} role="status">
            <strong>Lý do hủy món</strong>
            <span>{cancellationReason}</span>
          </section>
        ) : null}

        <section className={styles.recipeBlock}>
          <h4><ChefHat aria-hidden="true" /> Nguyên liệu sử dụng</h4>
          <IngredientDetails ingredients={item.ingredientsSnapshot || []} />
        </section>
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
