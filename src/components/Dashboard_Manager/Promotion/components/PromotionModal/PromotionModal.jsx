import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Clock,
  DollarSign,
  FileText,
  Gift,
  Percent,
  Save,
  ShoppingBag,
  Tag,
  Users,
  X,
} from "lucide-react";

import { PROMOTION_TYPES } from "../../../../../utils/constants";
import "./PromotionModal.scss";

const buildInitialFormData = (promotion, fallbackRestaurantId = "") => {
  const initialType = promotion?.type || "percentage";

  return {
    name: promotion?.name || "",
    code: promotion?.code || "",
    type: initialType,
    scope: initialType === "bogo" ? "item" : initialType === "combo" ? "order" : promotion?.scope || "order",
    categoryId: promotion?.categoryId || "",
    itemId: promotion?.itemId || "",
    giftItemId: promotion?.giftItemId || "",
    buyQuantity: promotion?.buyQuantity || 1,
    getQuantity: promotion?.getQuantity || 1,
    comboItems: Array.isArray(promotion?.comboItems) && promotion.comboItems.length
      ? promotion.comboItems.map((item) => ({
          itemId: item?.itemId || "",
          quantity: item?.quantity || 1,
        }))
      : [
          { itemId: "", quantity: 1 },
          { itemId: "", quantity: 1 },
        ],
    discountType: promotion?.discountType || "percent",
    discountValue:
      promotion?.discountValue === 0 ? "0" : promotion?.discountValue || "",
    minOrderValue: promotion?.minOrderValue || "",
    maxDiscount: promotion?.maxDiscount || "",
    startDate: promotion?.startDate || "",
    endDate: promotion?.endDate || "",
    usageLimit: promotion?.usageLimit || "",
    targetAudience: promotion?.targetAudience || "all",
    restaurantId: promotion?.restaurantId || fallbackRestaurantId,
    description: promotion?.description || "",
    conditions: Array.isArray(promotion?.conditions)
      ? promotion.conditions.join("\n")
      : "",
    stacking: Boolean(promotion?.stacking),
    level: promotion?.level || 1,
  };
};

const toNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatVietnamDateTimePreview = (value) => {
  if (!value) return "Chưa chọn";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa chọn";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const TARGET_AUDIENCE_LABELS = {
  new: "Khách hàng mới",
  vip: "Khách VIP",
  birthday: "Khách có sinh nhật trong tháng",
};

