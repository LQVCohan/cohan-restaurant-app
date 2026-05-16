import React, { useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardEdit,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  UserRoundCheck,
  X,
} from "lucide-react";
import useStaffPerformance from "../../../../../hooks/useStaffPerformance";
import "./StaffPerformancePage.scss";
import { getPerformanceActionErrorMessage } from "@/utils/payrollPerformanceErrorMessages";

const SCORE_LEVELS = {
  excellent: {
    label: "Xuất sắc",
    className: "excellent",
    description:
      "Phù hợp cho ca quan trọng, ca cao điểm hoặc ca cần kinh nghiệm.",
  },
  good: {
    label: "Tốt",
    className: "good",
    description: "Có thể ưu tiên khi xếp lịch vận hành thường ngày.",
  },
  average: {
    label: "Ổn định",
    className: "average",
    description: "Phù hợp với ca thông thường, cần tiếp tục theo dõi.",
  },
  needs_attention: {
    label: "Cần theo dõi",
    className: "attention",
    description: "Nên hạn chế xếp ca quan trọng một mình.",
  },
  poor: {
    label: "Rủi ro cao",
    className: "poor",
    description: "Cần quản lý/HR xem lại trước khi ưu tiên xếp lịch.",
  },
};

const COMPONENT_META = {
  productivity: {
    label: "Năng suất",
    icon: TrendingUp,
    description:
      "Khối lượng xử lý trong kỳ so với mặt bằng nhân viên cùng nhà hàng.",
  },
  punctuality: {
    label: "Đúng giờ",
    icon: CalendarDays,
    description: "Đi trễ, về sớm, vắng mặt và tổng số phút vi phạm.",
  },
  quality: {
    label: "Chất lượng",
    icon: Award,
    description: "Đánh giá chất lượng phục vụ/vận hành hiện có.",
  },
  managerReview: {
    label: "Đánh giá quản lý",
    icon: ClipboardEdit,
    description:
      "Đánh giá định kỳ từ manager/HR về thái độ, kỹ năng và phối hợp.",
  },
  compliance: {
    label: "Tuân thủ",
    icon: ShieldCheck,
    description: "Mức độ tuân thủ quy trình, ít chỉnh công và ít vi phạm.",
  },
};



const PERFORMANCE_FORMULA_ITEMS = [
  { key: "productivity", label: "Năng suất", weight: 25 },
  { key: "punctuality", label: "Đúng giờ", weight: 25 },
  { key: "quality", label: "Chất lượng", weight: 20 },
  { key: "managerReview", label: "Đánh giá quản lý", weight: 20 },
  { key: "compliance", label: "Tuân thủ", weight: 10 },
];
const toDateInput = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const getMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    periodStart: toDateInput(start),
    periodEnd: toDateInput(end),
  };
};

const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
};

const getScoreLevel = (score) => {
  const n = Number(score || 0);
  if (n >= 90) return SCORE_LEVELS.excellent;
  if (n >= 80) return SCORE_LEVELS.good;
  if (n >= 65) return SCORE_LEVELS.average;
  if (n >= 50) return SCORE_LEVELS.needs_attention;
  return SCORE_LEVELS.poor;
};

const getAvatarColor = (name = "?") => {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  return colors[name.length % colors.length];
};

const scoreText = (value) => `${Math.round(Number(value || 0))}/100`;
const formatPercent = (value) => `${Math.round(Number(value || 0))}%`;
const formatContributionScore = (value) => {
  const n = Number(value || 0);
  return `${Math.round(n * 100) / 100}`;
};

export const getWeightedContribution = (score, weight) => {
  const safeScore = Number(score);
  const safeWeight = Number(weight);
  if (!Number.isFinite(safeScore) || !Number.isFinite(safeWeight)) return 0;
  return (safeScore * safeWeight) / 100;
};

const safeFactorNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
export const formatCustomerRating = (factors = {}) => {
  const staffRateCount = safeFactorNumber(factors?.staffRateCount, 0);
  if (staffRateCount <= 0) {
    return {
      hasRating: false,
      label: "Chưa có đánh giá khách hàng",
      hint: "Đánh giá khách hàng không tự động thay đổi điểm hiệu suất. Quản lý có thể dùng thông tin này để cân nhắc khi nhập đánh giá.",
    };
  }

  const staffRate = safeFactorNumber(factors?.staffRate, 0);
  const customerRatingScore = safeFactorNumber(
    factors?.customerRatingScore,
    staffRate * 20,
  );
  const normalizedRate = Math.round(staffRate * 100) / 100;
  const normalizedScore = Math.round(customerRatingScore * 100) / 100;

  return {
    hasRating: true,
    label: `Đánh giá khách hàng: ${normalizedRate}/5 (${staffRateCount} lượt)`,
    hint: `Quy đổi tham khảo: ${normalizedScore}/100`,
  };
};

const buildSnapshotByEmployee = (snapshots = []) =>
  snapshots.reduce((acc, snapshot) => {
    acc[String(snapshot.employeeId)] = snapshot;
    return acc;
  }, {});

const getRestaurantName = (restaurantList, restaurantId) =>
  restaurantList.find((item) => String(item.id) === String(restaurantId))
    ?.name || "Nhà hàng hiện tại";

