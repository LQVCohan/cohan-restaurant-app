import React from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import "./Header.scss";

const Header = ({ restaurantList }) => {
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

  return (
    <Card className="header-card">
      <div className="header-section">
        <h1 className="page-title">📦 Quản lý Kho Nguyên liệu</h1>
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

      {/* Sample export button */}
      <div className="select-container">
        <button className="export-sample-button" onClick={handleExportSample}>
          Xuất mẫu Excel
        </button>

        {/* Select Box for Restaurants */}
        <select className="select-box">
          <option value="">Chọn nhà hàng</option>
          {restaurantList.map((restaurant) => (
            <option key={restaurant.id} value={restaurant.id}>
              {restaurant.name}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
};

export default Header;
