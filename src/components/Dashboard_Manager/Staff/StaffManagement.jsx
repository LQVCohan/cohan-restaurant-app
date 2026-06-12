// src/pages/StaffManagement/index.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import StaffHeader from "./components/Header";
import PageNavigation from "./components/PageNavigation";
import EmployeeDashboard from "./components/EmployeeDashboard";
import AttendancePage from "./components/Attendance";
import LeaveManagement from "./components/LeaveManagement";
import SchedulePage from "./components/Schedule";
import StaffReportsPage from "./components/Reports";
import StaffPerformancePage from "./components/Performance";
import {
  AddEmployeeModal,
  EditEmployeeModal,
  WorkHistoryModal,
} from "./components/modals";

import useStaffManagement from "../../../hooks/useStaffManagement";
import { useTime } from "../../../hooks/useTime";
import useManagerRestaurantSelection from "../../../hooks/useManagerRestaurantSelection";
import { useNotification } from "@/hooks/useNotification";
import { matchesEmployeeSearch } from "../../../utils/employeeSearch";
import { getStaffRoleDisplayLabel } from "../../../utils/staffRoleOptions";
import {
  getStaffListStatus,
  normalizeAccountStatus,
  normalizeEmploymentStatus,
} from "./staffStatus";

import "./StaffManagement.scss";
import "./StaffPremiumBoard.scss";
import "./StaffManagerCohesion.scss";

const QUERY_PENDING_LEAVE_REQUESTS = gql`
  query PendingLeaveRequests($filter: LeaveRequestFilterInput) {
    leaveRequests(filter: $filter) {
      id
      restaurantId
      status
    }
  }
`;

const STAFF_SUB_PAGES = new Set([
  "dashboard",
  "attendance",
  "leave",
  "schedule",
  "performance",
  "reports",
]);

const getStaffNavigationQuery = () => {
  const params = new URLSearchParams(window.location.search || "");
  return {
    staffPage: params.get("staffPage") || "",
    employeeId: params.get("employeeId") || "",
    employeeName: params.get("employeeName") || "",
  };
};

const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value.id ?? value._id ?? value.restaurantId ?? value);
  }
  return String(value);
};

const hasRestaurantMatch = (staff, restaurantIds) => {
  const allowedIds = (Array.isArray(restaurantIds) ? restaurantIds : [restaurantIds])
    .map(normalizeId)
    .filter(Boolean);
  if (!allowedIds.length) return true;

  const staffRestaurantIds = [
    staff.restaurantForStaff,
    ...(Array.isArray(staff.refRestaurants) ? staff.refRestaurants : []),
  ]
    .map(normalizeId)
    .filter(Boolean);

  if (!staffRestaurantIds.length) return true;
  return staffRestaurantIds.some((id) => allowedIds.includes(id));
};

const noop = () => {};

