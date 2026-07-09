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
  StaffAvatarModal,
  WorkHistoryModal,
} from "./components/modals";

import useStaffManagement from "../../../hooks/useStaffManagement";
import useStaffAvatar from "../../../hooks/useStaffAvatar";
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

const QUERY_PENDING_LEAVE_REQUESTS = gql`
  query PendingLeaveRequests($filter: LeaveRequestFilterInput) {
    leaveRequests(filter: $filter) {
      id
      restaurantId
      status
    }
  }
`;

const QUERY_PENDING_ATTENDANCE_CORRECTIONS = gql`
  query PendingAttendanceCorrections($filter: AttendanceCorrectionFilterInput) {
    attendanceCorrectionRequests(filter: $filter) {
      id
      restaurantId
      status
    }
  }
`;

const QUERY_REVIEW_OVERTIME_REQUESTS = gql`
  query ReviewOvertimeRequests($filter: OvertimeRequestFilterInput) {
    overtimeRequests(filter: $filter) {
      id
      restaurantId
      status
    }
  }
`;

const ACTIONABLE_OVERTIME_STATUSES = new Set(["pending_approval", "approved"]);

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

const getActionErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.networkError?.message ||
  error?.message ||
  fallback;

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
    staffAvatar: false,
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
    softDeleteStaff,
    setStaffEmploymentStatus,
    setStaffAccountStatus,
    resendStaffVerification,
    setFilters,
    refetchStaffList,
    staffListLoading,
    errors: staffErrors,
  } = useStaffManagement({
    restaurantId: selectedRestaurant || null,
    page: 1,
    pageSize: 50,
    pollInterval: selectedRestaurant ? 15000 : 0,
  });

  const {
    uploadStaffAvatar,
    removeStaffAvatar,
    uploadingAvatar,
  } = useStaffAvatar();

  const staffListError = staffErrors?.list || null;

  useEffect(() => {
    const handleNavigationQuery = (event) => {
      if (event?.detail?.page !== "staff") return;
      const nextStaffPage =
        event?.detail?.query?.staffPage || getStaffNavigationQuery().staffPage;
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

  const pendingCorrectionFilter = useMemo(
    () => ({
      status: "pending",
      restaurantId: selectedRestaurant || undefined,
    }),
    [selectedRestaurant],
  );

  const overtimeReviewFilter = useMemo(
    () => ({
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

  const { data: pendingCorrectionData, loading: pendingCorrectionLoading } =
    useQuery(QUERY_PENDING_ATTENDANCE_CORRECTIONS, {
      variables: { filter: pendingCorrectionFilter },
      skip: !selectedRestaurant,
      fetchPolicy: "cache-and-network",
      pollInterval: 30000,
      notifyOnNetworkStatusChange: true,
    });

  const { data: overtimeReviewData, loading: overtimeReviewLoading } =
    useQuery(QUERY_REVIEW_OVERTIME_REQUESTS, {
      variables: { filter: overtimeReviewFilter },
      skip: !selectedRestaurant,
      fetchPolicy: "cache-and-network",
      pollInterval: 30000,
      notifyOnNetworkStatusChange: true,
    });

  const filteredStaff = useMemo(() => {
    if (!staffList) return [];
    let result = staffList;

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
        const avatarUrl =
          staff.avatarUrl ||
          staff.avatar ||
          staff.photoUrl ||
          staff.profileImage ||
          "";

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
          avatar: avatarUrl,
          avatarUrl,
          startDate: staff.dateJoined
            ? new Date(staff.dateJoined).toLocaleDateString("vi-VN")
            : "---",
          shift: staff.shiftType || "Ca xoay",
          baseSalary: staff.baseSalary ?? null,
          salary: staff.baseSalary ?? null,
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
            (staff.email && !staff.emailVerified) ||
              (staff.phone && !staff.phoneVerified),
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
      onLeaveStaff: filteredStaff.filter(
        (staff) => staff.employmentStatus === "ON_LEAVE",
      ).length,
      avgRate: 0,
    }),
    [filteredStaff],
  );

  const pendingLeaveCount = useMemo(() => {
    const requests = pendingLeaveData?.leaveRequests || [];
    if (!requests.length || !selectedRestaurant) return 0;
    return requests.filter(
      (request) => request.restaurantId === selectedRestaurant,
    ).length;
  }, [pendingLeaveData?.leaveRequests, selectedRestaurant]);

  const pendingCorrectionCount = useMemo(() => {
    const requests = pendingCorrectionData?.attendanceCorrectionRequests || [];
    if (!requests.length || !selectedRestaurant) return 0;
    return requests.filter(
      (request) => request.restaurantId === selectedRestaurant && request.status === "pending",
    ).length;
  }, [pendingCorrectionData?.attendanceCorrectionRequests, selectedRestaurant]);

  const pendingOvertimeReviewCount = useMemo(() => {
    const requests = overtimeReviewData?.overtimeRequests || [];
    if (!requests.length || !selectedRestaurant) return 0;
    return requests.filter(
      (request) =>
        request.restaurantId === selectedRestaurant &&
        ACTIONABLE_OVERTIME_STATUSES.has(String(request.status || "").toLowerCase()),
    ).length;
  }, [overtimeReviewData?.overtimeRequests, selectedRestaurant]);

  const pendingReviewCount =
    pendingLeaveCount + pendingCorrectionCount + pendingOvertimeReviewCount;

  const isLoading = staffListLoading || restaurantsLoading;
  const isHeaderLoading =
    restaurantsLoading ||
    staffListLoading ||
    pendingLeaveLoading ||
    pendingCorrectionLoading ||
    overtimeReviewLoading;

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
    [
      closeModal,
      refetchStaffList,
      selectedEmployee?.id,
      showNotification,
      updateStaff,
    ],
  );

  const handleAvatarSubmit = useCallback(
    async ({ employee, file, remove }) => {
      if (!employee?.id) {
        throw new Error("Chưa chọn nhân viên để cập nhật ảnh đại diện.");
      }

      try {
        const updated = remove
          ? await removeStaffAvatar(employee.id)
          : await uploadStaffAvatar(employee.id, file);
        const nextAvatarUrl = updated?.avatarUrl || "";

        setSelectedEmployee((current) => {
          if (!current || String(current.id) !== String(employee.id)) return current;
          return {
            ...current,
            avatar: nextAvatarUrl,
            avatarUrl: nextAvatarUrl,
            raw: {
              ...(current.raw || {}),
              avatarUrl: nextAvatarUrl,
            },
          };
        });

        await refetchStaffList?.();
        showNotification(
          remove
            ? "Đã xóa ảnh đại diện nhân viên."
            : "Đã cập nhật ảnh đại diện nhân viên.",
          "success",
        );
        return updated;
      } catch (error) {
        const message = getActionErrorMessage(
          error,
          "Không thể cập nhật ảnh đại diện nhân viên.",
        );
        showNotification(message, "error");
        throw new Error(message);
      }
    },
    [
      refetchStaffList,
      removeStaffAvatar,
      showNotification,
      uploadStaffAvatar,
    ],
  );

  const handleDeleteEmployee = useCallback(
    async (employeeId) => {
      const employee = mappedStaff.find(
        (item) => String(item.id) === String(employeeId),
      );
      const employeeName = employee?.name || "nhân viên này";
      const confirmed = window.confirm(
        `Ngừng hiển thị ${employeeName} khỏi danh sách nhân sự? Dữ liệu lịch sử vẫn được giữ lại.`,
      );
      if (!confirmed) return;

      try {
        await softDeleteStaff(employeeId);
        await refetchStaffList?.();
        if (String(selectedEmployee?.id) === String(employeeId)) {
          setSelectedEmployee(null);
        }
        showNotification(`Đã ngừng hiển thị ${employeeName}.`, "success");
      } catch (error) {
        showNotification(
          getActionErrorMessage(
            error,
            "Không thể cập nhật trạng thái nhân viên.",
          ),
          "error",
        );
      }
    },
    [
      mappedStaff,
      refetchStaffList,
      selectedEmployee?.id,
      showNotification,
      softDeleteStaff,
    ],
  );

  const handleEmploymentStatusChange = useCallback(
    async (employeeId, status, successMessage) => {
      try {
        await setStaffEmploymentStatus(employeeId, status);
        await refetchStaffList?.();
        showNotification(successMessage, "success");
      } catch (error) {
        showNotification(
          getActionErrorMessage(
            error,
            "Không thể cập nhật trạng thái lao động.",
          ),
          "error",
        );
      }
    },
    [refetchStaffList, setStaffEmploymentStatus, showNotification],
  );

  const handleAccountStatusChange = useCallback(
    async (employeeId, status, successMessage) => {
      try {
        await setStaffAccountStatus(employeeId, status);
        await refetchStaffList?.();
        showNotification(successMessage, "success");
      } catch (error) {
        showNotification(
          getActionErrorMessage(
            error,
            "Không thể cập nhật trạng thái tài khoản.",
          ),
          "error",
        );
      }
    },
    [refetchStaffList, setStaffAccountStatus, showNotification],
  );

  const handleResendVerification = useCallback(
    async (employee, channel) => {
      if (!employee?.id) return;
      try {
        const result = await resendStaffVerification(employee.id, channel);
        showNotification(
          result?.message || `Đã gửi yêu cầu xác minh cho ${employee.name}.`,
          "success",
        );
      } catch (error) {
        showNotification(
          getActionErrorMessage(
            error,
            "Không thể gửi lại thông tin xác minh.",
          ),
          "error",
        );
      }
    },
    [resendStaffVerification, showNotification],
  );

  const handleEmployeeAction = useCallback(
    (employee, action) => {
      setSelectedEmployee(employee);
      if (action === "edit") {
        openModal("editEmployee");
        return;
      }
      if (action === "delete") {
        void handleDeleteEmployee(employee.id);
      }
    },
    [handleDeleteEmployee, openModal],
  );

  useEffect(() => {
    if (!selectedEmployee) return;
    const nextSelectedEmployee = mappedStaff.find(
      (item) => item.id === selectedEmployee.id,
    );
    if (nextSelectedEmployee) {
      if (nextSelectedEmployee !== selectedEmployee) {
        setSelectedEmployee(nextSelectedEmployee);
      }
      return;
    }
    if (!isLoading) setSelectedEmployee(null);
  }, [isLoading, mappedStaff, selectedEmployee]);

  useEffect(() => {
    const { employeeId, employeeName } = getStaffNavigationQuery();
    if (!employeeId && !employeeName) return;
    if (employeeName) setSearchQuery(employeeName);

    const targetStaff = mappedStaff.find(
      (staff) => String(staff.id) === String(employeeId),
    );
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
          onEmployeeAction={handleEmployeeAction}
          onEditEmployee={() => openModal("editEmployee")}
          onEditAvatar={() => openModal("staffAvatar")}
          onViewHistory={() => openModal("workHistory")}
          onDeleteEmployee={handleDeleteEmployee}
          onSetOnLeave={(employeeId) =>
            handleEmploymentStatusChange(
              employeeId,
              "ON_LEAVE",
              "Đã chuyển nhân viên sang trạng thái nghỉ phép.",
            )
          }
          onSetWorking={(employeeId) =>
            handleEmploymentStatusChange(
              employeeId,
              "WORKING",
              "Đã chuyển nhân viên sang trạng thái đang làm việc.",
            )
          }
          onSetResigned={(employeeId) =>
            handleEmploymentStatusChange(
              employeeId,
              "RESIGNED",
              "Đã cập nhật nhân viên nghỉ việc.",
            )
          }
          onLockAccount={(employeeId) =>
            handleAccountStatusChange(
              employeeId,
              "blocked",
              "Đã khóa tài khoản nhân viên.",
            )
          }
          onUnlockAccount={(employeeId) =>
            handleAccountStatusChange(
              employeeId,
              "active",
              "Đã mở khóa tài khoản nhân viên.",
            )
          }
          onCalculateSalary={undefined}
          onResendVerification={handleResendVerification}
          roleList={roleList}
          loading={isLoading}
          error={staffListError}
          onRetry={refetchStaffList}
        />
      );
    }
    if (currentPage === "attendance") {
      return (
        <AttendancePage
          currentTime={currentTime}
          currentDate={currentDate}
          restaurantId={selectedRestaurant}
        />
      );
    }
    if (currentPage === "leave") {
      return <LeaveManagement restaurantId={selectedRestaurant} />;
    }
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
    handleAccountStatusChange,
    handleDeleteEmployee,
    handleEmployeeAction,
    handleEmploymentStatusChange,
    handleResendVerification,
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
            pendingReviewCount={pendingReviewCount}
            onPageChange={setCurrentPage}
            isCollapsed={isHeaderCollapsed}
            onToggle={() => setIsHeaderCollapsed((prev) => !prev)}
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </header>

        <nav className={`page-nav-wrapper ${isHeaderCollapsed ? "sticky" : ""}`}>
          <PageNavigation
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
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
      <StaffAvatarModal
        isOpen={modals.staffAvatar}
        employee={selectedEmployee}
        uploading={uploadingAvatar}
        onClose={() => closeModal("staffAvatar")}
        onSubmit={handleAvatarSubmit}
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