const ReviewModal = ({
  isOpen,
  employee,
  snapshot,
  restaurantId,
  periodStart,
  periodEnd,
  onClose,
  onSubmit,
  submitting,
}) => {
  const [form, setForm] = useState({
    managerRatingScore: 75,
    attitudeScore: 75,
    teamworkScore: 75,
    skillScore: 75,
    note: "",
  });

  React.useEffect(() => {
    if (!isOpen) return;
    setForm({
      managerRatingScore: 75,
      attitudeScore: 75,
      teamworkScore: 75,
      skillScore: 75,
      note: "",
    });
  }, [isOpen, employee?.id]);

  if (!isOpen || !employee) return null;
  const customerRating = formatCustomerRating(snapshot?.factors);

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === "note" ? value : Number(value),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    await onSubmit({
      employeeId: employee.id,
      restaurantId,
      periodStart: `${periodStart}T00:00:00.000Z`,
      periodEnd: `${periodEnd}T23:59:59.999Z`,
      managerRatingScore: Number(form.managerRatingScore),
      attitudeScore: Number(form.attitudeScore),
      teamworkScore: Number(form.teamworkScore),
      skillScore: Number(form.skillScore),
      note: form.note.trim(),
    });
  };

  return (
    <div className="performance-modal-overlay" onMouseDown={onClose}>
      <div
        className="performance-review-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3>Đánh giá hiệu suất quản lý</h3>
            <p>
              {employee.name} · {formatDate(periodStart)} -{" "}
              {formatDate(periodEnd)}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="review-form" onSubmit={handleSubmit}>
          <div className="factor-box">
            <strong>Tham khảo đánh giá khách hàng</strong>
            <div className="factor-grid">
              <span>{customerRating.label}</span>
              {customerRating.hasRating ? <span>{customerRating.hint}</span> : null}
            </div>
            {!customerRating.hasRating ? <p>{customerRating.hint}</p> : null}
          </div>
          {[
            {
              key: "managerRatingScore",
              label: "Đánh giá tổng quan",
              help: "Mức độ hoàn thành công việc và độ phù hợp vận hành.",
            },
            {
              key: "attitudeScore",
              label: "Thái độ",
              help: "Tinh thần phục vụ, trách nhiệm, thái độ với khách và đồng đội.",
            },
            {
              key: "teamworkScore",
              label: "Phối hợp đội nhóm",
              help: "Khả năng hỗ trợ ca, phối hợp bếp/phục vụ/quầy.",
            },
            {
              key: "skillScore",
              label: "Kỹ năng",
              help: "Kỹ năng chuyên môn theo role: server, cashier, cook, bartender...",
            },
          ].map((field) => (
            <label key={field.key} className="review-score-field">
              <div className="field-copy">
                <strong>{field.label}</strong>
                <span>{field.help}</span>
              </div>
              <div className="field-control">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={form[field.key]}
                  onChange={(event) =>
                    updateField(field.key, event.target.value)
                  }
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form[field.key]}
                  onChange={(event) =>
                    updateField(field.key, event.target.value)
                  }
                />
              </div>
            </label>
          ))}

          <label className="review-note-field">
            <strong>Ghi chú đánh giá</strong>
            <textarea
              value={form.note}
              onChange={(event) => updateField("note", event.target.value)}
              placeholder="VD: Làm tốt ca cao điểm, phối hợp tốt, cần cải thiện tốc độ xử lý..."
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Đang lưu..." : "Lưu đánh giá"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PerformanceDetailPanel = ({ snapshot, employee, onClose }) => {
  if (!snapshot && !employee) return null;

  const level = getScoreLevel(snapshot?.finalPerformanceScore || 0);
  const customerRating = formatCustomerRating(snapshot?.factors);

  return (
    <aside className="performance-detail-panel">
      <div className="detail-header">
        <div>
          <span className="eyebrow">Chi tiết hiệu suất</span>
          <h3>{snapshot?.employeeName || employee?.name || "Nhân viên"}</h3>
          <p>
            {snapshot
              ? `${formatDate(snapshot.periodStart)} - ${formatDate(snapshot.periodEnd)}`
              : "Chưa có snapshot hiệu suất cho kỳ này."}
          </p>
        </div>
        <button type="button" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {snapshot ? (
        <>
          <div className={`detail-score-card ${level.className}`}>
            <strong>{scoreText(snapshot.finalPerformanceScore)}</strong>
            <span>{level.label}</span>
            <p>{level.description}</p>
          </div>

          <div className="component-list">
            {Object.entries(COMPONENT_META).map(([key, meta]) => {
              const item = snapshot[key];
              const Icon = meta.icon;

              return (
                <div className="component-item" key={key}>
                  <div className="component-title">
                    <Icon size={17} />
                    <div>
                      <strong>{meta.label}</strong>
                      <span>{meta.description}</span>
                    </div>
                  </div>
                  <div className="component-score">
                    <strong>{scoreText(item?.score)}</strong>
                    <span>Tỷ trọng {item?.weight || 0}%</span>
                  </div>
                  {item?.note ? <p>{item.note}</p> : null}
                </div>
              );
            })}
          </div>

          <div className="score-formula-card">
            <strong>Breakdown điểm theo trọng số</strong>
            <ul>
              {PERFORMANCE_FORMULA_ITEMS.map((item) => {
                const componentScore = snapshot?.[item.key]?.score;
                const contribution = getWeightedContribution(componentScore, item.weight);
                return (
                  <li key={item.key}>
                    <span>
                      {item.label}: {scoreText(componentScore)} × {formatPercent(item.weight)}
                    </span>
                    <strong>{formatContributionScore(contribution)} điểm</strong>
                  </li>
                );
              })}
              <li className="total">
                <span>Tổng</span>
                <strong>{scoreText(snapshot.finalPerformanceScore)}</strong>
              </li>
            </ul>
          </div>

          <div className="factor-box">
            <strong>Dữ liệu đầu vào</strong>
            <div className="factor-grid">
              <span>Order xử lý: {snapshot.factors?.orderCount ?? 0}</span>
              <span>Ca làm: {snapshot.factors?.shiftsCount ?? 0}</span>
              <span>Đi trễ: {snapshot.factors?.lateEvents ?? 0}</span>
              <span>Về sớm: {snapshot.factors?.earlyEvents ?? 0}</span>
              <span>Vắng: {snapshot.factors?.absenceEvents ?? 0}</span>
              <span>Chỉnh công: {snapshot.factors?.correctionsCount ?? 0}</span>
            </div>
            <div className="factor-grid">
              <span>{customerRating.label}</span>
              {customerRating.hasRating ? <span>{customerRating.hint}</span> : null}
            </div>
          </div>
        </>
      ) : (
        <div className="empty-detail">
          Chưa có dữ liệu hiệu suất. Hãy bấm “Tính lại hiệu suất kỳ này” hoặc
          tính riêng nhân viên này.
        </div>
      )}
    </aside>
  );
};

