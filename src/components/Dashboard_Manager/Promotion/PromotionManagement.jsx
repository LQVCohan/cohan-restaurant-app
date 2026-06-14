import React, { useContext, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Edit3,
  Eye,
  FilterX,
  Inbox,
  PauseCircle,
  PlayCircle,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import {
  hasPermission,
  NO_PERMISSION_MESSAGE,
} from "@/utils/frontendPermissionAccess";
import { useCouponAnalytics } from "../../../hooks/useCouponAnalytics";
import { usePromotionAnalytics } from "../../../hooks/usePromotionAnalytics";
import StatsCard from "./components/StatsCard/StatsCard";
import PromotionModal from "./components/PromotionModal/PromotionModal";
import CouponModal from "./components/CouponModal/CouponModal";
import CouponPackageModal from "./components/CouponPackageModal/CouponPackageModal";
import { COUPON_CATEGORIES } from "../../../utils/constants";
import { downloadXlsxWorkbook } from "../../../utils/xlsxWorkbook";
import { usePromotions } from "../../../hooks/usePromotions";
import { useCoupons } from "../../../hooks/useCoupons";
import "./PromotionManagement.scss";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import ManagerCommandBar from "../shared/ManagerCommandBar";

const STATUS_TABS = [
  { id: "all", label: "Tất cả" },
  { id: "active", label: "Đang chạy" },
  { id: "scheduled", label: "Sắp tới" },
  { id: "expired", label: "Đã xong" },
  { id: "draft", label: "Nháp" },
];

const STATUS_META = {
  active: { label: "Đang chạy", tone: "active" },
  scheduled: { label: "Sắp tới", tone: "scheduled" },
  expired: { label: "Hết hạn", tone: "expired" },
  draft: { label: "Nháp", tone: "draft" },
};

const PROMOTION_TYPE_LABELS = {
  all: "Tất cả loại",
  percentage: "Giảm phần trăm",
  fixed: "Giảm tiền",
  freeship: "Freeship",
  bogo: "Mua tặng",
  combo: "Combo",
};

const DATE_FILTER_LABELS = {
  all: "Mọi thời gian",
  today: "Đang hiệu lực hôm nay",
  week: "Trong 7 ngày tới",
  expiring: "Sắp hết hạn 72h",
};

const SECTION_META = {
  promotions: {
    title: "Quản lý khuyến mãi",
    subtitle: "Tạo chương trình theo mùa, combo, BOGO, freeship và ưu đãi theo món.",
    emptyTitle: "Chưa có chương trình phù hợp",
    emptyText: "Tạo chương trình mới hoặc đổi bộ lọc để xem các ưu đãi đang vận hành.",
    createLabel: "Tạo khuyến mãi",
    permission: "promotion.write",
  },
  coupons: {
    title: "Quản lý coupon",
    subtitle: "Theo dõi mã nhập tay, điều kiện áp dụng, dùng chồng và lịch công bố.",
    emptyTitle: "Chưa có coupon phù hợp",
    emptyText: "Tạo coupon cho khách mới, khách VIP hoặc chiến dịch giao hàng.",
    createLabel: "Tạo coupon",
    permission: "coupon.write",
  },
  couponPackages: {
    title: "Quản lý gói coupon",
    subtitle: "Gộp nhiều coupon thành một gói phát cho từng nhóm khách hàng.",
    emptyTitle: "Chưa có gói coupon phù hợp",
    emptyText: "Tạo gói coupon để gom ưu đãi onboarding, sinh nhật hoặc chăm sóc khách cũ.",
    createLabel: "Tạo gói coupon",
    permission: "coupon.write",
  },
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatCompactCurrency = (value) => {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1000000) return `₫${(number / 1000000).toFixed(1)}M`;
  return formatCurrency(number);
};

const formatDate = (dateStr) => {
  if (!dateStr) return "--";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getDateRange = (filter) => {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  const inSevenDays = new Date(now);
  inSevenDays.setDate(now.getDate() + 7);
  const inThreeDays = new Date(now);
  inThreeDays.setHours(now.getHours() + 72);

  if (filter === "today") return { start: startToday, end: endToday, mode: "overlap" };
  if (filter === "week") return { start: startToday, end: inSevenDays, mode: "overlap" };
  if (filter === "expiring") return { start: now, end: inThreeDays, mode: "end-only" };
  return null;
};

const matchesDateFilter = (item, filter) => {
  if (!filter || filter === "all") return true;
  const range = getDateRange(filter);
  if (!range) return true;

  const start = item.startDate ? new Date(item.startDate) : null;
  const end = item.endDate ? new Date(item.endDate) : null;
  const startMs = start && !Number.isNaN(start.getTime()) ? start.getTime() : null;
  const endMs = end && !Number.isNaN(end.getTime()) ? end.getTime() : null;

  if (range.mode === "end-only") {
    return Boolean(endMs && endMs >= range.start.getTime() && endMs <= range.end.getTime());
  }

  const rangeStart = range.start.getTime();
  const rangeEnd = range.end.getTime();
  const itemStart = startMs || Number.NEGATIVE_INFINITY;
  const itemEnd = endMs || Number.POSITIVE_INFINITY;
  return itemStart <= rangeEnd && itemEnd >= rangeStart;
};

const getUsageRatio = (item) => {
  const used = Number(item.usageCount || 0);
  const limit = Number(item.usageLimit || 0);
  if (!limit) return used > 0 ? 100 : 0;
  return Math.min(Math.round((used / limit) * 100), 100);
};

const getPromotionValue = (promotion) => {
  if (promotion.type === "bogo") {
    return `Mua ${promotion.buyQuantity || 1} tặng ${promotion.getQuantity || 1}`;
  }
  if (promotion.type === "freeship") return "Freeship";
  if (promotion.type === "percentage") return `${promotion.discountValue || 0}%`;
  if (promotion.type === "combo" && promotion.discountType === "percent") {
    return `${promotion.discountValue || 0}% combo`;
  }
  return formatCompactCurrency(promotion.discountValue);
};

const getCouponValue = (coupon) =>
  coupon.discountType === "percent"
    ? `${coupon.discountValue || 0}%`
    : formatCompactCurrency(coupon.discountValue);

const normalizeStatus = (status) => STATUS_META[status] || STATUS_META.draft;

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
  const [isCouponPackageModalOpen, setIsCouponPackageModalOpen] = useState(false);
  const [editingCouponPackage, setEditingCouponPackage] = useState(null);
  const [viewMode, setViewMode] = useState("list");
  const [activeTab, setActiveTab] = useState("all");
  const [activeSection, setActiveSection] = useState("promotions");
  const [promotionTypeFilter, setPromotionTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [detailDrawer, setDetailDrawer] = useState(null);

  const selectedRestaurant = useMemo(
    () =>
      promotionRestaurants.find(
        (restaurant) => String(restaurant.id) === String(selectedRestaurantId || ""),
      ) || null,
    [promotionRestaurants, selectedRestaurantId],
  );

  const selectedRestaurantLabel =
    selectedRestaurant?.name || `Restaurant-${selectedRestaurantId || "all"}`;

  const filteredPromotions = useMemo(
    () =>
      promotions.filter((promotion) => {
        const matchesType =
          promotionTypeFilter === "all" || promotion.type === promotionTypeFilter;
        return matchesType && matchesDateFilter(promotion, dateFilter);
      }),
    [promotions, promotionTypeFilter, dateFilter],
  );

  const filteredCoupons = useMemo(
    () => coupons.filter((coupon) => matchesDateFilter(coupon, dateFilter)),
    [coupons, dateFilter],
  );

  const filteredCouponPackages = useMemo(
    () =>
      couponPackages.filter((couponPackage) =>
        matchesDateFilter(couponPackage, dateFilter),
      ),
    [couponPackages, dateFilter],
  );

  const sectionRows = {
    promotions: filteredPromotions,
    coupons: filteredCoupons,
    couponPackages: filteredCouponPackages,
  };

  const currentRows = sectionRows[activeSection] || [];
  const currentSection = SECTION_META[activeSection];
  const currentCount = currentRows.length;
  const totalCount =
    activeSection === "promotions"
      ? allPromotions.length
      : activeSection === "coupons"
        ? allCoupons.length
        : allCouponPackages.length;
  const canWriteCurrentSection =
    activeSection === "promotions" ? canWritePromotion : canWriteCoupon;

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
  }, [
    activeSection,
    couponAnalytics,
    promotionAnalytics,
    allCouponPackages,
    resolveStatus,
  ]);

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
        savings: "Chi phí giảm giá",
        usage: "Tỷ lệ sử dụng",
        total: "Lượt dùng Coupon",
        hot: "Top Coupon",
      };
    }

    return {
      savings: "Chi phí giảm giá",
      usage: "Tỷ lệ sử dụng",
      total: "Lượt dùng Promotion",
      hot: "Top Promotion",
    };
  }, [activeSection]);

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
    if (!Array.isArray(promotion.comboItems) || !promotion.comboItems.length) return "";
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
    if (promotion.type === "combo") {
      return promotion.discountType === "fixed" ? "COMBO_FIXED" : "COMBO_PERCENT";
    }
    return promotion.discountType === "fixed" ? "FIXED" : "PERCENTAGE";
  };

  const getDetailMeta = (section, item) => {
    if (!item) return null;

    if (section === "coupons") {
      return {
        title: item.name,
        code: item.code,
        status: resolveStatus(item),
        value: getCouponValue(item),
        type: COUPON_CATEGORIES[item.category] || item.category || "Coupon",
        scope: (item.orderTypes || []).length
          ? item.orderTypes.join(", ")
          : "Mọi loại đơn",
        minOrderValue: item.minOrderValue,
        maxDiscount: item.maxDiscount,
        usageCount: item.usageCount,
        usageLimit: item.usageLimit,
        startDate: item.startDate,
        endDate: item.endDate,
        description: item.description,
        conditions: item.conditions || [],
        ruleLines: [
          item.stackable ? "Cho phép dùng chung coupon" : "Không dùng chồng coupon",
          item.combinableWithPromotions
            ? "Có thể đi cùng promotion"
            : "Không đi cùng promotion",
          item.exclusive ? "Ưu đãi độc quyền" : "Không độc quyền",
          item.firstOrderOnly ? "Chỉ đơn đầu tiên" : "Không giới hạn đơn đầu tiên",
        ],
      };
    }

    if (section === "couponPackages") {
      const packageCoupons = (item.couponIds || [])
        .map((couponId) => allCoupons.find((coupon) => String(coupon.id) === String(couponId)))
        .filter(Boolean);
      return {
        title: item.name,
        code: item.code,
        status: resolveStatus(item),
        value: `${packageCoupons.length || item.couponIds?.length || 0} coupon`,
        type: "Gói coupon",
        scope: "Phát theo nhóm khách hàng",
        usageCount: packageCoupons.reduce(
          (sum, coupon) => sum + Number(coupon.usageCount || 0),
          0,
        ),
        usageLimit: packageCoupons.reduce(
          (sum, coupon) => sum + Number(coupon.usageLimit || 0),
          0,
        ),
        startDate: item.startDate,
        endDate: item.endDate,
        description: item.description,
        conditions: item.conditions || [],
        ruleLines: packageCoupons.length
          ? packageCoupons.map((coupon) => `${coupon.code} · ${coupon.name}`)
          : ["Chưa gắn coupon vào gói"],
      };
    }

    return {
      title: item.name,
      code: item.code,
      status: item.status,
      value: getPromotionValue(item),
      type: PROMOTION_TYPE_LABELS[item.type] || item.type,
      scope: resolvePromotionTargetLabel(item),
      minOrderValue: item.minOrderValue,
      maxDiscount: item.maxDiscount,
      usageCount: item.usageCount,
      usageLimit: item.usageLimit,
      startDate: item.startDate,
      endDate: item.endDate,
      description: item.description,
      conditions: item.conditions || [],
      ruleLines: [
        item.type === "bogo" && resolveGiftItemLabel(item)
          ? `Món tặng: ${resolveGiftItemLabel(item)}`
          : null,
        item.type === "combo" && resolveComboItemsLabel(item)
          ? `Combo: ${resolveComboItemsLabel(item)}`
          : null,
        item.stacking ? "Cho phép dùng chung coupon hợp lệ" : "Không dùng chung coupon",
        `Độ ưu tiên: ${item.level || 1}`,
      ].filter(Boolean),
    };
  };

  const buildExportSheets = () => {
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
              "Giới hạn",
              "Trạng thái",
              "Bắt đầu",
              "Kết thúc",
              "Nhà hàng",
            ],
            ...filteredCoupons.map((coupon) => [
              coupon.name,
              coupon.code,
              COUPON_CATEGORIES[coupon.category] || coupon.category,
              getCouponValue(coupon),
              coupon.minOrderValue,
              coupon.maxDiscount,
              coupon.usageCount,
              coupon.usageLimit,
              resolveStatus(coupon),
              coupon.startDate,
              coupon.endDate,
              selectedRestaurantLabel,
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
            ["Tên gói", "Mã", "Coupon", "Trạng thái", "Bắt đầu", "Kết thúc", "Nhà hàng", "Điều kiện"],
            ...filteredCouponPackages.map((couponPackage) => [
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
              resolveStatus(couponPackage),
              couponPackage.startDate,
              couponPackage.endDate,
              selectedRestaurantLabel,
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
            "Giảm giá",
            "Đơn tối thiểu",
            "Giảm tối đa",
            "Đã dùng",
            "Giới hạn",
            "Bắt đầu",
            "Kết thúc",
            "Trạng thái",
            "Nhà hàng",
            "Mô tả",
            "Điều kiện",
          ],
          ...filteredPromotions.map((promotion) => [
            promotion.name,
            promotion.code,
            resolvePromotionDiscountKind(promotion),
            resolvePromotionTargetLabel(promotion),
            getPromotionValue(promotion),
            promotion.minOrderValue,
            promotion.maxDiscount,
            promotion.usageCount,
            promotion.usageLimit,
            promotion.startDate,
            promotion.endDate,
            promotion.status,
            selectedRestaurantLabel,
            promotion.description,
            (promotion.conditions || []).join(" | "),
          ]),
        ],
      },
    ];
  };

  const handleExport = () => {
    if (!currentRows.length) return;
    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadXlsxWorkbook(
      buildExportSheets(),
      `promotion-${activeSection}-${selectedRestaurantId || "all"}-${dateSuffix}.xlsx`,
    );
  };

  const handleOpenPromotionModal = (promotion = null) => {
    if (!canWritePromotion) return;
    setEditingPromotion(promotion);
    setIsModalOpen(true);
  };

  const handleOpenCouponModal = (coupon = null) => {
    if (!canWriteCoupon) return;
    setEditingCoupon(coupon);
    setIsCouponModalOpen(true);
  };

  const handleOpenCouponPackageModal = (couponPackage = null) => {
    if (!canWriteCoupon) return;
    setEditingCouponPackage(couponPackage);
    setIsCouponPackageModalOpen(true);
  };

  const handleCreateCurrent = () => {
    if (!canWriteCurrentSection) return;
    if (activeSection === "promotions") handleOpenPromotionModal();
    else if (activeSection === "coupons") handleOpenCouponModal();
    else handleOpenCouponPackageModal();
  };

  const handleTemplateOpen = (sectionId) => {
    setActiveSection(sectionId);
    setActiveTab("all");
    setDetailDrawer(null);
    requestAnimationFrame(() => {
      if (sectionId === "promotions") handleOpenPromotionModal();
      else if (sectionId === "coupons") handleOpenCouponModal();
      else handleOpenCouponPackageModal();
    });
  };

  const handleSavePromotion = async (promotionData) => {
    if (!canWritePromotion) return;
    try {
      const targetRestaurantId = editingPromotion
        ? await updatePromotion(editingPromotion.id, promotionData)
        : await addPromotion(promotionData);

      if (targetRestaurantId && String(targetRestaurantId) !== String(selectedRestaurantId)) {
        updateFilters({ restaurant: targetRestaurantId });
      }
      setIsModalOpen(false);
      setEditingPromotion(null);
    } catch (error) {
      console.error("Khong the luu khuyen mai.", error);
    }
  };

  const handleSaveCoupon = async (couponData) => {
    if (!canWriteCoupon) return;
    try {
      if (editingCoupon) await updateCoupon(editingCoupon.id, couponData);
      else await addCoupon(couponData);
      setIsCouponModalOpen(false);
      setEditingCoupon(null);
    } catch (error) {
      console.error("Khong the luu coupon.", error);
    }
  };

  const handleSaveCouponPackage = async (packageData) => {
    if (!canWriteCoupon) return;
    try {
      if (editingCouponPackage) await updateCouponPackage(editingCouponPackage.id, packageData);
      else await addCouponPackage(packageData);
      setIsCouponPackageModalOpen(false);
      setEditingCouponPackage(null);
    } catch (error) {
      console.error("Khong the luu goi coupon.", error);
    }
  };

  const handleDeletePromotion = (id) => {
    if (!canWritePromotion) return;
    if (window.confirm("Bạn có chắc chắn muốn xóa khuyến mãi này?")) {
      deletePromotion(id);
    }
  };

  const handleDeleteCoupon = (id) => {
    if (!canWriteCoupon) return;
    if (window.confirm("Bạn có chắc chắn muốn xóa coupon này?")) {
      deleteCoupon(id);
    }
  };

  const handleDeleteCouponPackage = (id) => {
    if (!canWriteCoupon) return;
    if (window.confirm("Bạn có chắc chắn muốn xóa gói coupon này?")) {
      deleteCouponPackage(id);
    }
  };

  const handleTogglePromotionStatus = async (promotion) => {
    if (!canWritePromotion) return;
    const nextStatus = promotion.status === "active" ? "draft" : "active";
    await updatePromotion(promotion.id, { ...promotion, status: nextStatus });
  };

  const handleToggleCouponStatus = async (coupon) => {
    if (!canWriteCoupon) return;
    const nextStatus = resolveStatus(coupon) === "active" ? "draft" : "active";
    await updateCoupon(coupon.id, { ...coupon, status: nextStatus });
  };

  const handleToggleCouponPackageStatus = async (couponPackage) => {
    if (!canWriteCoupon) return;
    const nextStatus = resolveStatus(couponPackage) === "active" ? "draft" : "active";
    await updateCouponPackage(couponPackage.id, { ...couponPackage, status: nextStatus });
  };

  const handleStatusTabChange = (tabId) => {
    setActiveTab(tabId);
    setDetailDrawer(null);
    if (activeSection === "promotions") updateFilters({ status: tabId });
    else if (activeSection === "coupons") updateCouponFilters({ status: tabId });
    else updateCouponPackageFilters({ status: tabId });
  };

  const handleClearFilters = () => {
    setActiveTab("all");
    setPromotionTypeFilter("all");
    setDateFilter("all");
    setDetailDrawer(null);
    if (activeSection === "promotions") {
      updateFilters({ search: "", status: "all", restaurant: selectedRestaurantId });
    } else if (activeSection === "coupons") {
      updateCouponFilters({ search: "", category: "all", status: "all" });
    } else {
      updateCouponPackageFilters({ search: "", status: "all" });
    }
  };

  const searchValue =
    activeSection === "promotions"
      ? filters.search
      : activeSection === "coupons"
        ? couponFilters.search
        : couponPackageFilters.search;

  const hasActiveFilters =
    dateFilter !== "all" ||
    (activeSection === "promotions"
      ? filters.search || filters.status !== "all" || promotionTypeFilter !== "all"
      : activeSection === "coupons"
        ? couponFilters.search || couponFilters.status !== "all" || couponFilters.category !== "all"
        : couponPackageFilters.search || couponPackageFilters.status !== "all");

  const promotionSearchPlaceholder =
    activeSection === "promotions"
      ? "Tìm chương trình, mã..."
      : activeSection === "coupons"
        ? "Tìm coupon, mã..."
        : "Tìm gói coupon, mã...";

  const renderStatusBadge = (status) => {
    const conf = normalizeStatus(status);
    return (
      <span className={`promo-status-badge promo-status-badge--${conf.tone}`}>
        {conf.label}
      </span>
    );
  };

  const renderUsage = (item) => {
    const ratio = getUsageRatio(item);
    return (
      <div className="usage-bar">
        <div className="bar-bg">
          <div className="bar-fill" style={{ width: `${ratio}%` }} />
        </div>
        <span className="text-xs text-secondary mt-1 block">
          {Number(item.usageCount || 0).toLocaleString("vi-VN")}
          {item.usageLimit ? ` / ${Number(item.usageLimit).toLocaleString("vi-VN")}` : " lượt dùng"}
        </span>
      </div>
    );
  };

  const renderActionButtons = (section, item) => {
    const isPromotion = section === "promotions";
    const isPackage = section === "couponPackages";
    const canWrite = isPromotion ? canWritePromotion : canWriteCoupon;
    const status = isPromotion ? item.status : resolveStatus(item);
    const disabledTitle = canWrite ? undefined : NO_PERMISSION_MESSAGE;

    return (
      <div className="action-buttons">
        <button
          type="button"
          onClick={() => setDetailDrawer({ section, item })}
          title="Xem chi tiết"
          aria-label="Xem chi tiết"
        >
          <Eye size={16} />
        </button>
        <button
          type="button"
          disabled={!canWrite}
          title={disabledTitle || "Nhân bản"}
          aria-label="Nhân bản"
          onClick={() => {
            if (!canWrite) return;
            if (isPromotion) duplicatePromotion(item.id);
            else if (isPackage) duplicateCouponPackage(item.id);
            else duplicateCoupon(item.id);
          }}
        >
          <Copy size={16} />
        </button>
        <button
          type="button"
          disabled={!canWrite}
          title={disabledTitle || (status === "active" ? "Tạm dừng" : "Kích hoạt")}
          aria-label={status === "active" ? "Tạm dừng" : "Kích hoạt"}
          onClick={() => {
            if (!canWrite) return;
            if (isPromotion) handleTogglePromotionStatus(item);
            else if (isPackage) handleToggleCouponPackageStatus(item);
            else handleToggleCouponStatus(item);
          }}
        >
          {status === "active" ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
        </button>
        <button
          type="button"
          disabled={!canWrite}
          title={disabledTitle || "Sửa"}
          aria-label="Sửa"
          onClick={() => {
            if (!canWrite) return;
            if (isPromotion) handleOpenPromotionModal(item);
            else if (isPackage) handleOpenCouponPackageModal(item);
            else handleOpenCouponModal(item);
          }}
        >
          <Edit3 size={16} />
        </button>
        <button
          type="button"
          disabled={!canWrite}
          title={disabledTitle || "Xóa"}
          aria-label="Xóa"
          className="text-danger"
          onClick={() => {
            if (!canWrite) return;
            if (isPromotion) handleDeletePromotion(item.id);
            else if (isPackage) handleDeleteCouponPackage(item.id);
            else handleDeleteCoupon(item.id);
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  };

  const renderPromotionGrid = () => (
    <div className="promotion-grid">
      {filteredPromotions.map((promotion) => (
        <article className="promotion-tile" key={promotion.id}>
          <div className="promotion-tile__topline">
            {renderStatusBadge(promotion.status)}
            <span className="promotion-type-chip">
              {PROMOTION_TYPE_LABELS[promotion.type] || promotion.type}
            </span>
          </div>
          <div className="promotion-tile__value">{getPromotionValue(promotion)}</div>
          <h3>{promotion.name}</h3>
          <div className="code-badge"><Tag size={12} /> {promotion.code || "NO-CODE"}</div>
          <div className="promotion-tile__meta">
            <span>{resolvePromotionTargetLabel(promotion)}</span>
            <span>{formatDate(promotion.startDate)} – {formatDate(promotion.endDate)}</span>
          </div>
          {renderUsage(promotion)}
          <div className="promotion-tile__actions">
            {renderActionButtons("promotions", promotion)}
          </div>
        </article>
      ))}
    </div>
  );

  const renderPromotionTable = () => (
    <div className="table-responsive">
      <table className="premium-table promotion-table">
        <thead>
          <tr>
            <th>Chương trình / Mã</th>
            <th>Loại</th>
            <th>Phạm vi</th>
            <th>Hiệu lực</th>
            <th>Giảm giá</th>
            <th>Hiệu quả</th>
            <th>Trạng thái</th>
            <th className="text-right">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filteredPromotions.map((promotion) => (
            <tr key={promotion.id}>
              <td>
                <div className="fw-bold text-dark mb-1">{promotion.name}</div>
                <div className="code-badge"><Tag size={12} /> {promotion.code || "NO-CODE"}</div>
              </td>
              <td className="text-secondary text-sm">
                {PROMOTION_TYPE_LABELS[promotion.type] || promotion.type}
              </td>
              <td className="text-secondary text-sm">
                <div>{resolvePromotionTargetLabel(promotion)}</div>
                {promotion.type === "bogo" && resolveGiftItemLabel(promotion) ? (
                  <div className="text-xs">Tặng: {resolveGiftItemLabel(promotion)}</div>
                ) : null}
                {promotion.type === "combo" && resolveComboItemsLabel(promotion) ? (
                  <div className="text-xs">{resolveComboItemsLabel(promotion)}</div>
                ) : null}
              </td>
              <td className="text-secondary text-sm">
                <div>{formatDate(promotion.startDate)}</div>
                <div className="text-xs">đến {formatDate(promotion.endDate)}</div>
              </td>
              <td className="text-primary font-bold">{getPromotionValue(promotion)}</td>
              <td>{renderUsage(promotion)}</td>
              <td>{renderStatusBadge(promotion.status)}</td>
              <td className="text-right">{renderActionButtons("promotions", promotion)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderCouponTable = () => (
    <div className="table-responsive">
      <table className="premium-table coupon-table">
        <thead>
          <tr>
            <th>Coupon / Mã</th>
            <th>Nhóm</th>
            <th>Hiệu lực</th>
            <th>Giảm giá</th>
            <th>Dùng chồng</th>
            <th>Hiệu quả</th>
            <th>Trạng thái</th>
            <th className="text-right">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filteredCoupons.map((coupon) => (
            <tr key={coupon.id}>
              <td>
                <div className="fw-bold text-dark mb-1">{coupon.name}</div>
                <div className="code-badge"><Tag size={12} /> {coupon.code}</div>
              </td>
              <td className="text-secondary text-sm">
                {COUPON_CATEGORIES[coupon.category] || coupon.category}
              </td>
              <td className="text-secondary text-sm">
                <div>{formatDate(coupon.startDate)}</div>
                <div className="text-xs">đến {formatDate(coupon.endDate)}</div>
              </td>
              <td className="text-primary font-bold">{getCouponValue(coupon)}</td>
              <td className="text-secondary text-sm">
                <div className="coupon-stack-flags">
                  {coupon.combinableWithPromotions && <span className="coupon-chip">+ Promotion</span>}
                  {coupon.stackable && <span className="coupon-chip">+ Coupon</span>}
                  {coupon.exclusive && <span className="coupon-chip coupon-chip-danger">Độc quyền</span>}
                  {!coupon.combinableWithPromotions && !coupon.stackable && !coupon.exclusive && (
                    <span className="text-xs text-muted">Không dùng chồng</span>
                  )}
                </div>
              </td>
              <td>{renderUsage(coupon)}</td>
              <td>{renderStatusBadge(resolveStatus(coupon))}</td>
              <td className="text-right">{renderActionButtons("coupons", coupon)}</td>
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
            <th>Gói coupon / Mã</th>
            <th>Coupon trong gói</th>
            <th>Hiệu lực</th>
            <th>Trạng thái</th>
            <th className="text-right">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filteredCouponPackages.map((couponPackage) => (
            <tr key={couponPackage.id}>
              <td>
                <div className="fw-bold text-dark mb-1">{couponPackage.name}</div>
                <div className="code-badge"><Tag size={12} /> {couponPackage.code}</div>
              </td>
              <td>
                <div className="coupon-pack-list">
                  {(couponPackage.couponIds || []).slice(0, 4).map((couponId) => {
                    const coupon = allCoupons.find((item) => String(item.id) === String(couponId));
                    return (
                      <span key={couponId} className="coupon-chip">
                        {coupon ? coupon.name : `#${couponId}`}
                      </span>
                    );
                  })}
                  {(couponPackage.couponIds || []).length > 4 && (
                    <span className="coupon-chip">+{couponPackage.couponIds.length - 4}</span>
                  )}
                </div>
              </td>
              <td className="text-secondary text-sm">
                <div>{formatDate(couponPackage.startDate)}</div>
                <div className="text-xs">đến {formatDate(couponPackage.endDate)}</div>
              </td>
              <td>{renderStatusBadge(resolveStatus(couponPackage))}</td>
              <td className="text-right">{renderActionButtons("couponPackages", couponPackage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderEmptyState = () => (
    <div className="empty-state empty-state--actionable">
      <Inbox size={48} />
      <h3>{currentSection.emptyTitle}</h3>
      <p>{currentSection.emptyText}</p>
      <button
        type="button"
        className="btn-empty-primary"
        onClick={handleCreateCurrent}
        disabled={!canWriteCurrentSection}
        title={canWriteCurrentSection ? currentSection.createLabel : NO_PERMISSION_MESSAGE}
      >
        <Plus size={16} />
        <span>{currentSection.createLabel}</span>
      </button>
      <div className="quick-template-row" aria-label="Gợi ý tạo nhanh">
        <button type="button" onClick={() => handleTemplateOpen("coupons")} disabled={!canWriteCoupon}>
          NEW10 khách mới
        </button>
        <button type="button" onClick={() => handleTemplateOpen("promotions")} disabled={!canWritePromotion}>
          Combo trưa
        </button>
        <button type="button" onClick={() => handleTemplateOpen("promotions")} disabled={!canWritePromotion}>
          Freeship đơn lớn
        </button>
      </div>
    </div>
  );

  const renderDetailDrawer = () => {
    if (!detailDrawer) return null;
    const meta = getDetailMeta(detailDrawer.section, detailDrawer.item);
    if (!meta) return null;
    const ratio = getUsageRatio(meta);

    return (
      <div className="promo-detail-overlay" onClick={() => setDetailDrawer(null)}>
        <aside className="promo-detail-drawer" onClick={(event) => event.stopPropagation()}>
          <div className="promo-detail-drawer__header">
            <div>
              <span className="promo-detail-eyebrow">Chi tiết hiệu quả</span>
              <h2>{meta.title}</h2>
              <div className="code-badge"><Tag size={12} /> {meta.code || "NO-CODE"}</div>
            </div>
            <button type="button" onClick={() => setDetailDrawer(null)} aria-label="Đóng chi tiết">
              <X size={18} />
            </button>
          </div>

          <div className="promo-detail-summary">
            <div>
              <span>Giá trị ưu đãi</span>
              <strong>{meta.value}</strong>
            </div>
            <div>
              <span>Trạng thái</span>
              {renderStatusBadge(meta.status)}
            </div>
          </div>

          <div className="promo-detail-metrics">
            <div>
              <span>Đã dùng</span>
              <strong>{Number(meta.usageCount || 0).toLocaleString("vi-VN")}</strong>
            </div>
            <div>
              <span>Giới hạn</span>
              <strong>{meta.usageLimit ? Number(meta.usageLimit).toLocaleString("vi-VN") : "Không giới hạn"}</strong>
            </div>
            <div>
              <span>Tỷ lệ dùng</span>
              <strong>{ratio}%</strong>
            </div>
          </div>

          <section className="promo-detail-section">
            <h3>Điều kiện vận hành</h3>
            <dl>
              <div><dt>Loại</dt><dd>{meta.type}</dd></div>
              <div><dt>Phạm vi</dt><dd>{meta.scope}</dd></div>
              <div><dt>Đơn tối thiểu</dt><dd>{meta.minOrderValue ? formatCurrency(meta.minOrderValue) : "Không yêu cầu"}</dd></div>
              <div><dt>Giảm tối đa</dt><dd>{meta.maxDiscount ? formatCurrency(meta.maxDiscount) : "Không giới hạn"}</dd></div>
              <div><dt>Hiệu lực</dt><dd>{formatDate(meta.startDate)} – {formatDate(meta.endDate)}</dd></div>
            </dl>
          </section>

          <section className="promo-detail-section">
            <h3>Quy tắc áp dụng</h3>
            <ul>
              {(meta.ruleLines || []).map((line) => <li key={line}>{line}</li>)}
              {(meta.conditions || []).map((line) => <li key={line}>{line}</li>)}
              {!meta.ruleLines?.length && !meta.conditions?.length && <li>Chưa có điều kiện bổ sung.</li>}
            </ul>
          </section>

          <section className="promo-detail-section promo-detail-history">
            <h3>Lịch sử sử dụng</h3>
            {Number(meta.usageCount || 0) > 0 ? (
              <p>Hệ thống đã ghi nhận {Number(meta.usageCount).toLocaleString("vi-VN")} lượt sử dụng. Kết nối API đơn hàng để xem từng hóa đơn áp mã.</p>
            ) : (
              <p>Chưa có lượt sử dụng nào cho ưu đãi này.</p>
            )}
          </section>

          <div className="promo-detail-actions">
            {renderActionButtons(detailDrawer.section, detailDrawer.item)}
          </div>
        </aside>
      </div>
    );
  };

  return (
    <div className="promotion-manager-page">
      <ManagementPageHeader
        density="compact"
        showTimeWidget={false}
        eyebrow="PROMOTION MANAGER"
        title="Khuyến mãi"
        subtitle="Quản lý campaign, coupon, điều kiện và thời gian hiệu lực."
        icon="🎁"
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={(value) => updateFilters({ restaurant: value })}
        restaurantList={promotionRestaurants.map((restaurant) => ({
          id: restaurant.id,
          name: restaurant.name || `Nhà hàng ${restaurant.id}`,
        }))}
        stats={[
          { id: "total", icon: "📦", label: "Tổng", value: totalCount },
          { id: "active", icon: "🟢", label: "Đang chạy", value: currentRows.filter((item) => (activeSection === "promotions" ? item.status : resolveStatus(item)) === "active").length },
          { id: "scheduled", icon: "🗓️", label: "Sắp tới/Nháp", value: statsData.hotPromotions },
          { id: "usage", icon: "🎯", label: "Lượt dùng", value: statsData.totalUsage },
        ]}
      />

      <ManagerCommandBar
        tabs={[
          { id: "promotions", label: "Chương trình khuyến mãi" },
          { id: "coupons", label: "Coupon" },
          { id: "couponPackages", label: "Gói Coupon" },
        ]}
        activeTab={activeSection}
        onTabChange={(sectionId) => {
          setActiveSection(sectionId);
          setActiveTab("all");
          setViewMode(sectionId === "promotions" ? "list" : "list");
          setDetailDrawer(null);
          if (sectionId === "promotions") updateFilters({ status: "all" });
          else if (sectionId === "coupons") updateCouponFilters({ status: "all" });
          else updateCouponPackageFilters({ status: "all" });
        }}
        searchValue={searchValue}
        searchPlaceholder={promotionSearchPlaceholder}
        onSearchChange={(value) => {
          if (activeSection === "promotions") updateFilters({ search: value });
          else if (activeSection === "coupons") updateCouponFilters({ search: value });
          else updateCouponPackageFilters({ search: value });
        }}
        filters={(
          <>
            {activeSection === "promotions" && (
              <div className="dropdown-filter">
                <select
                  aria-label="Lọc loại khuyến mãi"
                  value={promotionTypeFilter}
                  onChange={(event) => setPromotionTypeFilter(event.target.value)}
                >
                  {Object.entries(PROMOTION_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            )}
            {activeSection === "coupons" && (
              <div className="dropdown-filter">
                <select
                  aria-label="Lọc nhóm coupon"
                  value={couponFilters.category}
                  onChange={(event) => updateCouponFilters({ category: event.target.value })}
                >
                  <option value="all">Tất cả nhóm</option>
                  {Object.entries(COUPON_CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            )}
            <div className="dropdown-filter dropdown-filter--date">
              <select
                aria-label="Lọc thời gian hiệu lực"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
              >
                {Object.entries(DATE_FILTER_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </div>
            <button className="btn-clear-filter" onClick={handleClearFilters} disabled={!hasActiveFilters} type="button">
              <FilterX size={14} />
              <span>Xóa lọc</span>
            </button>
          </>
        )}
        viewMode={activeSection === "promotions" ? viewMode : undefined}
        onViewModeChange={activeSection === "promotions" ? setViewMode : undefined}
        actions={[
          {
            label: "Xuất",
            icon: <Download size={18} />,
            onClick: handleExport,
            disabled: !currentCount,
          },
          {
            label: currentSection.createLabel,
            icon: <Plus size={18} />,
            variant: "primary",
            disabled: !canWriteCurrentSection,
            title: canWriteCurrentSection ? currentSection.createLabel : NO_PERMISSION_MESSAGE,
            onClick: handleCreateCurrent,
          },
        ]}
      />

      <section className="stats-section">
        <StatsCard stats={statsData} labels={statsLabels} />
      </section>

      {activeSection === "coupons" && couponAnalyticsError && (
        <p className="promotion-inline-alert promotion-inline-alert--danger">
          <AlertTriangle size={14} /> Chưa tải được thống kê Coupon. Danh sách vẫn hiển thị bình thường.
        </p>
      )}
      {activeSection === "coupons" && couponAnalyticsLoading && (
        <p className="promotion-inline-alert"><BarChart3 size={14} /> Đang cập nhật thống kê Coupon...</p>
      )}
      {activeSection === "promotions" && promotionAnalyticsError && (
        <p className="promotion-inline-alert promotion-inline-alert--danger">
          <AlertTriangle size={14} /> Chưa tải được thống kê Promotion, đang hiển thị giá trị mặc định.
        </p>
      )}
      {activeSection === "promotions" && promotionAnalyticsLoading && (
        <p className="promotion-inline-alert"><BarChart3 size={14} /> Đang cập nhật thống kê Promotion...</p>
      )}

      <div className="main-content-card">
        <div className="promotion-section-head">
          <div>
            <p>{currentSection.subtitle}</p>
            <h2>{currentSection.title}</h2>
          </div>
          <div className="promotion-section-head__meta">
            <CalendarClock size={15} />
            <span>{DATE_FILTER_LABELS[dateFilter]}</span>
          </div>
        </div>

        <div className="tabs-header">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleStatusTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!canWriteCurrentSection && (
          <p className="text-xs text-secondary mt-2" title={NO_PERMISSION_MESSAGE}>
            {NO_PERMISSION_MESSAGE}
          </p>
        )}

        <div className="content-body">
          {currentRows.length === 0 ? (
            renderEmptyState()
          ) : activeSection === "promotions" ? (
            viewMode === "grid" ? renderPromotionGrid() : renderPromotionTable()
          ) : activeSection === "coupons" ? (
            renderCouponTable()
          ) : (
            renderCouponPackageTable()
          )}
        </div>

        <div className="pagination-footer">
          <span className="showing-text">
            Hiển thị <b>{currentCount}</b> trên <b>{totalCount}</b> kết quả
          </span>
          <div className="pagination-controls" aria-label="Phân trang khuyến mãi">
            <button type="button" disabled><ChevronLeft size={16} /></button>
            <button type="button" className="active">1</button>
            <button type="button" disabled={totalCount <= currentCount}>2</button>
            <button type="button" disabled>...</button>
            <button type="button" disabled={totalCount <= currentCount}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {renderDetailDrawer()}

      {isModalOpen && canWritePromotion && (
        <PromotionModal
          promotion={editingPromotion}
          restaurants={promotionRestaurants}
          defaultRestaurantId={selectedRestaurantId}
          categories={categories}
          menuItems={menuItems}
          onSave={handleSavePromotion}
          onClose={() => {
            setIsModalOpen(false);
            setEditingPromotion(null);
          }}
        />
      )}

      {isCouponModalOpen && canWriteCoupon && (
        <CouponModal
          coupon={editingCoupon}
          onSave={handleSaveCoupon}
          onClose={() => {
            setIsCouponModalOpen(false);
            setEditingCoupon(null);
          }}
        />
      )}

      {isCouponPackageModalOpen && canWriteCoupon && (
        <CouponPackageModal
          couponPackage={editingCouponPackage}
          availableCoupons={allCoupons}
          onSave={handleSaveCouponPackage}
          onClose={() => {
            setIsCouponPackageModalOpen(false);
            setEditingCouponPackage(null);
          }}
        />
      )}
    </div>
  );
};

export default PromotionManagement;
