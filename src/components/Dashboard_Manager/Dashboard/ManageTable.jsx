import React, { useState } from "react";
import Sidebar from "../Sidebar";

import TableGrid from "./TableGrid";
import OrderModal from "./OrderModal";
import Staff from "../Staff/StaffManagement";
import { useTableManagement } from "../../hooks/useTableManagement";
import "../../Dashboard_Manager/Styles/Dashboard.scss";

// Placeholder components for other sections
const Orders = () => <div>Đơn hàng content</div>;
const Menu = () => <div>Thực đơn content</div>;
const Inventory = () => <div>Kho hàng content</div>;

const Analytics = () => <div>Thống kê content</div>;
const Transactions = () => <div>Giao dịch content</div>;
const Reports = () => <div>Báo cáo content</div>;
const Settings = () => <div>Cài đặt content</div>;

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("tables");

  const {
    tables,
    selectedTable,
    setSelectedTable,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    activeArea,
    setActiveArea,
    getStatusCounts,
    updateTableStatus,
  } = useTableManagement();

  const handleTableClick = (table) => {
    setSelectedTable(table);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedTable(null);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
    setSidebarHidden(true);
  };

  const renderContent = () => {
    switch (activeSection) {
      case "tables":
        return (
          <TableGrid
            tables={tables}
            onTableClick={handleTableClick}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            statusCounts={getStatusCounts()}
            activeArea={activeArea}
            onAreaChange={setActiveArea}
          />
        );
      case "orders":
        return <Orders />;
      case "menu":
        return <Menu />;
      case "inventory":
        return <Inventory />;
      case "staff":
        return <Staff />;
      case "analytics":
        return <Analytics />;
      case "transactions":
        return <Transactions />;
      case "reports":
        return <Reports />;
      case "settings":
        return <Settings />;
      default:
        return <div>Content not found</div>;
    }
  };

  return (
    <div className="restaurant-table">
      <main className="main-content">
        <div className="content-section">{renderContent()}</div>
      </main>

      {modalOpen && (
        <OrderModal
          table={selectedTable}
          onClose={handleCloseModal}
          onUpdateStatus={updateTableStatus}
        />
      )}
    </div>
  );
};
export default Dashboard;
