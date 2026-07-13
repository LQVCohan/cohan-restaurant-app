import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  MapPin,
  User as UserCircle,
  AlertTriangle,
  X,
  Search,
  Plus,
  Minus,
  Scale,
  Crown,
  ChevronRight,
  Camera,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { getStaffOrderingPermissions } from "../staffOrderingPermissions";
import StaffProofCaptureModal from "./StaffProofCaptureModal";
import {
  normalizeProofImages,
  requiresProofImage,
} from "@/utils/orderProofRules";
import {
  getStaffOrderSelectionTotal,
  isWeightServingVariant,
  parsePortionQuantity,
  parseWeightKg,
  weightKgToGrams,
} from "@/utils/staffOrderQuantity";
import "./MenuOrdering.scss";

const NO_PERMISSION_MESSAGE =
  "Vai trò hiện tại không có quyền thực hiện thao tác này.";
const READONLY_MESSAGE =
  "Vai trò hiện tại chỉ có quyền xem và thao tác trong phạm vi được phân công.";

const sanitizeCategoryLabel = (value) => {
  const label = String(value || "").trim();
  if (!label || label === "Khác") return "Chưa phân loại";
  if (/^Danh mục\s+[0-9a-f]{3,}$/i.test(label)) return "Chưa phân loại";
  if (/^[0-9a-f]{12,}$/i.test(label)) return "Chưa phân loại";
  return label;
};

const getVariantKey = (variant) => {
  return String(variant?.key || variant?.mode || variant?.name || "");
};