const StaffManagement = () => {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [focusedEmployeeId, setFocusedEmployeeId] = useState("");
  const [modals, setModals] = useState({
    addEmployee: false,
    editEmployee: false,
    workHistory: false,
  });

  const { showNotification } = useNotification();
  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
  } = useManagerRestaurantSelection();
  const selectedRestaurant = selectedRestaurantId;
  const { currentTime, currentDate } = useTime();

  const {
    staffList,
    roleList,
    roleListLoading,
    roleListError,
    createStaff,
    updateStaff,
    setFilters,
    refetchStaffList,
    staffListLoading,
    staffListError,
  } = useStaffManagement({
    restaurantId: selectedRestaurant || null,
    page: 1,
    pageSize: 50,
    pollInterval: selectedRestaurant ? 15000 : 0,
  });

  useEffect(() => {
    const handleNavigationQuery = (event) => {
      if (event?.detail?.page !== "staff") return;
      const nextStaffPage = event?.detail?.query?.staffPage || getStaffNavigationQuery().staffPage;
      if (nextStaffPage && STAFF_SUB_PAGES.has(nextStaffPage)) {
        setCurrentPage(nextStaffPage);
      }
    };

    window.addEventListener("manager:navigation-query", handleNavigationQuery);
    return () => window.removeEventListener("manager:navigation-query", handleNavigationQuery);
  }, []);

  useEffect(() => {
    const { staffPage } = getStaffNavigationQuery();
    if (staffPage && STAFF_SUB_PAGES.has(staffPage)) {
      setCurrentPage(staffPage);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedRestaurant) return;
    setFilters({
      restaurantId: selectedRestaurant,
      search: undefined,
      roleId: null,
      employmentStatus: null,
    });
  }, [selectedRestaurant, setFilters]);

  const leaveFilter = useMemo(
    () => ({
      status: "PENDING",
      restaurantId: selectedRestaurant || undefined,
    }),
    [selectedRestaurant],
  );

  const { data: pendingLeaveData, loading: pendingLeaveLoading } = useQuery(
    QUERY_PENDING_LEAVE_REQUESTS,
    {
      variables: { filter: leaveFilter },
      skip: !selectedRestaurant,
      fetchPolicy: "cache-and-network",
      pollInterval: 30000,
      notifyOnNetworkStatusChange: true,
    },
  );

  const filteredStaff = useMemo(() => {
    if (!staffList) return [];
    let result = staffList;

    if (selectedRestaurant) {
      result = result.filter((staff) => hasRestaurantMatch(staff, selectedRestaurant));
    }
    if (debouncedSearchQuery) {
      result = result.filter((staff) => matchesEmployeeSearch(staff, debouncedSearchQuery));
    }
    return result;
  }, [staffList, selectedRestaurant, debouncedSearchQuery]);

  const mappedStaff = useMemo(
    () =>
      filteredStaff.map((staff) => {
        const accountStatus = normalizeAccountStatus(staff.status);
        const employmentStatus = normalizeEmploymentStatus(staff.employmentStatus);
        const roleLabel =
          getStaffRoleDisplayLabel(staff.role) ||
          getStaffRoleDisplayLabel(staff.roleName) ||
          getStaffRoleDisplayLabel(staff.role?.slug);

        return {
          id: staff.id,
          name: staff.fullName,
          code: staff.employeeCode,
          role: staff.positionTitle || roleLabel || "Chưa gán vị trí",
          roleId: staff.role?.id || null,
          roleSlug: staff.role?.slug || "",
          roleName: roleLabel || staff.roleName || "",
          positionTitle: staff.positionTitle || "",
          department: staff.department,
          status: getStaffListStatus({ accountStatus, employmentStatus }),
          accountStatus,
          employmentStatus,
          email: staff.email,
          phone: staff.phone,
          username: staff.username,
          avatar: staff.avatarUrl,
          startDate: staff.dateJoined
            ? new Date(staff.dateJoined).toLocaleDateString("vi-VN")
            : "---",
          shift: staff.shiftType || "Ca xoay",
          baseSalary: staff.baseSalary ?? null,
          salary: staff.baseSalary ?? null,
          restaurantForStaff: staff.restaurantForStaff,
          refRestaurants: staff.refRestaurants || [],
          address: staff.address
            ? [staff.address.line1, staff.address.ward, staff.address.district, staff.address.city]
                .filter(Boolean)
                .join(", ")
            : "",
          employmentType: staff.employmentType,
          workingDays: staff.workingDays || [],
          dateLeft: staff.dateLeft,
          taxCode: staff.taxCode,
          emergencyContact: staff.emergencyContact,
          noteInternal: staff.noteInternal,
          emailVerified: Boolean(staff.emailVerified),
          phoneVerified: Boolean(staff.phoneVerified),
          verificationStatus:
            staff.emailVerified || staff.phoneVerified
              ? "verified"
              : staff.status === "pending"
                ? "pending"
                : "unverified",
          verificationLabel: staff.emailVerified
            ? "Đã xác minh email"
            : staff.phoneVerified
              ? "Đã xác minh SĐT"
              : staff.status === "pending"
                ? "Chờ xác minh"
                : "Chưa xác minh",
          canResendVerification: Boolean(
            (staff.email && !staff.emailVerified) || (staff.phone && !staff.phoneVerified),
          ),
          raw: staff,
        };
      }),
    [filteredStaff],
  );

  const stats = useMemo(
    () => ({
      totalStaff: filteredStaff.length,
      activeStaff: filteredStaff.filter((staff) => staff.isOnline).length,
      onLeaveStaff: filteredStaff.filter((staff) => staff.employmentStatus === "ON_LEAVE").length,
      avgRate: 0,
    }),
    [filteredStaff],
  );

  const pendingLeaveCount = useMemo(() => {
    const requests = pendingLeaveData?.leaveRequests || [];
    if (!requests.length || !selectedRestaurant) return 0;
    return requests.filter((request) => request.restaurantId === selectedRestaurant).length;
  }, [pendingLeaveData?.leaveRequests, selectedRestaurant]);

  const isLoading = staffListLoading || restaurantsLoading;
  const isHeaderLoading = restaurantsLoading || staffListLoading || pendingLeaveLoading;

  const openModal = useCallback(
    (name) => setModals((prev) => ({ ...prev, [name]: true })),
    [],
  );
  const closeModal = useCallback(
    (name) => setModals((prev) => ({ ...prev, [name]: false })),
    [],
  );

  const handleAddEmployee = useCallback(
    async (values) => {
      const created = await createStaff(values);
      await refetchStaffList?.();
      if (created) setSelectedEmployee(created);
      closeModal("addEmployee");
      showNotification("Đã thêm nhân viên thành công.", "success");
    },
    [closeModal, createStaff, refetchStaffList, showNotification],
  );

  const handleEditEmployee = useCallback(
    async (values) => {
      if (!selectedEmployee?.id) return;
      const updated = await updateStaff(selectedEmployee.id, values);
      await refetchStaffList?.();
      if (updated) setSelectedEmployee(updated);
      closeModal("editEmployee");
      showNotification("Đã cập nhật hồ sơ nhân viên.", "success");
    },
    [closeModal, refetchStaffList, selectedEmployee?.id, showNotification, updateStaff],
  );

  useEffect(() => {
    if (!selectedEmployee) return;
    const nextSelectedEmployee = mappedStaff.find((item) => item.id === selectedEmployee.id);
    if (nextSelectedEmployee) {
      if (nextSelectedEmployee !== selectedEmployee) setSelectedEmployee(nextSelectedEmployee);
      return;
    }
    if (!isLoading) setSelectedEmployee(null);
  }, [isLoading, mappedStaff, selectedEmployee]);

  useEffect(() => {
    const { employeeId, employeeName } = getStaffNavigationQuery();
    if (!employeeId && !employeeName) return;
    if (employeeName) setSearchQuery(employeeName);

    const targetStaff = mappedStaff.find((staff) => String(staff.id) === String(employeeId));
    if (targetStaff) {
      setCurrentPage("dashboard");
      setSelectedEmployee(targetStaff);
      setFocusedEmployeeId(String(targetStaff.id));
      window.setTimeout(() => setFocusedEmployeeId(""), 3000);
    }
  }, [mappedStaff]);

  const mainContent = useMemo(() => {
    if (currentPage === "dashboard") {
      return (
        <EmployeeDashboard
          employees={mappedStaff}
          selectedEmployee={selectedEmployee}
          focusedEmployeeId={focusedEmployeeId}
          onEmployeeSelect={setSelectedEmployee}
          onEditEmployee={() => openModal("editEmployee")}
          onViewHistory={() => openModal("workHistory")}
          onDeleteEmployee={noop}
          onSetOnLeave={noop}
          onSetWorking={noop}
          onSetResigned={noop}
          onLockAccount={noop}
          onUnlockAccount={noop}
          onCalculateSalary={noop}
          onResendVerification={noop}
          roleList={roleList}
          loading={isLoading}
          error={staffListError}
          onRetry={refetchStaffList}
        />
      );
    }
    if (currentPage === "attendance") {
      return <AttendancePage currentTime={currentTime} currentDate={currentDate} />;
    }
    if (currentPage === "leave") return <LeaveManagement restaurantId={selectedRestaurant} />;
    if (currentPage === "schedule") return <SchedulePage />;
    if (currentPage === "performance") {
      return (
        <StaffPerformancePage
          employees={mappedStaff}
          selectedRestaurant={selectedRestaurant}
          restaurantList={restaurantOptions}
          searchQuery={searchQuery}
        />
      );
    }
    if (currentPage === "reports") return <StaffReportsPage />;
    return null;
  }, [
    currentDate,
    currentPage,
    currentTime,
    focusedEmployeeId,
    isLoading,
    mappedStaff,
    openModal,
    refetchStaffList,
    restaurantOptions,
    roleList,
    searchQuery,
    selectedEmployee,
    selectedRestaurant,
    staffListError,
  ]);

  return (
    <div className="staff-page-container">
      <div className="page-bg-blob blob-1" />
      <div className="page-bg-blob blob-2" />

      <div className="staff-page-content">
        <header className="page-header-wrapper">
          <StaffHeader
            selectedRestaurant={selectedRestaurant}
            onRestaurantChange={setSelectedRestaurantId}
            onAddEmployee={() => openModal("addEmployee")}
            onExportData={undefined}
            restaurantList={restaurantOptions}
            stats={stats}
            loading={isHeaderLoading}
            pendingLeaveCount={pendingLeaveCount}
            onPageChange={setCurrentPage}
            isCollapsed={isHeaderCollapsed}
            onToggle={() => setIsHeaderCollapsed((prev) => !prev)}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </header>

        <nav className={`page-nav-wrapper ${isHeaderCollapsed ? "sticky" : ""}`}>
          <PageNavigation currentPage={currentPage} onPageChange={setCurrentPage} />
        </nav>

        <main className="page-main-view fade-in-up">{mainContent}</main>
      </div>

      <AddEmployeeModal
        isOpen={modals.addEmployee}
        onClose={() => closeModal("addEmployee")}
        onSubmit={handleAddEmployee}
        restaurantList={restaurantOptions}
        defaultRestaurantId={selectedRestaurant}
        roleList={roleList}
        roleListLoading={roleListLoading}
        roleListError={roleListError}
      />
      <EditEmployeeModal
        isOpen={modals.editEmployee}
        employee={selectedEmployee}
        onClose={() => closeModal("editEmployee")}
        onSubmit={handleEditEmployee}
        restaurantList={restaurantOptions}
        defaultRestaurantId={selectedRestaurant}
        roleList={roleList}
        roleListLoading={roleListLoading}
        roleListError={roleListError}
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
