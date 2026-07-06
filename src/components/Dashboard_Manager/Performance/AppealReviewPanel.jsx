import React from "react";
import {
  usePerformanceIncidentAppeals,
  useReviewPerformanceIncidentAppeal,
  useReverseScoreForAcceptedAppeal,
} from "@/hooks/usePerformanceIncidentAppeals";

const REVIEWABLE_STATUSES = ["submitted", "under_review", "needs_more_info"];

const AppealReviewPanel = ({ restaurantId, canReview = true, isAccountant = false }) => {
  const { data, refetch } = usePerformanceIncidentAppeals(
    { restaurantId, limit: 100, offset: 0 },
    !restaurantId,
  );
  const [review] = useReviewPerformanceIncidentAppeal();
  const [reverseScore] = useReverseScoreForAcceptedAppeal();
  const appeals = data?.performanceIncidentAppeals || [];

  return (
    <section>
      <h2>Phản hồi từ nhân viên</h2>
      {appeals.map((appeal) => (
        <article key={appeal.id}>
          <p>{appeal.employeeId} - {appeal.incidentId}</p>
          <p>{appeal.reason}</p>
          <p>{appeal.status}</p>

          {canReview && REVIEWABLE_STATUSES.includes(appeal.status) ? (
            <div>
              {["under_review", "needs_more_info", "accepted", "rejected"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={async () => {
                    const decisionReason = ["accepted", "rejected"].includes(status)
                      ? window.prompt("Lý do quyết định") || ""
                      : "";
                    await review({
                      variables: {
                        input: {
                          appealId: appeal.id,
                          status,
                          decisionReason,
                        },
                      },
                    });
                    await refetch();
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
          ) : null}

          {canReview && !isAccountant && appeal.status === "accepted" && appeal.scoreReversalStatus !== "reversed" ? (
            <button
              type="button"
              onClick={async () => {
                const note = window.prompt(
                  "Hoàn điểm từ appeal đã chấp nhận\nHành động này chỉ điều chỉnh điểm hiệu suất, không ảnh hưởng payroll/lương.\nLịch sử áp điểm ban đầu vẫn được giữ để audit.",
                );
                if (!note?.trim()) return;
                const rawDelta = window.prompt("Nhập reversalDelta (để trống = hoàn full)") || "";
                if (!window.confirm("Tôi xác nhận điều chỉnh điểm cho nhân viên")) return;
                const parsed = rawDelta.trim() ? Number(rawDelta) : undefined;
                await reverseScore({
                  variables: {
                    input: {
                      appealId: appeal.id,
                      reversalDelta: Number.isFinite(parsed) ? parsed : undefined,
                      note,
                    },
                  },
                });
                await refetch();
              }}
            >
              Hoàn điểm
            </button>
          ) : null}

          {appeal.scoreReversalStatus === "reversed" ? (
            <p>Đã hoàn điểm: +{appeal.scoreReversalDelta || 0}</p>
          ) : null}
        </article>
      ))}
    </section>
  );
};

export default AppealReviewPanel;
