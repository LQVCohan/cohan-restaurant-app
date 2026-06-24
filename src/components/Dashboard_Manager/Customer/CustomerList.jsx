// src/pages/CustomerManagement/CustomerList.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  SearchX,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import CustomerCard from "./CustomerCard";
import "./CustomerList.scss";
import "./CustomerExperiencePolish.css";
import "./CustomerOperationsPolish.scss";
import "./CustomerManagerWorkflow.scss";
import "./CustomerManagerScale.scss";
import "./CustomerPaginationSafe.scss";
import "./CustomerFullCardPagination.scss";

const CUSTOMER_VISIBLE_PAGE_SIZE = 9;

const normalizeEpochToMs = (v) => {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(Math.floor(v)).length === 10 ? v * 1000 : v;
  }
  if (typeof v === "string") {
    if (/^\d+$/.test(v.trim())) {
      const n = Number(v.trim());
      return String(n).length === 10 ? n * 1000 : n;
    }
    const p = Date.parse(v);
    return Number.isFinite(p) ? p : null;
  }
  return null;
};

const formatMoney = (amount) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

const formatDate = (date) => {
  const ms = normalizeEpochToMs(date);
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString("vi-VN") : "—";
};

const getEntryAmount = (entry) => {
  if (entry?.raw?.totals?.grandTotal != null)
    return Number(entry.raw.totals.grandTotal);
  if (Array.isArray(entry?.raw?.items) && entry.raw.items.length) {
    return entry.raw.items.reduce(
      (sum, it) =>
        sum +
        (Number(it?.price || 0) + Number(it?.modifiersPrice || 0)) *
          Number(it?.quantity || 1),
      0,
    );
  }
  return Number(entry?.amount) || 0;
};

const getCustomerStats = (customer) => {
  const orders = Array.isArray(customer?.recentOrders)
    ? customer.recentOrders
    : [];
  const sortedOrders = [...orders].sort((a, b) => {
    const ams =
      normalizeEpochToMs(a?.raw?.createdAt ?? a?.createdAt ?? a?.date) ?? 0;
    const bms =
      normalizeEpochToMs(b?.raw?.createdAt ?? b?.createdAt ?? b?.date) ?? 0;
    return bms - ams;
  });
  const total = sortedOrders.reduce(
    (sum, entry) => sum + getEntryAmount(entry),
    0,
  );
  return {
    orderCount: sortedOrders.length,
    total,
    lastOrder: sortedOrders[0],
  };
};

const triggerAddCustomer = () => {
  const addButton = [...document.querySelectorAll("button")].find((button) =>
    button.textContent?.toLowerCase().includes("thêm khách"),
  );
  addButton?.click();
};

