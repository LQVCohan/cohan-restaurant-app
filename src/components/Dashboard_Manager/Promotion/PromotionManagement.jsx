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
import VoucherPackageModal from "./components/VoucherPackageModal/VoucherPackageModal";
import { VOUCHER_CATEGORIES } from "../../../utils/constants";

// --- Hooks ---
import { usePromotions } from "../../../hooks/usePromotions";
import { useVouchers } from "../../../hooks/useVouchers";

// --- Styles ---
import "./PromotionManagement.scss";

const PromotionManagement = () => {
  const {
    promotions,
    allPromotions,
    restaurants: promotionRestaurants,
    selectedRestaurantId,
    filters,
    addPromotion,
    updatePromotion,
    deletePromotion,
    duplicatePromotion,
    updateFilters,
  } = usePromotions();

  const {
    vouchers,
    allVouchers,
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
  } = useVouchers();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // 'list' | 'grid'
  const [activeTab, setActiveTab] = useState("all");
  const [activeSection, setActiveSection] = useState("promotions");

  // --- Derived Data (Tính toán số liệu) ---
  const statsData = useMemo(
    () => {
      if (activeSection === "vouchers") {
        const totalUsage = allVouchers.reduce(
          (sum, v) => sum + (v.usageCount || 0),
          0
        );
        const totalLimit = allVouchers.reduce(
          (sum, v) => sum + (v.usageLimit || 0),
          0
        );
        const totalSavings = allVouchers.reduce(
          (sum, v) =>
            sum + (v.discountValue || 0) * (v.usageCount || 0),
          0
        );

        return {
          totalSavings,
          usageRate: totalLimit ? Math.round((totalUsage / totalLimit) * 100) : 0,
          totalUsage,
          hotPromotions: allVouchers.filter((v) => (v.usageCount || 0) > 100)
            .length,
        };
      }

      if (activeSection === "packages") {
        const activePackages = allPackages.filter(
          (pkg) => resolveStatus(pkg) === "active"
        ).length;
        const totalUsage = allPackages.length;

        return {
          totalSavings: allPackages.length * 50000,
          usageRate: totalUsage
            ? Math.round((activePackages / totalUsage) * 100)
            : 0,
          totalUsage,
          hotPromotions: allPackages.filter(
            (pkg) => resolveStatus(pkg) === "scheduled"
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
                  Number(p.maxDiscount || Number.MAX_SAFE_INTEGER)
                )
              : discountValue;
          return sum + Math.max(0, perUsage) * usage;
        }, 0),
        usageRate: 45,
        totalUsage: allPromotions.reduce(
          (sum, p) => sum + (p.usageCount || 0),
          0
        ),
        hotPromotions: allPromotions.filter((p) => p.usageCount > 100).length, // Ví dụ logic
      };
    },
    [activeSection, allPromotions, allVouchers, allPackages, resolveStatus]
  );

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

  const handleSaveVoucher = (voucherData) => {
    if (editingVoucher) {
      updateVoucher(editingVoucher.id, voucherData);
    } else {
      addVoucher(voucherData);
    }
    handleCloseVoucherModal();
  };

  const handleDeleteVoucher = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa voucher này?")) {
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

  const handleSavePackage = (packageData) => {
    if (editingPackage) {
      updatePackage(editingPackage.id, packageData);
    } else {
      addPackage(packageData);
    }
    handleClosePackageModal();
  };

  const handleDeletePackage = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa gói voucher này?")) {
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
      title: "Quản Lý Voucher",
      subtitle:
        "Quản lý voucher theo nhóm món ăn, đặt bàn, đặt món và shipping.",
      emptyText: "Thử thay đổi bộ lọc hoặc tạo voucher mới.",
      createLabel: "Tạo voucher",
    },
    packages: {
      title: "Quản Lý Gói Voucher",
      subtitle: "Tạo gói voucher cho từng nhóm khách hàng.",
      emptyText: "Thử thay đổi bộ lọc hoặc tạo gói voucher mới.",
      createLabel: "Tạo gói voucher",
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
        ? allVouchers.length
        : allPackages.length;

  const renderVoucherTable = () => (
    <div className="table-responsive">
      <table className="premium-table voucher-table">
        <thead>
          <tr>
            <th width="25%">Voucher / Mã</th>
            <th width="18%">Nhóm</th>
            <th width="18%">Hiệu lực</th>
            <th width="15%">Giảm giá</th>
            <th width="10%">Trạng thái</th>
            <th width="14%" className="text-right">
              Hành động
            </th>
          </tr>
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
                  : `${voucher.discountValue.toLocaleString()}đ`}
              </td>
              <td>{renderStatusBadge(resolveStatus(voucher))}</td>
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
            <th width="30%">Gói voucher / Mã</th>
            <th width="25%">Voucher trong gói</th>
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
                    const voucher = allVouchers.find(
                      (item) => item.id === voucherId
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
          { id: "vouchers", label: "Voucher" },
          { id: "packages", label: "Gói voucher" },
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
                      ? "Tìm kiếm voucher, mã..."
                      : "Tìm kiếm gói voucher, mã..."
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

            <button
              className="btn-secondary"
              onClick={() => alert("Đang xuất file...")}
            >
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
          {(activeSection === "promotions"
            ? promotions.length === 0
            : activeSection === "vouchers"
              ? vouchers.length === 0
              : packages.length === 0) ? (
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
                              {item.type === "percent"
                                ? `${item.discountValue}%`
                                : `${item.discountValue.toLocaleString()}đ`}
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
                                        100
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
        <VoucherPackageModal
          voucherPackage={editingPackage}
          availableVouchers={allVouchers}
          onSave={handleSavePackage}
          onClose={handleClosePackageModal}
        />
      )}
    </div>
  );
};

export default PromotionManagement;
