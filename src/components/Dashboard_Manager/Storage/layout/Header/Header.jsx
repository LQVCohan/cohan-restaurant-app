import React from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import "./Header.scss";

const Header = () => {
  const handleImportData = () => {
    alert("Chức năng nhập dữ liệu từ Excel sẽ được triển khai");
  };

  const handleExportData = () => {
    alert("Chức năng xuất dữ liệu ra Excel sẽ được triển khai");
  };

  const handleGenerateReport = () => {
    alert("Chức năng tạo báo cáo chi tiết sẽ được triển khai");
  };

  return (
    <Card className="header-card">
      <div className="header-section">
        <h1 className="page-title">📦 Quản lý Kho Nguyên liệu</h1>
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
      </div>
    </Card>
  );
};

export default Header;
