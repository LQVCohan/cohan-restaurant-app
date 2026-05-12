import React, { useState, useMemo } from "react";
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

// --- Components ---
// Giả định bạn đã lưu các file này từ các bước trước
import StatsCard from "./components/StatsCard/StatsCard";
import PromotionsGrid from "./components/PromotionsGrid/PromotionsGrid";
import PromotionModal from "./components/PromotionModal/PromotionModal";
import VoucherModal from "./components/VoucherModal/VoucherModal";
import CouponPackageModal from "./components/VoucherPackageModal/VoucherPackageModal";
import { VOUCHER_CATEGORIES } from "../../../utils/constants";
import { downloadXlsxWorkbook } from "../../../utils/xlsxWorkbook";

// --- Hooks ---
import { usePromotions } from "../../../hooks/usePromotions";
import { useCoupons } from "../../../hooks/useCoupons";

// --- Styles ---
import "./PromotionManagement.scss";

const PromotionManagement = () => {
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
    vouchers,
    allCoupons,
    voucherFilters,
    updateVoucherFilters,
    addVoucher,
    updateVoucher,
    deleteVoucher,
    duplicateVoucher,
    packages,
    allPackages,
    packageFilters,
    updatePackageFilters,
    addPackage,
    updatePackage,
    deletePackage,
    duplicatePackage,
    resolveStatus,
  } = useCoupons(selectedRestaurantId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
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

  const buildExportSheets = () => {
    const restaurantName =
      selectedRestaurant?.name || `Restaurant-${selectedRestaurantId || "all"}`;

    if (activeSection === "vouchers") {
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
              "Công bố",
              "Bắt đầu",
              "Kết thúc",
              "Trạng thái",
              "Nhà hàng",
            ],
            ...vouchers.map((voucher) => [
              voucher.name,
              voucher.code,
              VOUCHER_CATEGORIES[voucher.category] || voucher.category,
              voucher.discountType === "percent"
                ? `${voucher.discountValue}%`
                : voucher.discountValue,
              voucher.minOrderValue,
              voucher.maxDiscount,
              voucher.usageLimit,
              voucher.usageCount,
              voucher.publishAt,
              voucher.startDate,
              voucher.endDate,
              resolveStatus(voucher),
              restaurantName,
            ]),
          ],
        },
      ];
    }

    if (activeSection === "packages") {
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
            ...packages.map((pkg) => [
              pkg.name,
              pkg.code,
              (pkg.voucherIds || [])
                .map((voucherId) => {
                  const voucher = allCoupons.find(
                    (item) => String(item.id) === String(voucherId),
                  );
                  return voucher?.name || voucherId;
                })
                .join(", "),
              pkg.publishAt,
              pkg.startDate,
              pkg.endDate,
              resolveStatus(pkg),
              restaurantName,
              (pkg.conditions || []).join(" | "),
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
        : activeSection === "vouchers"
          ? vouchers
          : packages;

    if (!rows.length) return;

    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadXlsxWorkbook(
      buildExportSheets(),
      `promotion-${activeSection}-${selectedRestaurantId || "all"}-${dateSuffix}.xlsx`,
    );
  };

  // --- Derived Data (Tính toán số liệu) ---
  const statsData = useMemo(() => {
    if (activeSection === "vouchers") {
      const totalUsage = allCoupons.reduce(
        (sum, v) => sum + (v.usageCount || 0),
        0,
      );
      const totalLimit = allCoupons.reduce(
        (sum, v) => sum + (v.usageLimit || 0),
        0,
      );
      const totalSavings = allCoupons.reduce(
        (sum, v) => sum + (v.discountValue || 0) * (v.usageCount || 0),
        0,
      );

      return {
        totalSavings,
        usageRate: totalLimit ? Math.round((totalUsage / totalLimit) * 100) : 0,
        totalUsage,
        hotPromotions: allCoupons.filter((v) => (v.usageCount || 0) > 100)
          .length,
      };
    }

    if (activeSection === "packages") {
      const activePackages = allPackages.filter(
        (pkg) => resolveStatus(pkg) === "active",
      ).length;
      const totalUsage = allPackages.length;

      return {
        totalSavings: allPackages.length * 50000,
        usageRate: totalUsage
          ? Math.round((activePackages / totalUsage) * 100)
          : 0,
        totalUsage,
        hotPromotions: allPackages.filter(
          (pkg) => resolveStatus(pkg) === "scheduled",
        ).length,
      };
    }

    return {
      totalSavings: allPromotions.reduce((sum, p) => {
        const usage = Number(p.usageCount || 0);
        const discountValue = Number(p.discountValue || 0);
        const perUsage =
          p.type === "percentage"
            ? Math.min(
                (Number(p.minOrderValue || 0) * discountValue) / 100,
                Number(p.maxDiscount || Number.MAX_SAFE_INTEGER),
              )
            : discountValue;
        return sum + Math.max(0, perUsage) * usage;
      }, 0),
      usageRate: 45,
      totalUsage: allPromotions.reduce(
        (sum, p) => sum + (p.usageCount || 0),
        0,
      ),
      hotPromotions: allPromotions.filter((p) => p.usageCount > 100).length, // Ví dụ logic
    };
  }, [activeSection, allPromotions, allCoupons, allPackages, resolveStatus]);

  // --- Handlers ---
  const handleOpenModal = (promotion = null) => {
    setEditingPromotion(promotion);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPromotion(null);
  };

  const handleSavePromotion = async (promotionData) => {
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
    if (window.confirm("Bạn có chắc chắn muốn xóa khuyến mãi này?")) {
      deletePromotion(id);
    }
  };

  const handleOpenVoucherModal = (voucher = null) => {
    setEditingVoucher(voucher);
    setIsVoucherModalOpen(true);
  };

  const handleCloseVoucherModal = () => {
    setIsVoucherModalOpen(false);
    setEditingVoucher(null);
  };

  const handleSaveVoucher = async (voucherData) => {
    try {
      if (editingVoucher) {
        await updateVoucher(editingVoucher.id, voucherData);
      } else {
        await addVoucher(voucherData);
      }
      handleCloseVoucherModal();
    } catch (error) {
      console.error("Khong the luu coupon.", error);
    }
  };

  const handleDeleteVoucher = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa coupon này?")) {
      deleteVoucher(id);
    }
  };

  const handleOpenPackageModal = (voucherPackage = null) => {
    setEditingPackage(voucherPackage);
    setIsPackageModalOpen(true);
  };

  const handleClosePackageModal = () => {
    setIsPackageModalOpen(false);
    setEditingPackage(null);
  };

  const handleSavePackage = async (packageData) => {
    try {
      if (editingPackage) {
        await updatePackage(editingPackage.id, packageData);
      } else {
        await addPackage(packageData);
      }
      handleClosePackageModal();
    } catch (error) {
      console.error("Khong the luu goi coupon.", error);
    }
  };

  const handleDeletePackage = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa gói Coupon này?")) {
      deletePackage(id);
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
    vouchers: {
      title: "Quản Lý Coupon",
      subtitle:
        "Quản lý coupon theo nhóm món ăn, đặt bàn, đặt món và shipping.",
      emptyText: "Thử thay đổi bộ lọc hoặc tạo coupon mới.",
      createLabel: "Tạo coupon",
    },
    packages: {
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
    if (activeSection === "vouchers") {
      updateVoucherFilters({ status: tabId });
      return;
    }
    updatePackageFilters({ status: tabId });
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
    if (activeSection === "vouchers") {
      updateVoucherFilters({ search: "", category: "all", status: "all" });
      return;
    }
    updatePackageFilters({ search: "", status: "all" });
  };

  const searchValue =
    activeSection === "promotions"
      ? filters.search
      : activeSection === "vouchers"
        ? voucherFilters.search
        : packageFilters.search;

  const hasActiveFilters =
    activeSection === "promotions"
      ? filters.search || filters.status !== "all"
      : activeSection === "vouchers"
        ? voucherFilters.search ||
          voucherFilters.status !== "all" ||
          voucherFilters.category !== "all"
        : packageFilters.search || packageFilters.status !== "all";

  const currentCount =
    activeSection === "promotions"
      ? promotions.length
      : activeSection === "vouchers"
        ? vouchers.length
        : packages.length;

  const totalCount =
    activeSection === "promotions"
      ? allPromotions.length
      : activeSection === "vouchers"
        ? allCoupons.length
        : allPackages.length;

  const renderVoucherTable = () => (
    <div className="table-responsive">
      <table className="premium-table voucher-table">
        <thead>
          <th width="25%">Coupon / Mã</th>
          <th width="15%">Nhóm</th>
          <th width="16%">Hiệu lực</th>
          <th width="14%">Giảm giá</th>
          <th width="14%">Dùng chồng</th>
          <th width="8%">Trạng thái</th>
          <th width="8%" className="text-right">
            Hành động
          </th>
        </thead>
        <tbody>
          {vouchers.map((voucher) => (
            <tr key={voucher.id}>
              <td>
                <div className="fw-bold text-dark mb-1">{voucher.name}</div>
                <div className="code-badge">
                  <Copy size={12} /> {voucher.code}
                </div>
                {voucher.publishAt && (
                  <div className="text-xs text-secondary mt-1">
                    Công bố: {formatDate(voucher.publishAt)}
                  </div>
                )}
              </td>
              <td className="text-secondary text-sm">
                {VOUCHER_CATEGORIES[voucher.category] || voucher.category}
              </td>
              <td className="text-secondary text-sm">
                <div>{formatDate(voucher.startDate)}</div>
                <div className="text-xs">đến {formatDate(voucher.endDate)}</div>
              </td>
              <td className="text-primary font-bold">
                {voucher.discountType === "percent"
                  ? `${voucher.discountValue}%`
                  : `${Number(voucher.discountValue || 0).toLocaleString()}đ`}
              </td>
              <td>{renderStatusBadge(resolveStatus(voucher))}</td>
              <td className="text-secondary text-sm">
                <div className="voucher-stack-flags">
                  {voucher.combinableWithPromotions && (
                    <span className="voucher-chip">+ Promotion</span>
                  )}
                  {voucher.stackable && (
                    <span className="voucher-chip">+ Coupon</span>
                  )}
                  {voucher.exclusive && (
                    <span className="voucher-chip voucher-chip-danger">
                      Độc quyền
                    </span>
                  )}
                  {!voucher.combinableWithPromotions &&
                    !voucher.stackable &&
                    !voucher.exclusive && (
                      <span className="text-xs text-muted">
                        Không dùng chồng
                      </span>
                    )}
                </div>
                <div className="text-xs text-secondary mt-1">
                  Ưu tiên: {voucher.priority || 0}
                </div>
              </td>
              <td className="text-right">
                <div className="action-buttons">
                  <button
                    onClick={() => duplicateVoucher(voucher.id)}
                    title="Nhân bản"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => handleOpenVoucherModal(voucher)}
                    title="Sửa"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteVoucher(voucher.id)}
                    title="Xóa"
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

  const renderPackageTable = () => (
    <div className="table-responsive">
      <table className="premium-table voucher-table">
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
          {packages.map((pkg) => (
            <tr key={pkg.id}>
              <td>
                <div className="fw-bold text-dark mb-1">{pkg.name}</div>
                <div className="code-badge">
                  <Copy size={12} /> {pkg.code}
                </div>
                {pkg.publishAt && (
                  <div className="text-xs text-secondary mt-1">
                    Công bố: {formatDate(pkg.publishAt)}
                  </div>
                )}
              </td>
              <td>
                <div className="voucher-pack-list">
                  {(pkg.voucherIds || []).map((voucherId) => {
                    const voucher = allCoupons.find(
                      (item) => item.id === voucherId,
                    );
                    return (
                      <span key={voucherId} className="voucher-chip">
                        {voucher ? voucher.name : `#${voucherId}`}
                      </span>
                    );
                  })}
                </div>
              </td>
              <td className="text-secondary text-sm">
                <div>{formatDate(pkg.startDate)}</div>
                <div className="text-xs">đến {formatDate(pkg.endDate)}</div>
              </td>
              <td>{renderStatusBadge(resolveStatus(pkg))}</td>
              <td className="text-right">
                <div className="action-buttons">
                  <button
                    onClick={() => duplicatePackage(pkg.id)}
                    title="Nhân bản"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => handleOpenPackageModal(pkg)}
                    title="Sửa"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeletePackage(pkg.id)}
                    title="Xóa"
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
          { id: "vouchers", label: "Coupon" },
          { id: "packages", label: "Gói Coupon" },
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
              } else if (section.id === "vouchers") {
                updateVoucherFilters({ status: "all" });
              } else {
                updatePackageFilters({ status: "all" });
              }
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* 2. STATS */}
      <section className="stats-section">
        <StatsCard stats={statsData} />
      </section>

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
                    : activeSection === "vouchers"
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
                  if (activeSection === "vouchers") {
                    updateVoucherFilters({ search: value });
                    return;
                  }
                  updatePackageFilters({ search: value });
                }}
              />
            </div>

            {activeSection === "vouchers" ? (
              <div className="dropdown-filter">
                <select
                  value={voucherFilters.category}
                  onChange={(event) =>
                    updateVoucherFilters({ category: event.target.value })
                  }
                >
                  <option value="all">Tất cả nhóm</option>
                  {Object.entries(VOUCHER_CATEGORIES).map(([key, label]) => (
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
                if (activeSection === "promotions") {
                  handleOpenModal();
                  return;
                }
                if (activeSection === "vouchers") {
                  handleOpenVoucherModal();
                  return;
                }
                handleOpenPackageModal();
              }}
            >
              <Plus size={18} />
              <span>{currentSection.createLabel}</span>
            </button>
          </div>
        </div>

        {/* C. Content Body */}
        <div className="content-body">
          {(
            activeSection === "promotions"
              ? promotions.length === 0
              : activeSection === "vouchers"
                ? vouchers.length === 0
                : packages.length === 0
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
                    onDuplicate={duplicatePromotion}
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
                                  onClick={() => duplicatePromotion(item.id)}
                                  title="Nhân bản"
                                >
                                  <Copy size={16} />
                                </button>
                                <button
                                  onClick={() => handleOpenModal(item)}
                                  title="Sửa"
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  title="Xóa"
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
              ) : activeSection === "vouchers" ? (
                renderVoucherTable()
              ) : (
                renderPackageTable()
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
      {isModalOpen && (
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

      {isVoucherModalOpen && (
        <VoucherModal
          voucher={editingVoucher}
          onSave={handleSaveVoucher}
          onClose={handleCloseVoucherModal}
        />
      )}

      {isPackageModalOpen && (
        <CouponPackageModal
          voucherPackage={editingPackage}
          availableCoupons={allCoupons}
          onSave={handleSavePackage}
          onClose={handleClosePackageModal}
        />
      )}
    </div>
  );
};

export default PromotionManagement;
