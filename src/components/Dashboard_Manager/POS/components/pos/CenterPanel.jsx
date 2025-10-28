import React, { useMemo, useState, useCallback } from "react";
import cls from "./CenterPanel.module.scss";
import { usePos } from "../../../../../context/PosContext";
import { formatPrice } from "../../utils/format";
import MenuItemModal from "../modals/MenuItemModal";

export default function CenterPanel() {
  const {
    // dữ liệu & filter hiện có trong POS context
    filteredMenu,
    currentCategory,
    setCurrentCategory,
    setSearchTerm,
    addItemToOrder,

    // nếu bạn đã nối useMenuManagement vào PosContext, các biến dưới sẽ có
    // (nếu chưa có thì UI vẫn chạy bình thường)
    timeSlotOptions,
    selectedTimeSlot,
    setSelectedTimeSlot,
  } = usePos();

  // Tabs danh mục (giữ static như bản của bạn để không phụ thuộc Category collection)
  const categoryTabs = useMemo(
    () => [
      { key: "all", label: "Tất cả" },
      { key: "appetizer", label: "Khai vị" },
      { key: "main", label: "Món chính" },
      { key: "seafood", label: "Hải sản" },
      { key: "hotpot", label: "Lẩu" },
      { key: "drink", label: "Đồ uống" },
      { key: "dessert", label: "Tráng miệng" },
    ],
    []
  );

  const onSelectCategory = (cat) => setCurrentCategory?.(cat);

  // Chuẩn hoá giá hiển thị (hỗ trợ schema mới: basePrice + preparationMethods)
  const withDisplay = useMemo(() => {
    return (filteredMenu || []).map((it) => {
      // 1) Giá: ưu tiên basePrice > 0
      const base = Number(it.basePrice ?? 0);
      // 2) Nếu không có basePrice, lấy giá của preparation mặc định hoặc cái đầu tiên
      const defaultPrep =
        Array.isArray(it.preparationMethods) && it.preparationMethods.length > 0
          ? it.preparationMethods.find((p) => p?.isDefault) ||
            it.preparationMethods[0]
          : null;
      const prepPrice = Number(defaultPrep?.price ?? 0);

      // 3) Fallback: item.price (dữ liệu cũ) hoặc 0
      const displayPrice =
        base > 0
          ? base
          : Number.isFinite(prepPrice) && prepPrice > 0
          ? prepPrice
          : Number(it.price ?? 0);

      // Unit: theo kg nếu byWeight
      const unit = it.byWeight ? "Kg" : "Phần";
      const cookingOption = defaultPrep?.name || "Bình thường";

      return {
        ...it,
        _displayPrice: displayPrice,
        _unit: unit,
        _defaultCooking: cookingOption,
      };
    });
  }, [filteredMenu]);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const openModal = useCallback((item) => {
    setSelectedItem(item);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedItem(null);
  }, []);

  const handleModalAdd = useCallback(
    (payload) => {
      const {
        menuItem,
        quantity = 1,
        cookingOption,
        unit,
        note,
      } = payload || {};
      const core = {
        id: menuItem?.id,
        name: menuItem?.name,
        price: Number(menuItem?._displayPrice ?? menuItem?.price ?? 0),
      };

      addItemToOrder?.({
        menuItem: core,
        cookingOption,
        unit,
        note,
        quantity,
      });
      closeModal();
    },
    [addItemToOrder, closeModal]
  );

  return (
    <div className={cls.wrapper}>
      {/* Header: tiêu đề + (tuỳ chọn) select khung giờ + ô tìm kiếm */}
      <div className={cls.header}>
        <h2 style={{ color: "#0c4a6e", fontWeight: 700, margin: 0 }}>
          Thực đơn
        </h2>

        <div className={cls.search}>
          {/* Hiển thị select timeSlot nếu context có cung cấp */}
          {Array.isArray(timeSlotOptions) &&
            timeSlotOptions.length > 0 &&
            typeof setSelectedTimeSlot === "function" && (
              <select
                className={cls.input}
                style={{ width: 180 }}
                value={selectedTimeSlot || ""}
                onChange={(e) => setSelectedTimeSlot(e.target.value || null)}
                title="Chọn khung giờ hiển thị menu"
              >
                {timeSlotOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}

          <input
            className={cls.input}
            placeholder="Tìm kiếm món ăn..."
            onChange={(e) => setSearchTerm?.(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs danh mục */}
      <div className={cls.tabs}>
        {categoryTabs.map((c) => (
          <button
            key={c.key}
            className={`${cls.tab} ${
              currentCategory === c.key ? cls.tabActive : ""
            }`}
            onClick={() => onSelectCategory(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Lưới món ăn */}
      <div className={cls.grid}>
        {withDisplay.map((item) => {
          const price = Number(item._displayPrice || 0);
          const thumb = item.thumbImage;
          const emoji = item.emoji || "🍽️";

          return (
            <div
              key={item.id}
              className={cls.card}
              onClick={() => openModal(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openModal(item)}
              title={`${item.name} — ${formatPrice(price)}`}
            >
              <div className={cls.image}>
                {thumb ? (
                  // Nếu có ảnh
                  <img
                    src={thumb}
                    alt={item.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    loading="lazy"
                  />
                ) : (
                  // Fallback emoji
                  <span aria-hidden="true">{emoji}</span>
                )}
              </div>

              <div className={cls.info}>
                <div className={cls.name}>{item.name}</div>
                <div className={cls.price}>
                  {formatPrice(price)}
                  {item.byWeight ? (
                    <span
                      style={{ marginLeft: 6, fontSize: 12, color: "#6b7280" }}
                    >
                      /kg
                    </span>
                  ) : null}
                </div>
                {item.description ? (
                  <div className={cls.desc}>{item.description}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal cho item */}
      <MenuItemModal
        isOpen={modalOpen}
        item={selectedItem}
        onAdd={handleModalAdd}
        onClose={closeModal}
      />
    </div>
  );
}