export default function MenuOrdering({
  onAdd,
  onItemSheetOpenChange,
  menuSearchQuery = "",
  setMenuSearchQuery,
  menuCategoryFilter = "all",
  setMenuCategoryFilter,
  menuServingFilter = "all",
  setMenuServingFilter,
  menuAvailabilityFilter = "available",
  setMenuAvailabilityFilter,
  menuPriceFilter = "all",
  setMenuPriceFilter,
  selectedTable,
  setSelectedCategory,
  onRemoveCustomer,
  menuItems = [],
  categories = ["Tất cả"],
}) {
  const { user } = useContext(AuthContext) || {};
  const permissions = useMemo(() => {
    return getStaffOrderingPermissions(user);
  }, [user]);

  const [selectedItem, setSelectedItem] = useState(null);
  const [prepChoice, setPrepChoice] = useState("");
  const [serveOrder, setServeOrder] = useState("Mang ra cùng lúc");
  const [selectedVariantKey, setSelectedVariantKey] = useState("");
  const [portionQuantityInput, setPortionQuantityInput] = useState("1");
  const [weightKgInput, setWeightKgInput] = useState("1");
  const [draftProofImages, setDraftProofImages] = useState([]);
  const [proofDraftItem, setProofDraftItem] = useState(null);
  const [actionError, setActionError] = useState("");

  const servingOptions = useMemo(() => {
    const options = new Map([["all", "Tất cả khẩu phần"]]);
    (menuItems || []).forEach((item) => {
      (item.servingVariants || []).forEach((variant) => {
        const key = getVariantKey(variant);
        if (key) {
          options.set(key, variant?.name || variant?.key || "Khẩu phần");
        }
      });
    });
    return Array.from(options, ([value, label]) => ({ value, label }));
  }, [menuItems]);

  const categoryOptions = useMemo(() => {
    const seen = new Set(["all"]);
    const options = [{ value: "all", label: "Tất cả" }];
    const source = categories?.length ? categories : ["Tất cả"];

    source.forEach((cat) => {
      const label = sanitizeCategoryLabel(cat);
      if (!label || label === "Tất cả" || seen.has(label)) return;
      seen.add(label);
      options.push({ value: label, label });
    });

    const meaningfulOptions = options.filter((option) => option.value !== "all");
    if (meaningfulOptions.length === 1 && meaningfulOptions[0].label === "Chưa phân loại") {
      return options.slice(0, 1);
    }

    return options;
  }, [categories]);

  const selectedVariants = useMemo(() => {
    return Array.isArray(selectedItem?.servingVariants)
      ? selectedItem.servingVariants
      : [];
  }, [selectedItem]);

  const selectedVariant = useMemo(() => {
    return (
      selectedVariants.find((variant) => getVariantKey(variant) === selectedVariantKey) ||
      selectedItem?.defaultVariant ||
      selectedVariants[0] ||
      null
    );
  }, [selectedItem, selectedVariantKey, selectedVariants]);

  const isWeightVariant = isWeightServingVariant(selectedVariant);
  const selectedUnitPrice = Number(
    selectedVariant?.price ?? selectedItem?.price ?? 0,
  );
  const portionQuantity = parsePortionQuantity(portionQuantityInput);
  const weightKg = parseWeightKg(weightKgInput);
  const quantityIsValid = isWeightVariant
    ? weightKg != null
    : portionQuantity != null;
  const selectionTotal = getStaffOrderSelectionTotal({
    price: selectedUnitPrice,
    variant: selectedVariant,
    portionQuantity: portionQuantityInput,
    weightKg: weightKgInput,
  });
  const quantityStepNumber = selectedVariants.length > 1 ? 2 : 1;
  const serveOrderStepNumber = quantityStepNumber + 1;
  const proofStepNumber = serveOrderStepNumber + 1;
  const selectedUnitLabel = isWeightVariant
    ? String(selectedVariant?.sellUnit || "kg").toLowerCase()
    : "phần";

  const draftProofTarget = useMemo(() => {
    if (!selectedItem) return null;
    return {
      ...selectedItem,
      quantity: isWeightVariant ? 1 : portionQuantity || 1,
      weightGrams: isWeightVariant ? weightKgToGrams(weightKgInput) : null,
      servingVariant: selectedVariant,
      proofImages: draftProofImages,
    };
  }, [
    draftProofImages,
    isWeightVariant,
    portionQuantity,
    selectedItem,
    selectedVariant,
    weightKgInput,
  ]);

  const shouldSuggestProof = useMemo(() => {
    if (!draftProofTarget) return false;
    const variantMode = String(selectedVariant?.mode || selectedVariant?.key || "").toUpperCase();
    return variantMode === "BY_WEIGHT" || requiresProofImage(draftProofTarget);
  }, [draftProofTarget, selectedVariant]);

  const filteredMenu = useMemo(() => {
    const matchesPriceFilter = (price) => {
      const amount = Number(price || 0);
      if (menuPriceFilter === "under_50000") return amount < 50000;
      if (menuPriceFilter === "50000_100000") {
        return amount >= 50000 && amount <= 100000;
      }
      if (menuPriceFilter === "100000_300000") {
        return amount > 100000 && amount <= 300000;
      }
      if (menuPriceFilter === "over_300000") return amount > 300000;
      return true;
    };

    return (menuItems || []).filter((m) => {
      const keyword = menuSearchQuery.trim().toLowerCase();
      const variantText = (m.servingVariants || [])
        .map((variant) => [variant?.name, variant?.key, variant?.mode].filter(Boolean).join(" "))
        .join(" ")
        .toLowerCase();
      const categoryLabel = sanitizeCategoryLabel(m.category);
      const matchesKeyword = !keyword || `${m.name} ${variantText}`.toLowerCase().includes(keyword);
      const matchesCategory = menuCategoryFilter === "all" || categoryLabel === menuCategoryFilter;
      const matchesServing =
        menuServingFilter === "all" ||
        (m.servingVariants || []).some((variant) => {
          return [variant?.key, variant?.mode, variant?.name]
            .filter(Boolean)
            .map(String)
            .includes(menuServingFilter);
        });
      const isAvailable =
        Number(m.stock || 0) > 0 &&
        !["unavailable", "out_of_stock", "hidden"].includes(String(m.status || "").toLowerCase());
      const matchesAvailability =
        menuAvailabilityFilter === "all" ||
        (menuAvailabilityFilter === "available" ? isAvailable : !isAvailable);
      return matchesKeyword && matchesCategory && matchesServing && matchesAvailability && matchesPriceFilter(m.price);
    });
  }, [menuAvailabilityFilter, menuCategoryFilter, menuItems, menuPriceFilter, menuSearchQuery, menuServingFilter]);

  useEffect(() => {
    onItemSheetOpenChange?.(Boolean(selectedItem && permissions.canAddItems));
    return () => onItemSheetOpenChange?.(false);
  }, [onItemSheetOpenChange, permissions.canAddItems, selectedItem]);

  const closeOptionsSheet = () => {
    setSelectedItem(null);
    setSelectedVariantKey("");
    setPrepChoice("");
    setServeOrder("Mang ra cùng lúc");
    setPortionQuantityInput("1");
    setWeightKgInput("1");
    setDraftProofImages([]);
    setProofDraftItem(null);
    setActionError("");
  };

  const handleOpenItem = (item) => {
    if (!permissions.canAddItems) return;

    const variants = Array.isArray(item.servingVariants) ? item.servingVariants : [];
    const defaultVariant =
      item.defaultVariant ||
      variants.find((variant) => variant?.key === item.servingKey) ||
      variants[0] ||
      null;

    setSelectedItem(item);
    setSelectedVariantKey(getVariantKey(defaultVariant));
    setPrepChoice("");
    setServeOrder("Mang ra cùng lúc");
    setPortionQuantityInput("1");
    setWeightKgInput("1");
    setDraftProofImages([]);
    setProofDraftItem(null);
    setActionError("");
  };

  const adjustSelectionAmount = (direction) => {
    setActionError("");

    if (isWeightVariant) {
      const current = parseWeightKg(weightKgInput) ?? 0;
      const next = Math.min(
        100,
        Math.max(0.1, Math.round((current + direction * 0.1) * 1000) / 1000),
      );
      setWeightKgInput(String(next));
      return;
    }

    const current = parsePortionQuantity(portionQuantityInput) ?? 1;
    const next = Math.min(99, Math.max(1, current + direction));
    setPortionQuantityInput(String(next));
  };

  const handleConfirmAdd = () => {
    if (!permissions.canAddItems) {
      setActionError(NO_PERMISSION_MESSAGE);
      return;
    }

    if (selectedVariants.length > 1 && !selectedVariant) {
      setActionError("Vui lòng chọn biến thể món.");
      return;
    }

    if (!quantityIsValid) {
      setActionError(
        isWeightVariant
          ? "Khối lượng phải lớn hơn 0 và không vượt quá 100 kg. Có thể nhập số thập phân như 0,5 hoặc 1,25."
          : "Số phần phải là số nguyên từ 1 đến 99.",
      );
      return;
    }

    setActionError("");

    onAdd(selectedItem, {
      variant: selectedVariant,
      quantity: isWeightVariant ? 1 : portionQuantity,
      weightGrams: isWeightVariant ? weightKgToGrams(weightKgInput) : null,
      prep: prepChoice || "Mặc định",
      serveOrder,
      proofImages: draftProofImages,
    });

    closeOptionsSheet();
  };

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString("vi-VN");
  }

  function getCustomerAccumulatedValue(customer) {
    return Number(
      customer?.totalSpending ??
        customer?.points ??
        customer?.loyaltyPoints ??
        0,
    );
  }

  function getCustomerNote(customer) {
    return (
      customer?.note ||
      customer?.noteInternal ||
      customer?.dietaryNotes ||
      customer?.customerPreferences ||
      ""
    );
  }

  if (!selectedTable) {
    return (
      <div className="staff-pos-empty-state">
        <div className="empty-icon-wrapper">
          <MapPin size={40} />
        </div>
        <h3>Chưa chọn bàn</h3>
        <p>Vui lòng chọn một bàn từ sơ đồ để bắt đầu gọi món</p>
      </div>
    );
  }

  return (
    <div className="staff-pos-menu">
      <div className="table-status-banner">
        <div className="table-info">
          <span className="label">Đang lên đơn</span>
          <span className="table-name">{selectedTable.name}</span>
        </div>
        <ChevronRight size={18} className="icon-right" />
      </div>

      {selectedTable.customer ? (
        <div className="customer-vip-card">
          <div className="cus-header">
            <div className="cus-avatar-wrap">
              <UserCircle size={36} className="text-primary" />
            </div>
            <div className="cus-details">
              <h4>
                {selectedTable.customer.name}
                <span className="rank-badge">
                  <Crown size={12} /> {selectedTable.customer.rank}
                </span>
              </h4>
              <p>
                {selectedTable.customer.phone || "Chưa có SĐT"} • Tích lũy:{" "}
                <strong>
                  {formatCurrency(
                    getCustomerAccumulatedValue(selectedTable.customer),
                  )}
                  đ
                </strong>
              </p>
            </div>
            {permissions.canRemoveCustomer && (
              <button
                type="button"
                className="btn-remove-cus"
                onClick={() => {
                  if (!permissions.canRemoveCustomer) {
                    setActionError(NO_PERMISSION_MESSAGE);
                    return;
                  }
                  onRemoveCustomer?.();
                }}
                aria-label="Gỡ khách khỏi bàn"
              >
                <X size={20} />
              </button>
            )}
          </div>
          {getCustomerNote(selectedTable.customer) && (
            <div className="cus-warning">
              <AlertTriangle size={14} />
              <span>
                <strong>Lưu ý:</strong>{" "}
                {getCustomerNote(selectedTable.customer)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="customer-empty-hint">
          <Search size={16} />
          <span>Có thể gán khách quen từ thanh tìm khách phía trên.</span>
        </div>
      )}

      {actionError && (
        <div className="staff-inline-state" role="alert">{actionError}</div>
      )}

      {permissions.isReadOnlyRole && (
        <div className="staff-inline-state">{READONLY_MESSAGE}</div>
      )}

      {permissions.canViewMenu && (
        <>
          <div className="menu-filter-panel" aria-label="Tìm và lọc món">
            <label className="menu-search-field">
              <Search size={17} />
              <input
                type="search"
                placeholder="Tìm món ăn, đồ uống..."
                value={menuSearchQuery}
                onChange={(event) => setMenuSearchQuery?.(event.target.value)}
              />
              {menuSearchQuery ? (
                <button type="button" onClick={() => setMenuSearchQuery?.("")} aria-label="Xóa tìm kiếm món">
                  <X size={15} />
                </button>
              ) : null}
            </label>
            <div className="category-scroll" aria-label="Lọc danh mục món">
              {categoryOptions.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  className={`filter-chip ${menuCategoryFilter === cat.value ? "active" : ""}`}
                  onClick={() => {
                    setMenuCategoryFilter?.(cat.value);
                    setSelectedCategory?.(cat.label);
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="category-scroll category-scroll--secondary" aria-label="Lọc món nâng cao">
              {servingOptions.map((option) => (
                <button key={option.value} type="button" className={`filter-chip ${menuServingFilter === option.value ? "active" : ""}`} onClick={() => setMenuServingFilter?.(option.value)}>{option.label}</button>
              ))}
              {[{ value: "available", label: "Còn món" }, { value: "all", label: "Tất cả trạng thái" }, { value: "sold_out", label: "Hết món" }].map((option) => (
                <button key={option.value} type="button" className={`filter-chip ${menuAvailabilityFilter === option.value ? "active" : ""}`} onClick={() => setMenuAvailabilityFilter?.(option.value)}>{option.label}</button>
              ))}
              {[
                { value: "all", label: "Mọi giá" },
                { value: "under_50000", label: "Dưới 50k" },
                { value: "50000_100000", label: "50k–100k" },
                { value: "100000_300000", label: "100k–300k" },
                { value: "over_300000", label: "Trên 300k" },
              ].map((option) => (
                <button key={option.value} type="button" className={`filter-chip ${menuPriceFilter === option.value ? "active" : ""}`} onClick={() => setMenuPriceFilter?.(option.value)}>{option.label}</button>
              ))}
            </div>
          </div>

          <div className="menu-grid">
            {!menuItems.length ? <div className="staff-inline-state">Nhà hàng chưa có món đang bán.</div> : null}
            {menuItems.length > 0 && filteredMenu.length === 0 ? <div className="staff-inline-state">Không tìm thấy món phù hợp.</div> : null}
            {filteredMenu.map((item) => {
              const isOutOfStock = item.stock <= 0;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={`menu-item-card ${isOutOfStock ? "out-of-stock" : ""}`}
                  onClick={() => {
                    if (isOutOfStock || !permissions.canAddItems) return;
                    handleOpenItem(item);
                  }}
                >
                  <div className="item-content">
                    <h4 className="item-name">{item.name}</h4>
                    <p className="item-price">{item.price.toLocaleString()}đ</p>
                  </div>
                  <div className="item-footer">
                    <span className={`stock-badge ${isOutOfStock ? "out" : "in"}`}>
                      {isOutOfStock ? "Hết món" : `Còn ${item.stock}`}
                    </span>
                    {!isOutOfStock && permissions.canAddItems && (
                      <span className="btn-add-quick" aria-hidden="true">
                        <Plus size={16} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {selectedItem && permissions.canAddItems && (
        <div
          className="item-options-overlay"
          onClick={closeOptionsSheet}
        >
          <div
            className="item-options-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drag-indicator">
              <div className="drag-handle"></div>
            </div>

            <div className="sheet-header">
              <div className="header-info">
                <h3>{selectedItem.name}</h3>
                <p className="price-text">
                  {selectedUnitPrice.toLocaleString("vi-VN")}đ/{selectedUnitLabel}
                </p>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={closeOptionsSheet}
                aria-label="Đóng tùy chọn món"
              >
                <X size={24} />
              </button>
            </div>

            <div className="sheet-body">
              {selectedVariants.length > 1 && (
                <div className="option-group">
                  <label className="group-label">1. Chọn biến thể</label>
                  <div className="chips-container">
                    {selectedVariants.map((variant) => {
                      const variantKey = getVariantKey(variant);
                      return (
                        <button
                          type="button"
                          key={variantKey}
                          className={`option-chip ${
                            selectedVariantKey === variantKey ? "selected" : ""
                          }`}
                          onClick={() => {
                            setSelectedVariantKey(variantKey);
                            setActionError("");
                          }}
                        >
                          {variant.name || variant.key}
                          {variant.price != null
                            ? ` · ${Number(variant.price).toLocaleString("vi-VN")}đ`
                            : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="option-group">
                <label className="group-label">
                  {quantityStepNumber}. {isWeightVariant ? "Khối lượng gọi món" : "Số phần"}
                </label>
                <div className={`quantity-editor-card ${isWeightVariant ? "is-weight" : "is-portion"}`}>
                  <div className="quantity-editor-card__top">
                    <span className="quantity-editor-card__icon" aria-hidden="true">
                      <Scale size={18} />
                    </span>
                    <div>
                      <strong>
                        {isWeightVariant ? "Nhập số kilogram" : "Nhập số phần nguyên"}
                      </strong>
                      <p>
                        {isWeightVariant
                          ? "Có thể nhập số thập phân, ví dụ 0,5 kg hoặc 1,25 kg."
                          : "Chỉ nhận số nguyên từ 1 đến 99 phần."}
                      </p>
                    </div>
                  </div>

                  <div className="quantity-stepper">
                    <button
                      type="button"
                      className="quantity-stepper__button"
                      onClick={() => adjustSelectionAmount(-1)}
                      aria-label={isWeightVariant ? "Giảm 0,1 kilogram" : "Giảm một phần"}
                    >
                      <Minus size={18} />
                    </button>
                    <label className="quantity-stepper__field">
                      <input
                        type="text"
                        inputMode={isWeightVariant ? "decimal" : "numeric"}
                        aria-label={isWeightVariant ? "Khối lượng kilogram" : "Số phần"}
                        value={isWeightVariant ? weightKgInput : portionQuantityInput}
                        onChange={(event) => {
                          const next = event.target.value;
                          setActionError("");
                          if (isWeightVariant) {
                            if (/^\d{0,3}(?:[.,]\d{0,3})?$/.test(next)) {
                              setWeightKgInput(next);
                            }
                            return;
                          }
                          setPortionQuantityInput(next.replace(/\D/g, "").slice(0, 2));
                        }}
                      />
                      <span className="quantity-stepper__suffix">
                        {isWeightVariant ? "kg" : "phần"}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="quantity-stepper__button"
                      onClick={() => adjustSelectionAmount(1)}
                      aria-label={isWeightVariant ? "Tăng 0,1 kilogram" : "Tăng một phần"}
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  <div className="quantity-editor-card__meta">
                    <span>
                      {isWeightVariant && weightKg != null
                        ? `${Math.round(weightKg * 1000).toLocaleString("vi-VN")} g`
                        : isWeightVariant
                          ? "Chưa nhập khối lượng hợp lệ"
                          : portionQuantity != null
                            ? `${portionQuantity} phần`
                            : "Chưa nhập số phần hợp lệ"}
                    </span>
                    <span className="quantity-editor-card__total">
                      Tạm tính <strong>{selectionTotal.toLocaleString("vi-VN")}đ</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="option-group">
                <label className="group-label">{serveOrderStepNumber}. Thứ tự lên món</label>
                <div className="chips-container">
                  {[
                    "Khai vị (Mang ra trước)",
                    "Mang ra cùng lúc",
                    "Tráng miệng (Mang ra sau)",
                  ].map((s) => (
                    <button
                      type="button"
                      key={s}
                      className={`option-chip ${serveOrder === s ? "selected" : ""}`}
                      onClick={() => setServeOrder(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="option-group proof-option-card">
                <div className="proof-option-card__copy">
                  <label className="group-label">{proofStepNumber}. Ảnh minh chứng</label>
                  <p>Dùng cho món cân ký hoặc món cần xác nhận hình ảnh trước khi gửi bếp.</p>
                  <span className="proof-option-card__status">
                    {draftProofImages.length
                      ? `Đã có ${draftProofImages.length} ảnh minh chứng`
                      : "Chưa có ảnh minh chứng."}
                  </span>
                </div>
                {shouldSuggestProof ? (
                  <div className="proof-option-card__hint">
                    Món này nên có ảnh minh chứng trước khi gửi bếp.
                  </div>
                ) : null}
                <button
                  type="button"
                  className="proof-option-card__button"
                  onClick={() => setProofDraftItem(draftProofTarget)}
                >
                  <Camera size={16} />
                  Chụp ảnh minh chứng
                </button>
              </div>

              {actionError && (
                <div className="item-options-error" role="alert">
                  {actionError}
                </div>
              )}
            </div>

            <div className="sheet-footer">
              <button
                type="button"
                className="btn-confirm-add"
                onClick={handleConfirmAdd}
                disabled={!quantityIsValid}
              >
                {quantityIsValid
                  ? `Thêm vào đơn • ${selectionTotal.toLocaleString("vi-VN")}đ`
                  : "Nhập số lượng hợp lệ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {proofDraftItem && (
        <StaffProofCaptureModal
          open={Boolean(proofDraftItem)}
          item={{ ...proofDraftItem, proofImages: draftProofImages }}
          onClose={() => setProofDraftItem(null)}
          onSave={(images) => {
            setDraftProofImages(normalizeProofImages(images));
            setProofDraftItem(null);
          }}
        />
      )}
    </div>
  );
}
