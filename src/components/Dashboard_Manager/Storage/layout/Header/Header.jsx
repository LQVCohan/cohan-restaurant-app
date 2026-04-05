// src/components/Dashboard_Manager/Storage/layout/Header/Header.jsx
import React from "react";
import {
  Package,
  Upload,
  Download,
  FileText,
  FileSpreadsheet,
  Store,
  Warehouse,
  ChevronDown,
  Loader2,
  Coins,
} from "lucide-react";
import "./Header.scss";

/**
 * Props:
 * - restaurantList: [{id, name, ...}]
 * - currentRestaurantId: string
 * - onRestaurantChange: fn(id)
 * - restaurantsLoading: boolean
 * - warehouses: [{id, name}]
 * - selectedWarehouseId: string|null
 * - onWarehouseChange: fn(id|null)
 * - warehousesLoading: boolean
 */
const Header = ({
  restaurantList = [],
  currentRestaurantId = "",
  onRestaurantChange,
  restaurantsLoading = false,
  warehouses = [],
  selectedWarehouseId = null,
  onWarehouseChange,
  warehousesLoading = false,
  activeCurrency = "VND",
  onCurrencyChange,
  manualRate = 26000,
  onManualRateSave,
  currencyLoading = false,
}) => {
  const [rateInput, setRateInput] = React.useState(String(manualRate || 26000));

  React.useEffect(() => {
    setRateInput(String(manualRate || 26000));
  }, [manualRate, currentRestaurantId]);

  // Handlers giữ nguyên
  const handleImportData = () =>
    alert("Chức năng nhập dữ liệu từ Excel sẽ được triển khai");
  const handleExportData = () =>
    alert("Chức năng xuất dữ liệu ra Excel sẽ được triển khai");
  const handleGenerateReport = () =>
    alert("Chức năng tạo báo cáo chi tiết sẽ được triển khai");
  const handleExportSample = () =>
    alert("Chức năng xuất mẫu Excel để nhập nguyên liệu sẽ được triển khai");

  const changeRestaurant = (e) => {
    const id = e.target.value || "";
    onRestaurantChange?.(id);
    onWarehouseChange?.(null);
  };

  const changeWarehouse = (e) => {
    const id = e.target.value || null;
    onWarehouseChange?.(id);
  };

  const isRestaurantDisabled = restaurantsLoading || !restaurantList.length;
  const isWarehouseDisabled =
    warehousesLoading || !currentRestaurantId || !warehouses.length;

  return (
    <div className="sm-header-card">
      {/* --- Top Section: Title & Actions --- */}
      <div className="sm-header-top">
        <div className="title-wrapper">
          <div className="icon-box">
            <Package size={24} color="#c5a47e" />
          </div>
          <h1 className="page-title">Quản lý Kho</h1>
        </div>

        <div className="actions-wrapper">
          <button
            className="sm-btn ghost"
            onClick={handleExportSample}
            title="Xuất mẫu Excel"
          >
            <FileSpreadsheet size={18} />{" "}
            <span className="hide-on-mobile">Mẫu Excel</span>
          </button>
          <div className="divider-vertical"></div>
          <button className="sm-btn secondary" onClick={handleImportData}>
            <Upload size={18} /> <span className="hide-on-mobile">Nhập</span>
          </button>
          <button className="sm-btn secondary" onClick={handleExportData}>
            <Download size={18} /> <span className="hide-on-mobile">Xuất</span>
          </button>
          <button className="sm-btn primary" onClick={handleGenerateReport}>
            <FileText size={18} /> <span>Báo cáo</span>
          </button>
        </div>
      </div>

      {/* --- Bottom Section: Filters --- */}
      <div className="sm-header-filters">
        {/* Restaurant Select */}
        <div className="filter-group">
          <label htmlFor="restaurant-select">
            <Store size={16} /> Nhà hàng
            {restaurantsLoading && <Loader2 size={14} className="spin" />}
          </label>
          <div className="custom-select-wrapper">
            <select
              id="restaurant-select"
              value={currentRestaurantId || ""}
              onChange={changeRestaurant}
              disabled={isRestaurantDisabled}
            >
              <option value="">
                {restaurantsLoading ? "Đang tải..." : "— Chọn nhà hàng —"}
              </option>
              {restaurantList.map((res) => (
                <option key={res.id} value={res.id}>
                  {res.name}
                </option>
              ))}
            </select>
            <ChevronDown className="arrow-icon" size={16} />
          </div>
        </div>

        {/* Warehouse Select */}
        <div className="filter-group">
          <label htmlFor="warehouse-select">
            <Warehouse size={16} /> Kho hàng
            {warehousesLoading && <Loader2 size={14} className="spin" />}
          </label>
          <div className="custom-select-wrapper">
            <select
              id="warehouse-select"
              value={selectedWarehouseId || ""}
              onChange={changeWarehouse}
              disabled={isWarehouseDisabled}
            >
              <option value="">
                {!currentRestaurantId
                  ? "Chọn nhà hàng trước"
                  : warehousesLoading
                  ? "Đang tải..."
                  : "— Tất cả kho —"}
              </option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <ChevronDown className="arrow-icon" size={16} />
          </div>
        </div>

        <div className="filter-group">
          <label htmlFor="currency-select">
            <Coins size={16} /> Tiền tệ
            {currencyLoading && <Loader2 size={14} className="spin" />}
          </label>
          <div className="custom-select-wrapper">
            <select
              id="currency-select"
              value={activeCurrency}
              onChange={(e) => onCurrencyChange?.(e.target.value)}
              disabled={!currentRestaurantId || currencyLoading}
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
            <ChevronDown className="arrow-icon" size={16} />
          </div>
        </div>

        <div className="filter-group">
          <label htmlFor="manual-rate-input">Tỷ giá USD→VND</label>
          <div className="inline-rate">
            <input
              id="manual-rate-input"
              type="number"
              min="1"
              step="1"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              disabled={!currentRestaurantId || currencyLoading}
            />
            <button
              className="sm-btn secondary"
              type="button"
              onClick={() => onManualRateSave?.(Number(rateInput))}
              disabled={!currentRestaurantId || currencyLoading}
            >
              Lưu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
