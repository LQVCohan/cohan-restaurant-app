import React, { useEffect, useMemo, useState, useCallback } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import Modal from "../../common/Modal";
import { formatCurrency } from "../../../utils/formatters";
import "./ModifierModal.scss";

/** ──────────────────────────────────────────────────────────────
 * GraphQL: lấy ModifierGroups áp dụng cho món hiện tại
 * Backend trả cả nhóm GLOBAL và nhóm ITEMS gắn với menuItemId
 * ──────────────────────────────────────────────────────────────
 */
const GET_MODIFIER_GROUPS = gql`
  query ModifierGroups($restaurantId: ID!, $menuItemId: ID) {
    modifierGroups(filter: { restaurantId: $restaurantId, menuItemId: $menuItemId }) {
      id
      name
      selectionType # "single" | "multiple"
      required
      isActive
      options {
        id
        name
        priceRule {
          rule
          amount
        }
        isDefault
      }
    }
  }
`;

const ModifierModal = ({ isOpen, onClose, item, onApply, restaurantId }) => {
  // item: { id, dishId/menuItemId, name, price (VND), modifiers? }
  const [selected, setSelected] = useState({}); // { [groupId]: [optionId, ...] }
  const [totalPrice, setTotalPrice] = useState(0);
  const [validationError, setValidationError] = useState("");

  const menuItemId = item?.menuItemId || item?.dishId || item?.id;

  const { data, loading, error } = useQuery(GET_MODIFIER_GROUPS, {
    variables: { restaurantId, menuItemId },
    skip: !isOpen || !restaurantId || !menuItemId,
    fetchPolicy: "cache-first",
  });

  const groupsForItem = useMemo(
    () => (data?.modifierGroups || []).filter((group) => group.isActive !== false),
    [data],
  );

/** Khởi tạo chọn mặc định mỗi khi mở modal / đổi item / dữ liệu groups sẵn sàng */
  useEffect(() => {
    if (!isOpen || !item || groupsForItem.length === 0) return;

    const init = {};
    const existingByGroup = (item.modifiers || item.selectedModifiers || []).reduce((map, modifier) => {
      if (!modifier?.groupId || !modifier?.optionId) return map;
      const key = String(modifier.groupId);
      map[key] = [...(map[key] || []), modifier.optionId];
      return map;
    }, {});

    groupsForItem.forEach((g) => {
      const existing = existingByGroup[String(g.id)];
      if (existing?.length) {
        init[g.id] = g.selectionType === "single" ? [existing[0]] : existing;
        return;
      }

      const defaults = (g.options || [])
        .filter((o) => o.isDefault)
        .map((o) => o.id);
      if (g.selectionType === "single") {
        if (defaults.length > 0) init[g.id] = [defaults[0]];
        else init[g.id] = []; // nếu required=true mà không có default thì để trống
      } else {
        init[g.id] = defaults; // multiple: có thể nhiều default
      }
    });
    setSelected(init);
  }, [isOpen, item, groupsForItem]);

  /** Tính tổng = base (VND) + sum(priceDelta đã chọn) */
  useEffect(() => {
    if (!item) return;

    let sum = Number(item.price || 0);
    groupsForItem.forEach((g) => {
      const chosen = selected[g.id] || [];
      chosen.forEach((opId) => {
        const op = g.options?.find((x) => String(x.id) === String(opId));
        if (op) sum += Number(op.priceRule?.amount || 0);
      });
    });

    setTotalPrice(sum);
  }, [item, selected, groupsForItem]);

  /** Chọn / bỏ chọn 1 option trong group */
  const toggleOption = useCallback((group, optionId) => {
    setValidationError("");
    setSelected((prev) => {
      const next = { ...prev };
      const arr = Array.isArray(next[group.id]) ? [...next[group.id]] : [];

      if (group.selectionType === "single") {
        // single => chỉ 1 lựa chọn
        next[group.id] = [optionId];
      } else {
        // multiple => bật/tắt
        const idx = arr.findIndex((id) => String(id) === String(optionId));
        if (idx >= 0) {
          arr.splice(idx, 1);
        } else {
          arr.push(optionId);
        }
        next[group.id] = arr;
      }
      return next;
    });
  }, []);

  /** Áp dụng: trả kết quả lên cha */
  const handleApply = () => {
    if (!item) return;
    const missingRequired = groupsForItem.filter((g) => g.required && !(selected[g.id] || []).length);
    if (missingRequired.length) {
      setValidationError(`Vui lòng chọn: ${missingRequired.map((g)=>g.name).join(", ")}`);
      return;
    }
    setValidationError("");
    const newModifiers = [];
    let newModifiersPrice = 0;

    groupsForItem.forEach((g) => {
      const chosen = selected[g.id] || [];
      chosen.forEach((opId) => {
        const op = g.options?.find((x) => String(x.id) === String(opId));
        if (!op) return;
        newModifiers.push({
          groupId: g.id,
          optionId: op.id,
          groupName: g.name,
          optionName: op.name,
          price: Number(op.priceRule?.amount || 0),
        });
        newModifiersPrice += Number(op.priceRule?.amount || 0);
      });
    });

    onApply?.(item.id, newModifiers, newModifiersPrice);
    onClose?.();
  };

  if (!isOpen || !item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      className="modifier-modal"
    >
      <div className="modifier-modal__header">
        <h3 className="modifier-modal__title">Tùy chọn cho {item.name}</h3>
        <p className="modifier-modal__subtitle">
          Tùy chỉnh món ăn theo ý thích của bạn
        </p>
      </div>

      <div className="modifier-modal__content">
        {validationError && <div className="modifier-validation-error" role="alert">{validationError}</div>}
        {loading ? (
          <div className="modifier-loading">Đang tải tuỳ chọn...</div>
        ) : error ? (
          <div className="modifier-error">Lỗi: {error.message}</div>
        ) : groupsForItem.length === 0 ? (
          <div className="modifier-empty">Món này chưa có tuỳ chọn.</div>
        ) : (
          groupsForItem.map((group) => {
            const selectedIds = selected[group.id] || [];
            return (
              <div key={group.id} className="modifier-group">
                <div className="modifier-group__header">
                  <h4 className="modifier-group__title">
                    {group.name}
                    <span
                      className={`modifier-group__badge ${
                        group.required ? "modifier-group__required" : ""
                      }`}
                    >
                      {group.required ? "Bắt buộc" : "Tùy chọn"}
                    </span>
                  </h4>
                  {group.selectionType === "single" ? (
                    <div className="modifier-group__hint">Chọn 1</div>
                  ) : (
                    <div className="modifier-group__hint">Chọn nhiều</div>
                  )}
                </div>

                <div className="modifier-options">
                  {group.options?.map((op) => {
                    const isSelected = selectedIds.some(
                      (id) => String(id) === String(op.id)
                    );
                    return (
                      <div
                        key={op.id}
                        className={`modifier-option ${
                          isSelected ? "selected" : ""
                        }`}
                        onClick={() => toggleOption(group, op.id)}
                      >
                        <div
                          className={`modifier-option__${
                            group.selectionType === "single"
                              ? "radio"
                              : "checkbox"
                          }`}
                        />
                        <div className="modifier-option__info">
                          <h5 className="modifier-option__name">{op.name}</h5>
                          {op.isDefault && (
                            <span className="modifier-option__default">
                              Mặc định
                            </span>
                          )}
                        </div>
                        <div
                          className={`modifier-option__price ${
                            Number(op.priceRule?.amount) === 0 ? "free" : ""
                          }`}
                        >
                          {Number(op.priceRule?.amount) === 0
                            ? "Miễn phí"
                            : (op.priceRule?.amount > 0 ? "+" : "") +
                              formatCurrency(Number(op.priceRule?.amount))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal.Footer className="modifier-modal__footer">
        <div className="modifier-total">
          Tổng:{" "}
          <span className="modifier-total__price">
            {formatCurrency(totalPrice)}
          </span>
        </div>
        <div className="modifier-actions">
          <button className="btn btn--secondary" onClick={onClose}>
            Hủy
          </button>
          <button
            className="btn btn--success"
            onClick={handleApply}
            disabled={loading || !!error}
          >
            Áp dụng
          </button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default ModifierModal;
