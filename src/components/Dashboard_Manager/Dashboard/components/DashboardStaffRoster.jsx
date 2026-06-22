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

const ROLE_LABELS = {
  bartender: "Nhân viên pha chế",
  cashier: "Thu ngân",
  chef: "Bếp trưởng",
  cleaner: "Nhân viên vệ sinh",
  cook: "Nhân viên bếp",
  host: "Nhân viên đón khách",
  manager: "Quản lý",
  server: "Nhân viên phục vụ",
  waiter: "Nhân viên phục vụ",
  waitress: "Nhân viên phục vụ",
};

const getRoleLabel = (staff) => {
  const rawLabel =
    staff?.positionTitle ||
    staff?.role?.name ||
    staff?.role?.slug ||
    staff?.department ||
    "";
  const normalizedLabel = String(rawLabel).trim().toLowerCase();

  return ROLE_LABELS[normalizedLabel] || rawLabel || "Chưa cập nhật chức danh";
};

const compareByName = (left, right) =>
  String(left?.fullName || "").localeCompare(
    String(right?.fullName || ""),
    "vi",
  );

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

  const { staff, onlineCount, visibleStaff } = useMemo(() => {
    const rows = Array.isArray(data?.staffList) ? data.staffList : [];
    const onlineStaff = rows
      .filter((item) => item?.isOnline === true)
      .sort(compareByName);
    const offlineStaff = rows
      .filter((item) => item?.isOnline !== true)
      .sort(compareByName);
    const orderedStaff = [...onlineStaff, ...offlineStaff];

    return {
      staff: orderedStaff,
      onlineCount: onlineStaff.length,
      visibleStaff: orderedStaff.slice(0, 6),
    };
  }, [data?.staffList]);

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
          <h3>Nhân viên của nhà hàng</h3>
          <p>{staff.length} nhân viên đang công tác tại nhà hàng.</p>
        </div>
        <span className="dashboard-staff-roster__count">
          <UsersRound size={14} />
          {loading && !staff.length ? "..." : `${staff.length} nhân viên`}
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
          Không thể tải danh sách nhân viên.
        </div>
      ) : visibleStaff.length ? (
        <div className="dashboard-staff-roster__list">
          {onlineCount > 0 ? (
            <p className="dashboard-staff-roster__group-label">
              Đang trực tuyến
            </p>
          ) : null}
          {visibleStaff.map((employee, index) => {
            const isFirstOffline =
              onlineCount > 0 && index === Math.min(onlineCount, 6);

            return (
              <React.Fragment key={employee.id}>
                {isFirstOffline ? (
                  <p className="dashboard-staff-roster__group-label dashboard-staff-roster__group-label--muted">
                    Nhân viên khác
                  </p>
                ) : null}
                <div className="dashboard-staff-roster__item">
                  <div className="dashboard-staff-roster__avatar-wrap">
                    <StaffAvatarMedia
                      employee={employee}
                      name={employee.fullName}
                      className="dashboard-staff-roster__avatar"
                      iconSize={18}
                    />
                    <span
                      className={`dashboard-staff-roster__presence ${employee.isOnline ? "is-online" : ""}`}
                      title={
                        employee.isOnline
                          ? "Đang trực tuyến"
                          : "Không trực tuyến"
                      }
                    />
                  </div>
                  <div className="dashboard-staff-roster__identity">
                    <strong>{employee.fullName || "Chưa cập nhật tên"}</strong>
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
              </React.Fragment>
            );
          })}
        </div>
      ) : (
        <div className="dashboard-staff-roster__state">
          Chưa có nhân viên đang công tác tại nhà hàng này.
        </div>
      )}

      <div className="dashboard-staff-roster__footer">
        <span>{onlineCount} người đang trực tuyến</span>
        <button type="button" onClick={onOpenStaff} disabled={!onOpenStaff}>
          Xem tất cả nhân viên
          <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
};

export { DASHBOARD_STAFF_ROSTER_QUERY, getRoleLabel };
export default DashboardStaffRoster;
