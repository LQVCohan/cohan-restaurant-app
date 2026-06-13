// src/pages/CustomerManagement/CustomerList.jsx
import React, { useMemo, useState } from "react";
import { SearchX, LayoutGrid, List, Plus, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import CustomerCard from "./CustomerCard";
import "./CustomerList.scss";
import "./CustomerExperiencePolish.css";
import "./CustomerOperationsPolish.scss";
import "./CustomerManagerWorkflow.scss";

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
  if (entry?.raw?.totals?.grandTotal != null) return Number(entry.raw.totals.grandTotal);
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
  const orders = Array.isArray(customer?.recentOrders) ? customer.recentOrders : [];
  const sortedOrders = [...orders].sort((a, b) => {
    const ams = normalizeEpochToMs(a?.raw?.createdAt ?? a?.createdAt ?? a?.date) ?? 0;
    const bms = normalizeEpochToMs(b?.raw?.createdAt ?? b?.createdAt ?? b?.date) ?? 0;
    return bms - ams;
  });
  const total = sortedOrders.reduce((sum, entry) => sum + getEntryAmount(entry), 0);
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
  const input = document.querySelector(".manager-command-bar .mcb-search input");
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
  <div className="cl-table-card" role="region" aria-label="Bảng khách hàng">
    <table className="cl-table">
      <thead>
        <tr>
          <th>Khách hàng</th>
          <th>Liên hệ</th>
          <th>Hạng</th>
          <th>Điểm</th>
          <th>Đơn gần đây</th>
          <th>Chi tiêu gần đây</th>
          <th>Lần cuối mua</th>
          <th>Loại</th>
        </tr>
      </thead>
      <tbody>
        {customers.map((customer) => {
          const stats = getCustomerStats(customer);
          const displayName = customer?.displayName || customer?.name || "Khách hàng";
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
                  <span className="cl-table-avatar">{displayName.charAt(0).toUpperCase()}</span>
                  <div>
                    <strong>{displayName}</strong>
                    <small>#{String(customer?.id || "").slice(-6) || "—"}</small>
                  </div>
                </div>
              </td>
              <td>
                <div className="cl-table-contact">
                  <span>{customer?.phone || "Chưa có SĐT"}</span>
                  <small>{customer?.email || "Chưa có email"}</small>
                </div>
              </td>
              <td><span className="cl-table-badge">{customer?.rankName || customer?.customerType || "Mới"}</span></td>
              <td>{Number(customer?.loyaltyPoints || 0).toLocaleString("vi-VN")}</td>
              <td>{stats.orderCount}</td>
              <td>{formatMoney(stats.total)}</td>
              <td>{formatDate(stats.lastOrder?.raw?.createdAt || stats.lastOrder?.date || customer?.joinDate)}</td>
              <td>{customer?.isGuest ? "Guest" : "Đăng ký"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const CustomerList = ({ customers, loading, onCustomerClick, pagination }) => {
  const [viewMode, setViewMode] = useState("grid");
  const totalLoaded = customers?.length || 0;
  const hasCustomers = totalLoaded > 0;
  const page = Math.max(1, Number(pagination?.page || 1));
  const pageSize = Math.max(1, Number(pagination?.pageSize || totalLoaded || 1));
  const totalCount = Number(pagination?.totalCount || totalLoaded || 0);
  const totalPages = Math.max(1, Number(pagination?.totalPages || Math.ceil(totalCount / pageSize) || 1));
  const startItem = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItem = totalCount > 0 ? Math.min(totalCount, startItem + totalLoaded - 1) : 0;
  const pageSizeOptions = pagination?.pageSizeOptions || [10, 20, 30, 50];

  const managerSummary = useMemo(() => {
    if (loading || pagination?.isLoading) return "Đang tải danh sách khách...";
    if (!totalCount) return "Chưa có khách phù hợp";
    return `Trang ${page}/${totalPages} • ${startItem}-${endItem} / ${totalCount.toLocaleString("vi-VN")} khách`;
  }, [endItem, loading, page, pagination?.isLoading, startItem, totalCount, totalPages]);

  const renderManagerStrip = () => (
    <div className="cl-manager-strip">
      <div>
        <span className="cl-strip-label">Danh sách khách</span>
        <strong>{managerSummary}</strong>
      </div>
      <div className="cl-strip-tools">
        <label className="cl-page-size">
          <span>Hiển thị</span>
          <select
            value={pageSize}
            disabled={loading || pagination?.isLoading}
            onChange={(event) => pagination?.onPageSizeChange?.(Number(event.target.value))}
          >
            {pageSizeOptions.map((value) => (
              <option key={value} value={value}>{value}/trang</option>
            ))}
          </select>
        </label>
        <div className="cl-view-toggle" aria-label="Chế độ xem">
          <button
            type="button"
            className={viewMode === "grid" ? "is-active" : ""}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid size={14} /> Lưới
          </button>
          <button
            type="button"
            className={viewMode === "table" ? "is-active" : ""}
            onClick={() => setViewMode("table")}
            disabled={!hasCustomers}
          >
            <List size={14} /> Bảng
          </button>
        </div>
      </div>
    </div>
  );

  const renderPager = () => (
    <div className="cl-pagination" aria-label="Phân trang khách hàng từ backend">
      <button
        type="button"
        onClick={pagination?.onPrevious}
        disabled={loading || pagination?.isLoading || !pagination?.hasPreviousPage}
      >
        <ChevronLeft size={15} /> Trước
      </button>
      <span>Trang <strong>{page}</strong> / {totalPages}</span>
      <button
        type="button"
        onClick={pagination?.onNext}
        disabled={loading || pagination?.isLoading || !pagination?.hasNextPage}
      >
        Sau <ChevronRight size={15} />
      </button>
    </div>
  );

  if (loading) {
    return (
      <>
        {renderManagerStrip()}
        <div className="cl-grid">
          {Array.from({ length: 6 }).map((_, index) => (
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
            Thêm khách mới hoặc xóa bộ lọc để xem lại toàn bộ danh sách.
          </p>
          <div className="cl-empty-actions">
            <button type="button" className="cl-empty-primary" onClick={triggerAddCustomer}>
              <Plus size={15} /> Thêm khách hàng
            </button>
            <button type="button" className="cl-empty-secondary" onClick={triggerClearFilters}>
              <RotateCcw size={15} /> Xóa bộ lọc
            </button>
          </div>
        </div>
      ) : viewMode === "table" ? (
        <CustomerTable customers={customers} onCustomerClick={onCustomerClick} />
      ) : (
        <div className="cl-grid">
          {customers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onClick={onCustomerClick}
            />
          ))}
        </div>
      )}

      {pagination ? renderPager() : null}
    </>
  );
};

export default CustomerList;
