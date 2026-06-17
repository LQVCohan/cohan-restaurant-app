import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronDown,
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
import { usePromotions } from "../../../hooks/usePromotions";
import { useCoupons } from "../../../hooks/useCoupons";
import { COUPON_CATEGORIES } from "../../../utils/constants";
import { downloadXlsxWorkbook } from "../../../utils/xlsxWorkbook";
import StatsCard from "./components/StatsCard/StatsCard";
import PromotionModal from "./components/PromotionModal/PromotionModal";
import CouponModal from "./components/CouponModal/CouponModal";
import CouponPackageModal from "./components/CouponPackageModal/CouponPackageModal";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import ManagerCommandBar from "../shared/ManagerCommandBar";
import "./PromotionManagement.scss";

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
  today: "Hiệu lực hôm nay",
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
  },
  coupons: {
    title: "Quản lý coupon",
    subtitle: "Theo dõi mã nhập tay, điều kiện áp dụng, dùng chồng và lịch công bố.",
    emptyTitle: "Chưa có coupon phù hợp",
    emptyText: "Tạo coupon cho khách mới, khách VIP hoặc chiến dịch giao hàng.",
    createLabel: "Tạo coupon",
  },
  couponPackages: {
    title: "Quản lý gói coupon",
    subtitle: "Gộp nhiều coupon thành một gói phát cho từng nhóm khách hàng.",
    emptyTitle: "Chưa có gói coupon phù hợp",
    emptyText: "Tạo gói coupon để gom ưu đãi onboarding, sinh nhật hoặc chăm sóc khách cũ.",
    createLabel: "Tạo gói coupon",
  },
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(toNumber(value));

const formatCompactCurrency = (value) => {
  const number = toNumber(value);
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

  const itemStart = startMs || Number.NEGATIVE_INFINITY;
  const itemEnd = endMs || Number.POSITIVE_INFINITY;
  return itemStart <= range.end.getTime() && itemEnd >= range.start.getTime();
};

const getHoursUntilEnd = (item) => {
  if (!item?.endDate) return null;
  const end = new Date(item.endDate).getTime();
  if (!Number.isFinite(end)) return null;
  return Math.round((end - Date.now()) / 36e5);
};

const getUsageRatio = (item) => {
  const used = toNumber(item.usageCount);
  const limit = toNumber(item.usageLimit);
  if (!limit) return used > 0 ? 100 : 0;
  return Math.min(Math.round((used / limit) * 100), 100);
};

const getPromotionValue = (promotion) => {
  if (promotion.type === "bogo") return `Mua ${promotion.buyQuantity || 1} tặng ${promotion.getQuantity || 1}`;
  if (promotion.type === "freeship") return "Freeship";
  if (promotion.type === "percentage") return `${promotion.discountValue || 0}%`;
  if (promotion.type === "combo" && promotion.discountType === "percent") return `${promotion.discountValue || 0}% combo`;
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

  const [activeSection, setActiveSection] = useState("promotions");
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [promotionTypeFilter, setPromotionTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [detailDrawer, setDetailDrawer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [isCouponPackageModalOpen, setIsCouponPackageModalOpen] = useState(false);
  const [editingCouponPackage, setEditingCouponPackage] = useState(null);

  useEffect(() => {
    const body = document.body;
    if (!detailDrawer) {
      body.classList.remove("promotion-detail-lock");
      return undefined;
    }

    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    body.classList.add("promotion-detail-lock");
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      body.classList.remove("promotion-detail-lock");
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [detailDrawer]);

  const selectedRestaurant = useMemo(
    () =>
      promotionRestaurants.find(
        (restaurant) => String(restaurant.id) === String(selectedRestaurantId || ""),
      ) || null,
    [promotionRestaurants, selectedRestaurantId],
  );

  const selectedRestaurantLabel = selectedRestaurant?.name || `Restaurant-${selectedRestaurantId || "all"}`;
