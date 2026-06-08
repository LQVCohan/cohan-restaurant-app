import React, { useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import Modal from "../../../../../common/Modal";
import LoadingSpinner from "../../../../../common/LoadingSpinner";
import Badge from "../../../../../common/Badge";
import "./WorkHistoryModal.scss";

const QUERY_STAFF_WORK_HISTORY = gql`
  query StaffWorkHistory(
    $staffId: ID
    $startDate: DateTime!
    $endDate: DateTime!
    $limit: Int
  ) {
    staffAttendanceRecords(
      employeeId: $staffId
      startDate: $startDate
      endDate: $endDate
    ) {
      id
      workDate
      shiftType
      plannedStartTime
      plannedEndTime
      actualCheckInAt
      actualCheckOutAt
      workedMinutes
      latenessMinutes
      earlyLeaveMinutes
      overtimeMinutes
      status
      note
    }
    staffShiftHistory(staffId: $staffId, limit: $limit) {
      id
      shiftType
      startTime
      endTime
      status
      notes
      restaurant {
        id
        name
      }
    }
  }
`;

const toIsoStartOfDay = (value) => `${value}T00:00:00.000Z`;
const toIsoEndOfDay = (value) => `${value}T23:59:59.999Z`;

const WorkHistoryModal = ({ isOpen, onClose, employee }) => {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 60);
    return {
      startDate: toIsoStartOfDay(start.toISOString().split("T")[0]),
      endDate: toIsoEndOfDay(end.toISOString().split("T")[0]),
    };
  }, []);

  const { data, loading, error } = useQuery(QUERY_STAFF_WORK_HISTORY, {
    variables: {
      staffId: employee?.id || null,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      limit: 50,
    },
    skip: !isOpen || !employee?.id,
    fetchPolicy: "network-only",
  });

  const history = useMemo(() => {
    const attendanceRows = (data?.staffAttendanceRecords || []).map((row) => ({
      id: `attendance-${row.id}`,
      date: row.workDate,
      type: "attendance",
      action: row.status || "attendance",
      time: row.actualCheckInAt && row.actualCheckOutAt
        ? `${new Date(row.actualCheckInAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })} - ${new Date(row.actualCheckOutAt).toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : row.plannedStartTime && row.plannedEndTime
          ? `${new Date(row.plannedStartTime).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })} - ${new Date(row.plannedEndTime).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "--",
      description: row.note || `Chấm công ca ${row.shiftType || "không xác định"}`,
      status: row.status || "completed",
      duration: row.workedMinutes ? `${Math.round(Number(row.workedMinutes) / 60)}h` : null,
      overtime: Number(row.overtimeMinutes || 0),
      warnings: [
        Number(row.latenessMinutes || 0) > 0 ? `Đi muộn ${row.latenessMinutes} phút` : null,
        Number(row.earlyLeaveMinutes || 0) > 0 ? `Về sớm ${row.earlyLeaveMinutes} phút` : null,
        ["scheduled_absent", "absent"].includes(row.status) ? "Vắng ca" : null,
        row.status === "late_early_leave" ? "Đi muộn / về sớm" : null,
      ].filter(Boolean),
    }));

    const shiftRows = (data?.staffShiftHistory || []).map((row) => ({
      id: `shift-${row.id}`,
      date: row.startTime || row.endTime || new Date().toISOString(),
      type: "shift",
      action: row.status || "shift",
      time:
        row.startTime && row.endTime
          ? `${new Date(row.startTime).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })} - ${new Date(row.endTime).toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "--",
      description:
        row.notes ||
        `Ca ${row.shiftType || "không xác định"}${
          row.restaurant?.name ? ` tại ${row.restaurant.name}` : ""
        }`,
      status: row.status || "completed",
      duration: null,
      overtime: 0,
      warnings: row.status === "cancelled" ? ["Ca đã hủy"] : [],
    }));

    return [...attendanceRows, ...shiftRows];
  }, [data?.staffAttendanceRecords, data?.staffShiftHistory]);

  const getTypeIcon = (type) => {
    if (type === "attendance") return "🕒";
    if (type === "shift") return "📅";
    return "📝";
  };

  const getTypeLabel = (type) => {
    if (type === "attendance") return "Chấm công";
    if (type === "shift") return "Ca làm";
    return "Khác";
  };

  const getStatusVariant = (status) => {
    if (["completed", "paid"].includes(status)) return "success";
    if (["approved", "locked", "finalized"].includes(status)) return "info";
    if (["pending", "scheduled_absent", "late", "early_leave", "late_early_leave"].includes(status))
      return "warning";
    if (["rejected", "cancelled"].includes(status)) return "danger";
    return "default";
  };

  const filteredHistory = history.filter((item) => {
    if (filter === "all") return true;
    return item.type === filter;
  });

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    if (sortBy === "type") return a.type.localeCompare(b.type);
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const totalPages = Math.ceil(sortedHistory.length / itemsPerPage);
  const paginatedHistory = sortedHistory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const summary = useMemo(() => {
    const attendanceCount = history.filter((h) => h.type === "attendance").length;
    const shiftCount = history.filter((h) => h.type === "shift").length;
    const warnings = history.filter((h) =>
      ["scheduled_absent", "late", "early_leave", "late_early_leave"].includes(h.status)
    ).length;
    const overtimeMinutes = history.reduce((sum, h) => sum + Number(h.overtime || 0), 0);
    return { attendanceCount, shiftCount, warnings, overtimeMinutes };
  }, [history]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" className="work-history-modal">
      <div className="work-history-modal__header">
        <div>
          <h2>Lịch sử làm việc</h2>
          <p>{employee?.name || "Nhân viên"} — chấm công & ca làm gần nhất</p>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">🕒</div>
          <div className="card-content">
            <div className="card-value">{summary.attendanceCount}</div>
            <div className="card-label">Lượt chấm công</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">📅</div>
          <div className="card-content">
            <div className="card-value">{summary.shiftCount}</div>
            <div className="card-label">Lịch sử ca</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">⚠️</div>
          <div className="card-content">
            <div className="card-value">{summary.warnings}</div>
            <div className="card-label">Bất thường</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">⏳</div>
          <div className="card-content">
            <div className="card-value">{summary.overtimeMinutes}</div>
            <div className="card-label">Phút tăng ca</div>
          </div>
        </div>
      </div>

      <div className="history-filters">
        <div className="filter-group">
          <label className="filter-label">Lọc theo loại:</label>
          <select
            className="filter-select"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Tất cả</option>
            <option value="attendance">Chấm công</option>
            <option value="shift">Ca làm</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">Sắp xếp:</label>
          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date">Theo ngày</option>
            <option value="type">Theo loại</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="history-loading">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="history-empty">Không tải được lịch sử làm việc.</div>
      ) : paginatedHistory.length === 0 ? (
        <div className="history-empty">Chưa có dữ liệu lịch sử làm việc.</div>
      ) : (
        <div className="history-list">
          {paginatedHistory.map((item) => (
            <div key={item.id} className="history-item">
              <div className="item-icon">{getTypeIcon(item.type)}</div>
              <div className="item-content">
                <div className="item-header">
                  <div className="item-title">
                    <span className="item-type">{getTypeLabel(item.type)}</span>
                    <Badge variant={getStatusVariant(item.status)} size="small">
                      {item.status}
                    </Badge>
                  </div>
                  <div className="item-date">
                    {new Date(item.date).toLocaleDateString("vi-VN")}
                  </div>
                </div>
                <div className="item-description">{item.description}</div>
                <div className="item-details">
                  <span className="detail-item">🕐 {item.time}</span>
                  {item.duration && <span className="detail-item">⏱️ {item.duration}</span>}
                  {item.overtime > 0 && <span className="detail-item">⚡ Tăng ca {item.overtime} phút</span>}
                </div>
                {item.warnings?.length ? (
                  <div className="item-warnings">
                    {item.warnings.map((warning) => (
                      <span key={warning} className="warning-chip">⚠️ {warning}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            ← Trước
          </button>
          <span className="pagination-info">
            Trang {currentPage} / {totalPages}
          </span>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Sau →
          </button>
        </div>
      )}
    </Modal>
  );
};

export default WorkHistoryModal;
