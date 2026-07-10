import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import Modal from "../../../../common/Modal";
import {
  FiAlertCircle,
  FiCheck,
  FiFilter,
  FiRefreshCw,
  FiRotateCcw,
  FiSearch,
  FiTrendingDown,
  FiTrendingUp,
  FiZap,
} from "react-icons/fi";
import "./PriceEditModal.scss";
import "./PriceEditModalPolish.scss";
import "./PriceEditModalSelection.scss";
import MenuConfirmDialog from "../common/MenuConfirmDialog";

const RESTORE_MENU_ITEM_PRICES = gql`
  mutation RestoreMenuItemPrices($input: RestoreMenuItemPricesInput!) {
    restoreMenuItemPrices(input: $input) {
      restoredCount
      skippedCount
    }
  }
`;

const DEFAULT_BULK_CHANGE = {
  type: "fixed",
  value: "",
  category: "",
  applyTo: "all",
};

const cloneIngredients = (ingredients = []) =>
  Array.isArray(ingredients)
    ? ingredients.map((ingredient) => ({
        ingredientId: ingredient?.ingredientId,
        qty: Number(ingredient?.qty || 0),
        unit: ingredient?.unit || ingredient?.baseUnit || "",
        wastePct: Number(ingredient?.wastePct || 0),
      }))
    : [];

