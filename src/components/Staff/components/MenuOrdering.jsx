import React, { useContext, useMemo, useState } from "react";
import {
  MapPin,
  UserCircle,
  AlertTriangle,
  X,
  Search,
  Plus,
  Crown,
  ChevronRight,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { getStaffOrderingPermissions } from "../staffOrderingPermissions";
import "./MenuOrdering.scss";

const NO_PERMISSION_MESSAGE =
  "Vai trò hiện tại không có quyền thực hiện thao tác này.";
const READONLY_MESSAGE =
  "Vai trò hiện tại chỉ có quyền xem và thao tác trong phạm vi được phân công.";

export default function MenuOrdering({
  onAdd,
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
  selectedCategory,
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

  const servingOptions = useMemo(() => {
    const options = new Map([["all", "Tất cả khẩu phần"]]);
    (menuItems || []).forEach((item) => {
      (item.servingVariants || []).forEach((variant) => {
        const key = variant?.key || variant?.mode || variant?.name;
        if (key) options.set(String(key), variant?.name || variant?.key || "Khẩu phần");
      });
    });
    return Array.from(options, ([value, label]) => ({ value, label }));
  }, [menuItems]);

  const categoryOptions = useMemo(() => {
    const source = categories?.length ? categories : ["Tất cả"];
    return [
      { value: "all", label: "Tất cả" },
      ...source.filter((cat) => cat && cat !== "Tất cả").map((cat) => ({ value: cat, label: cat })),
    ];
  }, [categories]);

  const matchesPriceFilter = (price) => {
    const amount = Number(price || 0);
    if (menuPriceFilter === "under_50000") return amount < 50000;
    if (menuPriceFilter === "50000_100000") return amount >= 50000 && amount <= 100000;
    if (menuPriceFilter === "100000_300000") return amount > 100000 && amount <= 300000;
    if (menuPriceFilter === "over_300000") return amount > 300000;
    return true;
  };

  const filteredMenu = (menuItems || []).filter((m) => {
    const keyword = menuSearchQuery.trim().toLowerCase();
    const variantText = (m.servingVariants || [])
      .map((variant) => [variant?.name, variant?.key, variant?.mode].filter(Boolean).join(" "))
      .join(" ")
      .toLowerCase();
    const matchesKeyword = !keyword || `${m.name} ${variantText}`.toLowerCase().includes(keyword);
    const matchesCategory = menuCategoryFilter === "all" || m.category === menuCategoryFilter || m.categoryId === menuCategoryFilter;
    const matchesServing = menuServingFilter === "all" || (m.servingVariants || []).some((variant) => [variant?.key, variant?.mode, variant?.name].map(String).includes(menuServingFilter));
    const isAvailable = Number(m.stock || 0) > 0 && !["unavailable", "out_of_stock", "hidden"].includes(String(m.status || "").toLowerCase());
    const matchesAvailability = menuAvailabilityFilter === "all" || (menuAvailabilityFilter === "available" ? isAvailable : !isAvailable);
    return matchesKeyword && matchesCategory && matchesServing && matchesAvailability && matchesPriceFilter(m.price);
  });

  const handleConfirmAdd = () => {
    if (!permissions.canAddItems) {
      alert(NO_PERMISSION_MESSAGE);
      return;
    }

    const variants = Array.isArray(selectedItem?.servingVariants)
      ? selectedItem.servingVariants
      : [];

    const selectedVariant =
      variants.find((v) => v?.key === selectedVariantKey) ||
      selectedItem?.defaultVariant ||
      variants[0] ||
      null;

    if (variants.length > 1 && !selectedVariant) {
      alert("Vui lòng chọn biến thể món.");
      return;
    }

    onAdd(selectedItem, {
      variant: selectedVariant,
      prep: prepChoice || "Mặc định",
      serveOrder,
    });

    setSelectedItem(null);
    setSelectedVariantKey("");
    setPrepChoice("");
    setServeOrder("Mang ra cùng lúc");
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
                className="btn-remove-cus"
                onClick={() => {
                  if (!permissions.canRemoveCustomer) {
                    alert(NO_PERMISSION_MESSAGE);
                    return;
                  }
                  onRemoveCustomer?.();
                }}
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
                <div
                  key={item.id}
                  className={`menu-item-card ${isOutOfStock ? "out-of-stock" : ""}`}
                  onClick={() => {
                    if (isOutOfStock || !permissions.canAddItems) return;

                    const variants = Array.isArray(item.servingVariants)
                      ? item.servingVariants
                      : [];
                    const defaultVariant =
                      item.defaultVariant ||
                      variants.find((v) => v?.key === item.servingKey) ||
                      variants[0] ||
                      null;

                    setSelectedItem(item);
                    setSelectedVariantKey(defaultVariant?.key || "");
                    setPrepChoice("");
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
                      <button className="btn-add-quick">
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedItem && permissions.canAddItems && (
        <div
          className="item-options-overlay"
          onClick={() => setSelectedItem(null)}
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
                  {selectedItem.price.toLocaleString()}đ
                </p>
              </div>
              <button
                className="btn-close"
                onClick={() => setSelectedItem(null)}
              >
                <X size={24} />
              </button>
            </div>

            <div className="sheet-body">
              {Array.isArray(selectedItem.servingVariants) &&
                selectedItem.servingVariants.length > 1 && (
                  <div className="option-group">
                    <label className="group-label">1. Chọn biến thể</label>
                    <div className="chips-container">
                      {selectedItem.servingVariants.map((variant) => (
                        <button
                          key={variant.key}
                          className={`option-chip ${
                            selectedVariantKey === variant.key ? "selected" : ""
                          }`}
                          onClick={() => setSelectedVariantKey(variant.key)}
                        >
                          {variant.name || variant.key}
                          {variant.price != null
                            ? ` · ${Number(variant.price).toLocaleString("vi-VN")}đ`
                            : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              <div className="option-group">
                <label className="group-label">2. Thứ tự lên món</label>
                <div className="chips-container">
                  {[
                    "Khai vị (Mang ra trước)",
                    "Mang ra cùng lúc",
                    "Tráng miệng (Mang ra sau)",
                  ].map((s) => (
                    <button
                      key={s}
                      className={`option-chip ${serveOrder === s ? "selected" : ""}`}
                      onClick={() => setServeOrder(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sheet-footer">
              <button className="btn-confirm-add" onClick={handleConfirmAdd}>
                Thêm vào đơn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
