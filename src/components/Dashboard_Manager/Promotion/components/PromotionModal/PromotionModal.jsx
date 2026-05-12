import React, { useEffect, useMemo, useState } from "react";
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
    scope: initialType === "bogo" ? "item" : promotion?.scope || "order",
    categoryId: promotion?.categoryId || "",
    itemId: promotion?.itemId || "",
    giftItemId: promotion?.giftItemId || "",
    buyQuantity: promotion?.buyQuantity || 1,
    getQuantity: promotion?.getQuantity || 1,
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

  const handleInputChange = (event) => {
    const { checked, name, type, value } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    setFormData((prev) => {
      const next = { ...prev, [name]: nextValue };

      if (name === "type") {
        if (value === "bogo") {
          next.scope = "item";
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
      conditions: formData.conditions
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      status: mode === "draft" ? "draft" : "active",
      productId: formData.giftItemId || null,
      level: toNumber(formData.level, 1),
      stacking: Boolean(formData.stacking),
    });
  };

  return (
    <div
      className="premium-modal-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="premium-modal">
        <div className="modal-header">
          <div className="header-content">
            <h2>{promotion ? "Chỉnh sửa ưu đãi" : "Tạo ưu đãi mới"}</h2>
            <p>Điền thông tin chi tiết để thiết lập chương trình khuyến mãi.</p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <form id="promoForm" onSubmit={handleSubmit}>
            <div className="form-section">
              <h3 className="section-title">
                <FileText size={18} /> Thông tin chung
              </h3>
              <div className="grid-2">
                <div className="form-group full">
                  <label>
                    Tên chương trình <span className="req">*</span>
                  </label>
                  <input
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
                  <label>
                    Mã code <span className="req">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <Tag className="input-icon" size={16} />
                    <input
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
                  <label>
                    Nhà hàng áp dụng <span className="req">*</span>
                  </label>
                  <select
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
                <Percent size={18} /> Loại khuyến mãi và giá trị
              </h3>
              <div className="grid-3">
                <div className="form-group">
                  <label>
                    Loại <span className="req">*</span>
                  </label>
                  <select
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
                      <label>
                        SL mua <span className="req">*</span>
                      </label>
                      <input
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
                      <label>
                        SL tặng <span className="req">*</span>
                      </label>
                      <input
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
                    <label>Giá trị</label>
                    <div className="input-icon-wrapper">
                      <DollarSign className="input-icon" size={16} />
                      <input disabled type="text" value="Miễn phí vận chuyển" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label>
                        Mức giảm <span className="req">*</span>
                      </label>
                      <input
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
                      <label>Giảm tối đa</label>
                      <input
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
                  <label>Đơn tối thiểu</label>
                  <div className="input-icon-wrapper">
                    <DollarSign className="input-icon" size={16} />
                    <input
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
                  <label>Giới hạn lượt dùng</label>
                  <input
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
                <Gift size={18} /> Cấu hình dùng chồng
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
                    Cho phép khuyến mãi này dùng chung với voucher hợp lệ
                  </span>
                </label>

                <div className="form-group">
                  <label>Độ ưu tiên</label>
                  <select
                    name="level"
                    value={formData.level}
                    onChange={handleInputChange}
                  >
                    <option value={1}>Thấp</option>
                    <option value={2}>Trung bình</option>
                    <option value={3}>Cao</option>
                  </select>
                </div>
              </div>

              <p className="text-xs text-secondary mt-2">
                Promotion chỉ được cộng với voucher nếu cả promotion và voucher
                đều cho phép.
              </p>
            </div>
            <div className="form-section">
              <h3 className="section-title">
                <ShoppingBag size={18} /> Đối tượng áp dụng
              </h3>
              <div className="grid-2">
                <div className="form-group">
                  <label>Phạm vi</label>
                  <select
                    disabled={formData.type === "bogo"}
                    name="scope"
                    onChange={handleInputChange}
                    value={formData.scope}
                  >
                    <option value="order">Toàn bộ đơn hàng</option>
                    <option value="category">Theo danh mục</option>
                    <option value="item">Theo món</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Khách hàng mục tiêu</label>
                  <div className="input-icon-wrapper">
                    <Users className="input-icon" size={16} />
                    <select
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
                    <label>Lọc món theo danh mục</label>
                    <select
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
                      Chỉ dùng để lọc danh sách món, không lưu thành phạm vi áp dụng.
                    </p>
                  </div>
                )}

                {formData.scope === "category" && (
                  <div className="form-group full">
                    <label>
                      Danh mục áp dụng <span className="req">*</span>
                    </label>
                    <select
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
                    <label>
                      {formData.type === "bogo"
                        ? "Món khách phải mua"
                        : "Món áp dụng"}{" "}
                      <span className="req">*</span>
                    </label>
                    <select
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

                {formData.type === "bogo" && (
                  <div className="form-group full">
                    <label>
                      Món tặng <span className="req">*</span>
                    </label>
                    <div className="input-icon-wrapper">
                      <Gift className="input-icon" size={16} />
                      <select
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
                <Clock size={18} /> Thời gian
              </h3>
              <div className="grid-2">
                <div className="form-group">
                  <label>
                    Bắt đầu <span className="req">*</span>
                  </label>
                  <input
                    className={errors.startDate ? "error" : ""}
                    name="startDate"
                    onChange={handleInputChange}
                    type="datetime-local"
                    value={formData.startDate}
                  />
                  {errors.startDate && (
                    <span className="err-msg">{errors.startDate}</span>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    Kết thúc <span className="req">*</span>
                  </label>
                  <input
                    className={errors.endDate ? "error" : ""}
                    name="endDate"
                    onChange={handleInputChange}
                    type="datetime-local"
                    value={formData.endDate}
                  />
                  {errors.endDate && (
                    <span className="err-msg">{errors.endDate}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="form-section no-border">
              <div className="form-group full">
                <label>Mô tả chương trình</label>
                <textarea
                  name="description"
                  onChange={handleInputChange}
                  placeholder="Mô tả ngắn để đội vận hành hiểu rõ chương trình"
                  rows="2"
                  value={formData.description}
                />
              </div>

              <div className="form-group full">
                <label>Điều kiện áp dụng (mỗi dòng 1 điều kiện)</label>
                <textarea
                  name="conditions"
                  onChange={handleInputChange}
                  placeholder="- Không áp dụng lễ tết"
                  rows="3"
                  value={formData.conditions}
                />
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
              <Save size={18} />
              {promotion ? "Lưu thay đổi" : "Tạo khuyến mãi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromotionModal;
