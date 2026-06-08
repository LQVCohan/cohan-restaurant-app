import React, { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { QUERY_MY_PAYSLIP, QUERY_MY_PAYSLIPS } from "@/hooks/usePayroll";
import PayrollPayslipModal from "@/components/Dashboard_Manager/Staff/components/PayrollPayslipModal";
import "./StaffDashboardPage.scss";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(amount || 0));

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "--";

const statusLabel = (status) => ({ finalized: "Đã chốt", paying: "Đang chi trả", paid: "Đã thanh toán", locked: "Đã khóa" }[status] || status || "--");

const StaffPayslipsPage = () => {
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const listQuery = useQuery(QUERY_MY_PAYSLIPS, { variables: { limit: 24 }, fetchPolicy: "cache-and-network" });
  const detailQuery = useQuery(QUERY_MY_PAYSLIP, { variables: { periodId: selectedPeriodId }, skip: !selectedPeriodId, fetchPolicy: "cache-and-network" });

  const rows = listQuery.data?.myPayslips || [];
  const selectedItem = detailQuery.data?.myPayslip || null;
  const modalPayslip = useMemo(() => {
    if (!selectedItem) return null;
    return {
      period: {
        id: selectedItem.periodId,
        name: selectedItem.periodName,
        startDate: selectedItem.periodStartDate,
        endDate: selectedItem.periodEndDate,
        status: selectedItem.periodStatus,
        finalizedAt: selectedItem.periodFinalizedAt,
        stats: { totalPayroll: selectedItem.netSalary || 0, paidAmount: selectedItem.paidAmount || 0, remaining: selectedItem.remainingAmount || 0, progress: selectedItem.netSalary ? Math.round(((selectedItem.paidAmount || 0) / selectedItem.netSalary) * 100) : 0 },
      },
      employee: { id: selectedItem.id, name: selectedItem.name, code: selectedItem.code, role: selectedItem.role, department: selectedItem.department },
      item: selectedItem,
      breakdown: selectedItem,
      payments: [],
      remainingAmount: selectedItem.remainingAmount || 0,
      canMarkPaid: false,
      canEdit: false,
    };
  }, [selectedItem]);

  return (
    <div className="staff-dashboard-page" aria-labelledby="staff-payslips-title">
      <section className="staff-dashboard-hero">
        <div className="staff-dashboard-hero__copy">
          <span className="staff-dashboard-badge staff-dashboard-badge--accent">Phiếu lương cá nhân</span>
          <h1 id="staff-payslips-title">Phiếu lương của tôi</h1>
          <p>Chỉ hiển thị các kỳ lương đã được công bố/chốt, đang chi trả, đã thanh toán hoặc đã khóa.</p>
        </div>
      </section>

      {listQuery.loading && <div className="staff-dashboard-empty">Đang tải phiếu lương...</div>}
      {listQuery.error && <div className="staff-dashboard-empty">Không tải được phiếu lương. Vui lòng thử lại.</div>}
      {!listQuery.loading && !listQuery.error && rows.length === 0 && (
        <div className="staff-dashboard-empty">Chưa có phiếu lương được công bố.</div>
      )}

      {rows.length > 0 && (
        <div className="staff-dashboard-panel">
          <div className="table-responsive">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>Kỳ lương</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Thực lĩnh</th>
                  <th className="text-right">Đã thanh toán</th>
                  <th className="text-right">Còn lại</th>
                  <th>Ngày chốt</th>
                  <th>Ngày thanh toán</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.payrollItemId || row.periodId}>
                    <td>{row.periodName || `${formatDate(row.periodStartDate)} - ${formatDate(row.periodEndDate)}`}</td>
                    <td>{statusLabel(row.periodStatus || row.status)}</td>
                    <td className="text-right">{formatCurrency(row.netSalary)}</td>
                    <td className="text-right">{formatCurrency(row.paidAmount)}</td>
                    <td className="text-right">{formatCurrency(row.remainingAmount)}</td>
                    <td>{formatDate(row.periodFinalizedAt)}</td>
                    <td>{formatDate(row.paidAt)}</td>
                    <td><button type="button" className="btn btn-white" onClick={() => setSelectedPeriodId(row.periodId)}>Xem chi tiết</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PayrollPayslipModal
        open={Boolean(selectedPeriodId)}
        onClose={() => setSelectedPeriodId("")}
        periodId={selectedPeriodId}
        employeeId={selectedItem?.id}
        payrollPayslip={modalPayslip}
        payrollPayments={[]}
        loading={detailQuery.loading}
      />
    </div>
  );
};

export default StaffPayslipsPage;
