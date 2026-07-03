import React, { useEffect, useMemo, useState, useCallback } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import Modal from "../../common/Modal";
import { formatCurrency } from "../../../utils/formatters";
import "./ModifierModal.scss";

const GET_MODIFIER_GROUPS = gql`
  query ModifierGroups($restaurantId: ID!, $menuItemId: ID) {
    modifierGroups(filter: { restaurantId: $restaurantId, menuItemId: $menuItemId }) {
      id
      name
      selectionType
      required
      minSelected
      maxSelected
      isActive
      options {
        id
        name
        priceRule {
          rule
          amount
        }
        isDefault
        isActive
      }
    }
  }
`;

export const getModifierSelectionError = (group, selectedCount) => {
  const count = Number(selectedCount || 0);
  if (group?.selectionType === "single") {
    if (group.required && count < 1) return `Vui lòng chọn một lựa chọn cho ${group.name}.`;
    if (count > 1) return `${group.name} chỉ cho phép chọn một lựa chọn.`;
    return "";
  }

  const minimum = group?.required
    ? Math.max(1, Number(group.minSelected || 0))
    : Number(group?.minSelected || 0);
  const maximum = group?.maxSelected == null ? null : Number(group.maxSelected);

  if (!group?.required && count === 0) return "";
  if (count < minimum) return `Vui lòng chọn ít nhất ${minimum} lựa chọn cho ${group.name}.`;
  if (maximum != null && count > maximum) return `Chỉ được chọn tối đa ${maximum} lựa chọn cho ${group.name}.`;
  return "";
};

export const calculateModifierPricing = (basePrice, groups = [], selected = {}) => {
  let setPrice = null;
  let setCount = 0;
  let delta = 0;

  groups.forEach((group) => {
    const selectedIds = selected[group.id] || [];
    selectedIds.forEach((optionId) => {
      const option = (group.options || []).find((candidate) => String(candidate.id) === String(optionId));
      if (!option || option.isActive === false) return;
      const amount = Number(option.priceRule?.amount || 0);
      if (option.priceRule?.rule === "SET") {
        setCount += 1;
        if (setPrice == null) setPrice = amount;
      } else {
        delta += amount;
      }
    });
  });

  const base = Number(basePrice || 0);
  const totalPrice = Math.max(0, (setPrice == null ? base : setPrice) + delta);
  return {
    totalPrice,
    modifiersPrice: totalPrice - base,
    setCount,
  };
};

const getGroupHint = (group) => {
  if (group.selectionType === "single") return "Chọn 1";
  const minimum = group.required ? Math.max(1, Number(group.minSelected || 0)) : Number(group.minSelected || 0);
  const maximum = group.maxSelected == null ? null : Number(group.maxSelected);
  if (minimum && maximum) return `Chọn ${minimum}–${maximum}`;
  if (maximum) return `Tối đa ${maximum}`;
  if (minimum) return `Ít nhất ${minimum}`;
  return "Chọn nhiều";
};

const formatOptionPrice = (option) => {
  const amount = Number(option.priceRule?.amount || 0);
  if (option.priceRule?.rule === "SET") return `Giá món ${formatCurrency(amount)}`;
  if (amount === 0) return "Miễn phí";
  return `${amount > 0 ? "+" : "−"}${formatCurrency(Math.abs(amount))}`;
};