const createBulkOperationKey = () =>
  `bulk_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const normalizeInlineError = (error) => {
  if (!error) return null;
  return {
    message: error?.message || "Không thể lưu thay đổi giá.",
    successCount: Number(error?.successCount || 0),
    failureCount: Number(error?.failureCount || 0),
    failures: Array.isArray(error?.failures) ? error.failures : [],
  };
};

const createValidationError = (message) => ({
  message,
  failures: [],
  successCount: 0,
  failureCount: 0,
});

const normalizeMethodDefaults = (methods = []) => {
  const normalizedMethods = methods.map((method, idx) => ({
    ...method,
    isDefault:
      typeof method.isDefault === "boolean" ? method.isDefault : idx === 0,
  }));
  let defaultIndex = normalizedMethods.findIndex((method) => method.isDefault);
  if (defaultIndex < 0) defaultIndex = 0;
  return normalizedMethods.map((method, idx) => ({
    ...method,
    isDefault: idx === defaultIndex,
  }));
};

const PriceEditModal = ({
  isOpen,
  isSubmitting = false,
  menuItems,
  onSave,
  onClose,
}) => {
  const [priceChanges, setPriceChanges] = useState([]);
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [submitError, setSubmitError] = useState(null);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);
  const [appliedBulkOperations, setAppliedBulkOperations] = useState({});
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [bulkChange, setBulkChange] = useState(DEFAULT_BULK_CHANGE);
  const [restoreSavedPrices, { loading: isRestoringPrices }] = useMutation(
    RESTORE_MENU_ITEM_PRICES,
  );

  const restaurantId = useMemo(
    () => (menuItems || []).find((item) => item?.restaurantId)?.restaurantId || null,
    [menuItems],
  );
  const submitting = isSubmitting || isLocalSubmitting || isRestoringPrices;

  useEffect(() => {
    if (!isOpen || !menuItems) return;

    const changes = menuItems.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      category: item.categoryName || "Chưa phân loại",
      lastBulkOperationKey: null,
      methods: normalizeMethodDefaults(
        (Array.isArray(item.servingVariants) && item.servingVariants.length
          ? item.servingVariants
          : [
              {
                key: "default",
                name: "Mặc định",
                price: item.basePrice || 0,
                mode: "PORTION",
                sellQty: 1,
                sellUnit: "portion",
                ingredients: [],
                isDefault: true,
              },
            ]
        ).map((method, idx) => ({
          key: method.key || method.name,
          name: method.name || method.key || "Mặc định",
          mode: method.mode || "PORTION",
          sellQty: method.sellQty || 1,
          sellUnit: method.sellUnit || "portion",
          ingredients: cloneIngredients(method.ingredients),
          isDefault:
            typeof method.isDefault === "boolean" ? method.isDefault : idx === 0,
          originalPrice: Number(method.price || 0),
          newPrice: Number(method.price || 0),
          changed: false,
          changeSource: null,
          bulkOperationKey: null,
        })),
      ),
    }));

    setPriceChanges(changes);
    setSelectedItemIds(new Set(changes.map((item) => String(item.itemId))));
    setSearchTerm("");
    setFilterCategory("all");
    setSubmitError(null);
    setIsLocalSubmitting(false);
    setAppliedBulkOperations({});
    setIsResetConfirmOpen(false);
    setIsRestoreConfirmOpen(false);
    setBulkChange(DEFAULT_BULK_CHANGE);
  }, [isOpen, menuItems]);

  const categories = useMemo(
    () => [...new Set(priceChanges.map((item) => item.category))],
    [priceChanges],
  );

  const filteredItems = useMemo(
    () =>
      priceChanges.filter((item) => {
        const matchSearch = item.itemName
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
        const matchCategory =
          filterCategory === "all" || item.category === filterCategory;
        return matchSearch && matchCategory;
      }),
    [priceChanges, searchTerm, filterCategory],
  );

  const selectedFilteredCount = filteredItems.filter((item) =>
    selectedItemIds.has(String(item.itemId)),
  ).length;
  const allFilteredSelected =
    filteredItems.length > 0 && selectedFilteredCount === filteredItems.length;
  const someFilteredSelected =
    selectedFilteredCount > 0 && selectedFilteredCount < filteredItems.length;

  const toggleItem = (itemId, checked) => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (checked) next.add(String(itemId));
      else next.delete(String(itemId));
      return next;
    });
  };

  const toggleFilteredItems = (checked) => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      filteredItems.forEach((item) => {
        const id = String(item.itemId);
        if (checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const handlePriceChange = (itemId, methodKey, newValue) => {
    setSubmitError(null);
    setPriceChanges((prev) =>
      prev.map((item) => {
        if (item.itemId !== itemId) return item;
        const methods = item.methods.map((method) => {
          if (method.key !== methodKey) return method;
          const parsedValue = newValue === "" ? 0 : Number(newValue);
          const nextPrice = Number.isFinite(parsedValue)
            ? Math.max(0, parsedValue)
            : 0;
          const changed = nextPrice !== method.originalPrice;
          return {
            ...method,
            newPrice: nextPrice,
            changed,
            changeSource: changed ? "manual" : null,
            bulkOperationKey: null,
          };
        });
        return { ...item, methods: normalizeMethodDefaults(methods) };
      }),
    );
  };

  const applyBulkChange = () => {
    if (bulkChange.value === "") {
      setSubmitError(createValidationError("Hãy nhập giá trị điều chỉnh."));
      return;
    }
    if (bulkChange.applyTo === "category" && !bulkChange.category) {
      setSubmitError(
        createValidationError("Hãy chọn danh mục trước khi áp dụng điều chỉnh giá."),
      );
      return;
    }

    const changeValue = Number(bulkChange.value);
    if (!Number.isFinite(changeValue)) {
      setSubmitError(createValidationError("Giá trị điều chỉnh không hợp lệ."));
      return;
    }
    if (
      bulkChange.type === "percentage" &&
      (changeValue < -100 || changeValue > 500)
    ) {
      setSubmitError(
        createValidationError(
          "Phần trăm chỉ chấp nhận từ -100% đến 500%. Muốn cộng 10.000đ, hãy chọn Cộng/Trừ tiền (VNĐ).",
        ),
      );
      return;
    }

    const operation = {
      key: createBulkOperationKey(),
      mode: bulkChange.type === "percentage" ? "PERCENT" : "AMOUNT",
      value: changeValue,
      roundTo: 0,
      floorZero: true,
    };
    const affectedItemIds = [];

    const nextPriceChanges = priceChanges.map((item) => {
      const selected = selectedItemIds.has(String(item.itemId));
      const inScope =
        bulkChange.applyTo === "all" ||
        (bulkChange.applyTo === "category" &&
          item.category === bulkChange.category);
      if (!selected || !inScope) return item;

      const methods = item.methods.map((method) => {
        const rawPrice =
          operation.mode === "PERCENT"
            ? method.originalPrice * (1 + operation.value / 100)
            : method.originalPrice + operation.value;
        const nextPrice = Math.max(0, Math.round(rawPrice));
        const changed = nextPrice !== method.originalPrice;
        return {
          ...method,
          newPrice: nextPrice,
          changed,
          changeSource: changed ? "bulk" : null,
          bulkOperationKey: changed ? operation.key : null,
        };
      });
      const itemChanged = methods.some((method) => method.changed);
      if (itemChanged) affectedItemIds.push(item.itemId);
      return {
        ...item,
        lastBulkOperationKey: itemChanged ? operation.key : null,
        methods,
      };
    });

    if (affectedItemIds.length === 0) {
      setSubmitError(
        createValidationError(
          selectedItemIds.size === 0
            ? "Chưa có món nào được tick trong phạm vi đã chọn."
            : "Giá mới không khác giá hiện tại của các món đã chọn.",
        ),
      );
      return;
    }

    setPriceChanges(nextPriceChanges);
    setAppliedBulkOperations((current) => ({
      ...current,
      [operation.key]: { ...operation, menuItemIds: affectedItemIds },
    }));
    setSubmitError(null);
  };

  const resetPrices = () => {
    setSubmitError(null);
    setAppliedBulkOperations({});
    setPriceChanges((prev) =>
      prev.map((item) => ({
        ...item,
        lastBulkOperationKey: null,
        methods: normalizeMethodDefaults(
          item.methods.map((method) => ({
            ...method,
            newPrice: method.originalPrice,
            changed: false,
            changeSource: null,
            bulkOperationKey: null,
          })),
        ),
      })),
    );
  };

  const changedItems = useMemo(
    () =>
      priceChanges.filter((item) =>
        item.methods.some((method) => method.changed),
      ),
    [priceChanges],
  );
  const changedCount = changedItems.length;

  const buildManualUpdate = (item) => ({
    itemId: item.itemId,
    itemName: item.itemName,
    methods: normalizeMethodDefaults(
      item.methods.map((method) => ({
        key: method.key || method.name,
        name: method.name,
        mode: method.mode || "PORTION",
        sellQty: method.sellQty || 1,
        sellUnit: method.sellUnit || "portion",
        ingredients: cloneIngredients(method.ingredients),
        isDefault: method.isDefault,
        price: method.newPrice,
      })),
    ),
  });

  const buildSavePayload = () => {
    const bulkGroups = new Map();
    const manualUpdates = [];

    changedItems.forEach((item) => {
      const hasManualChanges = item.methods.some(
        (method) => method.changed && method.changeSource === "manual",
      );
      if (hasManualChanges) {
        manualUpdates.push(buildManualUpdate(item));
        return;
      }

      const changedMethods = item.methods.filter((method) => method.changed);
      if (!changedMethods.length) return;
      const bulkOperationKey =
        item.lastBulkOperationKey || changedMethods[0]?.bulkOperationKey;
      const bulkOperation = bulkOperationKey
        ? appliedBulkOperations[bulkOperationKey]
        : null;
      const isBulkOnlyItem = changedMethods.every(
        (method) =>
          method.changeSource === "bulk" &&
          method.bulkOperationKey === bulkOperationKey,
      );

      if (!bulkOperation || !isBulkOnlyItem) {
        manualUpdates.push(buildManualUpdate(item));
        return;
      }

      const existingGroup = bulkGroups.get(bulkOperationKey) || {
        ...bulkOperation,
        menuItemIds: [],
      };
      existingGroup.menuItemIds.push(item.itemId);
      bulkGroups.set(bulkOperationKey, existingGroup);
    });

    return {
      bulkOperations: Array.from(bulkGroups.values()),
      manualUpdates,
    };
  };

  const handleSave = async () => {
    if (submitting || changedItems.length === 0) return;
    setSubmitError(null);
    setIsLocalSubmitting(true);
    try {
      await onSave(buildSavePayload());
      onClose?.();
    } catch (error) {
      setSubmitError(normalizeInlineError(error));
    } finally {
      setIsLocalSubmitting(false);
    }
  };

  const handleRestoreSavedPrices = async () => {
    if (submitting || !restaurantId || selectedItemIds.size === 0) return;
    setSubmitError(null);
    try {
      const { data } = await restoreSavedPrices({
        variables: {
          input: {
            restaurantId,
            menuItemIds: Array.from(selectedItemIds),
          },
        },
      });
      const result = data?.restoreMenuItemPrices;
      if (!result?.restoredCount) {
        throw new Error(
          "Không có bản giá cũ đã lưu cho các món được tick. Hãy lưu một lần điều chỉnh giá trước.",
        );
      }

      await onSave({ bulkOperations: [], manualUpdates: [] });
      setIsRestoreConfirmOpen(false);
      onClose?.();
    } catch (error) {
      setIsRestoreConfirmOpen(false);
      setSubmitError(normalizeInlineError(error));
    }
  };

  const handleRequestClose = () => {
    if (!submitting) onClose?.();
  };

  const formatPrice = (price) => new Intl.NumberFormat("vi-VN").format(price);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleRequestClose}
        title="Điều chỉnh giá hàng loạt"
        size="xl"
        className="price-edit-modal"
        closeOnOverlayClick={!submitting}
        closeOnEscape={!submitting}
      >
        <div className="pem-container">
          <div className="pem-toolbar">
            <div className="pem-row">
              <div className="pem-control-group" style={{ flex: "0 0 auto" }}>
                <label>Áp dụng cho</label>
                <select
                  className="pem-select"
                  value={bulkChange.applyTo}
                  onChange={(event) =>
                    setBulkChange((current) => ({
                      ...current,
                      applyTo: event.target.value,
                    }))
                  }
                  disabled={submitting}
                >
                  <option value="all">Tất cả món đã tick</option>
                  <option value="category">Món đã tick trong danh mục</option>
                </select>
              </div>

              {bulkChange.applyTo === "category" && (
                <div className="pem-control-group">
                  <label>Chọn danh mục</label>
                  <select
                    className="pem-select"
                    value={bulkChange.category}
                    onChange={(event) =>
                      setBulkChange((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    disabled={submitting}
                  >
                    <option value="">-- Chọn --</option>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pem-control-group">
                <label>Loại điều chỉnh</label>
                <select
                  className="pem-select"
                  value={bulkChange.type}
                  onChange={(event) => {
                    setBulkChange((current) => ({
                      ...current,
                      type: event.target.value,
                      value: "",
                    }));
                    setSubmitError(null);
                  }}
                  disabled={submitting}
                >
                  <option value="fixed">Cộng/Trừ tiền (VNĐ)</option>
                  <option value="percentage">Tăng/Giảm %</option>
                </select>
              </div>

              <div className="pem-control-group">
                <label>
                  Giá trị {bulkChange.type === "percentage" ? "(%)" : "(VNĐ)"}
                </label>
                <input
                  type="number"
                  className="pem-input"
                  placeholder={
                    bulkChange.type === "percentage"
                      ? "VD: 10 hoặc -10"
                      : "VD: 10000 hoặc -10000"
                  }
                  value={bulkChange.value}
                  min={bulkChange.type === "percentage" ? -100 : undefined}
                  max={bulkChange.type === "percentage" ? 500 : undefined}
                  step={bulkChange.type === "percentage" ? 1 : 1000}
                  onChange={(event) =>
                    setBulkChange((current) => ({
                      ...current,
                      value: event.target.value,
                    }))
                  }
                  disabled={submitting}
                />
              </div>

              <button
                className="pem-btn-apply"
                onClick={applyBulkChange}
                disabled={submitting || selectedItemIds.size === 0}
              >
                <FiZap /> Áp dụng
              </button>
              <button
                className="pem-btn-reset"
                onClick={() => setIsResetConfirmOpen(true)}
                disabled={submitting}
              >
                <FiRefreshCw /> Đặt lại
              </button>
              <button
                className="pem-btn-reset"
                onClick={() => setIsRestoreConfirmOpen(true)}
                disabled={submitting || !restaurantId || selectedItemIds.size === 0}
                title="Khôi phục giá gần nhất đã lưu trong cơ sở dữ liệu"
              >
                <FiRotateCcw /> Khôi phục giá đã lưu
              </button>
            </div>

            <div className="pem-selection-note">
              Đã tick <strong>{selectedItemIds.size}</strong> món. Bỏ tick những món
              không muốn áp dụng trước khi nhấn “Áp dụng”.
            </div>
          </div>

          <div className="pem-table-wrapper">
            {submitError?.message && (
              <div className="pem-empty pem-error">
                <div className="pem-error-title">
                  <FiAlertCircle /> <strong>{submitError.message}</strong>
                </div>
                {submitError.failureCount > 0 && (
                  <div className="pem-error-list">
                    {submitError.successCount > 0 && (
                      <div>Đã lưu thành công {submitError.successCount} món.</div>
                    )}
                    {submitError.failures.map((failure, index) => (
                      <div
                        key={`${
                          failure.itemId || failure.itemName || "failure"
                        }-${index}`}
                      >
                        {(failure.itemName || "Món không xác định") +
                          ": " +
                          failure.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="pem-search-bar">
              <FiSearch className="search-icon" size={18} />
              <input
                type="text"
                placeholder="Tìm món ăn..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                disabled={submitting}
              />
              <div className="pem-search-divider" />
              <FiFilter className="search-icon" size={16} />
              <select
                className="pem-filter-select"
                value={filterCategory}
                onChange={(event) => setFilterCategory(event.target.value)}
                disabled={submitting}
              >
                <option value="all">Tất cả danh mục</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="pem-scroll-area">
              {filteredItems.length === 0 ? (
                <div className="pem-empty">Không tìm thấy món ăn nào phù hợp.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th className="pem-check-cell">
                        <input
                          type="checkbox"
                          aria-label="Chọn tất cả món đang hiển thị"
                          checked={allFilteredSelected}
                          ref={(node) => {
                            if (node) node.indeterminate = someFilteredSelected;
                          }}
                          onChange={(event) =>
                            toggleFilteredItems(event.target.checked)
                          }
                          disabled={submitting}
                        />
                      </th>
                      <th>Món ăn</th>
                      <th>Quy cách</th>
                      <th>Giá hiện tại</th>
                      <th>Giá mới (VNĐ)</th>
                      <th>Chênh lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) =>
                      item.methods.map((method, idx) => (
                        <tr
                          key={`${item.itemId}-${method.key || idx}`}
                          className={method.changed ? "is-changed" : ""}
                        >
                          <td className="pem-check-cell">
                            {idx === 0 && (
                              <input
                                type="checkbox"
                                aria-label={`Chọn ${item.itemName}`}
                                checked={selectedItemIds.has(String(item.itemId))}
                                onChange={(event) =>
                                  toggleItem(item.itemId, event.target.checked)
                                }
                                disabled={submitting}
                              />
                            )}
                          </td>
                          <td>
                            {idx === 0 && (
                              <div>
                                <div className="pem-item-name">{item.itemName}</div>
                                {item.category !== "Chưa phân loại" && (
                                  <span className="pem-cate-tag">
                                    {item.category}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td>{method.name}</td>
                          <td className="pem-current-price">
                            {formatPrice(method.originalPrice)}
                          </td>
                          <td>
                            <input
                              type="number"
                              className={`pem-input-price ${
                                method.changed ? "changed" : ""
                              }`}
                              value={method.newPrice}
                              step={1000}
                              onFocus={(event) => event.target.select()}
                              onChange={(event) =>
                                handlePriceChange(
                                  item.itemId,
                                  method.key,
                                  event.target.value,
                                )
                              }
                              disabled={submitting}
                            />
                          </td>
                          <td>
                            {method.changed &&
                              (method.newPrice > method.originalPrice ? (
                                <span className="pem-indicator inc">
                                  <FiTrendingUp />{" "}
                                  {formatPrice(
                                    method.newPrice - method.originalPrice,
                                  )}
                                </span>
                              ) : method.newPrice < method.originalPrice ? (
                                <span className="pem-indicator dec">
                                  <FiTrendingDown />{" "}
                                  {formatPrice(
                                    method.originalPrice - method.newPrice,
                                  )}
                                </span>
                              ) : null)}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="pem-footer">
            <div className="pem-stats">
              Đang hiển thị <strong>{filteredItems.length}</strong> món · Đã tick{" "}
              <strong>{selectedItemIds.size}</strong> món · Đã sửa đổi{" "}
              <strong>{changedCount}</strong> món.
            </div>
            <div className="pem-actions">
              <button
                className="btn-cancel"
                onClick={handleRequestClose}
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button
                className="btn-save"
                onClick={handleSave}
                disabled={changedCount === 0 || submitting}
              >
                <FiCheck style={{ marginRight: 6 }} />
                {submitting
                  ? "Đang xử lý..."
                  : `Lưu${changedCount > 0 ? ` (${changedCount})` : ""} thay đổi`}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <MenuConfirmDialog
        isOpen={isResetConfirmOpen}
        title="Đặt lại toàn bộ giá?"
        message="Các thay đổi giá chưa lưu sẽ được đưa về giá ban đầu."
        tone="warning"
        confirmText="Đặt lại"
        cancelText="Hủy"
        isLoading={submitting}
        onCancel={() => setIsResetConfirmOpen(false)}
        onConfirm={() => {
          resetPrices();
          setIsResetConfirmOpen(false);
        }}
      />

      <MenuConfirmDialog
        isOpen={isRestoreConfirmOpen}
        title="Khôi phục giá đã lưu?"
        message={`Hệ thống sẽ lấy bản giá trước lần điều chỉnh gần nhất của ${selectedItemIds.size} món đã tick từ cơ sở dữ liệu. Các thay đổi chưa lưu trong cửa sổ này sẽ bị bỏ.`}
        tone="warning"
        confirmText="Khôi phục giá"
        cancelText="Hủy"
        isLoading={isRestoringPrices}
        onCancel={() => setIsRestoreConfirmOpen(false)}
        onConfirm={handleRestoreSavedPrices}
      />
    </>
  );
};

export default PriceEditModal;
