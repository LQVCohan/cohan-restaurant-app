import React, { useContext, useMemo, useState } from "react";
import { AuthContext } from "@/context/AuthContext";
import useOvertimeManagement from "@/hooks/useOvertimeManagement";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;
const OPERATIONAL_STAFF_ROLES = new Set([
  "staff",
  "server",
  "supervisor",
  "host",
  "cashier",
  "chef",
  "cook",
  "kitchen_helper",
  "cleaner",
  "shipper",
  "storekeeper",
  "bartender",
]);

const normalizeRole = (value) => String(value || "").trim().toLowerCase();
const normalizeId = (value) => {
  if (!value) return "";
  if (typeof value === "object") {
    return String(value.id ?? value._id ?? value.restaurantId ?? "").trim();
  }
  return String(value).trim();
};
const resolveRole = (user) =>
  normalizeRole(user?.roleName || user?.role?.slug || user?.role || user?.userType);
const isStaffActor = (user) =>
  normalizeRole(user?.userType) === "staff" || OPERATIONAL_STAFF_ROLES.has(resolveRole(user));
const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const toStart = (key) => `${key}T00:00:00.000+07:00`;
const toEnd = (key) => `${key}T23:59:59.999+07:00`;
const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function StaffOvertimeConfirmation() {
  const { user, restaurants } = useContext(AuthContext) || {};
  const [feedback, setFeedback] = useState(null);
  const employeeId = normalizeId(user?.id || user?._id || user?.userId);
  const restaurantId = normalizeId(
    user?.restaurantForStaff || user?.restaurant || restaurants?.[0],
  );
  const hasValidScope =
    isStaffActor(user) &&
    OBJECT_ID_PATTERN.test(employeeId) &&
    OBJECT_ID_PATTERN.test(restaurantId);

  const dateRange = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const end = new Date();
    end.setDate(end.getDate() + 90);
    return {
      startDate: hasValidScope ? toStart(toDateKey(start)) : undefined,
      endDate: hasValidScope ? toEnd(toDateKey(end)) : undefined,
    };
  }, [hasValidScope]);

  const {
    overtimeRequests = [],
    loading,
    error,
    confirmOvertimeRequest,
    confirmState = { loading: false },
  } = useOvertimeManagement({
    ...dateRange,
    status: "pending_employee_confirmation",
    restaurantId: hasValidScope ? restaurantId : undefined,
    employeeId: hasValidScope ? employeeId : undefined,
  });

  if (!hasValidScope) return null;

  const pendingOwnRequests = overtimeRequests.filter(
    (request) =>
      request.status === "pending_employee_confirmation" &&
      String(request.employeeId) === employeeId,
  );

  const confirm = async (request) => {
    setFeedback(null);
    try {
      await confirmOvertimeRequest(request.id);
      setFeedback({
        type: "success",
        message: "Đã xác nhận đề nghị tăng ca. Yêu cầu đang chờ quản lý duyệt.",
      });
    } catch (submitError) {
      setFeedback({
        type: "error",
        message:
          submitError?.graphQLErrors?.[0]?.message ||
          submitError?.message ||
          "Không thể xác nhận đề nghị tăng ca.",
      });
    }
  };

  if (!loading && !error && pendingOwnRequests.length === 0) return null;

  return (
    <section className="staff-attendance-history" aria-label="Đề nghị tăng ca cần xác nhận">
      <article className="staff-attendance-card">
        <h2>Đề nghị tăng ca cần bạn xác nhận</h2>
        <p>Đây là đề nghị do quản lý tạo. Sau khi bạn xác nhận, yêu cầu mới chuyển sang bước duyệt.</p>
        {feedback && (
          <div className={`staff-attendance-feedback staff-attendance-feedback--${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
            {feedback.message}
          </div>
        )}
        {error && (
          <div className="staff-attendance-feedback staff-attendance-feedback--error" role="alert">
            {error.message || "Không tải được đề nghị tăng ca cần xác nhận."}
          </div>
        )}
        {loading ? (
          <div className="staff-attendance-empty">Đang tải...</div>
        ) : (
          <div className="staff-attendance-history-list">
            {pendingOwnRequests.map((request) => (
              <div className="staff-attendance-history-item" key={request.id}>
                <div>
                  <strong>{formatDateTime(request.plannedStartTime)} – {formatDateTime(request.plannedEndTime)}</strong>
                  <span>{request.reason}</span>
                </div>
                <div className="staff-attendance-history-actions">
                  <span className="staff-attendance-pill staff-attendance-pill--pending_employee_confirmation">
                    chờ bạn xác nhận
                  </span>
                  <button
                    type="button"
                    onClick={() => confirm(request)}
                    disabled={confirmState.loading}
                  >
                    Xác nhận tăng ca
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