const clearSearchInput = () => {
  const input = document.querySelector(
    ".manager-command-bar .mcb-search input",
  );
  if (!input) return;
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  valueSetter?.call(input, "");
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const triggerClearFilters = () => {
  clearSearchInput();
  const allFilter = [...document.querySelectorAll(".cm-pill")].find((button) =>
    button.textContent?.toLowerCase().includes("tất cả"),
  );
  allFilter?.click();
};

const CustomerTable = ({ customers, onCustomerClick }) => (
  <div
    className="cl-table-card"
    role="region"
    aria-label="Bảng khách hàng"
  >
    <table className="cl-table">
      <thead>
        <tr>
          <th>Khách hàng</th>
          <th>Liên hệ</th>
          <th>Hạng khách</th>
          <th>Điểm</th>
          <th>Số đơn</th>
          <th>Chi tiêu</th>
          <th>Mua gần nhất</th>
          <th>Loại tài khoản</th>
        </tr>
      </thead>
      <tbody>
        {customers.map((customer) => {
          const stats = getCustomerStats(customer);
          const displayName =
            customer?.displayName || customer?.name || "Khách hàng";
          return (
            <tr
              key={customer.id}
              tabIndex={0}
              role="button"
              onClick={() => onCustomerClick?.(customer)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onCustomerClick?.(customer);
                }
              }}
            >
              <td>
                <div className="cl-table-customer">
                  <span className="cl-table-avatar">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <strong>{displayName}</strong>
                    <small>#{String(customer?.id || "").slice(-6) || "—"}</small>
                  </div>
                </div>
              </td>
              <td>
                <div className="cl-table-contact">
                  <span>{customer?.phone || "Chưa có số điện thoại"}</span>
                  <small>{customer?.email || "Chưa có email"}</small>
                </div>
              </td>
              <td>
                <span className="cl-table-badge">
                  {customer?.rankName || customer?.customerType || "Mới"}
                </span>
              </td>
              <td>
                {Number(customer?.loyaltyPoints || 0).toLocaleString("vi-VN")}
              </td>
              <td>{stats.orderCount}</td>
              <td>{formatMoney(stats.total)}</td>
              <td>
                {formatDate(
                  stats.lastOrder?.raw?.createdAt ||
                    stats.lastOrder?.date ||
                    customer?.joinDate,
                )}
              </td>
              <td>
                {customer?.isGuest ? "Khách vãng lai" : "Có tài khoản"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const CustomerList = ({ customers, loading, onCustomerClick, pagination }) => {
  const [viewMode, setViewMode] = useState("grid");
  const [localPage, setLocalPage] = useState(1);
  const listAnchorRef = useRef(null);
  const didMountRef = useRef(false);
  const totalLoaded = customers?.length || 0;
  const hasCustomers = totalLoaded > 0;
  const backendPage = Math.max(1, Number(pagination?.page || 1));
  const backendPageSize = Math.max(
    1,
    Number(pagination?.pageSize || totalLoaded || 1),
  );
  const totalCount = Number(pagination?.totalCount || totalLoaded || 0);
  const visiblePageSize = CUSTOMER_VISIBLE_PAGE_SIZE;
  const localTotalPages = Math.max(
    1,
    Math.ceil(totalLoaded / visiblePageSize),
  );
  const totalVirtualPageCount = Math.max(
    1,
    Math.ceil(totalCount / visiblePageSize),
  );
  const backendOffset = (backendPage - 1) * backendPageSize;
  const localStartIndex = (localPage - 1) * visiblePageSize;
  const localEndIndex = localStartIndex + visiblePageSize;
  const visibleCustomers = useMemo(
    () => (customers || []).slice(localStartIndex, localEndIndex),
    [customers, localEndIndex, localStartIndex],
  );
  const currentVirtualPage = Math.max(
    1,
    Math.floor(backendOffset / visiblePageSize) + localPage,
  );
  const startItem =
    totalCount > 0 ? backendOffset + localStartIndex + 1 : 0;
  const endItem =
    totalCount > 0
      ? Math.min(
          totalCount,
          backendOffset + localStartIndex + visibleCustomers.length,
        )
      : 0;
  const hasPreviousLocalPage = localPage > 1;
  const hasNextLocalPage = localPage < localTotalPages;
  const hasPreviousPage =
    hasPreviousLocalPage || Boolean(pagination?.hasPreviousPage);
  const hasNextPage = hasNextLocalPage || Boolean(pagination?.hasNextPage);
  const hasPagination = hasCustomers;

  const scrollListToTop = () => {
    window.requestAnimationFrame(() => {
      listAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  useEffect(() => {
    setLocalPage(1);
  }, [customers, backendPage, backendPageSize]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    scrollListToTop();
  }, [localPage, backendPage, backendPageSize, viewMode]);

  const managerSummary = useMemo(() => {
    if (loading || pagination?.isLoading)
      return "Đang tải danh sách khách...";
    if (!totalCount) return "Chưa có khách phù hợp";
    return `Trang ${currentVirtualPage}/${totalVirtualPageCount} • ${startItem}-${endItem} / ${totalCount.toLocaleString("vi-VN")} khách`;
  }, [
    currentVirtualPage,
    endItem,
    loading,
    pagination?.isLoading,
    startItem,
    totalCount,
    totalVirtualPageCount,
  ]);

  const handlePreviousPage = () => {
    scrollListToTop();
    if (hasPreviousLocalPage) {
      setLocalPage((current) => Math.max(1, current - 1));
      return;
    }
    pagination?.onPrevious?.();
  };

  const handleNextPage = () => {
    scrollListToTop();
    if (hasNextLocalPage) {
      setLocalPage((current) => Math.min(localTotalPages, current + 1));
      return;
    }
    pagination?.onNext?.();
  };

  const handleViewModeChange = (nextMode) => {
    setViewMode(nextMode);
    setLocalPage(1);
    scrollListToTop();
  };

  const renderPager = (compact = false, showPageSize = false) => (
    <div
      className={`cl-pagination ${compact ? "cl-pagination--inline" : ""}`}
      aria-label="Phân trang khách hàng"
    >
      <button
        type="button"
        onClick={handlePreviousPage}
        disabled={loading || pagination?.isLoading || !hasPreviousPage}
        title="Trang trước"
        aria-label="Chuyển đến trang trước"
      >
        <ChevronLeft size={15} /> Trước
      </button>
      <span>
        Trang <strong>{currentVirtualPage}</strong> / {totalVirtualPageCount}
      </span>
      {showPageSize ? <span>{visiblePageSize}/trang</span> : <span aria-hidden="true" className="sr-only">{visiblePageSize} mỗi trang</span>}
      <button
        type="button"
        onClick={handleNextPage}
        disabled={loading || pagination?.isLoading || !hasNextPage}
        title="Trang sau"
        aria-label="Chuyển đến trang sau"
      >
        Sau <ChevronRight size={15} />
      </button>
    </div>
  );

  const renderManagerStrip = () => (
    <div
      ref={listAnchorRef}
      className="cl-manager-strip cl-manager-strip--with-pagination"
    >
      <div>
        <span className="cl-strip-label">Danh sách khách</span>
        <strong>{managerSummary}</strong>
      </div>
      <div className="cl-strip-tools">
        {hasPagination ? renderPager(true) : null}
        <div className="cl-view-toggle" aria-label="Kiểu hiển thị danh sách">
          <button
            type="button"
            className={viewMode === "grid" ? "is-active" : ""}
            onClick={() => handleViewModeChange("grid")}
            title="Hiển thị dạng lưới"
          >
            <LayoutGrid size={14} /> Lưới
          </button>
          <button
            type="button"
            className={viewMode === "table" ? "is-active" : ""}
            onClick={() => handleViewModeChange("table")}
            disabled={!hasCustomers}
            title="Hiển thị dạng bảng"
          >
            <List size={14} /> Bảng
          </button>
        </div>
      </div>
    </div>
  );

  const renderBottomPager = () => {
    if (!hasPagination) return null;
    return (
      <div
        className="cl-bottom-pagination-bar"
        aria-label="Phân trang cuối danh sách"
      >
        <strong>{managerSummary}</strong>
        {renderPager(true, true)}
      </div>
    );
  };

  if (loading) {
    return (
      <>
        {renderManagerStrip()}
        <div className="cl-grid cl-grid--nine-page">
          {Array.from({ length: CUSTOMER_VISIBLE_PAGE_SIZE }).map((_, index) => (
            <div key={index} className="cl-skeleton-card">
              <div className="cl-sk-header">
                <div className="cl-sk-avatar" />
                <div className="cl-sk-info">
                  <div className="cl-sk-line w-60" />
                  <div className="cl-sk-line w-40" />
                </div>
              </div>
              <div className="cl-sk-body">
                <div className="cl-sk-line w-80" />
                <div className="cl-sk-line w-50" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {renderManagerStrip()}

      {!hasCustomers ? (
        <div className="cl-empty-state">
          <div className="cl-empty-icon">
            <SearchX size={42} strokeWidth={1.2} />
          </div>
          <h3 className="cl-empty-title">Chưa tìm thấy khách hàng</h3>
          <p className="cl-empty-desc">
            Hãy thử đổi từ khóa, điều chỉnh bộ lọc hoặc thêm khách hàng mới.
          </p>
          <div className="cl-empty-actions">
            <button
              type="button"
              className="cl-empty-primary"
              onClick={triggerAddCustomer}
            >
              <Plus size={15} /> Thêm khách hàng
            </button>
            <button
              type="button"
              className="cl-empty-secondary"
              onClick={triggerClearFilters}
            >
              <RotateCcw size={15} /> Xóa bộ lọc
            </button>
          </div>
        </div>
      ) : viewMode === "table" ? (
        <>
          <CustomerTable
            customers={visibleCustomers}
            onCustomerClick={onCustomerClick}
          />
          {renderBottomPager()}
        </>
      ) : (
        <>
          <div className="cl-grid cl-grid--nine-page">
            {visibleCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                onClick={onCustomerClick}
              />
            ))}
          </div>
          {renderBottomPager()}
        </>
      )}
    </>
  );
};

export default CustomerList;
