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

const PIE_COLORS = ["#1f6f4a", "#a87845", "#f59e0b", "#ef4444", "#2563eb", "#8b5cf6"];

const KPI_CONFIG = [
  { key: "activeEmployees", label: "Đang hoạt động", icon: "👥", featured: true, tone: "success" },
  { key: "terminatedEmployees", label: "Đã nghỉ việc", icon: "🚪", tone: "muted" },
  { key: "joinedEmployees", label: "Nhân sự vào kỳ này", icon: "➕", featured: true, tone: "info" },
  { key: "leftEmployees", label: "Nhân sự rời kỳ này", icon: "➖", tone: "warning" },
  { key: "presentCount", label: "Có mặt", icon: "✅", featured: true, tone: "success" },
  { key: "absentCount", label: "Vắng", icon: "⚠️", tone: "danger" },
  { key: "lateCount", label: "Đi muộn", icon: "⏱️", tone: "warning" },
  { key: "earlyLeaveCount", label: "Về sớm", icon: "↩️", tone: "warning" },
  { key: "leaveTotal", label: "Đơn nghỉ", icon: "🏖️", featured: true, tone: "info" },
  { key: "leaveDaysUsed", label: "Ngày nghỉ đã dùng", icon: "📅", tone: "muted" },
  { key: "remainingLeaveBalanceDays", label: "Quỹ nghỉ còn lại", icon: "🧮", tone: "success" },
];

const toDateLabel = (value) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "--";

const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN");

const formatDelta = (comparisonItem) => {
  if (!comparisonItem) return "--";
  const delta = Number(comparisonItem.delta || 0);
  const deltaPct = Number(comparisonItem.deltaPct || 0);
  return `${delta >= 0 ? "+" : ""}${formatNumber(delta)} (${deltaPct}%)`;
};

const getDeltaTone = (comparisonItem) => {
  if (!comparisonItem) return "neutral";
  const delta = Number(comparisonItem.delta || 0);
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
};

const hasMeaningfulData = (rows, keys = ["count"]) => {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return rows.some((row) => keys.some((key) => Number(row?.[key] || 0) !== 0));
};

