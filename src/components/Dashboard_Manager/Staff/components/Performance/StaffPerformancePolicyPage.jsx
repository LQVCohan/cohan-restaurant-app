import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  Building2,
  CheckCircle2,
  Info,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import useStaffPerformancePolicy from "@/hooks/useStaffPerformancePolicy";
import {
  resetPerformanceLevelThresholds,
  setPerformanceLevelThresholds,
} from "@/utils/staffPerformanceGlobalFormat";
import StaffPerformancePage, {
  resolveEffectivePerformanceRestaurantId,
} from "./StaffPerformancePage";
import "./StaffPerformancePolicyPage.scss";
import "./StaffPerformanceExperience.scss";

export const DEFAULT_POLICY_THRESHOLDS = Object.freeze({
  excellentMin: 90,
  goodMin: 80,
  averageMin: 65,
  needsAttentionMin: 50,
});

const THRESHOLD_FIELDS = [
  {
    key: "excellentMin",
    label: "Xuất sắc từ",
    help: "Điểm bằng hoặc cao hơn mốc này được xếp Xuất sắc.",
  },
  {
    key: "goodMin",
    label: "Tốt từ",
    help: "Khoảng từ mốc này đến dưới Xuất sắc.",
  },
  {
    key: "averageMin",
    label: "Trung bình từ",
    help: "Khoảng từ mốc này đến dưới Tốt.",
  },
  {
    key: "needsAttentionMin",
    label: "Cần chú ý từ",
    help: "Điểm thấp hơn mốc này được xếp Kém.",
  },
];

const FORMULA_LABELS = {
  productivity: "Năng suất",
  punctuality: "Đúng giờ",
  quality: "Chất lượng",
  managerReview: "Đánh giá quản lý",
  compliance: "Tuân thủ",
};

const DEFAULT_WEIGHTS = {
  productivity: 25,
  punctuality: 25,
  quality: 20,
  managerReview: 20,
  compliance: 10,
};

const DEFAULT_LOCKED_RULES = [
  "Trọng số 25/25/20/20/10",
  "Công thức năng suất theo thời lượng ca",
  "Mức trừ đi trễ, về sớm và vắng mặt",
  "Quy tắc Chất lượng theo từng vai trò",
  "Mức trừ yêu cầu chỉnh công",
  "Quy trình incident và hoàn điểm appeal",
];

export const validatePolicyThresholds = (values = {}) => {
  const normalized = Object.fromEntries(
    THRESHOLD_FIELDS.map(({ key }) => [key, Number(values[key])]),
  );
  const invalidField = THRESHOLD_FIELDS.find(({ key }) => {
    const value = normalized[key];
    return !Number.isInteger(value) || value < 1 || value > 100;
  });

  if (invalidField) {
    return {
      valid: false,
      message: `${invalidField.label} phải là số nguyên từ 1 đến 100.`,
      values: normalized,
    };
  }

  if (
    !(
      normalized.excellentMin > normalized.goodMin &&
      normalized.goodMin > normalized.averageMin &&
      normalized.averageMin > normalized.needsAttentionMin
    )
  ) {
    return {
      valid: false,
      message:
        "Các mốc phải giảm nghiêm ngặt: Xuất sắc > Tốt > Trung bình > Cần chú ý.",
      values: normalized,
    };
  }

  return { valid: true, message: "", values: normalized };
};

const rangePreview = (thresholds) => [
  `Xuất sắc: ${thresholds.excellentMin}–100`,
  `Tốt: ${thresholds.goodMin}–${thresholds.excellentMin - 1}`,
  `Trung bình: ${thresholds.averageMin}–${thresholds.goodMin - 1}`,
  `Cần chú ý: ${thresholds.needsAttentionMin}–${thresholds.averageMin - 1}`,
  `Kém: 0–${thresholds.needsAttentionMin - 1}`,
];

