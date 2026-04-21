// src/pages/StaffManagement/index.jsx
import React, { useState, useEffect, useMemo, useContext, useCallback } from "react";
import StaffHeader from "./components/Header"; // Giả sử đã đổi tên file component Header mới
import PageNavigation from "./components/PageNavigation";
import EmployeeDashboard from "./components/EmployeeDashboard";
import AttendancePage from "./components/Attendance";
import LeaveManagement from "./components/LeaveManagement";
import SchedulePage from "./components/Schedule";
import StaffReportsPage from "./components/Reports";
import {
  AddEmployeeModal,
  EditEmployeeModal,
  WorkHistoryModal,
} from "./components/modals";

import useStaffManagement from "../../../hooks/useStaffManagement";
import { useTime } from "../../../hooks/useTime";
import { useRestaurant } from "../../../hooks/useRestaurant";
import { AuthContext } from "@/context/AuthContext";
import { matchesEmployeeSearch } from "../../../utils/employeeSearch";

// Import styles
import "./StaffManagement.scss";

const StaffManagement = () => {
  // --- STATE ---
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const [modals, setModals] = useState({
    addEmployee: false,
    editEmployee: false,
    workHistory: false,
  });

  // --- HOOKS & CONTEXT ---
  const { user } = useContext(AuthContext);
  const managerId = user?.id || user?._id || null;
  const { currentTime, currentDate } = useTime();

  // --- DATA FETCHING ---
  const {
    getManagedRestaurants,
    getManagedRestaurantIds,
    loading: restaurantLoading,
  } = useRestaurant();

  const [restaurantList, setRestaurantList] = useState([]);
  const [managedRestaurantIds, setManagedRestaurantIds] = useState([]);

  useEffect(() => {
    if (!managerId) return;
    let cancelled = false;
    (async () => {
      try {
        const [restaurants, ids] = await Promise.all([
          getManagedRestaurants(managerId),
          getManagedRestaurantIds(managerId),
        ]);
        if (!cancelled) {
          setRestaurantList(restaurants || []);
          setManagedRestaurantIds(ids || []);
        }
      } catch (err) {
        console.error("Load restaurants failed:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [managerId, getManagedRestaurantIds, getManagedRestaurants]);

  const {
    staffList,
    createStaff,
    updateStaff,
    deleteStaff,
    setStaffEmploymentStatus,
    setStaffAccountStatus,
    rateStaff,
    setFilters,
    staffListLoading,
  } = useStaffManagement({ page: 1, pageSize: 50 }); // Tăng pageSize để demo mượt

  // --- FILTER & LOGIC ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      restaurantId: selectedRestaurant === "all" ? null : selectedRestaurant,
      search: undefined,
    }));
  }, [selectedRestaurant, debouncedSearchQuery, setFilters]);

  // Client-side filtering (nếu cần filter thêm ở client)
  const filteredStaff = useMemo(() => {
    if (!staffList) return [];
    let result = staffList;

    // Filter by Restaurant
    if (selectedRestaurant !== "all") {
      result = result.filter((s) =>
        s.refRestaurants?.some((r) => r.id === selectedRestaurant),
      );
    } else if (managedRestaurantIds.length > 0) {
      result = result.filter((s) =>
        s.refRestaurants?.some((r) => managedRestaurantIds.includes(r.id)),
      );
    }

    // Filter by Search (Local fallback)
    if (searchQuery) {
      result = result.filter((s) => matchesEmployeeSearch(s, searchQuery));
    }
    return result;
  }, [staffList, selectedRestaurant, managedRestaurantIds, searchQuery]);

  // Map Data Model
  const mappedStaff = useMemo(
    () =>
      filteredStaff.map((staff) => {
        // ... (Giữ nguyên logic mapStaffToEmployee của bạn ở đây)
        // Để code gọn, tôi tóm tắt lại logic map
        const isInactive =
          staff.status !== "active" ||
          ["RESIGNED", "SUSPENDED"].includes(staff.employmentStatus);
        const isOnLeave = staff.employmentStatus === "ON_LEAVE";
        return {
          id: staff.id,
          name: staff.fullName,
          code: staff.employeeCode,
          role: staff.positionTitle || staff.role?.name || "N/A",
          department: staff.department,
          status: isInactive ? "inactive" : isOnLeave ? "break" : "active",
          email: staff.email,
          phone: staff.phone,
          avatar: staff.avatarUrl,
          startDate: staff.dateJoined
            ? new Date(staff.dateJoined).toLocaleDateString("vi-VN")
            : "---",
          shift: staff.shiftType || "Ca xoay",
          primaryRestaurantId: staff.primaryRestaurant?.id,
          raw: staff,
        };
      }),
    [filteredStaff],
  );

  // Calculate Stats
  const stats = useMemo(
    () => ({
      totalStaff: filteredStaff.length,
      activeStaff: filteredStaff.filter((s) => s.status === "active").length,
      onLeaveStaff: filteredStaff.filter(
        (s) => s.employmentStatus === "ON_LEAVE",
      ).length,
      avgRate:
        filteredStaff.reduce((sum, s) => sum + (s.rate || 0), 0) /
        (filteredStaff.length || 1),
    }),
    [filteredStaff],
  );

  // --- HANDLERS ---
  const toggleHeader = useCallback(
    () => setIsHeaderCollapsed((prev) => !prev),
    [],
  );
  const openModal = useCallback(
    (name) => setModals((prev) => ({ ...prev, [name]: true })),
    [],
  );
  const closeModal = useCallback(
    (name) => setModals((prev) => ({ ...prev, [name]: false })),
    [],
  );

  // Handlers CRUD (Giữ nguyên logic cũ)
  const handleAddEmployee = useCallback(
    async (val) => {
      await createStaff(val);
      closeModal("addEmployee");
    },
    [createStaff, closeModal],
  );
  const handleEditEmployee = useCallback(
    async (val) => {
      if (!selectedEmployee?.id) return;
      await updateStaff(selectedEmployee.id, val);
      closeModal("editEmployee");
    },
    [closeModal, selectedEmployee?.id, updateStaff],
  );
  const handleSetOnLeave = useCallback(
    (id) => setStaffEmploymentStatus(id, "ON_LEAVE"),
    [setStaffEmploymentStatus],
  );
  const handleSetWorking = useCallback(
    (id) => setStaffEmploymentStatus(id, "WORKING"),
    [setStaffEmploymentStatus],
  );
  const handleLockAccount = useCallback(
    (id) => setStaffAccountStatus(id, "blocked"),
    [setStaffAccountStatus],
  );
  const handleUnlockAccount = useCallback(
    (id) => setStaffAccountStatus(id, "active"),
    [setStaffAccountStatus],
  );

  const handleOpenEditEmployee = useCallback(
    () => openModal("editEmployee"),
    [openModal],
  );
  const handleOpenWorkHistory = useCallback(
    () => openModal("workHistory"),
    [openModal],
  );

  useEffect(() => {
    if (!selectedEmployee) return;
    const stillVisible = mappedStaff.some(
      (item) => item.id === selectedEmployee.id,
    );
    if (!stillVisible) setSelectedEmployee(null);
  }, [mappedStaff, selectedEmployee]);

  const isLoading = staffListLoading || restaurantLoading;

  const mainContent = useMemo(() => {
    if (currentPage === "dashboard") {
      return (
        <EmployeeDashboard
          employees={mappedStaff}
          selectedEmployee={selectedEmployee}
          onEmployeeSelect={setSelectedEmployee}
          onEditEmployee={handleOpenEditEmployee}
          onViewHistory={handleOpenWorkHistory}
          onDeleteEmployee={deleteStaff}
          onSetOnLeave={handleSetOnLeave}
          onSetWorking={handleSetWorking}
          onLockAccount={handleLockAccount}
          onUnlockAccount={handleUnlockAccount}
          onRateStaff={rateStaff}
          loading={isLoading}
        />
      );
    }
    if (currentPage === "attendance") {
      return <AttendancePage currentTime={currentTime} currentDate={currentDate} />;
    }
    if (currentPage === "leave") return <LeaveManagement />;
    if (currentPage === "schedule") return <SchedulePage />;
    if (currentPage === "reports") return <StaffReportsPage />;
    return null;
  }, [
    currentDate,
    currentPage,
    currentTime,
    deleteStaff,
    handleLockAccount,
    handleOpenEditEmployee,
    handleOpenWorkHistory,
    handleSetOnLeave,
    handleSetWorking,
    handleUnlockAccount,
    isLoading,
    mappedStaff,
    rateStaff,
    selectedEmployee,
  ]);

  return (
    <div className="staff-page-container">
      {/* BACKGROUND DECORATIONS */}
      <div className="page-bg-blob blob-1"></div>
      <div className="page-bg-blob blob-2"></div>

      <div className="staff-page-content">
        {/* HEADER */}
        <header className="page-header-wrapper">
          <StaffHeader
            selectedRestaurant={selectedRestaurant}
            onRestaurantChange={setSelectedRestaurant}
            onAddEmployee={() => openModal("addEmployee")}
            onExportData={() => console.log("Export")}
            restaurantList={restaurantList}
            stats={stats}
            loading={isLoading}
            onPageChange={setCurrentPage}
            isCollapsed={isHeaderCollapsed}
            onToggle={toggleHeader}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </header>

        {/* NAVIGATION TABS */}
        <nav
          className={`page-nav-wrapper ${isHeaderCollapsed ? "sticky" : ""}`}
        >
          <PageNavigation
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </nav>

        {/* MAIN CONTENT AREA */}
        <main className="page-main-view fade-in-up">
          {mainContent}
        </main>
      </div>

      {/* MODAL PORTAL AREA */}
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
