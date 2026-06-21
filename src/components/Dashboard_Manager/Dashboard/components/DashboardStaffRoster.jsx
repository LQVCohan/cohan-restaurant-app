import React, { useContext, useEffect, useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { ArrowRight, UsersRound, Wifi } from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { hasPermission } from "@/utils/frontendPermissionAccess";
import {
  STAFF_DATA_CHANGED_EVENT,
  isSameRestaurantEvent,
} from "@/utils/staffSyncEvents";
import StaffAvatarMedia from "../../Staff/components/StaffAvatarMedia";
import "./DashboardStaffRoster.scss";

const DASHBOARD_STAFF_ROSTER_QUERY = gql`
  query DashboardStaffRoster(
    $restaurantId: ID
    $employmentStatus: EmploymentStatus
  ) {
    staffList(
      restaurantId: $restaurantId
      employmentStatus: $employmentStatus
    ) {
      id
      fullName
      avatarUrl
      employeeCode
      positionTitle
      department
      employmentStatus
      status
      isOnline
      role {
        id
        name
        slug
      }
    }
  }
`;

const getRoleLabel = (staff) =>
  staff?.positionTitle ||
  staff?.role?.name ||
  staff?.role?.slug ||
  staff?.department ||
  "Nhân viên";

const DashboardStaffRoster = ({ restaurantId, onOpenStaff }) => {
  const { user } = useContext(AuthContext);
  const canReadStaff = hasPermission(user, "staff.read");

  const { data, loading, error, refetch } = useQuery(
    DASHBOARD_STAFF_ROSTER_QUERY,
    {
      variables: {
        restaurantId: restaurantId || null,
        employmentStatus: "WORKING",
      },
      skip: !restaurantId || !canReadStaff,
      fetchPolicy: "cache-and-network",
      notifyOnNetworkStatusChange: true,
      pollInterval: restaurantId && canReadStaff ? 30000 : 0,
    },
  );

  const staff = useMemo(() => {
    const rows = Array.isArray(data?.staffList) ? data.staffList : [];
    return [...rows].sort((left, right) => {
      const onlineDifference =
        Number(Boolean(right?.isOnline)) - Number(Boolean(left?.isOnline));
      if (onlineDifference) return onlineDifference;
      return String(left?.fullName || "").localeCompare(
        String(right?.fullName || ""),
        "vi",
      );
    });
  }, [data?.staffList]);

  const visibleStaff = staff.slice(0, 6);
  const onlineCount = staff.filter((item) => item?.isOnline).length;

  useEffect(() => {
    if (!restaurantId || !canReadStaff) return undefined;

    const handleStaffDataChanged = (event) => {
      if (!isSameRestaurantEvent(event, restaurantId)) return;
      void refetch({
        restaurantId,
        employmentStatus: "WORKING",
      });
    };
    const handleFocus = () => {
      void refetch({
        restaurantId,
        employmentStatus: "WORKING",
      });
    };

    window.addEventListener(STAFF_DATA_CHANGED_EVENT, handleStaffDataChanged);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener(STAFF_DATA_CHANGED_EVENT, handleStaffDataChanged);
      window.removeEventListener("focus", handleFocus);
    };
  }, [canReadStaff, refetch, restaurantId]);

  if (!canReadStaff) return null;

  return (
    <article className="dashboard-card dashboard-card--side dashboard-staff-roster">
      <div className="dashboard-card__head dashboard-card__head--compact">
        <div>
          <h3>Nhân sự đang làm việc</h3>
          <p>Ảnh và trạng thái được đồng bộ từ hồ sơ nhân viên.</p>
        </div>
        <span className="dashboard-staff-roster__count">
          <UsersRound size={14} />
          {loading && !staff.length ? "..." : staff.length}
        </span>
      </div>

      {loading && !staff.length ? (
        <div className="dashboard-staff-roster__loading" role="status">
          {[0, 1, 2].map((item) => (
            <span key={item} />
          ))}
        </div>
      ) : error ? (
        <div className="dashboard-staff-roster__state is-error">
          Không thể tải danh sách nhân sự.
        </div>
      ) : visibleStaff.length ? (
        <div className="dashboard-staff-roster__list">
          {visibleStaff.map((employee) => (
            <div className="dashboard-staff-roster__item" key={employee.id}>
              <div className="dashboard-staff-roster__avatar-wrap">
                <StaffAvatarMedia
                  employee={employee}
                  name={employee.fullName}
                  className="dashboard-staff-roster__avatar"
                  iconSize={18}
                />
                <span
                  className={`dashboard-staff-roster__presence ${employee.isOnline ? "is-online" : ""}`}
                  title={employee.isOnline ? "Đang trực tuyến" : "Ngoại tuyến"}
                />
              </div>
              <div className="dashboard-staff-roster__identity">
                <strong>{employee.fullName || "Nhân viên"}</strong>
                <span>{getRoleLabel(employee)}</span>
              </div>
              {employee.isOnline ? (
                <Wifi
                  size={14}
                  className="dashboard-staff-roster__online-icon"
                  aria-label="Đang trực tuyến"
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard-staff-roster__state">
          Chưa có nhân viên ở trạng thái đang làm việc.
        </div>
      )}

      <div className="dashboard-staff-roster__footer">
        <span>{onlineCount} nhân viên đang trực tuyến</span>
        <button type="button" onClick={onOpenStaff} disabled={!onOpenStaff}>
          Quản lý nhân sự
          <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
};

export { DASHBOARD_STAFF_ROSTER_QUERY, getRoleLabel };
export default DashboardStaffRoster;
