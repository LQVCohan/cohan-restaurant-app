// src/pages/StaffManagement/index.jsx
import React, { useState, useEffect, useMemo, useContext } from "react";
import Header from "./components/Header";
import PageNavigation from "./components/PageNavigation";
import EmployeeDashboard from "./components/EmployeeDashboard";
import AttendancePage from "./components/Attendance";
import LeaveManagement from "./components/LeaveManagement";
import SchedulePage from "./components/Schedule";
import {
  AddEmployeeModal,
  EditEmployeeModal,
  WorkHistoryModal,
} from "./components/modals";

import useStaffManagement from "../../../hooks/useStaffManagement";
import { useTime } from "../../../hooks/useTime";
import { useRestaurant } from "../../../hooks/useRestaurant";
import { AuthContext } from "@/context/AuthContext";

// Import file SCSS layout chính
import "./StaffManagement.scss";

const StaffManagement = () => {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [modals, setModals] = useState({
    addEmployee: false,
    editEmployee: false,
    workHistory: false,
  });

  // 🔥 STATE HEADER COLLAPSE
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const toggleHeader = () => setIsHeaderCollapsed((prev) => !prev);

  // --- LOGIC FETCH DATA & AUTH ---
  const { user } = useContext(AuthContext);
  const managerId = user?.id || user?._id || null;

  const [restaurantList, setRestaurantList] = useState([]);
  const [managedRestaurantIds, setManagedRestaurantIds] = useState([]);

  const {
    getManagedRestaurants,
    getManagedRestaurantIds,
    loading: restaurantLoading,
  } = useRestaurant();

  useEffect(() => {
    if (!managerId) return;
    let cancelled = false;

    (async () => {
      try {
        const [restaurants, ids] = await Promise.all([
          getManagedRestaurants(managerId),
          getManagedRestaurantIds(managerId),
        ]);

        if (cancelled) return;

        setRestaurantList(restaurants || []);
        setManagedRestaurantIds(ids || []);
      } catch (err) {
        console.error("Failed to load managed restaurants:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user.id]);

  // Hook quản lý nhân viên
  const {
    staffList,
    createStaff,
    updateStaff,
    deleteStaff,
    setStaffEmploymentStatus,
    setStaffAccountStatus,
    rateStaff,
    page,
    setPage,
    pageSize,
    setPageSize,
    staffListLoading,
  } = useStaffManagement({
    page: 1,
    pageSize: 20,
  });

  const { currentTime, currentDate } = useTime();

  // --- FILTERING LOGIC ---
  const filteredStaff = useMemo(() => {
    if (!staffList || staffList.length === 0) return [];

    if (selectedRestaurant === "all") {
      if (!managedRestaurantIds || managedRestaurantIds.length === 0) {
        return staffList;
      }
      return staffList.filter((staff) => {
        if (!staff.refRestaurants || staff.refRestaurants.length === 0)
          return false;
        const staffRestaurantIds = staff.refRestaurants.map((r) => r.id);
        return staffRestaurantIds.some((id) =>
          managedRestaurantIds.includes(id)
        );
      });
    }

    return staffList.filter((staff) => {
      if (!staff.refRestaurants || staff.refRestaurants.length === 0)
        return false;
      return staff.refRestaurants.some((r) => r.id === selectedRestaurant);
    });
  }, [staffList, selectedRestaurant, managedRestaurantIds]);

  // --- PAGINATION ---
  const totalItems = filteredStaff.length;
  const totalPages = useMemo(
    () => (pageSize > 0 ? Math.ceil(totalItems / pageSize) : 1),
    [totalItems, pageSize]
  );

  const safePage = useMemo(() => {
    if (totalPages === 0) return 1;
    if (page > totalPages) return totalPages;
    if (page < 1) return 1;
    return page;
  }, [page, totalPages]);

  const paginatedStaff = useMemo(() => {
    if (!pageSize || pageSize <= 0) return filteredStaff;
    const start = (safePage - 1) * pageSize;
    return filteredStaff.slice(start, start + pageSize);
  }, [filteredStaff, safePage, pageSize]);

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    const total = filteredStaff.length;
    const active = filteredStaff.filter((s) => s.status === "active").length;
    const onLeave = filteredStaff.filter(
      (s) => s.employmentStatus === "ON_LEAVE"
    ).length;
    const avgRate =
      total > 0
        ? filteredStaff.reduce((sum, s) => sum + (s.rate || 0), 0) / total
        : 0;

    return {
      totalStaff: total,
      activeStaff: active,
      onLeaveStaff: onLeave,
      avgRate,
    };
  }, [filteredStaff]);

  // --- HANDLERS ---
  const openModal = (modalName) => {
    setModals((prev) => ({ ...prev, [modalName]: true }));
  };

  const closeModal = (modalName) => {
    setModals((prev) => ({ ...prev, [modalName]: false }));
  };

  const handlePageChangeTab = (pageKey) => {
    setCurrentPage(pageKey);
  };

  const handleRestaurantChange = (restaurantId) => {
    setSelectedRestaurant(restaurantId);
    setPage(1);
  };

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
  };

  const handleAddEmployee = async (formValues) => {
    await createStaff(formValues);
    closeModal("addEmployee");
  };

  const handleEditEmployee = async (formValues) => {
    if (!selectedEmployee) return;
    await updateStaff(selectedEmployee.id, formValues);
    closeModal("editEmployee");
  };

  const handleDeleteEmployee = async (employeeId) => {
    await deleteStaff(employeeId);
  };

  const handleSetOnLeave = async (employeeId) => {
    await setStaffEmploymentStatus(employeeId, "ON_LEAVE");
  };

  const handleSetWorking = async (employeeId) => {
    await setStaffEmploymentStatus(employeeId, "WORKING");
  };

  const handleLockAccount = async (employeeId) => {
    await setStaffAccountStatus(employeeId, "blocked");
  };

  const handleUnlockAccount = async (employeeId) => {
    await setStaffAccountStatus(employeeId, "active");
  };

  const handleRateStaff = async (employeeId, rating) => {
    await rateStaff(employeeId, rating);
  };

  const handleExportData = () => {
    console.log("Export staff data", filteredStaff);
  };

  const anyLoading = staffListLoading || restaurantLoading;

  return (
    <div className="staff-management-layout">
      {/* HEADER SECTION (COLLAPSIBLE) */}
      <div className={`header-section ${isHeaderCollapsed ? "collapsed" : ""}`}>
        <Header
          selectedRestaurant={selectedRestaurant}
          onRestaurantChange={handleRestaurantChange}
          onAddEmployee={() => openModal("addEmployee")}
          onExportData={handleExportData}
          restaurantList={restaurantList}
          stats={stats}
          loading={anyLoading}
          onPageChange={handlePageChangeTab}
          // 👇 Cần thêm dòng này
          isCollapsed={isHeaderCollapsed}
          onToggle={toggleHeader}
        />
      </div>

      {/* NAVIGATION BAR */}
      <div className="nav-section">
        <PageNavigation
          currentPage={currentPage}
          onPageChange={handlePageChangeTab}
        />
      </div>

      {/* CONTENT SECTION */}
      <div className="content-section fade-in-up">
        {currentPage === "dashboard" && (
          <EmployeeDashboard
            employees={paginatedStaff}
            selectedEmployee={selectedEmployee}
            onEmployeeSelect={handleEmployeeSelect}
            onEditEmployee={() => openModal("editEmployee")}
            onViewHistory={() => openModal("workHistory")}
            onDeleteEmployee={handleDeleteEmployee}
            onSetOnLeave={handleSetOnLeave}
            onSetWorking={handleSetWorking}
            onLockAccount={handleLockAccount}
            onUnlockAccount={handleUnlockAccount}
            onRateStaff={handleRateStaff}
            page={safePage}
            pageSize={pageSize}
            totalItems={totalItems}
            totalPages={totalPages}
            onChangePage={setPage}
            onChangePageSize={setPageSize}
            loading={anyLoading}
          />
        )}

        {currentPage === "attendance" && (
          <AttendancePage currentTime={currentTime} currentDate={currentDate} />
        )}

        {currentPage === "leave" && <LeaveManagement />}

        {currentPage === "schedule" && <SchedulePage />}
      </div>

      {/* MODALS */}
      <AddEmployeeModal
        isOpen={modals.addEmployee}
        onClose={() => closeModal("addEmployee")}
        onSubmit={handleAddEmployee}
        restaurantList={restaurantList}
      />

      <EditEmployeeModal
        isOpen={modals.editEmployee}
        employee={selectedEmployee}
        onClose={() => closeModal("editEmployee")}
        onSubmit={handleEditEmployee}
        restaurantList={restaurantList}
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