const ChartCard = ({ title, subtitle, hasData, children, className = "" }) => (
  <section className={`chart-card ${className}`.trim()}>
    <div className="chart-card__header">
      <div>
        <h4>{title}</h4>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
    {hasData ? (
      children
    ) : (
      <div className="chart-empty-state">
        <span>📭</span>
        <strong>Chưa có dữ liệu biểu đồ</strong>
        <p>Thử đổi khoảng ngày hoặc kiểm tra lại dữ liệu chấm công/nghỉ phép.</p>
      </div>
    )}
  </section>
);

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

  const featuredKpis = useMemo(
    () => KPI_CONFIG.filter((item) => item.featured),
    []
  );
  const compactKpis = useMemo(
    () => KPI_CONFIG.filter((item) => !item.featured),
    []
  );

  const reportHealth = useMemo(() => {
    const attendanceRecords = Number(summary.attendanceRecords || 0);
    const issueTotal =
      Number(summary.absentCount || 0) +
      Number(summary.lateCount || 0) +
      Number(summary.earlyLeaveCount || 0);
    const issueRate = attendanceRecords > 0 ? Math.round((issueTotal / attendanceRecords) * 100) : 0;
    return {
      attendanceRecords,
      issueTotal,
      issueRate,
      leaveApproved: Number(summary.leaveApproved || 0),
      leavePending: Number(summary.leavePending || 0),
    };
  }, [summary]);

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

  const renderKpiCard = (kpi, compact = false) => {
    const cmp = comparisonMap.get(kpi.key);
    return (
      <article key={kpi.key} className={`kpi-card tone-${kpi.tone || "muted"} ${compact ? "kpi-card--compact" : ""}`.trim()}>
        <div className="kpi-card__icon" aria-hidden="true">{kpi.icon}</div>
        <div className="kpi-card__content">
          <span className="label">{kpi.label}</span>
          <strong className="value">{formatNumber(summary[kpi.key] ?? 0)}</strong>
          <span className={`delta ${getDeltaTone(cmp)}`}>{formatDelta(cmp)}</span>
        </div>
      </article>
    );
  };

  return (
    <div className="staff-reports-page">
      <section className="report-command-center">
        <div className="report-command-center__copy">
          <span className="eyebrow">Bảng điều khiển báo cáo</span>
          <h2>Tổng quan nhân sự theo kỳ</h2>
          <p>
            Kết hợp dữ liệu nhân sự, chấm công và nghỉ phép để quản lý nhanh biến động vận hành.
          </p>
          <div className="report-period-pill">
            {toDateLabel(report?.currentPeriod?.startDate || startDate)} → {toDateLabel(report?.currentPeriod?.endDate || endDate)}
          </div>
        </div>

        <div className="report-health-grid" aria-label="Tóm tắt sức khỏe báo cáo">
          <div className="report-health-card primary">
            <span>Record chấm công</span>
            <strong>{formatNumber(reportHealth.attendanceRecords)}</strong>
            <small>Tổng lượt ghi nhận trong kỳ</small>
          </div>
          <div className="report-health-card warning">
            <span>Tỷ lệ vấn đề</span>
            <strong>{reportHealth.issueRate}%</strong>
            <small>{formatNumber(reportHealth.issueTotal)} lượt vắng/muộn/về sớm</small>
          </div>
          <div className="report-health-card success">
            <span>Đơn nghỉ đã duyệt</span>
            <strong>{formatNumber(reportHealth.leaveApproved)}</strong>
            <small>{formatNumber(reportHealth.leavePending)} đơn đang chờ</small>
          </div>
        </div>
      </section>

      <div className="report-toolbar">
        <div className="filters" aria-label="Bộ lọc báo cáo nhân sự">
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
        <button className="btn-export" onClick={handleExportExcel} disabled={!report || loading}>
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
          <section className="kpi-section" aria-label="Chỉ số chính">
            <div className="kpi-section__header">
              <div>
                <span className="eyebrow">Chỉ số nổi bật</span>
                <h3>Tình hình trong kỳ</h3>
              </div>
              <p>So sánh với kỳ trước hoặc kỳ tùy chọn.</p>
            </div>
            <div className="kpi-grid kpi-grid--featured">
              {featuredKpis.map((kpi) => renderKpiCard(kpi))}
            </div>
            <div className="kpi-grid kpi-grid--compact">
              {compactKpis.map((kpi) => renderKpiCard(kpi, true))}
            </div>
          </section>

          <div className="charts-grid">
            <ChartCard
              title="Xu hướng chấm công theo ngày"
              subtitle="Có mặt, vắng, muộn và về sớm theo thời gian"
              hasData={hasMeaningfulData(report.attendanceTrend, ["present", "absent", "late", "earlyLeave"])}
              className="chart-card--wide"
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={report.attendanceTrend || []} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6ded1" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#1f6f4a" strokeWidth={2.5} name="Có mặt" dot={false} />
                  <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} name="Vắng" dot={false} />
                  <Line type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={2} name="Muộn" dot={false} />
                  <Line type="monotone" dataKey="earlyLeave" stroke="#6366f1" strokeWidth={2} name="Về sớm" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Phân bố loại nghỉ"
              subtitle="Cơ cấu các loại đơn nghỉ trong kỳ"
              hasData={hasMeaningfulData(report.leaveByType, ["count", "days"])}
            >
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={report.leaveByType || []} dataKey="count" nameKey="leaveType" outerRadius={96} innerRadius={52} paddingAngle={2}>
                    {(report.leaveByType || []).map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Đơn nghỉ theo trạng thái"
              subtitle="Đã duyệt, từ chối và chờ duyệt"
              hasData={hasMeaningfulData(leaveStatusChartData, ["count"])}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={leaveStatusChartData} margin={{ top: 8, right: 14, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6ded1" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1f6f4a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Nhân sự hoạt động / nghỉ việc"
              subtitle="Trạng thái lực lượng nhân sự"
              hasData={hasMeaningfulData(report.workforceStatusDistribution, ["count"])}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={report.workforceStatusDistribution || []} margin={{ top: 8, right: 14, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6ded1" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1f6f4a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Phân bố đi muộn / về sớm / vắng"
              subtitle="Các vấn đề chấm công cần chú ý"
              hasData={hasMeaningfulData(report.attendanceIssueDistribution, ["count"])}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={report.attendanceIssueDistribution || []} margin={{ top: 8, right: 14, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6ded1" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Tham gia theo ca"
              subtitle="Record chấm công theo từng loại ca"
              hasData={hasMeaningfulData(report.attendanceByShift, ["records", "present", "absent"])}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={report.attendanceByShift || []} margin={{ top: 8, right: 14, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e6ded1" />
                  <XAxis dataKey="shiftType" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="records" fill="#2563eb" name="Tổng record" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="present" fill="#1f6f4a" name="Có mặt" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="absent" fill="#ef4444" name="Vắng" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="tables-grid">
            <div className="table-block">
              <div className="table-block__header">
                <div>
                  <span className="eyebrow">Đối chiếu</span>
                  <h4>Chi tiết chấm công</h4>
                </div>
                <strong>{formatNumber((report.attendanceDetails || []).length)} dòng</strong>
              </div>
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
                        <td colSpan={8} className="empty-cell">Không có dữ liệu chấm công trong khoảng thời gian đã chọn.</td>
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
              <div className="table-block__header">
                <div>
                  <span className="eyebrow">Nghỉ phép</span>
                  <h4>Chi tiết nghỉ phép</h4>
                </div>
                <strong>{formatNumber((report.leaveDetails || []).length)} đơn</strong>
              </div>
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
                        <td colSpan={8} className="empty-cell">Không có đơn nghỉ trong khoảng thời gian đã chọn.</td>
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
          </div>
        </>
      )}
    </div>
  );
};

export default StaffReportsPage;
