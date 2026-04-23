import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import useStaffReports, { buildPresetRange } from "@/hooks/useStaffReports";
import { downloadXlsxWorkbook } from "@/utils/xlsxWorkbook";
import "./StaffReportsPage.scss";

const PIE_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const KPI_CONFIG = [
  { key: "activeEmployees", label: "Đang hoạt động" },
  { key: "terminatedEmployees", label: "Đã nghỉ việc" },
  { key: "joinedEmployees", label: "Nhân sự vào kỳ này" },
  { key: "leftEmployees", label: "Nhân sự rời kỳ này" },
  { key: "presentCount", label: "Có mặt" },
  { key: "absentCount", label: "Vắng" },
  { key: "lateCount", label: "Đi muộn" },
  { key: "earlyLeaveCount", label: "Về sớm" },
  { key: "leaveTotal", label: "Đơn nghỉ" },
  { key: "leaveDaysUsed", label: "Ngày nghỉ đã dùng" },
  { key: "remainingLeaveBalanceDays", label: "Quỹ nghỉ còn lại" },
];

const toDateLabel = (value) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "--";

const formatDelta = (comparisonItem) => {
  if (!comparisonItem) return "--";
  const delta = Number(comparisonItem.delta || 0);
  const deltaPct = Number(comparisonItem.deltaPct || 0);
  return `${delta >= 0 ? "+" : ""}${delta} (${deltaPct}%)`;
};

const buildStaffReportSheets = ({ report, summary, comparisonMap }) => {
  const summaryRows = [
    [
      "Chỉ số",
      "Kỳ hiện tại",
      "Kỳ so sánh",
      "Chênh lệch",
      "% chênh lệch",
    ],
    ...KPI_CONFIG.map((kpi) => {
      const cmp = comparisonMap.get(kpi.key);
      return [
        kpi.label,
        summary[kpi.key] ?? 0,
        cmp?.previous ?? 0,
        cmp?.delta ?? 0,
        cmp?.deltaPct ?? 0,
      ];
    }),
  ];

  const attendanceTrendRows = [
    ["Ngày", "Có mặt", "Vắng", "Đi muộn", "Về sớm"],
    ...(report?.attendanceTrend || []).map((row) => [
      row.date || "",
      row.present ?? 0,
      row.absent ?? 0,
      row.late ?? 0,
      row.earlyLeave ?? 0,
    ]),
  ];

  const attendanceRows = [
    [
      "Nhân viên",
      "Mã NV",
      "Ngày",
      "Ca",
      "Trạng thái",
      "Phút làm",
      "Phút muộn",
      "Phút về sớm",
    ],
    ...(report?.attendanceDetails || []).map((row) => [
      row.employeeName || "--",
      row.employeeCode || "--",
      row.date || "",
      row.shiftType || "--",
      row.status || "--",
      row.workedMinutes ?? 0,
      row.lateMinutes ?? 0,
      row.earlyLeaveMinutes ?? 0,
    ]),
  ];

  const leaveRows = [
    [
      "Nhân viên",
      "Mã NV",
      "Loại nghỉ",
      "Trạng thái",
      "Từ ngày",
      "Đến ngày",
      "Số ngày",
      "Lý do",
    ],
    ...(report?.leaveDetails || []).map((row) => [
      row.employeeName || "--",
      row.employeeCode || "--",
      row.leaveType || "--",
      row.status || "--",
      toDateLabel(row.startDate),
      toDateLabel(row.endDate),
      row.requestedDays ?? 0,
      row.reason || "--",
    ]),
  ];

  return [
    { name: "TongQuan", rows: summaryRows },
    { name: "XuHuongChamCong", rows: attendanceTrendRows },
    { name: "ChiTietChamCong", rows: attendanceRows },
    { name: "ChiTietNghiPhep", rows: leaveRows },
  ];
};

