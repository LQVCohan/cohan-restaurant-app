import React, { useEffect, useMemo, useRef, useState } from "react";
import { History, MessageSquareText, X } from "lucide-react";
import { useStaffPerformanceView } from "@/hooks/useStaffPerformanceView";
import {
  useCreatePerformanceIncidentAppeal,
  usePerformanceIncidentAppeals,
} from "@/hooks/usePerformanceIncidentAppeals";
import StaffPerformanceSummaryCards from "./StaffPerformanceSummaryCards";
import StaffPerformanceTimeline from "./StaffPerformanceTimeline";
import StaffScoreAdjustmentsTable from "./StaffScoreAdjustmentsTable";
import StaffIncidentsList from "./StaffIncidentsList";
import "./StaffPerformance.scss";

const EMPTY_APPEAL_FORM = {
  incidentId: "",
  reason: "",
  evidenceNote: "",
  evidenceUrls: "",
};

const getGraphQLErrorMessage = (
  error,
  fallback = "Không thể gửi phản hồi. Vui lòng thử lại.",
) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.networkError?.result?.errors?.[0]?.message ||
  error?.message ||
  fallback;

const StaffPerformanceState = ({ tone = "muted", title, description }) => (
  <div className="staff-performance-page">
    <section
      className={`staff-performance-state staff-performance-state--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="staff-performance-state__mark" />
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  </div>
);

const StaffPerformancePage = () => {
  const now = new Date();
  const {
    summary,
    timeline,
    adjustments,
    incidents,
    loading,
    error,
    missingIdentity,
    restaurantId,
  } = useStaffPerformanceView({
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
  });
  const [form, setForm] = useState(EMPTY_APPEAL_FORM);
  const [appealError, setAppealError] = useState("");
  const [appealSuccess, setAppealSuccess] = useState("");
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState("");
  const drawerCloseRef = useRef(null);
  const [createAppeal] = useCreatePerformanceIncidentAppeal();
  const appealFilter = useMemo(
    () => ({ restaurantId, limit: 100, offset: 0 }),
    [restaurantId],
  );
  const { data: appealData, refetch: refetchAppeals } =
    usePerformanceIncidentAppeals(appealFilter, !restaurantId);
  const appeals = appealData?.performanceIncidentAppeals || [];

  const selectedIncident = useMemo(
    () => incidents?.find((incident) => incident.id === form.incidentId),
    [incidents, form.incidentId],
  );

  const closeDrawer = () => setActiveDrawer("");
  const openAppealDrawer = (incidentId = "") => {
    setAppealError("");
    setAppealSuccess("");
    if (incidentId) {
      setForm((current) => ({ ...current, incidentId }));
    }
    setActiveDrawer("appeal");
  };

  useEffect(() => {
    if (!activeDrawer) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerCloseRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDrawer]);

  const handleSubmitAppeal = async (event) => {
    event.preventDefault();
    setAppealError("");
    setAppealSuccess("");

    if (!form.incidentId) {
      setAppealError("Chọn một sự kiện cần phản hồi.");
      return;
    }
    if (!form.reason.trim()) {
      setAppealError("Nhập lý do phản hồi trước khi gửi.");
      return;
    }

    setSubmittingAppeal(true);
    try {
      await createAppeal({
        variables: {
          input: {
            incidentId: form.incidentId,
            reason: form.reason.trim(),
            evidenceNote: form.evidenceNote.trim(),
            evidenceUrls: form.evidenceUrls
              .split("\n")
              .map((value) => value.trim())
              .filter(Boolean),
          },
        },
      });
      setForm(EMPTY_APPEAL_FORM);
      setAppealSuccess(
        "Đã gửi phản hồi. Quản lý sẽ xem xét trong quy trình hiện có.",
      );
      await refetchAppeals();
    } catch (submitError) {
      setAppealError(getGraphQLErrorMessage(submitError));
    } finally {
      setSubmittingAppeal(false);
    }
  };

  if (missingIdentity) {
    return (
      <StaffPerformanceState
        title="Chưa xác định được hồ sơ nhân viên"
        description="Không tìm thấy nhân viên hoặc nhà hàng để tải phản hồi hiệu suất cá nhân."
      />
    );
  }

  if (loading) {
    return (
      <div className="staff-performance-page">
        <section className="staff-performance-skeleton" aria-live="polite">
          <span className="staff-performance-skeleton__line staff-performance-skeleton__line--wide" />
          <span className="staff-performance-skeleton__line" />
          <span className="staff-performance-skeleton__line" />
          <p>Đang tải phản hồi hiệu suất của bạn...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <StaffPerformanceState
        tone="error"
        title="Không tải được dữ liệu hiệu suất"
        description="Vui lòng thử lại sau hoặc liên hệ quản lý nếu lỗi tiếp tục xảy ra."
      />
    );
  }

  const drawerTitle =
    activeDrawer === "history" ? "Lịch sử điều chỉnh" : "Gửi phản hồi";
  const drawerDescription =
    activeDrawer === "history"
      ? "Đối chiếu điểm cũ, điểm mới và ghi chú đã được áp dụng."
      : "Chọn sự kiện, nêu lý do ngắn gọn và bổ sung bằng chứng khi cần.";

  return (
    <div className="staff-performance-page" aria-label="Hiệu suất cá nhân">
      <section className="staff-performance-toolbar" aria-label="Kỳ hiệu suất">
        <div className="staff-performance-period">
          <span>Kỳ hiện tại</span>
          <strong>
            Tháng {now.getUTCMonth() + 1}/{now.getUTCFullYear()}
          </strong>
        </div>
        <div className="staff-performance-toolbar__actions">
          {adjustments?.length ? (
            <button type="button" onClick={() => setActiveDrawer("history")}>
              <History size={17} aria-hidden="true" />
              Lịch sử điều chỉnh
            </button>
          ) : null}
          {incidents?.length ? (
            <button
              type="button"
              className="is-primary"
              onClick={() => openAppealDrawer()}
            >
              <MessageSquareText size={17} aria-hidden="true" />
              Gửi phản hồi
            </button>
          ) : null}
        </div>
      </section>

      <StaffPerformanceSummaryCards summary={summary} />

      <section className="staff-performance-layout">
        <section
          className="staff-performance-panel"
          aria-labelledby="staff-performance-timeline-title"
        >
          <div className="staff-performance-panel__header">
            <h2 id="staff-performance-timeline-title">Diễn biến điểm</h2>
            <p>Xem thay đổi theo thời gian để biết việc cần chú ý.</p>
          </div>
          <StaffPerformanceTimeline timeline={timeline} />
        </section>

        <section
          className="staff-performance-panel"
          aria-labelledby="staff-performance-incidents-title"
        >
          <div className="staff-performance-panel__header">
            <h2 id="staff-performance-incidents-title">Sự kiện liên quan</h2>
            <p>Chỉ phản hồi khi dữ liệu chưa đúng hoặc cần bổ sung bối cảnh.</p>
          </div>
          <StaffIncidentsList
            incidents={incidents}
            appeals={appeals}
            onAppeal={openAppealDrawer}
          />
        </section>
      </section>

      {activeDrawer ? (
        <div
          className="staff-performance-drawer-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDrawer();
          }}
        >
          <aside
            className="staff-performance-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-performance-drawer-title"
            aria-describedby="staff-performance-drawer-description"
          >
            <header className="staff-performance-drawer__header">
              <div>
                <h2 id="staff-performance-drawer-title">{drawerTitle}</h2>
                <p id="staff-performance-drawer-description">
                  {drawerDescription}
                </p>
              </div>
              <button
                ref={drawerCloseRef}
                type="button"
                onClick={closeDrawer}
                aria-label={`Đóng ${drawerTitle.toLowerCase()}`}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="staff-performance-drawer__body">
              {activeDrawer === "history" ? (
                <StaffScoreAdjustmentsTable adjustments={adjustments} />
              ) : (
                <>
                  {selectedIncident ? (
                    <div className="staff-performance-selected-incident">
                      <span>Sự kiện đang chọn</span>
                      <strong>
                        {selectedIncident.eventType || selectedIncident.id}
                      </strong>
                    </div>
                  ) : null}
                  <form
                    className="staff-performance-appeal-form"
                    onSubmit={handleSubmitAppeal}
                  >
                    <label>
                      <span>Mã sự kiện</span>
                      <select
                        value={form.incidentId}
                        onChange={(event) =>
                          setForm({ ...form, incidentId: event.target.value })
                        }
                      >
                        <option value="">Chọn sự kiện cần phản hồi</option>
                        {(incidents || []).map((incident) => (
                          <option key={incident.id} value={incident.id}>
                            {incident.eventType || incident.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Lý do phản hồi</span>
                      <textarea
                        placeholder="Ví dụ: ca này đã được quản lý xác nhận lại"
                        value={form.reason}
                        onChange={(event) =>
                          setForm({ ...form, reason: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Ghi chú bằng chứng</span>
                      <textarea
                        placeholder="Ghi chú ngắn nếu có ảnh, tin nhắn hoặc xác nhận từ quản lý"
                        value={form.evidenceNote}
                        onChange={(event) =>
                          setForm({ ...form, evidenceNote: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>URL bằng chứng</span>
                      <textarea
                        placeholder="Mỗi URL một dòng"
                        value={form.evidenceUrls}
                        onChange={(event) =>
                          setForm({ ...form, evidenceUrls: event.target.value })
                        }
                      />
                    </label>
                    {appealError ? (
                      <p className="staff-performance-form-error" role="alert">
                        {appealError}
                      </p>
                    ) : null}
                    {appealSuccess ? (
                      <p className="staff-performance-form-success" role="status">
                        {appealSuccess}
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={
                        !form.incidentId ||
                        !form.reason.trim() ||
                        submittingAppeal
                      }
                    >
                      {submittingAppeal ? "Đang gửi..." : "Gửi phản hồi"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
};

export default StaffPerformancePage;
