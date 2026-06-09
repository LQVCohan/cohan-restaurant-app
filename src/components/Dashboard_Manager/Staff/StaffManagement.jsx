// src/pages/StaffManagement/index.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { gql, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import StaffHeader from "./components/Header"; // Giả sử đã đổi tên file component Header mới
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
  StaffActionConfirmModal,
} from "./components/modals";

import useStaffManagement from "../../../hooks/useStaffManagement";
import { useTime } from "../../../hooks/useTime";
import useManagerRestaurantSelection from "../../../hooks/useManagerRestaurantSelection";
import { useNotification } from "@/hooks/useNotification";
import { matchesEmployeeSearch } from "../../../utils/employeeSearch";
import {
  getStaffListStatus,
  normalizeAccountStatus,
  normalizeEmploymentStatus,
} from "./staffStatus";

// Import styles
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
const getStaffFocusParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    employeeId: params.get("employeeId") || "",
    employeeName: params.get("employeeName") || "",
  };
};

const getStaffNavigationQuery = () => {
  const params = new URLSearchParams(window.location.search || "");
  return {
    staffPage: params.get("staffPage") || "",
    employeeId: params.get("employeeId") || "",
    employeeName: params.get("employeeName") || "",
  };
};

const STAFF_SUB_PAGES = new Set([
  "dashboard",
  "attendance",
  "leave",
  "schedule",
  "performance",
  "reports",
]);

