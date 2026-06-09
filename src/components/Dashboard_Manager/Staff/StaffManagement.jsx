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
import { getStaffRoleDisplayLabel } from "../../../utils/staffRoleOptions";
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
        const roleLabel = getStaffRoleDisplayLabel(staff.role) || getStaffRoleDisplayLabel(staff.roleName);
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