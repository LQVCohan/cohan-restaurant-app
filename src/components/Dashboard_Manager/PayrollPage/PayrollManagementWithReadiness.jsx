import React, { useEffect, useMemo, useState } from "react";
import usePayroll from "@/hooks/usePayroll";
import PayrollManagement from "./PayrollManagement.jsx";
import PayrollReadinessPanel from "./components/PayrollReadinessPanel";

const BLOCKED_FINALIZE_HINT =
  "Kỳ lương chưa sẵn sàng chốt. Vui lòng xử lý các lỗi trong bảng kiểm tra.";

const updateFinalizeButtons = (blocked) => {
  const buttons = Array.from(
    document.querySelectorAll(".payroll-page-compact button"),
  ).filter((button) => String(button.textContent || "").includes("Chốt kỳ"));

  buttons.forEach((button) => {
    if (blocked) {
      if (!button.dataset.payrollReadinessManaged) {
        button.dataset.payrollReadinessManaged = "true";
        button.dataset.payrollReadinessPrevDisabled = String(button.disabled);
        button.dataset.payrollReadinessPrevTitle = button.title || "";
      }
      button.disabled = true;
      button.title = BLOCKED_FINALIZE_HINT;
      return;
    }

    if (button.dataset.payrollReadinessManaged) {
      button.disabled = button.dataset.payrollReadinessPrevDisabled === "true";
      button.title = button.dataset.payrollReadinessPrevTitle || "";
      delete button.dataset.payrollReadinessManaged;
      delete button.dataset.payrollReadinessPrevDisabled;
      delete button.dataset.payrollReadinessPrevTitle;
    }
  });
};

const PayrollManagementWithReadiness = () => {
  const [showReadinessPanel, setShowReadinessPanel] = useState(false);
  const {
    currentPeriodId,
    payrollReadiness,
    readinessLoading,
    readinessError,
    refetchPayrollReadiness,
    refetchValidation,
  } = usePayroll();

  const readinessBlocksFinalize = useMemo(
    () => payrollReadiness?.readyToFinalize === false,
    [payrollReadiness],
  );

  useEffect(() => {
    updateFinalizeButtons(readinessBlocksFinalize);
    if (readinessBlocksFinalize) {
      setShowReadinessPanel(true);
    }
    return () => updateFinalizeButtons(false);
  }, [readinessBlocksFinalize]);

  const handleOpenReadinessPanel = async () => {
    setShowReadinessPanel(true);
    const tasks = [];
    if (refetchPayrollReadiness) tasks.push(refetchPayrollReadiness());
    if (refetchValidation) tasks.push(refetchValidation());
    await Promise.allSettled(tasks);
  };

  const handleGoToIssue = (issue) => {
    console.log("Payroll readiness issue", issue);
    alert(
      issue?.suggestedAction ||
        issue?.message ||
        "Vui lòng xử lý lỗi trước khi chốt lương.",
    );
  };

  return (
    <>
      {currentPeriodId && (
        <div className="payroll-readiness-entrypoint">
          <div>
            <strong>Kiểm tra trước khi chốt lương</strong>
            <p>
              Xem trạng thái sẵn sàng từ lịch làm việc, chấm công, duyệt công/tăng ca và bảng lương.
            </p>
            {readinessBlocksFinalize && (
              <p className="payroll-action-hint payroll-action-hint--error">
                {BLOCKED_FINALIZE_HINT}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-white"
            onClick={handleOpenReadinessPanel}
          >
            Kiểm tra trước khi chốt
          </button>
        </div>
      )}

      {showReadinessPanel && (
        <PayrollReadinessPanel
          readiness={payrollReadiness}
          loading={readinessLoading}
          error={readinessError}
          onRefresh={handleOpenReadinessPanel}
          onGoToIssue={handleGoToIssue}
        />
      )}

      <PayrollManagement />
    </>
  );
};

export default PayrollManagementWithReadiness;