const StaffManagement = () => {
  // --- STATE ---
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [focusedEmployeeId, setFocusedEmployeeId] = useState("");
  const [navigationQueryVersion, setNavigationQueryVersion] = useState(0);
  const [pendingAction, setPendingAction] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigationQuery = (event) => {
      if (event?.detail?.page !== "staff") return;

      const nextStaffPage =
        event?.detail?.query?.staffPage || getStaffNavigationQuery().staffPage;

      if (nextStaffPage && STAFF_SUB_PAGES.has(nextStaffPage)) {
        setCurrentPage(nextStaffPage);
      }

      setNavigationQueryVersion((value) => value + 1);
    };

    window.addEventListener("manager:navigation-query", handleNavigationQuery);
    return () =>
      window.removeEventListener("manager:navigation-query", handleNavigationQuery);
  }, []);

  useEffect(() => {
    const { staffPage } = getStaffNavigationQuery();

    if (staffPage && STAFF_SUB_PAGES.has(staffPage)) {
      setCurrentPage(staffPage);
    }
  }, [navigationQueryVersion]);

  const [modals, setModals] = useState({
    addEmployee: false,
    editEmployee: false,
    workHistory: false,
  });

  // --- HOOKS & CONTEXT ---
  const { showNotification } = useNotification();
  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
  } = useManagerRestaurantSelection();
  const selectedRestaurant = selectedRestaurantId;
  const { currentTime, currentDate } = useTime();

  // --- DATA FETCHING ---
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
    staffListError,
    creatingStaff,
    updatingStaff,
    softDeletingStaff,
    changingEmploymentStatus,
    changingUserStatus,
    resendingVerification,
  } = useStaffManagement({
    restaurantId: selectedRestaurant || null,
    page: 1,
    pageSize: 50,
    pollInterval: selectedRestaurant ? 15000 : 0,
  }); // Tăng pageSize để demo mượt

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

  // --- FILTER & LOGIC ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
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
  // Client-side filtering (nếu cần filter thêm ở client)
  const filteredStaff = useMemo(() => {
    if (!staffList) return [];
    let result = staffList;

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
        staff.raw?.restaurantForStaff,
        ...(Array.isArray(staff.refRestaurants) ? staff.refRestaurants : []),
        ...(Array.isArray(staff.raw?.refRestaurants) ? staff.raw.refRestaurants : []),
      ]
        .map(normalizeId)
        .filter(Boolean);

      return staffRestaurantIds.some((id) => allowedIds.includes(id));
    };

    // Filter by Restaurant
    if (selectedRestaurant) {
      result = result.filter((s) => hasRestaurantMatch(s, selectedRestaurant));
    }

    // Filter by Search (Local fallback)
    if (debouncedSearchQuery) {
      result = result.filter((s) => matchesEmployeeSearch(s, debouncedSearchQuery));
    }
    return result;
  }, [staffList, selectedRestaurant, debouncedSearchQuery]);

  // Map Data Model
  const mappedStaff = useMemo(
    () =>
      filteredStaff.map((staff) => {
        const accountStatus = normalizeAccountStatus(staff.status);
        const employmentStatus = normalizeEmploymentStatus(
          staff.employmentStatus,
        );
        return {
          id: staff.id,
          name: staff.fullName,
          code: staff.employeeCode,
          role: staff.positionTitle || staff.role?.name || "N/A",
          roleId: staff.role?.id || null,
          roleSlug: staff.role?.slug || "",
          roleName: staff.role?.name || staff.roleName || "",
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
          address: staff.address ? [staff.address.line1, staff.address.ward, staff.address.district, staff.address.city].filter(Boolean).join(", ") : "",
          employmentType: staff.employmentType,
          workingDays: staff.workingDays || [],
          dateLeft: staff.dateLeft,
          taxCode: staff.taxCode,
          emergencyContact: staff.emergencyContact,
          noteInternal: staff.noteInternal,
          emailVerified: Boolean(staff.emailVerified),
          phoneVerified: Boolean(staff.phoneVerified),
          verificationStatus: staff.emailVerified || staff.phoneVerified ? "verified" : staff.status === "pending" ? "pending" : "unverified",
          verificationLabel: staff.emailVerified
            ? "Đã xác minh email"
            : staff.phoneVerified
              ? "Đã xác minh SĐT"
              : staff.status === "pending"
                ? "Chờ xác minh"
                : "Chưa xác minh",
          canResendVerification: Boolean((staff.email && !staff.emailVerified) || (staff.phone && !staff.phoneVerified)),
          raw: staff,
        };
      }),
    [filteredStaff],
  );

  // Calculate Stats
  const stats = useMemo(
    () => ({
      totalStaff: filteredStaff.length,
      activeStaff: filteredStaff.filter((s) => s.isOnline).length,
      onLeaveStaff: filteredStaff.filter(
        (s) => s.employmentStatus === "ON_LEAVE",
      ).length,
      avgRate: 0,
    }),
    [filteredStaff],
  );

  const pendingLeaveCount = useMemo(() => {
    const requests = pendingLeaveData?.leaveRequests || [];
    if (!requests.length) return 0;
    if (selectedRestaurant) {
      return requests.filter(
        (request) => request.restaurantId === selectedRestaurant,
      ).length;
    }
    return 0;
  }, [pendingLeaveData?.leaveRequests, selectedRestaurant]);

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
      const created = await createStaff(val);
      await refetchStaffList?.();
      if (created) setSelectedEmployee(created);
      closeModal("addEmployee");
      showNotification("Đã thêm nhân viên thành công.", "success");
    },
    [createStaff, closeModal, refetchStaffList, showNotification],
  );
  const handleEditEmployee = useCallback(
    async (val) => {
      if (!selectedEmployee?.id) return;
      const updated = await updateStaff(selectedEmployee.id, val);
      await refetchStaffList?.();
      if (updated) setSelectedEmployee(updated);
      closeModal("editEmployee");
      showNotification("Đã cập nhật hồ sơ nhân viên.", "success");
    },
    [closeModal, refetchStaffList, selectedEmployee?.id, showNotification, updateStaff],
  );
  const requestStaffAction = useCallback((action) => setPendingAction(action), []);

  const handleSetEmploymentStatus = useCallback(
    (employee, status) => {
      const id = employee?.id || employee;
      if (!id) return;
      const labelMap = { WORKING: "đang làm việc", ON_LEAVE: "tạm nghỉ", RESIGNED: "nghỉ việc" };
      if (status === "WORKING") {
        requestStaffAction({
          type: "employment",
          id,
          status,
          tone: "success",
          title: "Chuyển trạng thái lao động",
          message: `Chuyển nhân viên sang trạng thái ${labelMap[status]}?`,
          description: "Nhân viên sẽ được đưa lại vào danh sách đang làm việc.",
          confirmText: "Chuyển sang đang làm",
        });
        return;
      }
      requestStaffAction({
        type: "employment",
        id,
        status,
        tone: status === "RESIGNED" ? "danger" : "warning",
        title: "Xác nhận đổi trạng thái lao động",
        message: `Chuyển nhân viên sang trạng thái ${labelMap[status]}?`,
        description: status === "RESIGNED"
          ? "Nhân viên nghỉ việc sẽ không còn được xem là đang làm trong hồ sơ quản lý."
          : "Trạng thái tạm nghỉ dùng cho nhân viên đang nghỉ có thời hạn và có thể chuyển lại đang làm.",
        confirmText: status === "RESIGNED" ? "Xác nhận nghỉ việc" : "Xác nhận tạm nghỉ",
      });
    },
    [requestStaffAction],
  );

  const handleSetOnLeave = useCallback(
    (employeeOrId) => handleSetEmploymentStatus(employeeOrId, "ON_LEAVE"),
    [handleSetEmploymentStatus],
  );
  const handleSetWorking = useCallback(
    (employeeOrId) => handleSetEmploymentStatus(employeeOrId, "WORKING"),
    [handleSetEmploymentStatus],
  );
  const handleSetResigned = useCallback(
    (employeeOrId) => handleSetEmploymentStatus(employeeOrId, "RESIGNED"),
    [handleSetEmploymentStatus],
  );
  const handleLockAccount = useCallback(
    (employeeOrId) => {
      const id = employeeOrId?.id || employeeOrId;
      if (!id) return;
      requestStaffAction({
        type: "account",
        id,
        status: "blocked",
        tone: "danger",
        title: "Khóa tài khoản nhân viên",
        message: "Khóa tài khoản sẽ chặn nhân viên đăng nhập.",
        description: "Hồ sơ nhân viên vẫn được lưu để quản lý và có thể mở khóa lại khi cần.",
        confirmText: "Khóa tài khoản",
      });
    },
    [requestStaffAction],
  );
  const handleUnlockAccount = useCallback(
    (employeeOrId) => {
      const id = employeeOrId?.id || employeeOrId;
      if (!id) return;
      requestStaffAction({
        type: "account",
        id,
        status: "active",
        tone: "success",
        title: "Mở khóa tài khoản",
        message: "Mở khóa cho phép tài khoản hoạt động và đăng nhập lại.",
        description: "Hãy đảm bảo nhân viên đã đủ điều kiện quay lại sử dụng hệ thống.",
        confirmText: "Mở khóa",
      });
    },
    [requestStaffAction],
  );
  const handleResendStaffVerification = useCallback(
    async (employee, channel = "AUTO") => {
      const userId = employee?.id || employee;
      if (!userId) return;
      try {
        const result = await resendStaffVerification(userId, channel);
        if (result?.status === "SENT") showNotification("Đã gửi xác nhận.", "success");
        else if (result?.status === "ALREADY_VERIFIED") showNotification("Tài khoản đã được xác minh, không cần gửi lại.", "success");
        else if (result?.status === "COOLDOWN") showNotification("Vui lòng chờ trước khi gửi lại xác nhận.", "warning");
        else if (result?.status === "NOT_CONFIGURED") showNotification("Email/SMS provider chưa được cấu hình. Tài khoản đã tạo nhưng chưa gửi xác nhận.", "warning");
        else showNotification(result?.message || result?.errors?.[0] || "Không thể gửi xác nhận.", "warning");
      } catch (err) {
        showNotification(err?.message || "Không thể gửi xác nhận.", "error");
      }
    },
    [resendStaffVerification, showNotification],
  );

  const handleCalculateSalary = useCallback(
    (employee) => {
      if (!employee?.id) return;
      navigate(
        `/manager?employeeId=${encodeURIComponent(employee.id)}#payroll`,
      );
    },
    [navigate],
  );
  const handleSoftDeleteAccount = useCallback(
    (employeeOrId) => {
      const id = employeeOrId?.id || employeeOrId;
      if (!id) return;
      requestStaffAction({
        type: "softDelete",
        id,
        tone: "danger",
        title: "Xóa mềm nhân viên",
        message: "Tài khoản sẽ vào thùng rác hoặc không còn hoạt động trong danh sách quản lý.",
        description: "Đây là xóa mềm, không xóa vĩnh viễn dữ liệu nhân viên.",
        confirmText: "Xóa mềm",
      });
    },
    [requestStaffAction],
  );


  const handleConfirmPendingAction = useCallback(async () => {
    if (!pendingAction?.id) return;
    try {
      let updated = null;
      if (pendingAction.type === "employment") {
        updated = await setStaffEmploymentStatus(pendingAction.id, pendingAction.status);
        showNotification("Đã cập nhật trạng thái lao động.", "success");
      } else if (pendingAction.type === "account") {
        updated = await setStaffAccountStatus(pendingAction.id, pendingAction.status);
        showNotification(
          pendingAction.status === "blocked" ? "Đã khóa tài khoản nhân viên." : "Đã mở khóa tài khoản nhân viên.",
          "success",
        );
      } else if (pendingAction.type === "softDelete") {
        await softDeleteStaff(pendingAction.id);
        if (selectedEmployee?.id === pendingAction.id) setSelectedEmployee(null);
        showNotification("Đã xóa mềm nhân viên.", "success");
      }
      await refetchStaffList?.();
      if (updated && selectedEmployee?.id === pendingAction.id) {
        setSelectedEmployee(updated);
      }
      setPendingAction(null);
    } catch (err) {
      showNotification(err?.message || "Không thể thực hiện thao tác. Vui lòng thử lại.", "error");
    }
  }, [
    pendingAction,
    refetchStaffList,
    selectedEmployee?.id,
    setStaffAccountStatus,
    setStaffEmploymentStatus,
    showNotification,
    softDeleteStaff,
  ]);

  const handleOpenEditEmployee = useCallback(
    () => openModal("editEmployee"),
    [openModal],
  );
  const handleOpenWorkHistory = useCallback(
    () => openModal("workHistory"),
    [openModal],
  );

  const isLoading = staffListLoading || restaurantsLoading;
  const isHeaderLoading = restaurantsLoading || staffListLoading || pendingLeaveLoading;

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

    if (!isLoading) {
      setSelectedEmployee(null);
    }
  }, [isLoading, mappedStaff, selectedEmployee]);
  useEffect(() => {
    const { employeeId, employeeName } = getStaffFocusParams();
    if (!employeeId && !employeeName) return;
    if (employeeName) setSearchQuery(employeeName);
    const targetStaff = mappedStaff.find(
      (staff) => String(staff.id) === String(employeeId),
    );
    if (targetStaff) {
      setCurrentPage("dashboard");
      setSelectedEmployee(targetStaff);
      setFocusedEmployeeId(String(targetStaff.id));
      requestAnimationFrame(() => {
        const targetRow = document.querySelector(
          `[data-employee-id="${targetStaff.id}"]`,
        );
        targetRow?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      window.setTimeout(() => setFocusedEmployeeId(""), 3000);
    }
  }, [mappedStaff, navigationQueryVersion]);

  const mainContent = useMemo(() => {
    if (currentPage === "dashboard") {
      return (
        <EmployeeDashboard
          employees={mappedStaff}
          selectedEmployee={selectedEmployee}
          focusedEmployeeId={focusedEmployeeId}
          onEmployeeSelect={setSelectedEmployee}
          onEditEmployee={handleOpenEditEmployee}
          onViewHistory={handleOpenWorkHistory}
          onDeleteEmployee={handleSoftDeleteAccount}
          onSetOnLeave={handleSetOnLeave}
          onSetWorking={handleSetWorking}
          onSetResigned={handleSetResigned}
          onLockAccount={handleLockAccount}
          onUnlockAccount={handleUnlockAccount}
          onCalculateSalary={handleCalculateSalary}
          onResendVerification={handleResendStaffVerification}
          roleList={roleList}
          loading={isLoading}
          error={staffListError}
          onRetry={refetchStaffList}
        />
      );
    }
    if (currentPage === "attendance") {
      return (
        <AttendancePage currentTime={currentTime} currentDate={currentDate} />
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
    restaurantOptions,
    searchQuery,
    selectedRestaurant,
    currentDate,
    currentPage,
    currentTime,
    focusedEmployeeId,
    handleCalculateSalary,
    handleSoftDeleteAccount,
    handleLockAccount,
    handleOpenEditEmployee,
    handleOpenWorkHistory,
    handleResendStaffVerification,
    handleSetOnLeave,
    handleSetResigned,
    handleSetWorking,
    handleUnlockAccount,
    isLoading,
    mappedStaff,
    roleList,
    selectedEmployee,
    staffListError,
    refetchStaffList,
    setSelectedEmployee,
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
            onRestaurantChange={setSelectedRestaurantId}
            onAddEmployee={() => openModal("addEmployee")}
            onExportData={undefined}
            restaurantList={restaurantOptions}
            stats={stats}
            loading={isHeaderLoading}
            pendingLeaveCount={pendingLeaveCount}
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
        <main className="page-main-view fade-in-up">{mainContent}</main>
      </div>

      {/* MODAL PORTAL AREA */}
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
      <StaffActionConfirmModal
        isOpen={Boolean(pendingAction)}
        title={pendingAction?.title}
        message={pendingAction?.message}
        description={pendingAction?.description}
        tone={pendingAction?.tone}
        confirmText={pendingAction?.confirmText}
        isLoading={
          changingEmploymentStatus ||
          changingUserStatus ||
          softDeletingStaff ||
          creatingStaff ||
          updatingStaff ||
          resendingVerification
        }
        onCancel={() => setPendingAction(null)}
        onConfirm={handleConfirmPendingAction}
      />
    </div>
  );
};

export default StaffManagement;
