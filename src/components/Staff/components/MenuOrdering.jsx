import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  MapPin,
  User as UserCircle,
  AlertTriangle,
  X,
  Search,
  Plus,
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
  const [draftProofImages, setDraftProofImages] = useState([]);
  const [proofDraftItem, setProofDraftItem] = useState(null);

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

  const filteredItems = useMemo(() => {
    const search = String(menuSearchQuery || "").trim().toLowerCase();
    return (menuItems || []).filter((item) => {
      const matchesSearch =
        !search ||
        String(item?.name || "").toLowerCase().includes(search) ||
        String(item?.description || "").toLowerCase().includes(search);
      const categoryLabel = sanitizeCategoryLabel(item?.categoryLabel || item?.category || item?.categoryName);
      const matchesCategory =
        menuCategoryFilter === "all" ||
        categoryLabel === menuCategoryFilter ||
        item?.categoryId === menuCategoryFilter;
      const matchesServing =
        menuServingFilter === "all" ||
        (item?.servingVariants || []).some((variant) => getVariantKey(variant) === menuServingFilter);
      const price = Number(item?.price || item?.basePrice || item?.currentPrice || 0);
      const matchesPrice =
        menuPriceFilter === "all" ||
        (menuPriceFilter === "under-100" && price < 100000) ||
        (menuPriceFilter === "100-200" && price >= 100000 && price <= 200000) ||
        (menuPriceFilter === "over-200" && price > 200000);
      const availabilityStatus = String(item?.availabilityStatus || item?.status || "available").toLowerCase();
      const isAvailable = availabilityStatus !== "unavailable" && availabilityStatus !== "out_of_stock";
      const matchesAvailability =
        menuAvailabilityFilter === "all" ||
        (menuAvailabilityFilter === "available" && isAvailable) ||
        (menuAvailabilityFilter === "unavailable" && !isAvailable);

      return matchesSearch && matchesCategory && matchesServing && matchesPrice && matchesAvailability;
    });
  }, [menuItems, menuSearchQuery, menuCategoryFilter, menuServingFilter, menuPriceFilter, menuAvailabilityFilter]);

  const formatPrice = (value) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));

  const canAddItem = permissions.canCreateOrder || permissions.canManageOrders;
  const canAttachProof = permissions.canAttachProof || permissions.canManageOrders;

  const handleAdd = (item, extra = {}) => {
    if (!canAddItem) return;
    onAdd?.({
      ...item,
      selectedVariantKey: extra.selectedVariantKey || selectedVariantKey || undefined,
      prepChoice: extra.prepChoice || prepChoice || undefined,
      serveOrder: extra.serveOrder || serveOrder || undefined,
      proofImages: extra.proofImages || [],
    });
    setSelectedItem(null);
    setDraftProofImages([]);
    setProofDraftItem(null);
  };

  const handleConfirmAdd = () => {
    if (!selectedItem) return;
    if (requiresProofImage(selectedItem) && canAttachProof && draftProofImages.length === 0) {
      setProofDraftItem(selectedItem);
      return;
    }
    handleAdd(selectedItem, { proofImages: draftProofImages });
  };

  return (
    <div className="staff-menu-ordering">
      <div className="menu-ordering__filters">
        <label className="menu-ordering__search">
          <Search size={16} />
          <input
            value={menuSearchQuery}
            onChange={(event) => setMenuSearchQuery?.(event.target.value)}
            placeholder="Tìm món, mô tả..."
          />
        </label>
        <select
          value={menuCategoryFilter}
          onChange={(event) => setMenuCategoryFilter?.(event.target.value)}
          aria-label="Lọc danh mục"
        >
          <option value="all">Tất cả danh mục</option>
          {(categories || []).map((category) => {
            const label = sanitizeCategoryLabel(category?.name || category?.label || category);
            return (
              <option key={category?.id || label} value={category?.id || label}>
                {label}
              </option>
            );
          })}
        </select>
        <select
          value={menuServingFilter}
          onChange={(event) => setMenuServingFilter?.(event.target.value)}
          aria-label="Lọc khẩu phần"
        >
          {servingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={menuPriceFilter}
          onChange={(event) => setMenuPriceFilter?.(event.target.value)}
          aria-label="Lọc giá"
        >
          <option value="all">Tất cả giá</option>
          <option value="under-100">Dưới 100k</option>
          <option value="100-200">100k - 200k</option>
          <option value="over-200">Trên 200k</option>
        </select>
        <select
          value={menuAvailabilityFilter}
          onChange={(event) => setMenuAvailabilityFilter?.(event.target.value)}
          aria-label="Lọc trạng thái"
        >
          <option value="available">Đang bán</option>
          <option value="all">Tất cả trạng thái</option>
          <option value="unavailable">Tạm ngưng</option>
        </select>
      </div>

      {!canAddItem ? (
        <div className="staff-menu-ordering__permission" role="alert">
          <AlertTriangle size={18} />
          <span>{READONLY_MESSAGE}</span>
        </div>
      ) : null}

      <div className="menu-ordering__grid">
        {filteredItems.map((item) => {
          const price = item?.price ?? item?.basePrice ?? item?.currentPrice ?? 0;
          const categoryLabel = sanitizeCategoryLabel(item?.categoryLabel || item?.category || item?.categoryName);
          return (
            <article key={item.id} className="menu-ordering-card">
              <div className="menu-ordering-card__image">
                {item?.thumbImage || item?.image ? (
                  <img src={item.thumbImage || item.image} alt={item.name || "Món ăn"} />
                ) : (
                  <Crown size={24} />
                )}
                {requiresProofImage(item) ? (
                  <span className="menu-ordering-card__badge">
                    <Camera size={12} /> Cần ảnh
                  </span>
                ) : null}
              </div>
              <div className="menu-ordering-card__content">
                <div className="menu-ordering-card__meta">
                  <span>{categoryLabel}</span>
                  <span>
                    <MapPin size={12} /> {item?.prepArea || "Bếp chính"}
                  </span>
                </div>
                <h3>{item.name}</h3>
                <p>{item.description || "Món đang sẵn sàng phục vụ."}</p>
                <div className="menu-ordering-card__footer">
                  <strong>{formatPrice(price)}</strong>
                  <button type="button" disabled={!canAddItem} onClick={() => setSelectedItem(item)}>
                    <Plus size={14} /> Chọn
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {selectedItem ? (
        <div className="staff-menu-sheet" role="dialog" aria-modal="true" aria-label="Tùy chỉnh món">
          <button className="staff-menu-sheet__backdrop" type="button" onClick={() => setSelectedItem(null)} aria-label="Đóng" />
          <section className="staff-menu-sheet__panel">
            <header>
              <div>
                <span>Tùy chỉnh món</span>
                <h2>{selectedItem.name}</h2>
              </div>
              <button type="button" onClick={() => setSelectedItem(null)} aria-label="Đóng tùy chỉnh món">
                <X size={18} />
              </button>
            </header>

            <label>
              Khẩu phần
              <select value={selectedVariantKey} onChange={(event) => setSelectedVariantKey(event.target.value)}>
                <option value="">Mặc định</option>
                {(selectedItem.servingVariants || []).map((variant) => (
                  <option key={getVariantKey(variant)} value={getVariantKey(variant)}>
                    {variant.name || variant.key}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Ghi chú chế biến
              <input value={prepChoice} onChange={(event) => setPrepChoice(event.target.value)} placeholder="Ít cay, không hành..." />
            </label>

            <label>
              Thứ tự phục vụ
              <select value={serveOrder} onChange={(event) => setServeOrder(event.target.value)}>
                <option>Mang ra cùng lúc</option>
                <option>Món khai vị trước</option>
                <option>Món chính sau 10 phút</option>
              </select>
            </label>

            <div className="staff-menu-sheet__customer">
              <UserCircle size={18} />
              <span>{selectedTable?.code ? `Bàn ${selectedTable.code}` : "Khách lẻ / mang đi"}</span>
              {selectedTable ? (
                <button type="button" onClick={() => onRemoveCustomer?.(selectedTable)}>
                  Đổi khách <ChevronRight size={14} />
                </button>
              ) : null}
            </div>

            {requiresProofImage(selectedItem) ? (
              <div className="staff-menu-sheet__proof">
                <Camera size={18} />
                <span>Món này cần ảnh xác nhận theo quy định.</span>
                <button type="button" onClick={() => setProofDraftItem(selectedItem)} disabled={!canAttachProof}>
                  Chụp/đính kèm ảnh
                </button>
              </div>
            ) : null}

            <footer>
              <button type="button" onClick={() => setSelectedItem(null)}>
                Hủy
              </button>
              <button type="button" onClick={handleConfirmAdd} disabled={!canAddItem}>
                Thêm vào đơn
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      <StaffProofCaptureModal
        open={Boolean(proofDraftItem)}
        order={proofDraftItem ? { items: [proofDraftItem] } : null}
        onClose={() => setProofDraftItem(null)}
        onConfirm={(images) => {
          const normalized = normalizeProofImages(images);
          setDraftProofImages(normalized);
          if (proofDraftItem) {
            handleAdd(proofDraftItem, { proofImages: normalized });
          }
          setProofDraftItem(null);
        }}
      />
    </div>
  );
}
