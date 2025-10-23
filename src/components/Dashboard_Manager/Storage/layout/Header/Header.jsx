import React from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
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
}) => {
  const handleImportData = () => {
    alert("Chức năng nhập dữ liệu từ Excel sẽ được triển khai");
  };

  const handleExportData = () => {
    alert("Chức năng xuất dữ liệu ra Excel sẽ được triển khai");
  };

  const handleGenerateReport = () => {
    alert("Chức năng tạo báo cáo chi tiết sẽ được triển khai");
  };

  const handleExportSample = () => {
    alert("Chức năng xuất mẫu Excel để nhập nguyên liệu sẽ được triển khai");
  };

  const changeRestaurant = (e) => {
    const id = e.target.value || "";
    onRestaurantChange?.(id);
    onWarehouseChange?.(null); // reset kho khi đổi nhà hàng
  };

  const changeWarehouse = (e) => {
    const id = e.target.value || null;
    onWarehouseChange?.(id);
  };

  const isRestaurantDisabled = restaurantsLoading || !restaurantList.length;
  const isWarehouseDisabled =
    warehousesLoading || !currentRestaurantId || !warehouses.length;

  return (
    <Card className="header-card">
      <div className="header-section">
        <h1 className="page-title">📦 Quản lý Kho</h1>
      </div>

      <div className="header-actions">
        <Button variant="secondary" onClick={handleImportData}>
          📥 Nhập Excel
        </Button>
        <Button variant="secondary" onClick={handleExportData}>
          📤 Xuất Excel
        </Button>
        <Button variant="warning" onClick={handleGenerateReport}>
          📊 Báo cáo
        </Button>
      </div>

      <div className="select-container">
        <button className="export-sample-button" onClick={handleExportSample}>
          Xuất mẫu Excel
        </button>

        {/* Select Nhà hàng */}
        <div className="select-group">
          <label className="select-label" htmlFor="restaurant-select">
            Nhà hàng
            {restaurantsLoading && <span className="inline-loader" />}
          </label>
          <select
            id="restaurant-select"
            className={`select-box ${restaurantsLoading ? "loading" : ""}`}
            value={currentRestaurantId || ""}
            onChange={changeRestaurant}
            disabled={isRestaurantDisabled}
          >
            <option value="">
              {restaurantsLoading ? "Đang tải nhà hàng…" : "— Chọn nhà hàng —"}
            </option>
            {restaurantList.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                {restaurant.name}
              </option>
            ))}
          </select>
        </div>

        {/* Select Kho */}
        <div className="select-group">
          <label className="select-label" htmlFor="warehouse-select">
            Kho
            {warehousesLoading && <span className="inline-loader" />}
          </label>
          <select
            id="warehouse-select"
            className={`select-box ${warehousesLoading ? "loading" : ""}`}
            value={selectedWarehouseId || ""}
            onChange={changeWarehouse}
            disabled={isWarehouseDisabled}
          >
            <option value="">
              {!currentRestaurantId
                ? "Chọn nhà hàng trước"
                : warehousesLoading
                ? "Đang tải kho…"
                : "— Tất cả kho —"}
            </option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
};

export default Header;