const PromotionModal = ({
  promotion,
  restaurants = [],
  categories = [],
  menuItems = [],
  defaultRestaurantId = "",
  onSave,
  onClose,
}) => {
  const restaurantOptions = useMemo(
    () =>
      Array.isArray(restaurants)
        ? restaurants.filter((restaurant) => restaurant?.id)
        : [],
    [restaurants],
  );

  const fallbackRestaurantId =
    promotion?.restaurantId ||
    defaultRestaurantId ||
    restaurantOptions[0]?.id ||
    "";

  const [formData, setFormData] = useState(
    buildInitialFormData(promotion, fallbackRestaurantId),
  );
  const [errors, setErrors] = useState({});
  const modalRef = useRef(null);

  useEffect(() => {
    setFormData(buildInitialFormData(promotion, fallbackRestaurantId));
    setErrors({});
  }, [promotion, fallbackRestaurantId]);

  const scopedMenuItems = useMemo(() => {
    if (!formData.categoryId) return menuItems;
    return menuItems.filter(
      (item) => String(item.categoryId || "") === String(formData.categoryId),
    );
  }, [formData.categoryId, menuItems]);

  const derivedConditions = useMemo(() => {
    const lines = [];
    const minOrderValue = toNumber(formData.minOrderValue);
    const maxDiscount = toNumber(formData.maxDiscount);
    const usageLimit = toNumber(formData.usageLimit);
    if (minOrderValue > 0) {
      lines.push(`Đơn hàng tối thiểu ${minOrderValue.toLocaleString("vi-VN")}đ`);
    }
    if (maxDiscount > 0) {
      lines.push(`Giảm tối đa ${maxDiscount.toLocaleString("vi-VN")}đ`);
    }
    if (usageLimit > 0) lines.push(`Tối đa ${usageLimit.toLocaleString("vi-VN")} lượt dùng`);
    if (formData.targetAudience && formData.targetAudience !== "all") {
      lines.push(
        `Chỉ áp dụng cho nhóm: ${TARGET_AUDIENCE_LABELS[formData.targetAudience] || formData.targetAudience}`,
      );
    }
    return lines;
  }, [
    formData.maxDiscount,
    formData.minOrderValue,
    formData.targetAudience,
    formData.usageLimit,
  ]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      modalRef.current?.focus();
    });
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [onClose]);

  const handleInputChange = (event) => {
    const { checked, name, type, value } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    setFormData((prev) => {
      const next = { ...prev, [name]: nextValue };

      if (name === "type") {
        if (value === "bogo") {
          next.scope = "item";
        } else if (value === "combo") {
          next.scope = "order";
          next.itemId = "";
          next.categoryId = "";
          next.giftItemId = "";
          next.buyQuantity = 1;
          next.getQuantity = 1;
        } else {
          next.giftItemId = "";
          next.buyQuantity = 1;
          next.getQuantity = 1;
        }
      }

      if (name === "scope") {
        if (prev.type === "bogo" && value !== "item") {
          next.scope = "item";
        }
        if (prev.type === "combo" && value !== "order") {
          next.scope = "order";
        }
        if (value !== "category") {
          next.categoryId = "";
        }
        if (value !== "item") {
          next.itemId = "";
        }
      }

      if (name === "categoryId" && prev.scope === "item") {
        next.itemId = "";
      }

      return next;
    });

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleComboItemChange = (index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      comboItems: prev.comboItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
    setErrors((prev) => ({ ...prev, comboItems: "" }));
  };

  const handleAddComboItem = () => {
    setFormData((prev) => ({
      ...prev,
      comboItems: [...prev.comboItems, { itemId: "", quantity: 1 }],
    }));
  };

  const handleRemoveComboItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      comboItems:
        prev.comboItems.length > 2
          ? prev.comboItems.filter((_, itemIndex) => itemIndex !== index)
          : prev.comboItems,
    }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.name.trim()) nextErrors.name = "Bắt buộc nhập";
    if (!formData.code.trim()) nextErrors.code = "Bắt buộc nhập";
    if (!formData.type) nextErrors.type = "Chọn loại";
    if (!formData.restaurantId) nextErrors.restaurantId = "Chọn nhà hàng";
    if (!formData.startDate) nextErrors.startDate = "Chọn ngày";
    if (!formData.endDate) nextErrors.endDate = "Chọn ngày";

    if (
      formData.startDate &&
      formData.endDate &&
      formData.startDate >= formData.endDate
    ) {
      nextErrors.endDate = "Ngày kết thúc không hợp lệ";
    }

    if (formData.type === "combo") {
      const validComboItems = formData.comboItems.filter(
        (item) => item.itemId && toNumber(item.quantity) >= 1,
      );
      const uniqueItemIds = new Set(validComboItems.map((item) => item.itemId));

      if (validComboItems.length < 2) {
        nextErrors.comboItems = "Combo cần ít nhất 2 món";
      } else if (uniqueItemIds.size !== validComboItems.length) {
        nextErrors.comboItems = "Không chọn trùng món trong combo";
      }
    }

    if (formData.scope === "category" && !formData.categoryId) {
      nextErrors.categoryId = "Chọn danh mục áp dụng";
    }

    if (formData.scope === "item" && !formData.itemId) {
      nextErrors.itemId =
        formData.type === "bogo"
          ? "Chọn món khách phải mua"
          : "Chọn món áp dụng";
    }

    if (formData.type === "bogo") {
      if (!formData.giftItemId) {
        nextErrors.giftItemId = "Chọn món tặng";
      }
      if (toNumber(formData.buyQuantity) < 1) {
        nextErrors.buyQuantity = "Nhập SL mua";
      }
      if (toNumber(formData.getQuantity) < 1) {
        nextErrors.getQuantity = "Nhập SL tặng";
      }
    } else if (
      formData.type !== "freeship" &&
      toNumber(formData.discountValue) <= 0
    ) {
      nextErrors.discountValue = "Nhập giá trị";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      window.requestAnimationFrame(() => {
        modalRef.current?.querySelector(".error")?.focus();
      });
    }
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event, mode = "publish") => {
    event.preventDefault();
    if (!validateForm()) return;

    onSave({
      ...formData,
      discountValue:
        formData.type === "bogo" || formData.type === "freeship"
          ? 0
          : toNumber(formData.discountValue),
      minOrderValue: toNumber(formData.minOrderValue),
      maxDiscount: toNumber(formData.maxDiscount),
      usageLimit: toNumber(formData.usageLimit),
      buyQuantity:
        formData.type === "bogo" ? toNumber(formData.buyQuantity, 1) : 0,
      getQuantity:
        formData.type === "bogo" ? toNumber(formData.getQuantity, 1) : 0,
      comboItems:
        formData.type === "combo"
          ? formData.comboItems
              .filter((item) => item.itemId && toNumber(item.quantity) >= 1)
              .map((item) => ({
                itemId: item.itemId,
                quantity: toNumber(item.quantity, 1),
              }))
          : [],
      scope: formData.type === "combo" ? "order" : formData.scope,
      giftItemId: formData.type === "combo" ? null : formData.giftItemId,
      conditions: derivedConditions,
      status: mode === "draft" ? "draft" : "active",
      productId: formData.giftItemId || null,
      level: toNumber(formData.level, 1),
      stacking: Boolean(formData.stacking),
    });
  };

  return createPortal(
    <div
      className="premium-modal-overlay"
      role="presentation"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="premium-modal"
        ref={modalRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="promotion-modal-title"
      >
        <div className="modal-header">
          <div className="header-content">
            <h2 id="promotion-modal-title">{promotion ? "Chỉnh sửa ưu đãi" : "Tạo ưu đãi mới"}</h2>
            <p>Điền thông tin chi tiết để thiết lập chương trình khuyến mãi.</p>
          </div>
          <button className="btn-close" onClick={onClose} type="button" aria-label="Đóng">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="modal-body">
          <form id="promoForm" autoComplete="off" onSubmit={handleSubmit}>
            <div className="form-section">
              <h3 className="section-title">
                <FileText size={18} aria-hidden="true" /> Thông tin chung
              </h3>
              <div className="grid-2">
                <div className="form-group full">
                  <label htmlFor="promotion-name">
                    Tên chương trình <span className="req">*</span>
                  </label>
                  <input
                    id="promotion-name"
                    className={errors.name ? "error" : ""}
                    name="name"
                    onChange={handleInputChange}
                    placeholder="VD: Mừng khai trương cơ sở 2"
                    type="text"
                    value={formData.name}
                  />
                  {errors.name && (
                    <span className="err-msg">{errors.name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="promotion-code">
                    Mã code <span className="req">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <Tag className="input-icon" size={16} aria-hidden="true" />
                    <input
                      id="promotion-code"
                      className={`code-input ${errors.code ? "error" : ""}`}
                      name="code"
                      onChange={handleInputChange}
                      placeholder="VD: SUMMER2026"
                      type="text"
                      value={formData.code}
                    />
                  </div>
                  {errors.code && (
                    <span className="err-msg">{errors.code}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="promotion-restaurant">
                    Nhà hàng áp dụng <span className="req">*</span>
                  </label>
                  <select
                    id="promotion-restaurant"
                    className={errors.restaurantId ? "error" : ""}
                    disabled={!restaurantOptions.length}
                    name="restaurantId"
                    onChange={handleInputChange}
                    value={formData.restaurantId}
                  >
                    <option value="">
                      {restaurantOptions.length
                        ? "-- Chọn chi nhánh --"
                        : "-- Chưa có nhà hàng khả dụng --"}
                    </option>
                    {restaurantOptions.map((restaurant) => (
                      <option key={restaurant.id} value={restaurant.id}>
                        {restaurant.name || `Nhà hàng ${restaurant.id}`}
                      </option>
                    ))}
                  </select>
                  {errors.restaurantId && (
                    <span className="err-msg">{errors.restaurantId}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <Percent size={18} aria-hidden="true" /> Loại khuyến mãi và giá trị
              </h3>
              <div className="grid-3">
                <div className="form-group">
                  <label htmlFor="promotion-type">
                    Loại <span className="req">*</span>
                  </label>
                  <select
                    id="promotion-type"
                    className={errors.type ? "error" : ""}
                    name="type"
                    onChange={handleInputChange}
                    value={formData.type}
                  >
                    {Object.entries(PROMOTION_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {formData.type === "bogo" ? (
                  <>
                    <div className="form-group">
                      <label htmlFor="promotion-buy-quantity">
                        SL mua <span className="req">*</span>
                      </label>
                      <input
                        id="promotion-buy-quantity"
                        className={errors.buyQuantity ? "error" : ""}
                        min="1"
                        name="buyQuantity"
                        onChange={handleInputChange}
                        type="number"
                        value={formData.buyQuantity}
                      />
                      {errors.buyQuantity && (
                        <span className="err-msg">{errors.buyQuantity}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="promotion-get-quantity">
                        SL tặng <span className="req">*</span>
                      </label>
                      <input
                        id="promotion-get-quantity"
                        className={errors.getQuantity ? "error" : ""}
                        min="1"
                        name="getQuantity"
                        onChange={handleInputChange}
                        type="number"
                        value={formData.getQuantity}
                      />
                      {errors.getQuantity && (
                        <span className="err-msg">{errors.getQuantity}</span>
                      )}
                    </div>
                  </>
                ) : formData.type === "freeship" ? (
                  <div className="form-group full">
                    <label htmlFor="promotion-freeship-value">Giá trị</label>
                    <div className="input-icon-wrapper">
                      <DollarSign className="input-icon" size={16} aria-hidden="true" />
                      <input id="promotion-freeship-value" disabled type="text" value="Miễn phí vận chuyển" />
                    </div>
                    <p className="field-hint">
                      Khi thanh toán đơn giao hàng, hệ thống sẽ giảm trực tiếp
                      phí vận chuyển. Nếu có giới hạn giảm tối đa, số tiền
                      freeship sẽ không vượt quá giới hạn đó.
                    </p>
                  </div>
                ) : formData.type === "combo" ? (
                  <>
                    <div className="form-group">
                      <label htmlFor="promotion-discount-type">Kiểu giảm</label>
                      <select
                        id="promotion-discount-type"
                        name="discountType"
                        onChange={handleInputChange}
                        value={formData.discountType}
                      >
                        <option value="percent">Phần trăm</option>
                        <option value="fixed">Số tiền</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="promotion-discount-value">
                        Mức giảm <span className="req">*</span>
                      </label>
                      <input
                        id="promotion-discount-value"
                        className={errors.discountValue ? "error" : ""}
                        min="0"
                        name="discountValue"
                        onChange={handleInputChange}
                        placeholder="0"
                        type="number"
                        value={formData.discountValue}
                      />
                      {errors.discountValue && (
                        <span className="err-msg">{errors.discountValue}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="promotion-max-discount">Giảm tối đa</label>
                      <input
                        id="promotion-max-discount"
                        min="0"
                        name="maxDiscount"
                        onChange={handleInputChange}
                        placeholder="Không giới hạn"
                        type="number"
                        value={formData.maxDiscount}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label htmlFor="promotion-discount-value">
                        Mức giảm <span className="req">*</span>
                      </label>
                      <input
                        id="promotion-discount-value"
                        className={errors.discountValue ? "error" : ""}
                        min="0"
                        name="discountValue"
                        onChange={handleInputChange}
                        placeholder="0"
                        type="number"
                        value={formData.discountValue}
                      />
                      {errors.discountValue && (
                        <span className="err-msg">{errors.discountValue}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="promotion-max-discount">Giảm tối đa</label>
                      <input
                        id="promotion-max-discount"
                        min="0"
                        name="maxDiscount"
                        onChange={handleInputChange}
                        placeholder="Không giới hạn"
                        type="number"
                        value={formData.maxDiscount}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="grid-2 mt-3">
                <div className="form-group">
                  <label htmlFor="promotion-min-order">Đơn tối thiểu</label>
                  <div className="input-icon-wrapper">
                    <DollarSign className="input-icon" size={16} aria-hidden="true" />
                    <input
                      id="promotion-min-order"
                      min="0"
                      name="minOrderValue"
                      onChange={handleInputChange}
                      placeholder="0"
                      type="number"
                      value={formData.minOrderValue}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="promotion-usage-limit">Giới hạn lượt dùng</label>
                  <input
                    id="promotion-usage-limit"
                    min="0"
                    name="usageLimit"
                    onChange={handleInputChange}
                    placeholder="Tổng lượt dùng tối đa"
                    type="number"
                    value={formData.usageLimit}
                  />
                </div>
              </div>
            </div>
            <div className="form-section">
              <h3 className="section-title">
                <Gift size={18} aria-hidden="true" /> Cấu hình dùng chồng
              </h3>

              <div className="grid-2">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="stacking"
                    checked={Boolean(formData.stacking)}
                    onChange={handleInputChange}
                  />
                  <span>
                    Cho phép khuyến mãi này dùng chung với coupon hợp lệ
                  </span>
                </label>

                <div className="form-group">
                  <label htmlFor="promotion-level">Độ ưu tiên</label>
                  <select
                    id="promotion-level"
                    name="level"
                    value={formData.level}
                    onChange={handleInputChange}
                  >
                    <option value={1}>Thấp</option>
                    <option value={2}>Trung bình</option>
                    <option value={3}>Cao</option>
                  </select>
                  <p className="text-xs text-secondary">
                    Mức cao được xét trước khi nhiều ưu đãi cùng hợp lệ; không tự cho phép cộng dồn.
                  </p>
                </div>
              </div>

              <p className="text-xs text-secondary mt-2">
                Khuyến mãi chỉ được dùng cùng coupon khi cả hai đều cho phép.
              </p>
            </div>
            <div className="form-section">
              <h3 className="section-title">
                <ShoppingBag size={18} aria-hidden="true" /> Đối tượng áp dụng
              </h3>
              <div className="grid-2">
                <div className="form-group">
                  <label htmlFor="promotion-scope">Phạm vi</label>
                  <select
                    id="promotion-scope"
                    disabled={formData.type === "bogo" || formData.type === "combo"}
                    name="scope"
                    onChange={handleInputChange}
                    value={formData.scope}
                  >
                    <option value="order">Toàn bộ đơn hàng</option>
                    <option value="category">Theo danh mục</option>
                    <option value="item">Theo món</option>
                  </select>
                  {formData.type === "bogo" && (
                    <p className="text-xs text-secondary mt-2">
                      Khi thanh toán, hệ thống sẽ giảm tiền trên dòng món tặng nếu
                      bill có đủ món mua. Ví dụ: mua 1 món A tặng 1 món B, bill có
                      2 món A và 2 món B thì giảm tiền 2 món B.
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="promotion-target-audience">Khách hàng mục tiêu</label>
                  <div className="input-icon-wrapper">
                    <Users className="input-icon" size={16} aria-hidden="true" />
                    <select
                      id="promotion-target-audience"
                      name="targetAudience"
                      onChange={handleInputChange}
                      value={formData.targetAudience}
                    >
                      <option value="all">Tất cả khách hàng</option>
                      <option value="new">Khách hàng mới</option>
                      <option value="vip">Khách VIP</option>
                      <option value="birthday">Sinh nhật trong tháng</option>
                    </select>
                  </div>
                </div>

                {formData.scope === "item" && (
                  <div className="form-group full">
                    <label htmlFor="promotion-category-filter">Lọc món theo danh mục</label>
                    <select
                      id="promotion-category-filter"
                      name="categoryId"
                      onChange={handleInputChange}
                      value={formData.categoryId}
                    >
                      <option value="">-- Tất cả danh mục --</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-secondary mt-2">
                      Chỉ dùng để lọc danh sách món, không lưu thành phạm vi áp
                      dụng.
                    </p>
                  </div>
                )}

                {formData.scope === "category" && (
                  <div className="form-group full">
                    <label htmlFor="promotion-category">
                      Danh mục áp dụng <span className="req">*</span>
                    </label>
                    <select
                      id="promotion-category"
                      className={errors.categoryId ? "error" : ""}
                      name="categoryId"
                      onChange={handleInputChange}
                      value={formData.categoryId}
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    {errors.categoryId && (
                      <span className="err-msg">{errors.categoryId}</span>
                    )}
                  </div>
                )}

                {formData.scope === "item" && (
                  <div className="form-group full">
                    <label htmlFor="promotion-item">
                      {formData.type === "bogo"
                        ? "Món khách phải mua"
                        : "Món áp dụng"}{" "}
                      <span className="req">*</span>
                    </label>
                    <select
                      id="promotion-item"
                      className={errors.itemId ? "error" : ""}
                      name="itemId"
                      onChange={handleInputChange}
                      value={formData.itemId}
                    >
                      <option value="">-- Chọn món --</option>
                      {scopedMenuItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    {errors.itemId && (
                      <span className="err-msg">{errors.itemId}</span>
                    )}
                  </div>
                )}

                {formData.type === "combo" && (
                  <div className="form-group full">
                    <div className="field-label">
                      Món trong combo <span className="req">*</span>
                    </div>
                    <p className="field-hint">
                      Khi thanh toán, hệ thống chỉ giảm combo nếu bill có đủ tất
                      cả món trong combo. Số lượt combo được tính theo món có số
                      lượng ít nhất so với yêu cầu.
                    </p>
                    <div className="combo-items-editor">
                      {formData.comboItems.map((comboItem, index) => (
                        <div className="combo-item-row" key={`combo-item-${index}`}>
                          <select
                            aria-label={`Món combo ${index + 1}`}
                            onChange={(event) =>
                              handleComboItemChange(index, "itemId", event.target.value)
                            }
                            value={comboItem.itemId}
                          >
                            <option value="">-- Chọn món --</option>
                            {menuItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          <input
                            aria-label={`Số lượng món combo ${index + 1}`}
                            min="1"
                            onChange={(event) =>
                              handleComboItemChange(index, "quantity", event.target.value)
                            }
                            type="number"
                            value={comboItem.quantity}
                          />
                          <button
                            className="btn-ghost"
                            disabled={formData.comboItems.length <= 2}
                            onClick={() => handleRemoveComboItem(index)}
                            type="button"
                          >
                            Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                    {errors.comboItems && (
                      <span className="err-msg">{errors.comboItems}</span>
                    )}
                    <button
                      className="btn-secondary mt-2"
                      onClick={handleAddComboItem}
                      type="button"
                    >
                      Thêm món
                    </button>
                  </div>
                )}

                {formData.type === "bogo" && (
                  <div className="form-group full">
                    <label htmlFor="promotion-gift-item">
                      Món tặng <span className="req">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <Gift className="input-icon" size={16} aria-hidden="true" />
                      <select
                        id="promotion-gift-item"
                        className={errors.giftItemId ? "error" : ""}
                        name="giftItemId"
                        onChange={handleInputChange}
                        value={formData.giftItemId}
                      >
                        <option value="">-- Chọn món tặng --</option>
                        {menuItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {errors.giftItemId && (
                      <span className="err-msg">{errors.giftItemId}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <Clock size={18} aria-hidden="true" /> Thời gian
              </h3>
              <div className="grid-2">
                <div className="form-group">
                  <label htmlFor="promotion-start-date">
                    Bắt đầu <span className="req">*</span>
                  </label>
                  <input
                    id="promotion-start-date"
                    className={errors.startDate ? "error" : ""}
                    name="startDate"
                    onChange={handleInputChange}
                    type="datetime-local"
                    value={formData.startDate}
                  />
                  {errors.startDate && (
                    <span className="err-msg">{errors.startDate}</span>
                  )}
                  <span className="text-xs text-secondary">
                    Giờ Việt Nam: {formatVietnamDateTimePreview(formData.startDate)}
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="promotion-end-date">
                    Kết thúc <span className="req">*</span>
                  </label>
                  <input
                    id="promotion-end-date"
                    className={errors.endDate ? "error" : ""}
                    name="endDate"
                    onChange={handleInputChange}
                    type="datetime-local"
                    value={formData.endDate}
                  />
                  {errors.endDate && (
                    <span className="err-msg">{errors.endDate}</span>
                  )}
                  <span className="text-xs text-secondary">
                    Giờ Việt Nam: {formatVietnamDateTimePreview(formData.endDate)}
                  </span>
                </div>
              </div>
            </div>

            <div className="form-section no-border">
              <div className="form-group full">
                <label htmlFor="promotion-description">Mô tả chương trình</label>
                <textarea
                  id="promotion-description"
                  name="description"
                  onChange={handleInputChange}
                  placeholder="Mô tả ngắn để đội vận hành hiểu rõ chương trình"
                  rows="2"
                  value={formData.description}
                />
              </div>

              <div className="form-group full">
                <label>Điều kiện hệ thống sẽ kiểm tra</label>
                {derivedConditions.length ? (
                  <ul className="promotion-derived-conditions">
                    {derivedConditions.map((condition) => (
                      <li key={condition}>{condition}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="promotion-derived-conditions is-empty">
                    Không có điều kiện bổ sung. Hệ thống vẫn kiểm tra thời gian, phạm vi và trạng thái chương trình.
                  </p>
                )}
                <p className="text-xs text-secondary">
                  Danh sách này được tạo từ các trường cấu hình ở trên để tránh lưu điều kiện chỉ có tính mô tả.
                </p>
              </div>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose} type="button">
            Hủy bỏ
          </button>
          <div className="right-actions">
            <button
              className="btn-secondary"
              onClick={(event) => handleSubmit(event, "draft")}
              type="button"
            >
              Lưu nháp
            </button>
            <button className="btn-primary" form="promoForm" type="submit">
              <Save size={18} aria-hidden="true" />
              {promotion ? "Lưu thay đổi" : "Tạo khuyến mãi"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default PromotionModal;
