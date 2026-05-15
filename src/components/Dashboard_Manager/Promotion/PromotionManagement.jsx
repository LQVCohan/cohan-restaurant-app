import React, { useContext, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Download,
  FilterX,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Trash2,
  Inbox,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import {
  hasPermission,
  NO_PERMISSION_MESSAGE,
} from "@/utils/frontendPermissionAccess";
import { useCouponAnalytics } from "../../../hooks/useCouponAnalytics";
import { usePromotionAnalytics } from "../../../hooks/usePromotionAnalytics";
// --- Components ---
// Giả định bạn đã lưu các file này từ các bước trước
import StatsCard from "./components/StatsCard/StatsCard";
import PromotionsGrid from "./components/PromotionsGrid/PromotionsGrid";
import PromotionModal from "./components/PromotionModal/PromotionModal";
import CouponModal from "./components/CouponModal/CouponModal";
import CouponPackageModal from "./components/CouponPackageModal/CouponPackageModal";
import { COUPON_CATEGORIES } from "../../../utils/constants";
import { downloadXlsxWorkbook } from "../../../utils/xlsxWorkbook";

// --- Hooks ---
import { usePromotions } from "../../../hooks/usePromotions";
import { useCoupons } from "../../../hooks/useCoupons";

// --- Styles ---
import "./PromotionManagement.scss";

const PromotionManagement = () => {
  const { user } = useContext(AuthContext);
  const canWritePromotion = hasPermission(user, "promotion.write");
  const canWriteCoupon = hasPermission(user, "coupon.write");
  const {
    promotions,
    allPromotions,
    restaurants: promotionRestaurants,
    selectedRestaurantId,
    filters,
    categories,
    menuItems,
    addPromotion,
    updatePromotion,
    deletePromotion,
    duplicatePromotion,
    updateFilters,
  } = usePromotions();

  const {
    coupons,
    allCoupons,
    couponFilters,
    updateCouponFilters,
    addCoupon,
    updateCoupon,
    deleteCoupon,
    duplicateCoupon,
    couponPackages,
    allCouponPackages,
    couponPackageFilters,
    updateCouponPackageFilters,
    addCouponPackage,
    updateCouponPackage,
    deleteCouponPackage,
    duplicateCouponPackage,
    resolveStatus,
  } = useCoupons(selectedRestaurantId);
  const {
    analytics: couponAnalytics,
    loading: couponAnalyticsLoading,
    error: couponAnalyticsError,
  } = useCouponAnalytics(selectedRestaurantId);
  const {
    analytics: promotionAnalytics,
    loading: promotionAnalyticsLoading,
    error: promotionAnalyticsError,
  } = usePromotionAnalytics(selectedRestaurantId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [isCouponPackageModalOpen, setIsCouponPackageModalOpen] =
    useState(false);
  const [editingCouponPackage, setEditingCouponPackage] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // 'list' | 'grid'
  const [activeTab, setActiveTab] = useState("all");
  const [activeSection, setActiveSection] = useState("promotions");

  const selectedRestaurant = useMemo(
    () =>
      promotionRestaurants.find(
        (restaurant) =>
          String(restaurant.id) === String(selectedRestaurantId || ""),
      ) || null,
    [promotionRestaurants, selectedRestaurantId],
  );

  const formatPromotionValue = (promotion) => {
    if (promotion.type === "bogo") {
      return `Mua ${promotion.buyQuantity || 1} tặng ${promotion.getQuantity || 1}`;
    }
    if (promotion.type === "freeship") {
      return "Miễn phí vận chuyển";
    }
    if (promotion.type === "percentage") {
      return `${promotion.discountValue}%`;
    }
    return `${Number(promotion.discountValue || 0).toLocaleString()}đ`;
  };

  const resolvePromotionTargetLabel = (promotion) => {
    if (promotion.scope === "item") {
      const item = menuItems.find(
        (menuItem) => String(menuItem.id) === String(promotion.itemId || ""),
      );
      return item?.name || promotion.itemId || "Món áp dụng";
    }
    if (promotion.scope === "category") {
      const category = categories.find(
        (item) => String(item.id) === String(promotion.categoryId || ""),
      );
      return category?.name || promotion.categoryId || "Danh mục áp dụng";
    }
    return "Toàn bộ đơn hàng";
  };

  const resolveGiftItemLabel = (promotion) => {
    if (!promotion.giftItemId) return "";
    const item = menuItems.find(
      (menuItem) => String(menuItem.id) === String(promotion.giftItemId || ""),
    );
    return item?.name || promotion.giftItemId;
  };

  const resolveComboItemsLabel = (promotion) => {
    if (!Array.isArray(promotion.comboItems) || !promotion.comboItems.length) {
      return "";
    }

    return promotion.comboItems
      .map((comboItem) => {
        const item = menuItems.find(
          (menuItem) => String(menuItem.id) === String(comboItem.itemId || ""),
        );
        const name = item?.name || comboItem.itemId;
        const quantity = Number(comboItem.quantity || 1);
        return quantity > 1 ? `${name} x${quantity}` : name;
      })
      .join(", ");
  };

  const resolvePromotionDiscountKind = (promotion) => {
    if (promotion.type === "freeship") return "FREESHIP";
    if (promotion.type === "bogo") return "BOGO";
    if (promotion.type === "combo") return promotion.discountType === "fixed" ? "COMBO_FIXED" : "COMBO_PERCENT";
    return promotion.discountType === "fixed" ? "FIXED" : "PERCENTAGE";
  };

  const buildExportSheets = () => {
    const restaurantName =
      selectedRestaurant?.name || `Restaurant-${selectedRestaurantId || "all"}`;

    if (activeSection === "coupons") {
      return [
        {
          name: "Coupons",
          rows: [
            [
              "Tên coupon",
              "Mã",
              "Nhóm",
              "Giảm giá",
              "Đơn tối thiểu",
              "Giảm tối đa",
              "Lượt dùng",
              "Đã dùng",
              "Mỗi khách tối đa",
              "Loại đơn",
              "Phương thức thanh toán",
              "Đơn đầu tiên",
              "Công bố",
              "Bắt đầu",
              "Kết thúc",
              "Trạng thái",
              "Nhà hàng",
            ],
            ...coupons.map((coupon) => [
              coupon.name,
              coupon.code,
              COUPON_CATEGORIES[coupon.category] || coupon.category,
              coupon.discountType === "percent"
                ? `${coupon.discountValue}%`
                : coupon.discountValue,
              coupon.minOrderValue,
              coupon.maxDiscount,
              coupon.usageLimit,
              coupon.usageCount,
              coupon.perUserLimit || "",
              (coupon.orderTypes || []).join(", "),
              (coupon.paymentMethods || []).join(", "),
              coupon.firstOrderOnly ? "Có" : "Không",
              coupon.publishAt,
              coupon.startDate,
              coupon.endDate,
              resolveStatus(coupon),
              restaurantName,
            ]),
          ],
        },
      ];
    }

    if (activeSection === "couponPackages") {
      return [
        {
          name: "CouponPackages",
          rows: [
            [
              "Tên gói",
              "Mã",
              "Coupon",
              "Công bố",
              "Bắt đầu",
              "Kết thúc",
              "Trạng thái",
              "Nhà hàng",
              "Điều kiện",
            ],
            ...couponPackages.map((couponPackage) => [
              couponPackage.name,
              couponPackage.code,
              (couponPackage.couponIds || [])
                .map((couponId) => {
                  const coupon = allCoupons.find(
                    (item) => String(item.id) === String(couponId),
                  );
                  return coupon?.name || couponId;
                })
                .join(", "),
              couponPackage.publishAt,
              couponPackage.startDate,
              couponPackage.endDate,
              resolveStatus(couponPackage),
              restaurantName,
              (couponPackage.conditions || []).join(" | "),
            ]),
          ],
        },
      ];
    }

    return [
      {
        name: "Promotions",
        rows: [
          [
            "Tên chương trình",
            "Mã",
            "Loại",
            "Phạm vi",
            "Đối tượng áp dụng",
            "Món tặng",
            "Combo items",
            "Freeship giảm",
            "Loại giảm",
            "Mua",
            "Tặng",
            "Giảm giá",
            "Đơn tối thiểu",
            "Giảm tối đa",
            "Lượt dùng",
            "Đã dùng",
            "Bắt đầu",
            "Kết thúc",
            "Trạng thái",
            "Nhà hàng",
            "Mô tả",
            "Điều kiện",
          ],
          ...promotions.map((promotion) => [
            promotion.name,
            promotion.code,
            promotion.type,
            promotion.scope,
            resolvePromotionTargetLabel(promotion),
            resolveGiftItemLabel(promotion),
            promotion.type === "combo" ? resolveComboItemsLabel(promotion) : "",
            promotion.type === "freeship" ? "Có" : "",
            resolvePromotionDiscountKind(promotion),
            promotion.buyQuantity,
            promotion.getQuantity,
            formatPromotionValue(promotion),
            promotion.minOrderValue,
            promotion.maxDiscount,
            promotion.usageLimit,
            promotion.usageCount,
            promotion.startDate,
            promotion.endDate,
            promotion.status,
            restaurantName,
            promotion.description,
            (promotion.conditions || []).join(" | "),
          ]),
        ],
      },
    ];
  };

  const handleExport = () => {
    const rows =
      activeSection === "promotions"
        ? promotions
        : activeSection === "coupons"
          ? coupons
          : couponPackages;

    if (!rows.length) return;

    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadXlsxWorkbook(
      buildExportSheets(),
      `promotion-${activeSection}-${selectedRestaurantId || "all"}-${dateSuffix}.xlsx`,
    );
  };

  // --- Derived Data (Tính toán số liệu) ---
  const statsData = useMemo(() => {
    if (activeSection === "coupons") {
      return {
        totalSavings: Number(couponAnalytics.totalDiscountAmount || 0),
        usageRate: Number(couponAnalytics.usageRate || 0),
        totalUsage: Number(couponAnalytics.totalRedemptions || 0),
        hotPromotions: Number(couponAnalytics.topCoupons?.length || 0),
      };
    }

    if (activeSection === "couponPackages") {
      const activePackages = allCouponPackages.filter(
        (couponPackage) => resolveStatus(couponPackage) === "active",
      ).length;

      const scheduledPackages = allCouponPackages.filter(
        (couponPackage) => resolveStatus(couponPackage) === "scheduled",
      ).length;

      return {
        totalSavings: 0,
        usageRate: allCouponPackages.length
          ? Math.round((activePackages / allCouponPackages.length) * 100)
          : 0,
        totalUsage: allCouponPackages.length,
        hotPromotions: scheduledPackages,
      };
    }

    return {
      totalSavings: Number(promotionAnalytics.totalDiscountAmount || 0),
      usageRate: Number(promotionAnalytics.usageRate || 0),
      totalUsage: Number(promotionAnalytics.totalRedemptions || 0),
      hotPromotions: Number(promotionAnalytics.topPromotions?.length || 0),
    };
  }, [activeSection, couponAnalytics, promotionAnalytics, allCouponPackages, resolveStatus]);

  const couponActionTitle = canWriteCoupon ? undefined : NO_PERMISSION_MESSAGE;
  const promotionActionTitle = canWritePromotion ? undefined : NO_PERMISSION_MESSAGE;
  const canWriteCurrentSection =
    activeSection === "promotions" ? canWritePromotion : canWriteCoupon;

  const runCouponWriteAction = (action) => {
    if (!canWriteCoupon) return;
    action?.();
  };

  const runPromotionWriteAction = (action) => {
    if (!canWritePromotion) return;
    action?.();
  };

  // --- Handlers ---
  const handleOpenModal = (promotion = null) => {
    if (!canWritePromotion) return;
    setEditingPromotion(promotion);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPromotion(null);
  };

  const handleSavePromotion = async (promotionData) => {
    if (!canWritePromotion) return;
    try {
      const targetRestaurantId = editingPromotion
        ? await updatePromotion(editingPromotion.id, promotionData)
        : await addPromotion(promotionData);

      if (
        targetRestaurantId &&
        String(targetRestaurantId) !== String(selectedRestaurantId)
      ) {
        updateFilters({ restaurant: targetRestaurantId });
      }

      handleCloseModal();
    } catch (error) {
      console.error("Khong the luu khuyen mai.", error);
    }
  };

  const handleDelete = (id) => {
    if (!canWritePromotion) return;
    if (window.confirm("Bạn có chắc chắn muốn xóa khuyến mãi này?")) {
      deletePromotion(id);
    }
  };

  const handleOpenCouponModal = (coupon = null) => {
    if (!canWriteCoupon) return;
    setEditingCoupon(coupon);
    setIsCouponModalOpen(true);
  };

  const handleCloseCouponModal = () => {
    setIsCouponModalOpen(false);
    setEditingCoupon(null);
  };

  const handleSaveCoupon = async (couponData) => {
    if (!canWriteCoupon) return;
    try {
      if (editingCoupon) {
        await updateCoupon(editingCoupon.id, couponData);
      } else {
        await addCoupon(couponData);
      }
      handleCloseCouponModal();
    } catch (error) {
      console.error("Khong the luu coupon.", error);
    }
  };

  const handleDeleteCoupon = (id) => {
    if (!canWriteCoupon) return;
    if (window.confirm("Bạn có chắc chắn muốn xóa coupon này?")) {
      deleteCoupon(id);
    }
  };

  const handleOpenCouponPackageModal = (couponPackage = null) => {
    if (!canWriteCoupon) return;
    setEditingCouponPackage(couponPackage);
    setIsCouponPackageModalOpen(true);
  };

  const handleCloseCouponPackageModal = () => {
    setIsCouponPackageModalOpen(false);
    setEditingCouponPackage(null);
  };

  const handleSaveCouponPackage = async (packageData) => {
    if (!canWriteCoupon) return;
    try {
      if (editingCouponPackage) {
        await updateCouponPackage(editingCouponPackage.id, packageData);
      } else {
        await addCouponPackage(packageData);
      }
      handleCloseCouponPackageModal();
    } catch (error) {
      console.error("Khong the luu goi coupon.", error);
    }
  };

  const handleDeleteCouponPackage = (id) => {
    if (!canWriteCoupon) return;
    if (window.confirm("Bạn có chắc chắn muốn xóa gói Coupon này?")) {
      deleteCouponPackage(id);
    }
  };

  // --- Helpers UI ---
  const renderStatusBadge = (status) => {
    const map = {
      active: { label: "Đang chạy", class: "bg-green-100 text-green-700" },
      scheduled: { label: "Sắp tới", class: "bg-blue-50 text-blue-700" },
      expired: { label: "Kết thúc", class: "bg-red-50 text-red-700" },
      draft: { label: "Nháp", class: "bg-gray-100 text-gray-600" },
    };
    const conf = map[status] || map.draft;

    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${conf.class}`}
      >
        {conf.label}
      </span>
    );
  };

  // Format Helper
  const formatDate = (dateStr) => {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const sectionMeta = {
    promotions: {
      title: "Quản Lý Khuyến Mãi",
      subtitle: "Tạo chương trình khuyến mãi theo mùa như Tết, lễ hội.",
      emptyText: "Thử thay đổi bộ lọc hoặc tạo chương trình mới.",
      createLabel: "Tạo khuyến mãi",
    },
    coupons: {
      title: "Quản Lý Coupon",
      subtitle:
        "Quản lý coupon theo nhóm món ăn, đặt bàn, đặt món và shipping.",
      emptyText: "Thử thay đổi bộ lọc hoặc tạo coupon mới.",
      createLabel: "Tạo coupon",
    },
    couponPackages: {
      title: "Quản Lý Gói Coupon",
      subtitle: "Tạo gói Coupon cho từng nhóm khách hàng.",
      emptyText: "Thử thay đổi bộ lọc hoặc tạo gói Coupon mới.",
      createLabel: "Tạo gói Coupon",
    },
  };

  const currentSection = sectionMeta[activeSection];

  const handleStatusTabChange = (tabId) => {
    setActiveTab(tabId);
    if (activeSection === "promotions") {
      updateFilters({ status: tabId });
      return;
    }
    if (activeSection === "coupons") {
      updateCouponFilters({ status: tabId });
      return;
    }
    updateCouponPackageFilters({ status: tabId });
  };

  const handleClearFilters = () => {
    setActiveTab("all");
    if (activeSection === "promotions") {
      updateFilters({
        search: "",
        status: "all",
        restaurant: selectedRestaurantId,
      });
      return;
    }
    if (activeSection === "coupons") {
      updateCouponFilters({ search: "", category: "all", status: "all" });
      return;
    }
    updateCouponPackageFilters({ search: "", status: "all" });
  };

  const searchValue =
    activeSection === "promotions"
      ? filters.search
      : activeSection === "coupons"
        ? couponFilters.search
        : couponPackageFilters.search;

  const hasActiveFilters =
    activeSection === "promotions"
      ? filters.search || filters.status !== "all"
      : activeSection === "coupons"
        ? couponFilters.search ||
          couponFilters.status !== "all" ||
          couponFilters.category !== "all"
        : couponPackageFilters.search || couponPackageFilters.status !== "all";

  const currentCount =
    activeSection === "promotions"
      ? promotions.length
      : activeSection === "coupons"
        ? coupons.length
        : couponPackages.length;

  const totalCount =
    activeSection === "promotions"
      ? allPromotions.length
      : activeSection === "coupons"
        ? allCoupons.length
        : allCouponPackages.length;

  const renderCouponTable = () => (
    <div className="table-responsive">
      <table className="premium-table coupon-table">
        <thead>
          <tr>
            <th width="25%">Coupon / Mã</th>
            <th width="15%">Nhóm</th>
            <th width="16%">Hiệu lực</th>
            <th width="14%">Giảm giá</th>
            <th width="14%">Dùng chồng</th>
            <th width="8%">Trạng thái</th>
            <th width="8%" className="text-right">
              Hành động
            </th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon) => (
            <tr key={coupon.id}>
              <td>
                <div className="fw-bold text-dark mb-1">{coupon.name}</div>
                <div className="code-badge">
                  <Copy size={12} /> {coupon.code}
                </div>
                {coupon.publishAt && (
                  <div className="text-xs text-secondary mt-1">
                    Công bố: {formatDate(coupon.publishAt)}
                  </div>
                )}
              </td>
              <td className="text-secondary text-sm">
                {COUPON_CATEGORIES[coupon.category] || coupon.category}
              </td>
              <td className="text-secondary text-sm">
                <div>{formatDate(coupon.startDate)}</div>
                <div className="text-xs">đến {formatDate(coupon.endDate)}</div>
              </td>
              <td className="text-primary font-bold">
                {coupon.discountType === "percent"
                  ? `${coupon.discountValue}%`
                  : `${Number(coupon.discountValue || 0).toLocaleString()}đ`}
              </td>
              <td className="text-secondary text-sm">
                <div className="coupon-stack-flags">
                  {coupon.combinableWithPromotions && (
                    <span className="coupon-chip">+ Promotion</span>
                  )}
                  {coupon.stackable && (
                    <span className="coupon-chip">+ Coupon</span>
                  )}
                  {coupon.exclusive && (
                    <span className="coupon-chip coupon-chip-danger">
                      Độc quyền
                    </span>
                  )}
                  {!coupon.combinableWithPromotions &&
                    !coupon.stackable &&
                    !coupon.exclusive && (
                      <span className="text-xs text-muted">
                        Không dùng chồng
                      </span>
                    )}
                </div>
                <div className="text-xs text-secondary mt-1">
                  Ưu tiên: {coupon.priority || 0}
                </div>
              </td>
              <td>{renderStatusBadge(resolveStatus(coupon))}</td>
              <td className="text-right">
                <div className="action-buttons">
                  <button
                    onClick={() => runCouponWriteAction(() => duplicateCoupon(coupon.id))}
                    disabled={!canWriteCoupon}
                    title={couponActionTitle || "Nhân bản"}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => handleOpenCouponModal(coupon)}
                    disabled={!canWriteCoupon}
                    title={couponActionTitle || "Sửa"}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteCoupon(coupon.id)}
                    disabled={!canWriteCoupon}
                    title={couponActionTitle || "Xóa"}
                    className="text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCouponPackageTable = () => (
    <div className="table-responsive">
      <table className="premium-table coupon-table">
        <thead>
          <tr>
            <th width="30%">Gói Coupon / Mã</th>
            <th width="25%">Coupon trong gói</th>
            <th width="18%">Hiệu lực</th>
            <th width="12%">Trạng thái</th>
            <th width="15%" className="text-right">
              Hành động
            </th>
          </tr>
        </thead>
        <tbody>
          {couponPackages.map((couponPackage) => (
            <tr key={couponPackage.id}>
              <td>
                <div className="fw-bold text-dark mb-1">
                  {couponPackage.name}
                </div>
                <div className="code-badge">
                  <Copy size={12} /> {couponPackage.code}
                </div>
                {couponPackage.publishAt && (
                  <div className="text-xs text-secondary mt-1">
                    Công bố: {formatDate(couponPackage.publishAt)}
                  </div>
                )}
              </td>
              <td>
                <div className="coupon-pack-list">
                  {(couponPackage.couponIds || []).map((couponId) => {
                    const coupon = allCoupons.find(
                      (item) => item.id === couponId,
                    );
                    return (
                      <span key={couponId} className="coupon-chip">
                        {coupon ? coupon.name : `#${couponId}`}
                      </span>
                    );
                  })}
                </div>
              </td>
              <td className="text-secondary text-sm">
                <div>{formatDate(couponPackage.startDate)}</div>
                <div className="text-xs">
                  đến {formatDate(couponPackage.endDate)}
                </div>
              </td>
              <td>{renderStatusBadge(resolveStatus(couponPackage))}</td>
              <td className="text-right">
                <div className="action-buttons">
                  <button
                    onClick={() =>
                      runCouponWriteAction(() => duplicateCouponPackage(couponPackage.id))
                    }
                    disabled={!canWriteCoupon}
                    title={couponActionTitle || "Nhân bản"}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => handleOpenCouponPackageModal(couponPackage)}
                    disabled={!canWriteCoupon}
                    title={couponActionTitle || "Sửa"}
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteCouponPackage(couponPackage.id)}
                    disabled={!canWriteCoupon}
                    title={couponActionTitle || "Xóa"}
                    className="text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const statsLabels = useMemo(() => {
    if (activeSection === "couponPackages") {
      return {
        savings: "Tiết kiệm đã ghi nhận",
        usage: "Tỷ lệ đang chạy",
        total: "Tổng gói Coupon",
        hot: "Gói sắp tới",
      };
    }

    if (activeSection === "coupons") {
      return {
        savings: "Tiết kiệm thực tế",
        usage: "Tỷ lệ sử dụng",
        total: "Lượt dùng Coupon",
        hot: "Top Coupon",
      };
    }

    return {
      savings: "Tiết kiệm thực tế",
      usage: "Tỷ lệ sử dụng",
      total: "Lượt dùng Promotion",
      hot: "Top Promotion",
    };
  }, [activeSection]);
  return (
    <div className="promotion-manager-page">
      {/* 1. HEADER */}
      <header className="page-header">
        <div className="header-title">
          <h1>{currentSection.title}</h1>
          <p>{currentSection.subtitle}</p>
        </div>
        <div className="restaurant-selector">
          <span className="restaurant-selector__icon">🏠</span>
          <select
            aria-label="Chon nha hang khuyen mai"
            value={selectedRestaurantId}
            onChange={(event) =>
              updateFilters({ restaurant: event.target.value })
            }
            disabled={!promotionRestaurants.length}
          >
            {promotionRestaurants.length ? (
              promotionRestaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name || `Nha hang ${restaurant.id}`}
                </option>
              ))
            ) : (
              <option value="">Chua co nha hang kha dung</option>
            )}
          </select>
          <ChevronDown size={16} />
        </div>
      </header>

      <div className="section-tabs">
        {[
          { id: "promotions", label: "Chương trình khuyến mãi" },
          { id: "coupons", label: "Coupon" },
          { id: "couponPackages", label: "Gói Coupon" },
        ].map((section) => (
          <button
            key={section.id}
            className={`section-tab ${
              activeSection === section.id ? "active" : ""
            }`}
            onClick={() => {
              setActiveSection(section.id);
              setActiveTab("all");
              setViewMode("grid");
              if (section.id === "promotions") {
                updateFilters({ status: "all" });
              } else if (section.id === "coupons") {
                updateCouponFilters({ status: "all" });
              } else {
                updateCouponPackageFilters({ status: "all" });
              }
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* 2. STATS */}
      <section className="stats-section">
        <StatsCard stats={statsData} labels={statsLabels} />
      </section>
      {activeSection === "coupons" && couponAnalyticsError && (
        <p className="text-xs text-danger mt-2">
          Chưa tải được thống kê Coupon, đang hiển thị dữ liệu danh sách.
        </p>
      )}
      {activeSection === "coupons" && couponAnalyticsLoading && (
        <p className="text-xs text-secondary mt-2">
          Đang cập nhật thống kê Coupon...
        </p>
      )}
      {activeSection === "promotions" && promotionAnalyticsError && (
        <p className="text-xs text-danger mt-2">
          Chưa tải được thống kê Promotion, đang hiển thị giá trị mặc định.
        </p>
      )}
      {activeSection === "promotions" && promotionAnalyticsLoading && (
        <p className="text-xs text-secondary mt-2">
          Đang cập nhật thống kê Promotion...
        </p>
      )}

      {/* 3. MAIN CONTENT CARD */}
      <div className="main-content-card">
        {/* A. Tabs */}
        <div className="tabs-header">
          {[
            { id: "all", label: "Tất cả" },
            { id: "active", label: "Đang chạy" },
            { id: "scheduled", label: "Sắp tới" },
            { id: "expired", label: "Đã xong" },
            { id: "draft", label: "Nháp" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleStatusTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* B. Filter Toolbar */}
        <div className="filter-toolbar">
          <div className="filter-left">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder={
                  activeSection === "promotions"
                    ? "Tìm kiếm chương trình, mã..."
                    : activeSection === "coupons"
                      ? "Tìm kiếm coupon, mã..."
                      : "Tìm kiếm gói Coupon, mã..."
                }
                value={searchValue}
                onChange={(event) => {
                  const value = event.target.value;
                  if (activeSection === "promotions") {
                    updateFilters({ search: value });
                    return;
                  }
                  if (activeSection === "coupons") {
                    updateCouponFilters({ search: value });
                    return;
                  }
                  updateCouponPackageFilters({ search: value });
                }}
              />
            </div>

            {activeSection === "coupons" ? (
              <div className="dropdown-filter">
                <select
                  value={couponFilters.category}
                  onChange={(event) =>
                    updateCouponFilters({ category: event.target.value })
                  }
                >
                  <option value="all">Tất cả nhóm</option>
                  {Object.entries(COUPON_CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            ) : (
              <div className="dropdown-filter">
                <span>Tất cả loại</span>
                <ChevronDown size={14} />
              </div>
            )}

            <button
              className="btn-clear-filter"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
            >
              <FilterX size={14} />
              <span>Xóa lọc</span>
            </button>
          </div>

          <div className="filter-right">
            <div className="view-toggle">
              <button
                className={`toggle-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="Xem danh sách"
              >
                <List size={18} />
              </button>
              <button
                className={`toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Xem lưới"
              >
                <LayoutGrid size={18} />
              </button>
            </div>

            <button className="btn-secondary" onClick={handleExport}>
              <Download size={18} />
              <span>Xuất</span>
            </button>

            <button
              className="btn-primary"
              onClick={() => {
                if (!canWriteCurrentSection) return;
                if (activeSection === "promotions") {
                  handleOpenModal();
                  return;
                }
                if (activeSection === "coupons") {
                  handleOpenCouponModal();
                  return;
                }
                handleOpenCouponPackageModal();
              }}
              disabled={!canWriteCurrentSection}
              title={canWriteCurrentSection ? currentSection.createLabel : NO_PERMISSION_MESSAGE}
            >
              <Plus size={18} />
              <span>{currentSection.createLabel}</span>
            </button>
          </div>
        </div>

        {!canWriteCurrentSection && (
          <p className="text-xs text-secondary mt-2" title={NO_PERMISSION_MESSAGE}>
            {NO_PERMISSION_MESSAGE}
          </p>
        )}

        {/* C. Content Body */}
        <div className="content-body">
          {(
            activeSection === "promotions"
              ? promotions.length === 0
              : activeSection === "coupons"
                ? coupons.length === 0
                : couponPackages.length === 0
          ) ? (
            <div className="empty-state">
              <Inbox size={48} />
              <h3>Không tìm thấy dữ liệu</h3>
              <p>{currentSection.emptyText}</p>
            </div>
          ) : (
            <>
              {activeSection === "promotions" ? (
                viewMode === "grid" ? (
                  <PromotionsGrid
                    promotions={promotions}
                    onEdit={handleOpenModal}
                    onDelete={handleDelete}
                    onDuplicate={(id) =>
                      runPromotionWriteAction(() => duplicatePromotion(id))
                    }
                  />
                ) : (
                  <div className="table-responsive">
                    <table className="premium-table">
                      <thead>
                        <tr>
                          <th width="25%">Chương trình / Mã</th>
                          <th width="20%">Thời gian</th>
                          <th width="15%">Giảm giá</th>
                          <th width="15%">Hiệu quả</th>
                          <th width="10%">Trạng thái</th>
                          <th width="15%" className="text-right">
                            Hành động
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {promotions.map((item) => (
                          <tr key={item.id}>
                            <td>
                              <div className="fw-bold text-dark mb-1">
                                {item.name}
                              </div>
                              <div className="code-badge">
                                <Copy size={12} /> {item.code}
                              </div>
                            </td>
                            <td className="text-secondary text-sm">
                              <div>{formatDate(item.startDate)}</div>
                              <div className="text-xs">
                                đến {formatDate(item.endDate)}
                              </div>
                            </td>
                            <td className="text-primary font-bold">
                              {formatPromotionValue(item)}
                            </td>
                            <td>
                              <div className="usage-bar">
                                <div className="bar-bg">
                                  <div
                                    className="bar-fill"
                                    style={{
                                      width: `${Math.min(
                                        ((item.usageCount || 0) /
                                          (item.usageLimit || 100)) *
                                          100,
                                        100,
                                      )}%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="text-xs text-secondary mt-1 block">
                                  {item.usageCount || 0} lượt dùng
                                </span>
                              </div>
                            </td>
                            <td>{renderStatusBadge(item.status)}</td>
                            <td className="text-right">
                              <div className="action-buttons">
                                <button
                                  onClick={() =>
                                    runPromotionWriteAction(() => duplicatePromotion(item.id))
                                  }
                                  disabled={!canWritePromotion}
                                  title={promotionActionTitle || "Nhân bản"}
                                >
                                  <Copy size={16} />
                                </button>
                                <button
                                  onClick={() => handleOpenModal(item)}
                                  disabled={!canWritePromotion}
                                  title={promotionActionTitle || "Sửa"}
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  disabled={!canWritePromotion}
                                  title={promotionActionTitle || "Xóa"}
                                  className="text-danger"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : activeSection === "coupons" ? (
                renderCouponTable()
              ) : (
                renderCouponPackageTable()
              )}
            </>
          )}
        </div>

        {/* D. Pagination */}
        <div className="pagination-footer">
          <span className="showing-text">
            Hiển thị <b>{currentCount}</b> trên <b>{totalCount}</b> kết quả
          </span>
          <div className="pagination-controls">
            <button disabled>
              <ChevronLeft size={16} />
            </button>
            <button className="active">1</button>
            <button>2</button>
            <button>...</button>
            <button>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 4. MODAL */}
      {isModalOpen && canWritePromotion && (
        <PromotionModal
          promotion={editingPromotion}
          restaurants={promotionRestaurants}
          defaultRestaurantId={selectedRestaurantId}
          categories={categories}
          menuItems={menuItems}
          onSave={handleSavePromotion}
          onClose={handleCloseModal}
        />
      )}

      {isCouponModalOpen && canWriteCoupon && (
        <CouponModal
          coupon={editingCoupon}
          onSave={handleSaveCoupon}
          onClose={handleCloseCouponModal}
        />
      )}

      {isCouponPackageModalOpen && canWriteCoupon && (
        <CouponPackageModal
          couponPackage={editingCouponPackage}
          availableCoupons={allCoupons}
          onSave={handleSaveCouponPackage}
          onClose={handleCloseCouponPackageModal}
        />
      )}
    </div>
  );
};

export default PromotionManagement;