const ModifierModal = ({ isOpen, onClose, item, onApply, restaurantId }) => {
  const [selected, setSelected] = useState({});
  const [validationError, setValidationError] = useState("");
  const menuItemId = item?.menuItemId || item?.dishId || item?.id;

  const { data, loading, error } = useQuery(GET_MODIFIER_GROUPS, {
    variables: { restaurantId, menuItemId },
    skip: !isOpen || !restaurantId || !menuItemId,
    fetchPolicy: "cache-first",
  });

  const groupsForItem = useMemo(
    () => (data?.modifierGroups || [])
      .filter((group) => group.isActive !== false)
      .map((group) => ({
        ...group,
        options: (group.options || []).filter((option) => option.isActive !== false),
      })),
    [data],
  );

  useEffect(() => {
    if (!isOpen || !item) return;
    if (!groupsForItem.length) {
      setSelected({});
      return;
    }

    const existingByGroup = (item.modifiers || item.selectedModifiers || []).reduce((map, modifier) => {
      if (!modifier?.groupId || !modifier?.optionId) return map;
      const key = String(modifier.groupId);
      map[key] = [...(map[key] || []), modifier.optionId];
      return map;
    }, {});
    const initialSelection = {};

    groupsForItem.forEach((group) => {
      const activeOptionIds = new Set((group.options || []).map((option) => String(option.id)));
      const existing = (existingByGroup[String(group.id)] || []).filter((id) => activeOptionIds.has(String(id)));
      if (existing.length) {
        initialSelection[group.id] = group.selectionType === "single" ? [existing[0]] : existing;
        return;
      }

      const defaults = (group.options || []).filter((option) => option.isDefault).map((option) => option.id);
      initialSelection[group.id] = group.selectionType === "single" ? defaults.slice(0, 1) : defaults;
    });

    setSelected(initialSelection);
    setValidationError("");
  }, [groupsForItem, isOpen, item]);

  const pricing = useMemo(
    () => calculateModifierPricing(item?.price, groupsForItem, selected),
    [groupsForItem, item?.price, selected],
  );

  const toggleOption = useCallback((group, optionId) => {
    setValidationError("");
    setSelected((previous) => {
      const next = { ...previous };
      const current = Array.isArray(next[group.id]) ? [...next[group.id]] : [];

      if (group.selectionType === "single") {
        next[group.id] = [optionId];
        return next;
      }

      const selectedIndex = current.findIndex((id) => String(id) === String(optionId));
      if (selectedIndex >= 0) {
        current.splice(selectedIndex, 1);
      } else {
        const maximum = group.maxSelected == null ? null : Number(group.maxSelected);
        if (maximum != null && current.length >= maximum) {
          setValidationError(`Chỉ được chọn tối đa ${maximum} lựa chọn cho ${group.name}.`);
          return previous;
        }
        current.push(optionId);
      }
      next[group.id] = current;
      return next;
    });
  }, []);

  const handleApply = () => {
    if (!item) return;

    const selectionError = groupsForItem
      .map((group) => getModifierSelectionError(group, (selected[group.id] || []).length))
      .find(Boolean);
    if (selectionError) {
      setValidationError(selectionError);
      return;
    }
    if (pricing.setCount > 1) {
      setValidationError("Chỉ có thể chọn một tuỳ chọn đặt lại giá món.");
      return;
    }

    const newModifiers = [];
    groupsForItem.forEach((group) => {
      const chosen = selected[group.id] || [];
      chosen.forEach((optionId) => {
        const option = group.options?.find((candidate) => String(candidate.id) === String(optionId));
        if (!option) return;
        newModifiers.push({
          groupId: group.id,
          optionId: option.id,
          groupName: group.name,
          optionName: option.name,
          price: Number(option.priceRule?.amount || 0),
          priceRule: {
            rule: option.priceRule?.rule || "DELTA",
            amount: Number(option.priceRule?.amount || 0),
          },
        });
      });
    });

    setValidationError("");
    onApply?.(item.id, newModifiers, pricing.modifiersPrice);
    onClose?.();
  };

  if (!isOpen || !item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" className="modifier-modal">
      <div className="modifier-modal__header">
        <h3 className="modifier-modal__title">Tùy chọn cho {item.name}</h3>
        <p className="modifier-modal__subtitle">Chọn đúng số lượng theo hướng dẫn của từng nhóm</p>
      </div>

      <div className="modifier-modal__content">
        {validationError && <div className="modifier-validation-error" role="alert">{validationError}</div>}
        {loading ? (
          <div className="modifier-loading">Đang tải tuỳ chọn...</div>
        ) : error ? (
          <div className="modifier-error" role="alert">Không thể tải tuỳ chọn: {error.message}</div>
        ) : groupsForItem.length === 0 ? (
          <div className="modifier-empty">Món này chưa có tuỳ chọn.</div>
        ) : (
          groupsForItem.map((group) => {
            const selectedIds = selected[group.id] || [];
            return (
              <section key={group.id} className="modifier-group" aria-labelledby={`modifier-group-${group.id}`}>
                <div className="modifier-group__header">
                  <h4 id={`modifier-group-${group.id}`} className="modifier-group__title">
                    {group.name}
                    <span className={`modifier-group__badge ${group.required ? "modifier-group__required" : ""}`}>
                      {group.required ? "Bắt buộc" : "Tùy chọn"}
                    </span>
                  </h4>
                  <div className="modifier-group__hint">{getGroupHint(group)}</div>
                </div>

                <div className="modifier-options">
                  {group.options?.map((option) => {
                    const isSelected = selectedIds.some((id) => String(id) === String(option.id));
                    return (
                      <button
                        type="button"
                        key={option.id}
                        className={`modifier-option ${isSelected ? "selected" : ""}`}
                        onClick={() => toggleOption(group, option.id)}
                        aria-pressed={isSelected}
                      >
                        <span className={`modifier-option__${group.selectionType === "single" ? "radio" : "checkbox"}`} aria-hidden="true" />
                        <span className="modifier-option__info">
                          <span className="modifier-option__name">{option.name}</span>
                          {option.isDefault && <span className="modifier-option__default">Mặc định</span>}
                        </span>
                        <span className={`modifier-option__price ${Number(option.priceRule?.amount) === 0 && option.priceRule?.rule !== "SET" ? "free" : ""}`}>
                          {formatOptionPrice(option)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      <Modal.Footer className="modifier-modal__footer">
        <div className="modifier-total">
          Tổng: <span className="modifier-total__price">{formatCurrency(pricing.totalPrice)}</span>
        </div>
        <div className="modifier-actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>Hủy</button>
          <button type="button" className="btn btn--success" onClick={handleApply} disabled={loading || !!error}>Áp dụng</button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default ModifierModal;
