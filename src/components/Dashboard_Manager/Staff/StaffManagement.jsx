// src/pages/StaffManagement/index.jsx
import React, { useState, useEffect, useMemo, useContext } from "react";
import StaffHeader from "./components/Header"; // Giả sử đã đổi tên file component Header mới
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

// Import styles
import "./StaffManagement.scss";

const StaffManagement = () => {
  // --- STATE ---
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedRestaurant, setSelectedRestaurant] = useState("all");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
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
  }, [managerId]);

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
    setFilters((prev) => ({
      ...prev,
      restaurantId: selectedRestaurant === "all" ? null : selectedRestaurant,
      search: searchQuery, // Truyền search query vào hook nếu API hỗ trợ search server-side
    }));
  }, [selectedRestaurant, searchQuery, setFilters]);

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
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.fullName?.toLowerCase().includes(q) ||
          s.employeeCode?.toLowerCase().includes(q),
      );
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
          startDate: new Date(staff.dateJoined).toLocaleDateString("vi-VN"),
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
  const toggleHeader = () => setIsHeaderCollapsed((prev) => !prev);
  const openModal = (name) => setModals((prev) => ({ ...prev, [name]: true }));
  const closeModal = (name) =>
    setModals((prev) => ({ ...prev, [name]: false }));

  // Handlers CRUD (Giữ nguyên logic cũ)
  const handleCRUD = {
    add: async (val) => {
      await createStaff(val);
      closeModal("addEmployee");
    },
    edit: async (val) => {
      await updateStaff(selectedEmployee.id, val);
      closeModal("editEmployee");
    },
    delete: deleteStaff,
    setOnLeave: (id) => setStaffEmploymentStatus(id, "ON_LEAVE"),
    setWorking: (id) => setStaffEmploymentStatus(id, "WORKING"),
    lock: (id) => setStaffAccountStatus(id, "blocked"),
    unlock: (id) => setStaffAccountStatus(id, "active"),
    rate: rateStaff,
  };

  const isLoading = staffListLoading || restaurantLoading;

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
            // Props tìm kiếm (nếu StaffHeader hỗ trợ)
            searchValue={searchQuery}
            // Lưu ý: Cần update StaffHeader để nhận input onChange và gọi setSearchQuery
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
          {currentPage === "dashboard" && (
            <EmployeeDashboard
              employees={mappedStaff}
              selectedEmployee={selectedEmployee}
              onEmployeeSelect={setSelectedEmployee}
              onEditEmployee={() => openModal("editEmployee")}
              onViewHistory={() => openModal("workHistory")}
              onDeleteEmployee={handleCRUD.delete}
              onSetOnLeave={handleCRUD.setOnLeave}
              onSetWorking={handleCRUD.setWorking}
              onLockAccount={handleCRUD.lock}
              onUnlockAccount={handleCRUD.unlock}
              onRateStaff={handleCRUD.rate}
              loading={isLoading}
            />
          )}

          {currentPage === "attendance" && (
            <AttendancePage
              currentTime={currentTime}
              currentDate={currentDate}
            />
          )}

          {currentPage === "leave" && <LeaveManagement />}

          {currentPage === "schedule" && <SchedulePage />}
        </main>
      </div>

      {/* MODAL PORTAL AREA */}
      <AddEmployeeModal
        isOpen={modals.addEmployee}
        onClose={() => closeModal("addEmployee")}
        onSubmit={handleCRUD.add}
        restaurantList={restaurantList}
      />
      <EditEmployeeModal
        isOpen={modals.editEmployee}
        employee={selectedEmployee}
        onClose={() => closeModal("editEmployee")}
        onSubmit={handleCRUD.edit}
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
