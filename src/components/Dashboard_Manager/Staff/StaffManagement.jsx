import React, { useState, useEffect } from "react";
import Header from "./components/Header";
import StatsGrid from "./components/StatsGrid";
import PageNavigation from "./components/PageNavigation";
import EmployeeDashboard from "./components/EmployeeDashboard";
import AttendancePage from "./components/Attendance";
import LeaveManagement from "./components/LeaveManagement";
import {
  AddEmployeeModal,
  EditEmployeeModal,
  WorkHistoryModal,
} from "./components/modals";

import { useEmployees } from "../../../hooks/useEmployees";
import { useTime } from "../../../hooks/useTime";

const StaffManagement = () => {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [modals, setModals] = useState({
    addEmployee: false,
    editEmployee: false,
    workHistory: false,
  });

  const { employees, stats, updateEmployee, addEmployee, deleteEmployee } =
    useEmployees();
  const { currentTime, currentDate } = useTime();

  const openModal = (modalName) => {
    setModals((prev) => ({ ...prev, [modalName]: true }));
  };

  const closeModal = (modalName) => {
    setModals((prev) => ({ ...prev, [modalName]: false }));
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleRestaurantChange = (restaurant) => {
    setSelectedRestaurant(restaurant);
  };

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
  };

  return (
    <div className="app">
      <Header
        selectedRestaurant={selectedRestaurant}
        onRestaurantChange={handleRestaurantChange}
        onAddEmployee={() => openModal("addEmployee")}
      />

      <StatsGrid stats={stats} />

      <PageNavigation
        currentPage={currentPage}
        onPageChange={handlePageChange}
      />

      {currentPage === "dashboard" && (
        <EmployeeDashboard
          employees={employees}
          selectedEmployee={selectedEmployee}
          onEmployeeSelect={handleEmployeeSelect}
          onEditEmployee={() => openModal("editEmployee")}
          onViewHistory={() => openModal("workHistory")}
          onDeleteEmployee={deleteEmployee}
        />
      )}

      {currentPage === "attendance" && (
        <AttendancePage currentTime={currentTime} currentDate={currentDate} />
      )}

      {currentPage === "leave" && <LeaveManagement />}

      {/* Modals */}
      <AddEmployeeModal
        isOpen={modals.addEmployee}
        onClose={() => closeModal("addEmployee")}
        onSubmit={addEmployee}
      />

      <EditEmployeeModal
        isOpen={modals.editEmployee}
        employee={selectedEmployee}
        onClose={() => closeModal("editEmployee")}
        onSubmit={updateEmployee}
      />

      <WorkHistoryModal
        isOpen={modals.workHistory}
        employee={selectedEmployee}
        onClose={() => closeModal("workHistory")}
      />
    </div>
  );
};

export default StaffManagement;