const StaffReportsPage = () => {
  const defaultRange = buildPresetRange("last30");
  const [preset, setPreset] = useState("last30");
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [compareMode, setCompareMode] = useState("previous");
  const [compareStartDate, setCompareStartDate] = useState("");
  const [compareEndDate, setCompareEndDate] = useState("");

  const { report, loading, error } = useStaffReports({
    startDate,
    endDate,
    compareStartDate: compareMode === "custom" ? compareStartDate : undefined,
    compareEndDate: compareMode === "custom" ? compareEndDate : undefined,
  });

  const summary = report?.summary || {};

  const comparisonMap = useMemo(() => {
    const map = new Map();
    (report?.comparison || []).forEach((item) => map.set(item.metric, item));
    return map;
  }, [report?.comparison]);

  const leaveStatusChartData = useMemo(
    () =>
      (report?.leaveStatusDistribution || []).map((item) => {
        const key = String(item.label || "").toLowerCase();
        const viLabel =
          key === "approved" ? "Đã duyệt" : key === "rejected" ? "Từ chối" : "Chờ duyệt";
        return { ...item, label: viLabel };
      }),
    [report?.leaveStatusDistribution]
  );

  const handlePresetChange = (value) => {
    setPreset(value);
    const range = buildPresetRange(value);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const handleExportExcel = () => {
    if (!report) return;

    const sheets = buildStaffReportSheets({
      report,
      summary,
      comparisonMap,
    });

    downloadXlsxWorkbook(sheets, `staff-reports-${startDate}-${endDate}.xlsx`);
  };

  return (
    <div className="staff-reports-page">
      <div className="report-toolbar">
        <div className="filters">
          <select value={preset} onChange={(e) => handlePresetChange(e.target.value)}>
            <option value="last7">7 ngày gần nhất</option>
            <option value="last30">30 ngày gần nhất</option>
            <option value="month">Tháng này</option>
            <option value="quarter">Quý này</option>
            <option value="year">Năm nay</option>
          </select>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <select value={compareMode} onChange={(e) => setCompareMode(e.target.value)}>
            <option value="previous">So với kỳ trước</option>
            <option value="custom">So sánh kỳ tùy chọn</option>
          </select>
          {compareMode === "custom" && (
            <>
              <input
                type="date"
                value={compareStartDate}
                onChange={(e) => setCompareStartDate(e.target.value)}
              />
              <input
                type="date"
                value={compareEndDate}
                onChange={(e) => setCompareEndDate(e.target.value)}
              />
            </>
          )}
        </div>
        <button className="btn-export" onClick={handleExportExcel} disabled={!report}>
          📥 Xuất Excel
        </button>
      </div>

      {loading && <div className="report-state">Đang tải báo cáo nhân sự...</div>}
      {error && <div className="report-state error">Lỗi tải báo cáo: {error.message}</div>}
      {!loading && !error && !report && (
        <div className="report-state">Không có dữ liệu để hiển thị.</div>
      )}

      {report && (
        <>
          <div className="kpi-grid">
            {KPI_CONFIG.map((kpi) => {
              const cmp = comparisonMap.get(kpi.key);
              return (
                <div key={kpi.key} className="kpi-card">
                  <div className="label">{kpi.label}</div>
                  <div className="value">{summary[kpi.key] ?? 0}</div>
                  <div className={`delta ${(cmp?.delta || 0) >= 0 ? "up" : "down"}`}>
                    {formatDelta(cmp)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="charts-grid">
            <div className="chart-card">
              <h4>Xu hướng chấm công theo ngày</h4>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={report.attendanceTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#16a34a" name="Có mặt" />
                  <Line type="monotone" dataKey="absent" stroke="#ef4444" name="Vắng" />
                  <Line type="monotone" dataKey="late" stroke="#f59e0b" name="Muộn" />
                  <Line type="monotone" dataKey="earlyLeave" stroke="#6366f1" name="Về sớm" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h4>Phân bố loại nghỉ</h4>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={report.leaveByType || []} dataKey="count" nameKey="leaveType" outerRadius={100}>
                    {(report.leaveByType || []).map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h4>Đơn nghỉ theo trạng thái</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={leaveStatusChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h4>Nhân sự hoạt động / nghỉ việc</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={report.workforceStatusDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#16a34a" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h4>Phân bố đi muộn / về sớm / vắng</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={report.attendanceIssueDistribution || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-card">
              <h4>Tham gia theo ca</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={report.attendanceByShift || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="shiftType" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="records" fill="#2563eb" name="Tổng record" />
                  <Bar dataKey="present" fill="#16a34a" name="Có mặt" />
                  <Bar dataKey="absent" fill="#ef4444" name="Vắng" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="table-block">
            <h4>Chi tiết chấm công</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Mã</th>
                    <th>Ngày</th>
                    <th>Ca</th>
                    <th>Trạng thái</th>
                    <th>Phút làm</th>
                    <th>Muộn</th>
                    <th>Về sớm</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.attendanceDetails || []).length === 0 ? (
                    <tr>
                      <td colSpan={8}>Không có dữ liệu chấm công trong khoảng thời gian đã chọn.</td>
                    </tr>
                  ) : (
                    (report.attendanceDetails || []).map((row, idx) => (
                      <tr key={`${row.employeeId}-${row.date}-${idx}`}>
                        <td>{row.employeeName || "--"}</td>
                        <td>{row.employeeCode || "--"}</td>
                        <td>{row.date}</td>
                        <td>{row.shiftType || "--"}</td>
                        <td>{row.status}</td>
                        <td>{row.workedMinutes}</td>
                        <td>{row.lateMinutes}</td>
                        <td>{row.earlyLeaveMinutes}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="table-block">
            <h4>Chi tiết nghỉ phép</h4>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Mã</th>
                    <th>Loại nghỉ</th>
                    <th>Trạng thái</th>
                    <th>Từ ngày</th>
                    <th>Đến ngày</th>
                    <th>Số ngày</th>
                    <th>Lý do</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.leaveDetails || []).length === 0 ? (
                    <tr>
                      <td colSpan={8}>Không có đơn nghỉ trong khoảng thời gian đã chọn.</td>
                    </tr>
                  ) : (
                    (report.leaveDetails || []).map((row) => (
                      <tr key={row.requestId}>
                        <td>{row.employeeName || "--"}</td>
                        <td>{row.employeeCode || "--"}</td>
                        <td>{row.leaveType}</td>
                        <td>{row.status}</td>
                        <td>{toDateLabel(row.startDate)}</td>
                        <td>{toDateLabel(row.endDate)}</td>
                        <td>{row.requestedDays}</td>
                        <td>{row.reason || "--"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StaffReportsPage;