const PolicyModal = ({
  open,
  restaurantName,
  policy,
  loading,
  error,
  saving,
  onClose,
  onSave,
}) => {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [form, setForm] = useState(DEFAULT_POLICY_THRESHOLDS);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm({
      ...DEFAULT_POLICY_THRESHOLDS,
      ...(policy?.levelThresholds || {}),
    });
    setActionError("");
  }, [open, policy?.levelThresholds]);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose, open]);

  const validation = useMemo(() => validatePolicyThresholds(form), [form]);
  const weights = policy?.weights || DEFAULT_WEIGHTS;
  const lockedRules = policy?.lockedFields?.length
    ? policy.lockedFields
    : DEFAULT_LOCKED_RULES;

  if (!open || typeof document === "undefined") return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validation.valid) {
      setActionError(validation.message);
      return;
    }
    setActionError("");
    try {
      await onSave(validation.values);
    } catch (saveError) {
      setActionError(
        saveError?.graphQLErrors?.[0]?.message ||
          saveError?.message ||
          "Không thể lưu cấu hình đánh giá.",
      );
    }
  };

  return createPortal(
    <div
      className="performance-policy-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="performance-policy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="performance-policy-title"
        aria-describedby="performance-policy-description"
      >
        <header className="performance-policy-modal__header">
          <div className="performance-policy-modal__heading">
            <span className="performance-policy-modal__heading-icon" aria-hidden="true">
              <Settings2 size={22} />
            </span>
            <div>
              <span className="performance-policy-eyebrow">Quy tắc theo nhà hàng</span>
              <h2 id="performance-policy-title">Cấu hình đánh giá hiệu suất</h2>
              <p id="performance-policy-description">
                {restaurantName}. Điều chỉnh mốc xếp loại mà không làm thay đổi công thức nền.
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="performance-policy-close"
            onClick={onClose}
            aria-label="Đóng cấu hình đánh giá"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {loading ? (
          <div className="performance-policy-status" role="status">
            Đang tải cấu hình hiện tại…
          </div>
        ) : (
          <form className="performance-policy-form" onSubmit={handleSubmit}>
            <div className="performance-policy-modal__summary" aria-label="Tóm tắt cấu hình">
              <div className="performance-policy-summary-card">
                <span aria-hidden="true">
                  <ShieldCheck size={18} />
                </span>
                <strong>100%</strong>
                <small>Tổng trọng số đã khóa</small>
              </div>
              <div className="performance-policy-summary-card">
                <span aria-hidden="true">
                  <SlidersHorizontal size={18} />
                </span>
                <strong>4 mốc</strong>
                <small>Có thể điều chỉnh</small>
              </div>
              <div className="performance-policy-summary-card">
                <span aria-hidden="true">
                  <Building2 size={18} />
                </span>
                <strong title={restaurantName}>{restaurantName}</strong>
                <small>Phạm vi áp dụng</small>
              </div>
            </div>

            <div className="performance-policy-workspace">
              <div className="performance-policy-workspace__main">
                <section className="performance-policy-section performance-policy-section--editable">
                  <div className="performance-policy-section__title">
                    <SlidersHorizontal size={18} aria-hidden="true" />
                    <div>
                      <h3>Được phép điều chỉnh</h3>
                      <p>Các mốc phải là số nguyên và giảm nghiêm ngặt.</p>
                    </div>
                  </div>
                  <div className="performance-policy-threshold-grid">
                    {THRESHOLD_FIELDS.map((field) => (
                      <label key={field.key}>
                        <span>{field.label}</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          inputMode="numeric"
                          value={form[field.key]}
                          onChange={(event) => {
                            setForm((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }));
                            setActionError("");
                          }}
                        />
                        <small>{field.help}</small>
                      </label>
                    ))}
                  </div>
                  <div className="performance-policy-preview" aria-live="polite">
                    <strong>Xem trước khoảng điểm</strong>
                    <div>
                      {(validation.valid
                        ? rangePreview(validation.values)
                        : [validation.message]
                      ).map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="performance-policy-impact-note">
                  <strong>Phạm vi tác động</strong>
                  <p>
                    Mốc mới chỉ áp dụng khi tính lại hiệu suất. Snapshot và báo cáo lịch sử
                    không bị sửa âm thầm.
                  </p>
                </div>
              </div>

              <aside className="performance-policy-workspace__side">
                <section className="performance-policy-section">
                  <div className="performance-policy-section__title">
                    <ShieldCheck size={18} aria-hidden="true" />
                    <div>
                      <h3>Công thức đang áp dụng</h3>
                      <p>Tổng trọng số luôn bằng 100% và không thể sửa tại đây.</p>
                    </div>
                  </div>
                  <div className="performance-policy-weights">
                    {Object.entries(weights).map(([key, value]) => (
                      <div key={key}>
                        <span>{FORMULA_LABELS[key] || key}</span>
                        <strong>{value}%</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="performance-policy-section performance-policy-section--locked">
                  <div className="performance-policy-section__title">
                    <LockKeyhole size={18} aria-hidden="true" />
                    <div>
                      <h3>Được bảo vệ, không thể sửa</h3>
                      <p>Các quy tắc nghiệp vụ cốt lõi được khóa để tránh sai lệch.</p>
                    </div>
                  </div>
                  <ul>
                    {lockedRules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </section>
              </aside>
            </div>

            {error || actionError ? (
              <p className="performance-policy-error" role="alert">
                {actionError || error?.message || "Không tải được cấu hình."}
              </p>
            ) : null}

            <footer className="performance-policy-actions">
              <div className="performance-policy-actions__copy">
                <CheckCircle2 size={17} aria-hidden="true" />
                <span>Thay đổi được kiểm tra trước khi lưu và chỉ áp dụng cho snapshot mới.</span>
              </div>
              <div>
                <button type="button" className="btn-secondary" onClick={onClose}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving || !validation.valid || Boolean(error)}
                >
                  {saving ? "Đang lưu…" : "Lưu mốc xếp loại"}
                </button>
              </div>
            </footer>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
};

const StaffPerformancePolicyPage = (props) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [policyRenderKey, setPolicyRenderKey] = useState("default");
  const restaurantId = resolveEffectivePerformanceRestaurantId(
    props.selectedRestaurant,
  );
  const restaurantName =
    props.restaurantList?.find(
      (restaurant) => String(restaurant.id) === String(restaurantId),
    )?.name || "Chưa chọn nhà hàng";
  const {
    policy,
    loading,
    error,
    updatePolicy,
    updateState,
  } = useStaffPerformancePolicy({ restaurantId });

  useEffect(() => {
    resetPerformanceLevelThresholds();
    setPolicyRenderKey(`${restaurantId || "none"}:default`);
    setStatusMessage("");
  }, [restaurantId]);

  useEffect(() => {
    if (!policy?.levelThresholds) return;
    setPerformanceLevelThresholds(policy.levelThresholds);
    setPolicyRenderKey(
      `${restaurantId}:${JSON.stringify(policy.levelThresholds)}`,
    );
  }, [policy?.levelThresholds, restaurantId]);

  const handleSave = async (thresholds) => {
    const result = await updatePolicy({
      variables: {
        input: {
          restaurantId,
          levelThresholds: thresholds,
        },
      },
    });
    const saved = result?.data?.updateStaffPerformancePolicy;
    if (!saved?.levelThresholds) {
      throw new Error("Hệ thống không trả về cấu hình đã lưu.");
    }
    setPerformanceLevelThresholds(saved.levelThresholds);
    setPolicyRenderKey(
      `${restaurantId}:${JSON.stringify(saved.levelThresholds)}`,
    );
    setStatusMessage(
      "Đã lưu mốc xếp loại. Hãy tính lại hiệu suất để áp dụng cho snapshot mới.",
    );
    setModalOpen(false);
  };

  return (
    <div className="staff-performance-policy-shell">
      <section className="performance-page-hero">
        <div className="performance-page-hero__main">
          <span className="performance-page-hero__icon" aria-hidden="true">
            <BarChart3 size={25} />
          </span>
          <div className="performance-page-hero__copy">
            <span className="performance-page-hero__eyebrow">Quản trị hiệu suất</span>
            <h2>Hiệu suất nhân viên</h2>
            <p>
              Theo dõi kết quả làm việc theo từng kỳ, so sánh xu hướng và sử dụng dữ liệu
              minh bạch để hỗ trợ xếp lịch, đào tạo và ghi nhận nhân viên.
            </p>
            <div className="performance-page-hero__meta">
              <span title={restaurantName}>
                <Building2 size={14} aria-hidden="true" />
                {restaurantName}
              </span>
              <span>
                <ShieldCheck size={14} aria-hidden="true" />
                Công thức nghiệp vụ đã khóa
              </span>
              <span>
                <SlidersHorizontal size={14} aria-hidden="true" />
                4 mốc xếp loại có thể chỉnh
              </span>
            </div>
          </div>
        </div>

        <div className="performance-page-hero__aside">
          <div className="performance-page-hero__policy">
            <span aria-hidden="true">
              <Settings2 size={19} />
            </span>
            <small>Quy tắc đánh giá</small>
            <strong>25 / 25 / 20 / 20 / 10</strong>
            <p>Giữ công thức nhất quán, chỉ thay đổi ranh giới xếp loại.</p>
          </div>
          <button
            type="button"
            className="performance-policy-open-button"
            onClick={() => setModalOpen(true)}
            disabled={!restaurantId}
            title={
              restaurantId
                ? "Mở cấu hình đánh giá hiệu suất"
                : "Chọn một nhà hàng cụ thể trước khi cấu hình"
            }
          >
            <Settings2 size={17} aria-hidden="true" />
            Cấu hình đánh giá
          </button>
        </div>
      </section>

      <div className="performance-page-guidance" role="note">
        <Info size={19} aria-hidden="true" />
        <div>
          <strong>Luồng làm việc đề xuất</strong>
          <span>
            Chọn kỳ và nhà hàng → kiểm tra dữ liệu → tính lại snapshot → đánh giá các trường
            hợp cần chú ý.
          </span>
        </div>
        <span className="performance-page-guidance__pill">Không tự động trừ điểm</span>
      </div>

      {statusMessage ? (
        <p className="performance-policy-saved" role="status">
          {statusMessage}
        </p>
      ) : null}

      <StaffPerformancePage key={policyRenderKey} {...props} />

      <PolicyModal
        open={modalOpen}
        restaurantName={restaurantName}
        policy={policy}
        loading={loading}
        error={error || updateState.error}
        saving={updateState.loading}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};

export default StaffPerformancePolicyPage;
