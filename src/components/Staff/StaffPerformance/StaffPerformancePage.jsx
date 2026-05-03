import React from "react";
import { useStaffPerformanceView } from "@/hooks/useStaffPerformanceView";
import StaffPerformanceSummaryCards from "./StaffPerformanceSummaryCards";
import StaffPerformanceTimeline from "./StaffPerformanceTimeline";
import StaffScoreAdjustmentsTable from "./StaffScoreAdjustmentsTable";
import StaffIncidentsList from "./StaffIncidentsList";
import "./StaffPerformance.scss";

const StaffPerformancePage = () => {
  const now = new Date();
  const { summary, timeline, adjustments, incidents, loading, error, missingIdentity } =
    useStaffPerformanceView({ month: now.getUTCMonth() + 1, year: now.getUTCFullYear() });

  if (missingIdentity) return <div className="staff-performance-page">Không xác định được hồ sơ nhân viên hoặc nhà hàng.</div>;
  if (loading) return <div className="staff-performance-page">Đang tải hiệu suất của bạn...</div>;
  if (error) return <div className="staff-performance-page">Không tải được dữ liệu hiệu suất.</div>;

  return (
    <div className="staff-performance-page">
      <h1>Hiệu suất của tôi</h1>
      <p>Kỳ hiện tại: Tháng {now.getUTCMonth() + 1}/{now.getUTCFullYear()}</p>
      <p className="staff-performance-note">Khiếu nại sẽ được hỗ trợ sau.</p>

      <StaffPerformanceSummaryCards summary={summary} />

      <section>
        <h2>Timeline điểm</h2>
        <StaffPerformanceTimeline timeline={timeline} />
      </section>

      <section>
        <h2>Lịch sử điều chỉnh điểm</h2>
        <StaffScoreAdjustmentsTable adjustments={adjustments} />
      </section>

      <section>
        <h2>Incident liên quan</h2>
        <StaffIncidentsList incidents={incidents} />
      </section>
    </div>
  );
};

export default StaffPerformancePage;
