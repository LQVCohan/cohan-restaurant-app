import React, { useEffect, useState } from "react";
import {
  X,
  Save,
  FileText,
  Tag,
  Clock,
  Percent,
  DollarSign,
  ClipboardList,
} from "lucide-react";
import {
  COUPON_CATEGORIES,
  COUPON_DISCOUNT_TYPES,
} from "../../../../../utils/constants";
import "./CouponModal.scss";

const ORDER_TYPE_OPTIONS = [
  { value: "dine_in", label: "Dùng tại bàn" },
  { value: "takeaway", label: "Mang đi" },
  { value: "delivery", label: "Giao hàng" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "cash", label: "Tiền mặt" },
  { value: "card", label: "Thẻ" },
  { value: "transfer", label: "Chuyển khoản" },
  { value: "bank_transfer", label: "Ngân hàng" },
  { value: "e_wallet", label: "Ví điện tử" },
];

const toArray = (value) => {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return [...new Set(source.map((item) => String(item || "").trim()).filter(Boolean))];
};

const getCategoryId = (category) => String(category?.id || category?._id || "").trim();
const getCategoryName = (category) => String(category?.name || "").trim();
const getCouponCategoryIds = (coupon) => toArray(coupon?.categoryIds ?? coupon?.constraints?.categoryIds);
const getCouponCategoryNames = (coupon) => toArray(coupon?.categories ?? coupon?.constraints?.categories);
const normalizeRankValue = (value) => String(value || "").trim().toLowerCase();

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatVnd = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(toNumber(value));

const getCouponPreview = (formData) => {
  const minOrderValue = toNumber(formData.minOrderValue);
  const maxDiscount = toNumber(formData.maxDiscount);
  const discountValue = toNumber(formData.discountValue);
  const sampleOrderValue = Math.max(minOrderValue, 250000);
  const isPercent = formData.discountType === "percent";
  const rawDiscount = isPercent
    ? Math.round((sampleOrderValue * discountValue) / 100)
    : discountValue;
  const estimatedDiscount = maxDiscount > 0
    ? Math.min(rawDiscount, maxDiscount)
    : rawDiscount;
  const payableAmount = Math.max(sampleOrderValue - estimatedDiscount, 0);
  const warnings = [];

  if (isPercent && discountValue > 50) {
    warnings.push("Mức giảm phần trăm khá cao, nên kiểm tra biên lợi nhuận.");
  }
  if (isPercent && discountValue > 0 && maxDiscount <= 0) {
    warnings.push("Coupon phần trăm chưa có giới hạn giảm tối đa.");
  }
  if (discountValue > 0 && minOrderValue <= 0) {
    warnings.push("Chưa đặt giá trị đơn tối thiểu, khách có thể áp mã cho đơn nhỏ.");
  }
  if (formData.stackable && formData.combinableWithPromotions) {
    warnings.push("Coupon đang cho phép dùng chồng nhiều lớp ưu đãi.");
  }

  return {
    sampleOrderValue,
    estimatedDiscount: discountValue > 0 ? estimatedDiscount : 0,
    payableAmount: discountValue > 0 ? payableAmount : sampleOrderValue,
    warnings,
  };
};

const buildInitialFormData = (coupon) => {
  const categoryIds = getCouponCategoryIds(coupon);
  const categories = getCouponCategoryNames(coupon);

  return ({
  name: coupon?.name || "",
  code: coupon?.code || "",
  category: coupon?.category || "",
  discountType: coupon?.discountType || "",
  discountValue: coupon?.discountValue || "",
  minOrderValue: coupon?.minOrderValue || "",
  maxDiscount: coupon?.maxDiscount || "",
  usageLimit: coupon?.usageLimit || "",
  startDate: coupon?.startDate || "",
  endDate: coupon?.endDate || "",
  publishAt: coupon?.publishAt || "",
  description: coupon?.description || "",
  conditions: coupon?.conditions ? coupon.conditions.join("\n") : "",
  stackable: Boolean(coupon?.stackable),
  combinableWithPromotions: Boolean(coupon?.combinableWithPromotions),
  exclusive: Boolean(coupon?.exclusive),
  priority:
    coupon?.priority === 0 || coupon?.priority ? String(coupon.priority) : "0",
  perUserLimit:
    coupon?.perUserLimit === 0 || coupon?.perUserLimit
      ? String(coupon.perUserLimit)
      : "",
  orderTypes: toArray(coupon?.orderTypes),
  paymentMethods: toArray(coupon?.paymentMethods),
  firstOrderOnly: Boolean(coupon?.firstOrderOnly),
  customerRanks: toArray(coupon?.customerRanks ?? coupon?.constraints?.customerRanks).map(normalizeRankValue),
  categoryScope: categoryIds.length || categories.length ? "selected" : "all",
  categoryIds,
  categories,
});
};