const StaffPerformancePage = ({
  employees = [],
  selectedRestaurant = "all",
  restaurantList = [],
  searchQuery = "",
}) => {
  const defaultRange = useMemo(() => getMonthRange(), []);
  const [periodStart, setPeriodStart] = useState(defaultRange.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaultRange.periodEnd);
  const [localSearch, setLocalSearch] = useState(searchQuery || "");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [reviewEmployee, setReviewEmployee] = useState(null);

  const effectiveRestaurantId =
    selectedRestaurant !== "all"
      ? selectedRestaurant
      : restaurantList?.[0]?.id || employees?.[0]?.restaurantForStaff || "";

  const {
    snapshots,
    loading,
    error,
    upsertStaffPerformanceReview,
    recalculateStaffPerformanceSnapshots,
    reviewState,
    recalculateState,
  } = useStaffPerformance({
    restaurantId: effectiveRestaurantId,
    periodStart,
    periodEnd,
  });

  const snapshotByEmployee = useMemo(
    () => buildSnapshotByEmployee(snapshots),
    [snapshots],
  );

  const rows = useMemo(() => {
    const needle = String(localSearch || "")
      .trim()
      .toLowerCase();

    return employees
      .filter((employee) => {
        if (!needle) return true;
        return (
          String(employee.name || "")
            .toLowerCase()
            .includes(needle) ||
          String(employee.code || "")
            .toLowerCase()
            .includes(needle) ||
          String(employee.role || "")
            .toLowerCase()
            .includes(needle)
        );
      })
      .map((employee) => {
        const snapshot = snapshotByEmployee[String(employee.id)] || null;
        const score = snapshot?.finalPerformanceScore || null;
        const level = snapshot ? getScoreLevel(score) : null;

        return {
          employee,
          snapshot,
          score,
          level,
        };
      })
      .filter((row) => {
        if (selectedLevel === "all") return true;
        if (selectedLevel === "missing") return !row.snapshot;
        return row.snapshot?.performanceLevel === selectedLevel;
      })
      .sort((a, b) => Number(b.score || -1) - Number(a.score || -1));
  }, [employees, localSearch, selectedLevel, snapshotByEmployee]);

  const stats = useMemo(() => {
    const scoredRows = rows.filter((row) => row.snapshot);
    const avg =
      scoredRows.reduce(
        (sum, row) => sum + Number(row.snapshot.finalPerformanceScore || 0),
        0,
      ) / (scoredRows.length || 1);

    return {
      total: rows.length,
      generated: scoredRows.length,
      averageScore: Math.round(avg),
      excellentOrGood: scoredRows.filter(
        (row) =>
          row.snapshot.performanceLevel === "excellent" ||
          row.snapshot.performanceLevel === "good",
      ).length,
      needsAttention: scoredRows.filter(
        (row) =>
          row.snapshot.performanceLevel === "needs_attention" ||
          row.snapshot.performanceLevel === "poor",
      ).length,
      missing: rows.length - scoredRows.length,
    };
  }, [rows]);

  const handleRecalculateAll = async () => {
    if (!effectiveRestaurantId) {
      alert("Vui lòng chọn một nhà hàng cụ thể trước khi tính hiệu suất.");
      return;
    }

    const confirmed = window.confirm(
      "Tính lại hiệu suất cho toàn bộ nhân viên trong kỳ này?",
    );
    if (!confirmed) return;

    try {
      await recalculateStaffPerformanceSnapshots({
        variables: {
          input: {
            restaurantId: effectiveRestaurantId,
            periodStart: `${periodStart}T00:00:00.000Z`,
            periodEnd: `${periodEnd}T23:59:59.999Z`,
          },
        },
      });
      alert("Đã tính lại hiệu suất kỳ này.");
    } catch (err) {
      alert(getPerformanceActionErrorMessage(err, `Không thể tính hiệu suất: ${err.message}`));
    }
  };

  const handleRecalculateOne = async (employee) => {
    if (!effectiveRestaurantId || !employee?.id) return;

    try {
      await recalculateStaffPerformanceSnapshots({
        variables: {
          input: {
            restaurantId: effectiveRestaurantId,
            employeeId: employee.id,
            periodStart: `${periodStart}T00:00:00.000Z`,
            periodEnd: `${periodEnd}T23:59:59.999Z`,
          },
        },
      });
    } catch (err) {
      alert(getPerformanceActionErrorMessage(err, `Không thể tính hiệu suất nhân viên: ${err.message}`));
    }
  };

  const handleSubmitReview = async (input) => {
    try {
      await upsertStaffPerformanceReview({ variables: { input } });

      await recalculateStaffPerformanceSnapshots({
        variables: {
          input: {
            restaurantId: input.restaurantId,
            employeeId: input.employeeId,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
          },
        },
      });

      setReviewEmployee(null);
      alert("Đã lưu đánh giá và tính lại hiệu suất nhân viên.");
    } catch (err) {
      alert(
        getPerformanceActionErrorMessage(
          err,
          `Không thể lưu đánh giá hiệu suất: ${err?.message || "Lỗi không xác định"}`,
        ),
      );
    }
  };

  const openDetail = (row) => {
    setSelectedSnapshot(row.snapshot);
    setSelectedEmployee(row.employee);
  };

  return (
    <div className="staff-performance-page">
      <section className="performance-hero">
        <div>
          <span className="eyebrow">Staff Performance</span>
          <h2>Hiệu suất nhân viên</h2>
          <p>
            Tổng hợp năng suất, đúng giờ, chất lượng, đánh giá quản lý và tuân
            thủ để phục vụ xếp lịch, đánh giá nội bộ và quản trị nhân sự.
          </p>
        </div>

        <div className="hero-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setPeriodStart(defaultRange.periodStart);
              setPeriodEnd(defaultRange.periodEnd);
            }}
          >
            Kỳ hiện tại
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleRecalculateAll}
            disabled={recalculateState.loading || !effectiveRestaurantId}
          >
            <RefreshCw size={16} />
            {recalculateState.loading
              ? "Đang tính..."
              : "Tính lại hiệu suất kỳ này"}
          </button>
        </div>
      </section>

      <details className="performance-formula-panel">
        <summary>Cách tính điểm hiệu suất</summary>
        <p>Điểm hiệu suất = tổng điểm thành phần theo trọng số:</p>
        <ul>
          {PERFORMANCE_FORMULA_ITEMS.map((item) => (
            <li key={item.key}>
              {item.label}: {formatPercent(item.weight)}
            </li>
          ))}
        </ul>
        <pre>{`finalScore =
productivity * 25%
+ punctuality * 25%
+ quality * 20%
+ managerReview * 20%
+ compliance * 10%`}</pre>
        <p className="formula-note">
          Đánh giá khách hàng không tự động thay đổi điểm hiệu suất. Quản lý có
          thể dùng thông tin này để cân nhắc khi nhập đánh giá.
        </p>
      </details>

      <section className="performance-controls">
        <div className="control-group">
          <label>
            Từ ngày
            <input
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
            />
          </label>
          <label>
            Đến ngày
            <input
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
            />
          </label>
          <label>
            Nhà hàng
            <input
              value={
                effectiveRestaurantId
                  ? getRestaurantName(restaurantList, effectiveRestaurantId)
                  : "Chưa chọn nhà hàng"
              }
              readOnly
            />
          </label>
        </div>

        <div className="control-group right">
          <label className="search-control">
            <Search size={16} />
            <input
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              placeholder="Tìm nhân viên, mã NV, vai trò..."
            />
          </label>

          <select
            value={selectedLevel}
            onChange={(event) => setSelectedLevel(event.target.value)}
          >
            <option value="all">Tất cả mức hiệu suất</option>
            <option value="excellent">Xuất sắc</option>
            <option value="good">Tốt</option>
            <option value="average">Ổn định</option>
            <option value="needs_attention">Cần theo dõi</option>
            <option value="poor">Rủi ro cao</option>
            <option value="missing">Chưa có dữ liệu</option>
          </select>
        </div>
      </section>

      <section className="performance-kpis">
        <div className="kpi-card">
          <UserRoundCheck size={20} />
          <div>
            <span>Nhân viên hiển thị</span>
            <strong>{stats.total}</strong>
          </div>
        </div>
        <div className="kpi-card">
          <BarChart3 size={20} />
          <div>
            <span>Đã có snapshot</span>
            <strong>{stats.generated}</strong>
          </div>
        </div>
        <div className="kpi-card good">
          <Star size={20} />
          <div>
            <span>Điểm trung bình</span>
            <strong>{scoreText(stats.averageScore)}</strong>
          </div>
        </div>
        <div className="kpi-card excellent">
          <CheckCircle2 size={20} />
          <div>
            <span>Tốt / Xuất sắc</span>
            <strong>{stats.excellentOrGood}</strong>
          </div>
        </div>
        <div className="kpi-card attention">
          <ShieldCheck size={20} />
          <div>
            <span>Cần theo dõi</span>
            <strong>{stats.needsAttention}</strong>
          </div>
        </div>
      </section>

      {error ? (
        <div className="performance-error">
          Không tải được dữ liệu hiệu suất: {error.message}
        </div>
      ) : null}

      <section className="performance-layout">
        <div className="performance-table-card">
          <div className="table-header">
            <div>
              <h3>Bảng hiệu suất kỳ này</h3>
              <p>
                Điểm này là dữ liệu đầu vào cho thuật toán gợi ý nhân viên khi
                xếp lịch.
              </p>
            </div>
            {loading ? <span className="loading-pill">Đang tải...</span> : null}
          </div>

          <div className="performance-table-wrap">
            <table className="performance-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Điểm tổng</th>
                  <th>Mức</th>
                  <th>Năng suất</th>
                  <th>Đúng giờ</th>
                  <th>Quản lý</th>
                  <th>Tuân thủ</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="empty-row">
                      Không có nhân viên phù hợp bộ lọc.
                    </td>
                  </tr>
                ) : null}

                {rows.map((row) => {
                  const { employee, snapshot, level } = row;
                  const displayName =
                    employee.name || snapshot?.employeeName || "Nhân viên";

                  return (
                    <tr
                      key={employee.id}
                      className={!snapshot ? "missing-snapshot" : ""}
                      onClick={() => openDetail(row)}
                    >
                      <td>
                        <div className="employee-cell">
                          <div
                            className="avatar"
                            style={{
                              backgroundImage: employee.avatar
                                ? `url(${employee.avatar})`
                                : "none",
                              backgroundColor: !employee.avatar
                                ? getAvatarColor(displayName)
                                : "transparent",
                            }}
                          >
                            {!employee.avatar && displayName.charAt(0)}
                          </div>
                          <div>
                            <strong>{displayName}</strong>
                            <span>
                              {employee.code || "--"} · {employee.role || "--"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        {snapshot ? (
                          <strong className="total-score">
                            {scoreText(snapshot.finalPerformanceScore)}
                          </strong>
                        ) : (
                          <span className="muted">Chưa tính</span>
                        )}
                      </td>

                      <td>
                        {snapshot ? (
                          <span className={`level-badge ${level.className}`}>
                            {level.label}
                          </span>
                        ) : (
                          <span className="level-badge missing">
                            Thiếu dữ liệu
                          </span>
                        )}
                      </td>

                      <td>
                        {snapshot
                          ? scoreText(snapshot.productivity?.score)
                          : "--"}
                      </td>
                      <td>
                        {snapshot
                          ? scoreText(snapshot.punctuality?.score)
                          : "--"}
                      </td>
                      <td>
                        {snapshot
                          ? scoreText(snapshot.managerReview?.score)
                          : "--"}
                      </td>
                      <td>
                        {snapshot
                          ? scoreText(snapshot.compliance?.score)
                          : "--"}
                      </td>

                      <td
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="row-action"
                          onClick={() => setReviewEmployee(employee)}
                        >
                          Đánh giá
                        </button>
                        <button
                          type="button"
                          className="row-action ghost"
                          onClick={() => handleRecalculateOne(employee)}
                          disabled={recalculateState.loading}
                        >
                          Tính lại
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <PerformanceDetailPanel
          snapshot={selectedSnapshot}
          employee={selectedEmployee}
          onClose={() => {
            setSelectedSnapshot(null);
            setSelectedEmployee(null);
          }}
        />
      </section>

      <ReviewModal
        isOpen={Boolean(reviewEmployee)}
        employee={reviewEmployee}
        snapshot={snapshotByEmployee[String(reviewEmployee?.id)] || null}
        restaurantId={effectiveRestaurantId}
        periodStart={periodStart}
        periodEnd={periodEnd}
        onClose={() => setReviewEmployee(null)}
        onSubmit={handleSubmitReview}
        submitting={reviewState.loading || recalculateState.loading}
      />
    </div>
  );
};

export default StaffPerformancePage;
