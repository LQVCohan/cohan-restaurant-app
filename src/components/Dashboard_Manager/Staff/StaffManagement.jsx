import React, { useState } from "react";
import StaffOverview from "./StaffOverview";
import StaffList from "./StaffList";
import StaffAttendance from "./StaffAttendance";
import StaffPayroll from "./StaffPayroll";
import "../Styles/StaffManagement.scss";

const StaffManagement = () => {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    {
      id: "overview",
      label: "Tổng quan",
      icon: "fas fa-chart-pie",
      component: StaffOverview,
    },
    {
      id: "list",
      label: "Danh sách nhân viên",
      icon: "fas fa-users",
      component: StaffList,
    },
    {
      id: "attendance",
      label: "Chấm công",
      icon: "fas fa-clock",
      component: StaffAttendance,
    },
    {
      id: "payroll",
      label: "Bảng lương",
      icon: "fas fa-money-bill-wave",
      component: StaffPayroll,
    },
  ];

  const ActiveComponent = tabs.find((tab) => tab.id === activeTab)?.component;

  return (
    <div className="staff-management">
      <div className="staff-management__header">
        <h1 className="page-title">
          <i className="fas fa-users-cog" />
          Quản lý nhân viên
        </h1>
        <p className="page-subtitle">
          Quản lý thông tin, chấm công và lương của nhân viên
        </p>
      </div>

      <div className="staff-management__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${
              activeTab === tab.id ? "tab-button--active" : ""
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="staff-management__content">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
};

export default StaffManagement;