const CouponModal = ({ coupon, onSave, onClose, categories = [], restaurantId = "", customerRankOptions = [] }) => {
  const [formData, setFormData] = useState(buildInitialFormData(coupon));
  const [errors, setErrors] = useState({});
  const discountPreview = getCouponPreview(formData);
  const categoryOptions = Array.isArray(categories) ? categories : [];
  const selectedCategoryIds = toArray(formData.categoryIds);
  const missingCategoryIds = selectedCategoryIds.filter(
    (id) => !categoryOptions.some((category) => getCategoryId(category) === id),
  );
  const rankOptions = Array.isArray(customerRankOptions)
    ? customerRankOptions
      .map((rank) => ({ ...rank, value: normalizeRankValue(rank?.value || rank?.name || rank?.label) }))
      .filter((rank) => rank.value)
    : [];
  const selectedCustomerRanks = toArray(formData.customerRanks).map(normalizeRankValue);
  const legacyCustomerRanks = selectedCustomerRanks.filter(
    (rank) => !rankOptions.some((option) => option.value === rank),
  );

  useEffect(() => {
    setFormData(buildInitialFormData(coupon));
    setErrors({});
  }, [coupon]);

  useEffect(() => {
    if (formData.categoryScope !== "selected") return;
    const currentIds = toArray(formData.categoryIds);
    const currentNames = toArray(formData.categories).map((name) => name.toLowerCase());
    if (currentIds.length || !currentNames.length || !categoryOptions.length) return;

    const restoredCategories = categoryOptions.filter((category) => currentNames.includes(getCategoryName(category).toLowerCase()));
    if (!restoredCategories.length) return;

    setFormData((prev) => ({
      ...prev,
      categoryIds: restoredCategories.map(getCategoryId).filter(Boolean),
      categories: restoredCategories.map(getCategoryName).filter(Boolean),
    }));
  }, [categoryOptions, formData.categoryIds, formData.categories, formData.categoryScope]);

  const handleInputChange = (event) => {
    const { checked, name, type, value } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleCategoryScopeChange = (event) => {
    const nextScope = event.target.value;
    setFormData((prev) => ({
      ...prev,
      categoryScope: nextScope,
      categoryIds: nextScope === "all" ? [] : prev.categoryIds,
      categories: nextScope === "all" ? [] : prev.categories,
    }));
    if (errors.categoryIds) setErrors((prev) => ({ ...prev, categoryIds: "" }));
  };

  const handleCategoryCheckboxChange = (category) => (event) => {
    const { checked } = event.target;
    const categoryId = getCategoryId(category);
    const categoryName = getCategoryName(category);
    if (!categoryId) return;

    setFormData((prev) => {
      const currentIds = toArray(prev.categoryIds);
      const currentNames = toArray(prev.categories);
      return {
        ...prev,
        categoryIds: checked
          ? [...new Set([...currentIds, categoryId])]
          : currentIds.filter((id) => id !== categoryId),
        categories: checked && categoryName
          ? [...new Set([...currentNames, categoryName])]
          : currentNames.filter((name) => name !== categoryName),
      };
    });
    if (errors.categoryIds) setErrors((prev) => ({ ...prev, categoryIds: "" }));
  };

  const handleCustomerRankCheckboxChange = (rankValue) => (event) => {
    const { checked } = event.target;
    const value = normalizeRankValue(rankValue);
    if (!value) return;

    setFormData((prev) => {
      const currentValues = toArray(prev.customerRanks).map(normalizeRankValue);
      return {
        ...prev,
        customerRanks: checked
          ? [...new Set([...currentValues, value])]
          : currentValues.filter((rank) => rank !== value),
      };
    });
  };

  const handleMultiCheckboxChange = (fieldName, optionValue) => (event) => {
    const { checked } = event.target;
    setFormData((prev) => {
      const currentValues = toArray(prev[fieldName]);
      return {
        ...prev,
        [fieldName]: checked
          ? [...new Set([...currentValues, optionValue])]
          : currentValues.filter((value) => value !== optionValue),
      };
    });
  };

  const validateForm = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Bắt buộc nhập";
    if (!formData.code.trim()) nextErrors.code = "Bắt buộc nhập";
    if (!formData.category) nextErrors.category = "Chọn nhóm coupon";
    if (!formData.discountType) nextErrors.discountType = "Chọn loại";
    if (!formData.discountValue) nextErrors.discountValue = "Nhập giá trị";
    if (!formData.startDate) nextErrors.startDate = "Chọn ngày";
    if (formData.categoryScope === "selected" && toArray(formData.categoryIds).length === 0) nextErrors.categoryIds = "Vui lòng chọn ít nhất một danh mục áp dụng.";
    if (!formData.endDate) nextErrors.endDate = "Chọn ngày";
    if (
      formData.startDate &&
      formData.endDate &&
      formData.startDate >= formData.endDate
    ) {
      nextErrors.endDate = "Ngày kết thúc không hợp lệ";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event, mode = "publish") => {
    event.preventDefault();
    if (!validateForm()) return;

    const now = new Date();
    const publishAtDate = formData.publishAt
      ? new Date(formData.publishAt)
      : null;
    const endDate = new Date(formData.endDate);
    const startDate = new Date(formData.startDate);

    let status = "active";
    if (mode === "draft") {
      status = "draft";
    } else if (publishAtDate && publishAtDate > now) {
      status = "scheduled";
    } else if (endDate < now) {
      status = "expired";
    } else if (startDate > now) {
      status = "scheduled";
    }

    const selectedIds = formData.categoryScope === "selected" ? toArray(formData.categoryIds) : [];
    const selectedNames = formData.categoryScope === "selected"
      ? selectedIds.map((id) => getCategoryName(categoryOptions.find((category) => getCategoryId(category) === id))).filter(Boolean)
      : [];

    const formattedData = {
      ...formData,
      discountValue: parseFloat(formData.discountValue),
      minOrderValue: formData.minOrderValue
        ? parseFloat(formData.minOrderValue)
        : null,
      maxDiscount: formData.maxDiscount
        ? parseFloat(formData.maxDiscount)
        : null,
      usageLimit: formData.usageLimit
        ? parseInt(formData.usageLimit, 10)
        : null,
      conditions: formData.conditions.split("\n").filter((line) => line.trim()),
      status,
      stackable: Boolean(formData.stackable),
      combinableWithPromotions: Boolean(formData.combinableWithPromotions),
      exclusive: Boolean(formData.exclusive),
      priority: formData.priority ? parseInt(formData.priority, 10) : 0,
      perUserLimit: formData.perUserLimit
        ? parseInt(formData.perUserLimit, 10)
        : 0,
      orderTypes: toArray(formData.orderTypes),
      paymentMethods: toArray(formData.paymentMethods),
      firstOrderOnly: Boolean(formData.firstOrderOnly),
      customerRanks: toArray(formData.customerRanks).map(normalizeRankValue),
      categoryScope: formData.categoryScope,
      categoryIds: selectedIds,
      categories: selectedNames,
    };

    onSave(formattedData);
  };

  return (
    <div
      className="premium-modal-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="premium-modal">
        <div className="modal-header">
          <div className="header-content">
            <h2>{coupon ? "Chỉnh sửa coupon" : "Tạo coupon mới"}</h2>
            <p>
              Thiết lập coupon đầy đủ điều kiện, thời gian và lịch xuất bản.
            </p>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <form id="couponForm" onSubmit={handleSubmit}>
            <div className="form-section">
              <h3 className="section-title">
                <FileText size={18} /> Thông tin coupon
              </h3>
              <div className="grid-2">
                <div className="form-group full">
                  <label>
                    Tên coupon <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="VD: Coupon Tết 2025"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={errors.name ? "error" : ""}
                  />
                  {errors.name && (
                    <span className="err-msg">{errors.name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    Mã coupon <span className="req">*</span>
                  </label>
                  <div className="input-icon-wrapper">
                    <Tag size={16} className="input-icon" />
                    <input
                      type="text"
                      name="code"
                      placeholder="VD: NEWYEAR"
                      value={formData.code}
                      onChange={handleInputChange}
                      className={errors.code ? "error" : ""}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Nhóm coupon <span className="req">*</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className={errors.category ? "error" : ""}
                  >
                    <option value="">-- Chọn nhóm --</option>
                    {Object.entries(COUPON_CATEGORIES).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <span className="err-msg">{errors.category}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <Percent size={18} /> Giá trị & điều kiện
              </h3>
              <div className="grid-3">
                <div className="form-group">
                  <label>
                    Loại giảm <span className="req">*</span>
                  </label>
                  <select
                    name="discountType"
                    value={formData.discountType}
                    onChange={handleInputChange}
                    className={errors.discountType ? "error" : ""}
                  >
                    <option value="">-- Loại --</option>
                    {Object.entries(COUPON_DISCOUNT_TYPES).map(
                      ([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Mức giảm <span className="req">*</span>
                  </label>
                  <input
                    type="number"
                    name="discountValue"
                    placeholder="0"
                    value={formData.discountValue}
                    onChange={handleInputChange}
                    className={errors.discountValue ? "error" : ""}
                  />
                </div>

                <div className="form-group">
                  <label>Giảm tối đa</label>
                  <input
                    type="number"
                    name="maxDiscount"
                    placeholder="Không giới hạn"
                    value={formData.maxDiscount}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="grid-2 mt-3">
                <div className="form-group">
                  <label>Đơn tối thiểu</label>
                  <div className="input-icon-wrapper">
                    <DollarSign size={16} className="input-icon" />
                    <input
                      type="number"
                      name="minOrderValue"
                      placeholder="0"
                      value={formData.minOrderValue}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Giới hạn lượt dùng</label>
                  <input
                    type="number"
                    name="usageLimit"
                    placeholder="Tổng lượt dùng tối đa"
                    value={formData.usageLimit}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Mỗi khách dùng tối đa</label>
                  <input
                    type="number"
                    name="perUserLimit"
                    min="0"
                    placeholder="Không giới hạn"
                    value={formData.perUserLimit}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <aside className="discount-preview-card" aria-label="Ước tính giá trị coupon">
                <div className="preview-card-header">
                  <span>Ước tính trên đơn mẫu</span>
                  <strong>{formatVnd(discountPreview.sampleOrderValue)}</strong>
                </div>
                <div className="preview-card-metrics">
                  <div>
                    <span>Khách được giảm</span>
                    <strong>{formatVnd(discountPreview.estimatedDiscount)}</strong>
                  </div>
                  <div>
                    <span>Khách thanh toán</span>
                    <strong>{formatVnd(discountPreview.payableAmount)}</strong>
                  </div>
                </div>
                {discountPreview.warnings.length > 0 ? (
                  <ul className="preview-warning-list">
                    {discountPreview.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="preview-safe-note">Điều kiện hiện tại chưa có cảnh báo rủi ro lớn.</p>
                )}
              </aside>

              <div className="form-group full mt-3">
                <label>Mô tả coupon</label>
                <input
                  type="text"
                  name="description"
                  placeholder="Mô tả nhanh cho coupon"
                  value={formData.description}
                  onChange={handleInputChange}
                />
              </div>
            </div>



            <div className="form-section">
              <h3 className="section-title">
                <ClipboardList size={18} /> Phạm vi danh mục áp dụng
              </h3>

              <div className="coupon-category-scope-panel">
                <div className="category-scope-options" role="radiogroup" aria-label="Phạm vi danh mục áp dụng">
                  <label className={`scope-option ${formData.categoryScope === "all" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="categoryScope"
                      value="all"
                      checked={formData.categoryScope === "all"}
                      onChange={handleCategoryScopeChange}
                    />
                    <span>
                      <strong>Toàn bộ món</strong>
                      <small>Coupon áp dụng trên toàn bộ subtotal hợp lệ của đơn.</small>
                    </span>
                  </label>
                  <label className={`scope-option ${formData.categoryScope === "selected" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="categoryScope"
                      value="selected"
                      checked={formData.categoryScope === "selected"}
                      onChange={handleCategoryScopeChange}
                    />
                    <span>
                      <strong>Chỉ danh mục được chọn</strong>
                      <small>Coupon chỉ tính giảm trên món thuộc các danh mục này.</small>
                    </span>
                  </label>
                </div>

                {formData.categoryScope === "selected" && (
                  <div className="category-picker-box">
                    {categoryOptions.length > 0 ? (
                      <div className="category-checkbox-list">
                        {categoryOptions.map((category) => {
                          const categoryId = getCategoryId(category);
                          const categoryName = getCategoryName(category);
                          return (
                            <label className="category-checkbox-row" key={categoryId || categoryName}>
                              <input
                                type="checkbox"
                                checked={selectedCategoryIds.includes(categoryId)}
                                onChange={handleCategoryCheckboxChange(category)}
                                disabled={!categoryId}
                              />
                              <span>
                                <strong>{categoryName || "Danh mục chưa đặt tên"}</strong>
                                {Number(category.menuItemCount || 0) > 0 && <small>{category.menuItemCount} món</small>}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="category-empty-note">
                        Chưa tải được danh mục cho nhà hàng hiện tại{restaurantId ? "" : " vì chưa chọn nhà hàng"}.
                      </p>
                    )}
                    {missingCategoryIds.length > 0 && (
                      <p className="category-warning-note">
                        Một số danh mục cũ không còn tồn tại: {missingCategoryIds.join(", ")}.
                      </p>
                    )}
                    {errors.categoryIds && <span className="err-msg">{errors.categoryIds}</span>}
                    <p className="category-preview-note">
                      Ưu đãi chỉ áp dụng trên tổng giá trị các món thuộc danh mục đã chọn.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <ClipboardList size={18} /> Điều kiện đủ điều kiện
              </h3>

              <div className="grid-2">
                <div className="form-group full">
                  <label>Loại đơn áp dụng</label>
                  <div className="checkbox-group">
                    {ORDER_TYPE_OPTIONS.map((option) => (
                      <label className="checkbox-row" key={option.value}>
                        <input
                          type="checkbox"
                          name="orderTypes"
                          value={option.value}
                          checked={formData.orderTypes.includes(option.value)}
                          onChange={handleMultiCheckboxChange(
                            "orderTypes",
                            option.value,
                          )}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group full">
                  <label>Phương thức thanh toán</label>
                  <div className="checkbox-group">
                    {PAYMENT_METHOD_OPTIONS.map((option) => (
                      <label className="checkbox-row" key={option.value}>
                        <input
                          type="checkbox"
                          name="paymentMethods"
                          value={option.value}
                          checked={formData.paymentMethods.includes(
                            option.value,
                          )}
                          onChange={handleMultiCheckboxChange(
                            "paymentMethods",
                            option.value,
                          )}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="firstOrderOnly"
                    checked={Boolean(formData.firstOrderOnly)}
                    onChange={handleInputChange}
                  />
                  <span>Chỉ cho đơn đầu tiên của khách</span>
                </label>
              </div>
            </div>


            <div className="form-section">
              <h3 className="section-title">
                <ClipboardList size={18} /> Hạng khách hàng áp dụng
              </h3>

              <div className="customer-rank-scope-panel">
                <p className="rank-helper-note">
                  Không chọn hạng nào nghĩa là coupon áp dụng cho tất cả khách hàng.
                </p>

                {rankOptions.length > 0 ? (
                  <div className="rank-checkbox-list">
                    {rankOptions.map((rank) => (
                      <label className="rank-checkbox-row" key={rank.value}>
                        <input
                          type="checkbox"
                          checked={selectedCustomerRanks.includes(rank.value)}
                          onChange={handleCustomerRankCheckboxChange(rank.value)}
                        />
                        <span>
                          <strong>{rank.label || rank.value}</strong>
                          <small>
                            {Number.isFinite(Number(rank.minPoints)) ? `Từ ${rank.minPoints} điểm` : "Không có ngưỡng điểm"}
                            {rank.benefits ? ` · ${rank.benefits}` : ""}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="rank-empty-note">
                    Chưa tải được hạng khách hàng cho nhà hàng hiện tại{restaurantId ? "" : " vì chưa chọn nhà hàng"}.
                  </p>
                )}

                {legacyCustomerRanks.length > 0 && (
                  <div className="legacy-rank-box">
                    <p>Hạng cũ không còn trong cấu hình</p>
                    <div className="legacy-rank-list">
                      {legacyCustomerRanks.map((rank) => (
                        <label className="rank-checkbox-row legacy" key={rank}>
                          <input
                            type="checkbox"
                            checked={selectedCustomerRanks.includes(rank)}
                            onChange={handleCustomerRankCheckboxChange(rank)}
                          />
                          <span><strong>{rank}</strong></span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="form-section">
              <h3 className="section-title">
                <ClipboardList size={18} /> Cấu hình dùng chồng
              </h3>

              <div className="grid-2">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="stackable"
                    checked={Boolean(formData.stackable)}
                    onChange={handleInputChange}
                  />
                  <span>Cho phép dùng chồng với coupon khác</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="combinableWithPromotions"
                    checked={Boolean(formData.combinableWithPromotions)}
                    onChange={handleInputChange}
                  />
                  <span>Cho phép dùng chung với chương trình khuyến mãi</span>
                </label>

                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    name="exclusive"
                    checked={Boolean(formData.exclusive)}
                    onChange={handleInputChange}
                  />
                  <span>Coupon độc quyền, ưu tiên chặn ưu đãi khác</span>
                </label>

                <div className="form-group">
                  <label>Độ ưu tiên</label>
                  <input
                    type="number"
                    name="priority"
                    min="0"
                    placeholder="0"
                    value={formData.priority}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <p className="text-xs text-secondary mt-2">
                Quy tắc dùng chồng coupon sẽ được tính lại khi áp coupon vào đơn
                hàng.
              </p>
            </div>
            <div className="form-section">
              <h3 className="section-title">
                <Clock size={18} /> Thời gian & công bố
              </h3>
              <div className="grid-2">
                <div className="form-group">
                  <label>
                    Bắt đầu hiệu lực <span className="req">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    className={errors.startDate ? "error" : ""}
                  />
                </div>
                <div className="form-group">
                  <label>
                    Kết thúc hiệu lực <span className="req">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className={errors.endDate ? "error" : ""}
                  />
                  {errors.endDate && (
                    <span className="err-msg">{errors.endDate}</span>
                  )}
                </div>
                <div className="form-group full">
                  <label>Lịch xuất bản (coupon sắp tới)</label>
                  <div className="input-icon-wrapper">
                    <Clock size={16} className="input-icon" />
                    <input
                      type="datetime-local"
                      name="publishAt"
                      value={formData.publishAt}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section no-border">
              <div className="form-group full">
                <label>Điều kiện áp dụng (mỗi dòng 1 điều kiện)</label>
                <textarea
                  name="conditions"
                  rows="3"
                  placeholder="- Chỉ áp dụng cho coupon nhóm món ăn"
                  value={formData.conditions}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Hủy bỏ
          </button>
          <div className="right-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={(event) => handleSubmit(event, "draft")}
            >
              <ClipboardList size={18} /> Lưu nháp
            </button>
            <button type="submit" form="couponForm" className="btn-primary">
              <Save size={18} />
              {coupon ? "Lưu thay đổi" : "Tạo coupon"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CouponModal;
