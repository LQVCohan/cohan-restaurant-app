import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "../../../context/AuthContext";
import useManagerRestaurantSelection from "../../../hooks/useManagerRestaurantSelection";
import { hasPermission } from "../../../utils/frontendPermissionAccess";
import "./SettingsManagement.scss";
import ManagementPageHeader from "../shared/ManagementPageHeader";

const Q_SYSTEM_SETTING = gql`
  query SystemSetting($restaurantId: ID!) {
    systemSetting(restaurantId: $restaurantId) {
      timezone
      currency
      dateFormat
      operational { businessDayStartHour defaultLanguage }
      modules { scheduling rbac printing backup }
      overtimePolicy {
        enabled
        defaultMaxMinutesPerDay
        roleGroupLimits {
          service { maxMinutesPerDay }
          kitchen { maxMinutesPerDay }
          shiftManager { maxMinutesPerDay }
        }
      }
      metadata { version note }
      updatedAt
    }
  }
`;

const M_UPDATE_SYSTEM_SETTING = gql`
  mutation UpdateSystemSetting($input: UpdateSystemSettingInput!) {
    updateSystemSetting(input: $input) {
      timezone
      currency
      dateFormat
      operational { businessDayStartHour defaultLanguage }
      modules { scheduling rbac printing backup }
      overtimePolicy {
        enabled
        defaultMaxMinutesPerDay
        roleGroupLimits {
          service { maxMinutesPerDay }
          kitchen { maxMinutesPerDay }
          shiftManager { maxMinutesPerDay }
        }
      }
      metadata { version note }
      updatedAt
    }
  }
`;

const OVERTIME_ROLE_GROUPS = [
  {
    key: "service",
    label: "Nhân viên phục vụ",
    description: "Server, host, điều phối sảnh",
    defaultMinutes: 120,
  },
  {
    key: "kitchen",
    label: "Bếp",
    description: "Bếp trưởng, đầu bếp, phụ bếp",
    defaultMinutes: 180,
  },
  {
    key: "shiftManager",
    label: "Quản lý ca",
    description: "Giám sát ca, trưởng ca, manager trực",
    defaultMinutes: 240,
  },
];

const FALLBACK_OVERTIME_POLICY = {
  enabled: true,
  defaultMaxMinutesPerDay: 120,
  roleGroupLimits: OVERTIME_ROLE_GROUPS.reduce((acc, item) => {
    acc[item.key] = { maxMinutesPerDay: item.defaultMinutes };
    return acc;
  }, {}),
};

const FALLBACK_SYSTEM_SETTING = {
  timezone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  dateFormat: "DD/MM/YYYY",
  operational: { businessDayStartHour: 6, defaultLanguage: "vi" },
  modules: { scheduling: true, rbac: true, printing: true, backup: false },
  overtimePolicy: FALLBACK_OVERTIME_POLICY,
  metadata: { version: "N/A", note: "Đang hiển thị cấu hình tham chiếu mặc định." },
  updatedAt: null,
};

const QUICK_ACTIONS = [
  ["schedules", "Lịch làm việc", "Kiểm tra ca làm, quy tắc phân công và quyền chỉnh sửa lịch."],
  ["rbac", "Phân quyền nhân viên", "Kiểm tra role, quyền truy cập và tài khoản quản trị."],
  ["print-management", "Quản lý in ấn", "Kiểm tra máy in bếp, mẫu hóa đơn và retry print job."],
  ["restaurant-info-management", "Thông tin nhà hàng", "Kiểm tra hồ sơ, địa chỉ, hotline, giờ mở cửa."],
  ["backup", "Sao lưu cấu hình", "Kiểm tra readiness, export snapshot và lịch sử backup run."],
];

const MODULE_LABELS = {
  scheduling: "Lịch làm việc",
  rbac: "RBAC",
  printing: "In ấn",
  backup: "Backup",
};

const getOvertimePolicy = (setting = FALLBACK_SYSTEM_SETTING) => {
  const source = setting.overtimePolicy || FALLBACK_OVERTIME_POLICY;
  const roleGroupLimits = source.roleGroupLimits || {};
  return {
    enabled: source.enabled ?? FALLBACK_OVERTIME_POLICY.enabled,
    defaultMaxMinutesPerDay:
      source.defaultMaxMinutesPerDay ?? FALLBACK_OVERTIME_POLICY.defaultMaxMinutesPerDay,
    roleGroupLimits: OVERTIME_ROLE_GROUPS.reduce((acc, group) => {
      acc[group.key] = {
        maxMinutesPerDay:
          roleGroupLimits[group.key]?.maxMinutesPerDay ?? group.defaultMinutes,
      };
      return acc;
    }, {}),
  };
};

const toFormState = (setting = FALLBACK_SYSTEM_SETTING) => {
  const overtimePolicy = getOvertimePolicy(setting);
  return {
    timezone: setting.timezone || "",
    currency: setting.currency || "",
    dateFormat: setting.dateFormat || "",
    businessDayStartHour: String(setting.operational?.businessDayStartHour ?? ""),
    defaultLanguage: setting.operational?.defaultLanguage || "",
    modules: {
      scheduling: Boolean(setting.modules?.scheduling),
      rbac: Boolean(setting.modules?.rbac),
      printing: Boolean(setting.modules?.printing),
      backup: Boolean(setting.modules?.backup),
    },
    overtimePolicyEnabled: Boolean(overtimePolicy.enabled),
    overtimeDefaultMaxMinutes: String(overtimePolicy.defaultMaxMinutesPerDay ?? ""),
    overtimeLimits: OVERTIME_ROLE_GROUPS.reduce((acc, group) => {
      acc[group.key] = String(
        overtimePolicy.roleGroupLimits[group.key]?.maxMinutesPerDay ?? group.defaultMinutes,
      );
      return acc;
    }, {}),
    note: setting.metadata?.note || "",
  };
};

const validateMinuteLimit = (value, label) => {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
    return `${label} phải là số nguyên từ 0 đến 1440 phút.`;
  }
  return "";
};

const validateForm = (form) => {
  const errors = {};
  ["timezone", "currency", "dateFormat", "defaultLanguage"].forEach((field) => {
    if (!String(form[field] || "").trim()) errors[field] = "Trường này không được rỗng.";
  });
  const hour = Number(form.businessDayStartHour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    errors.businessDayStartHour = "Giờ bắt đầu ngày vận hành phải là số nguyên từ 0 đến 23.";
  }

  const defaultLimitError = validateMinuteLimit(
    form.overtimeDefaultMaxMinutes,
    "Giới hạn tăng ca mặc định",
  );
  if (defaultLimitError) errors.overtimeDefaultMaxMinutes = defaultLimitError;

  OVERTIME_ROLE_GROUPS.forEach((group) => {
    const error = validateMinuteLimit(
      form.overtimeLimits?.[group.key],
      `Giới hạn tăng ca ${group.label}`,
    );
    if (error) errors[`overtime_${group.key}`] = error;
  });

  if (String(form.note || "").length > 1000) errors.note = "Ghi chú tối đa 1000 ký tự.";
  return errors;
};

const formatMinutes = (value) => {
  const minutes = Number(value || 0);
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  if (hours && remain) return `${hours}h ${remain}p`;
  if (hours) return `${hours}h`;
  return `${remain}p`;
};

const SettingsSkeleton = () => (
  <section className="settings-management__skeleton-grid" aria-label="Đang tải cấu hình">
    {Array.from({ length: 4 }).map((_, index) => <div key={index} className="settings-management__skeleton-card" />)}
  </section>
);

const SettingsEmptyState = () => (
  <section className="settings-management__empty" role="status">
    <span className="settings-management__empty-kicker">Cần ngữ cảnh nhà hàng</span>
    <h2>Chưa có nhà hàng để đọc cấu hình</h2>
    <p>Hãy chọn hoặc gán nhà hàng cho tài khoản quản lý. Sau đó trang sẽ tải lại cấu hình vận hành, phân quyền, in ấn và sao lưu.</p>
  </section>
);

const SettingsManagement = () => {
  const { user } = useContext(AuthContext) || {};
  const canManageSystem = hasPermission(user, "system.manage");
  const { restaurantOptions, selectedRestaurantId, setSelectedRestaurantId, restaurantsLoading, hasRestaurants } = useManagerRestaurantSelection();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(() => toFormState());
  const [formErrors, setFormErrors] = useState({});
  const [saveMessage, setSaveMessage] = useState("");

  const { data, loading, error, refetch } = useQuery(Q_SYSTEM_SETTING, {
    variables: { restaurantId: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });

  const [updateSystemSetting, updateState] = useMutation(M_UPDATE_SYSTEM_SETTING, {
    onCompleted: () => {
      setEditMode(false);
      setSaveMessage("Đã lưu cấu hình hệ thống và cập nhật version metadata.");
      refetch?.();
    },
    onError: (mutationError) => setSaveMessage(`Không lưu được cấu hình: ${mutationError.message}`),
  });

  const systemSetting = data?.systemSetting || FALLBACK_SYSTEM_SETTING;
  const overtimePolicy = getOvertimePolicy(systemSetting);

  useEffect(() => {
    if (!editMode) setForm(toFormState(systemSetting));
  }, [editMode, systemSetting]);

  const enabledModules = Object.values(systemSetting.modules || {}).filter(Boolean).length;
  const updatedAt = systemSetting.updatedAt ? new Date(systemSetting.updatedAt).toLocaleString("vi-VN") : "Chưa có dữ liệu";
  const metadataVersion = systemSetting.metadata?.version || "N/A";
  const statusType = saveMessage.toLowerCase().includes("không") ? "error" : "success";

  const navigateManagerPage = (page) => {
    if (!page) return;
    window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page, source: "settings-management" } }));
    if (window.location.hash !== `#${page}`) window.location.hash = page;
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const setModule = (module, value) => {
    setForm((prev) => ({ ...prev, modules: { ...prev.modules, [module]: value } }));
  };

  const setOvertimeLimit = (roleGroup, value) => {
    setForm((prev) => ({
      ...prev,
      overtimeLimits: { ...prev.overtimeLimits, [roleGroup]: value },
    }));
    setFormErrors((prev) => ({ ...prev, [`overtime_${roleGroup}`]: undefined }));
  };

  const handleEdit = () => {
    setForm(toFormState(systemSetting));
    setFormErrors({});
    setSaveMessage("");
    setEditMode(true);
  };

  const handleCancel = () => {
    setEditMode(false);
    setForm(toFormState(systemSetting));
    setFormErrors({});
    setSaveMessage("");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    await updateSystemSetting({
      variables: {
        input: {
          restaurantId: selectedRestaurantId,
          timezone: form.timezone.trim(),
          currency: form.currency.trim(),
          dateFormat: form.dateFormat.trim(),
          operational: { businessDayStartHour: Number(form.businessDayStartHour), defaultLanguage: form.defaultLanguage.trim() },
          modules: form.modules,
          overtimePolicy: {
            enabled: Boolean(form.overtimePolicyEnabled),
            defaultMaxMinutesPerDay: Number(form.overtimeDefaultMaxMinutes),
            roleGroupLimits: OVERTIME_ROLE_GROUPS.reduce((acc, group) => {
              acc[group.key] = { maxMinutesPerDay: Number(form.overtimeLimits[group.key]) };
              return acc;
            }, {}),
          },
          note: form.note,
        },
      },
    });
  };

  return (
    <main className="settings-management">
      <ManagementPageHeader
        eyebrow="SYSTEM CONTROL CENTER"
        title="Cài đặt hệ thống"
        subtitle="Trung tâm kiểm soát cấu hình vận hành, phân quyền và module nền tảng của nhà hàng."
        icon="⚙️"
        stats={[{ label: "Nhà hàng", value: restaurantOptions.length, icon: "🏬" }, { label: "Module bật", value: `${enabledModules}/4`, icon: "📡" }]}
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={setSelectedRestaurantId}
        restaurantList={restaurantOptions}
        restaurantDisabled={restaurantsLoading || !hasRestaurants || updateState.loading}
        restaurantPlaceholder={restaurantsLoading ? "Đang tải nhà hàng..." : "Chưa có nhà hàng"}
        customControls={<div className="settings-management__badges" aria-label="Trạng thái trang"><span>Permission-based</span><span>Editable config</span><span>Audit log</span></div>}
        showTimeWidget={false}
      />

      <section className="settings-management__hero" aria-label="Tổng quan control center">
        <div><span className="settings-management__eyebrow">System control center</span><h2>Cấu hình nền tảng có version, phân quyền và audit</h2><p>Quản trị múi giờ, tiền tệ, format ngày, giới hạn tăng ca theo nhóm vai trò, module nền tảng và điều hướng nhanh tới các trung tâm cấu hình liên quan.</p></div>
        <div className="settings-management__hero-metrics"><article><strong>v{metadataVersion}</strong><span>Metadata version</span></article><article><strong>{loading ? "Sync" : error ? "Fallback" : "Ready"}</strong><span>Trạng thái backend</span></article><article><strong>{overtimePolicy.enabled ? "Đang chặn" : "Tắt"}</strong><span>Chính sách tăng ca</span></article><article><strong>{updatedAt}</strong><span>Cập nhật gần nhất</span></article></div>
      </section>

      {!restaurantsLoading && !hasRestaurants ? <SettingsEmptyState /> : null}
      {error ? <section className="settings-management__alert is-error" role="alert"><div><strong>Không đọc được cấu hình hệ thống.</strong><p>Trang đang dùng giá trị fallback để không chặn thao tác điều hướng.</p></div><button type="button" onClick={() => refetch?.()}>Thử lại</button></section> : null}
      {saveMessage ? <section className={`settings-management__alert is-${statusType}`} role={statusType === "error" ? "alert" : "status"}>{saveMessage}</section> : null}
      {!canManageSystem ? <section className="settings-management__alert is-warning" role="note"><strong>Chế độ chỉ xem.</strong> Tài khoản cần quyền system.manage để chỉnh sửa cấu hình.</section> : null}
      {(restaurantsLoading || loading) ? <SettingsSkeleton /> : null}

      {selectedRestaurantId && !loading ? (
        <section className="settings-management__workspace" aria-label="Không gian cấu hình">
          <div className="settings-management__primary-column">
            <form className={`settings-management__form ${editMode ? "is-editing" : ""}`} onSubmit={handleSave} aria-label="Form chỉnh sửa cấu hình hệ thống">
              <div className="settings-management__form-header"><div><span>Configuration form</span><h3>Thiết lập vận hành</h3><p>Version {metadataVersion} • cập nhật {updatedAt}</p></div><div className="settings-management__actions">{!editMode ? <button type="button" onClick={handleEdit} disabled={!canManageSystem}>Chỉnh sửa</button> : <><button type="submit" disabled={updateState.loading}>{updateState.loading ? "Đang lưu..." : "Lưu cấu hình"}</button><button type="button" className="settings-management__secondary-button" onClick={handleCancel} disabled={updateState.loading}>Hủy</button></>}</div></div>
              <div className="settings-management__form-grid">
                <label>Timezone<input aria-label="Timezone" value={form.timezone} disabled={!editMode || updateState.loading} onChange={(event) => setField("timezone", event.target.value)} />{formErrors.timezone ? <em>{formErrors.timezone}</em> : null}</label>
                <label>Currency<input aria-label="Currency" value={form.currency} disabled={!editMode || updateState.loading} onChange={(event) => setField("currency", event.target.value)} />{formErrors.currency ? <em>{formErrors.currency}</em> : null}</label>
                <label>Date format<input aria-label="Date format" value={form.dateFormat} disabled={!editMode || updateState.loading} onChange={(event) => setField("dateFormat", event.target.value)} />{formErrors.dateFormat ? <em>{formErrors.dateFormat}</em> : null}</label>
                <label>Business day start hour<input aria-label="Business day start hour" type="number" inputMode="numeric" value={form.businessDayStartHour} disabled={!editMode || updateState.loading} onChange={(event) => setField("businessDayStartHour", event.target.value)} />{formErrors.businessDayStartHour ? <em>{formErrors.businessDayStartHour}</em> : null}</label>
                <label>Default language<input aria-label="Default language" value={form.defaultLanguage} disabled={!editMode || updateState.loading} onChange={(event) => setField("defaultLanguage", event.target.value)} />{formErrors.defaultLanguage ? <em>{formErrors.defaultLanguage}</em> : null}</label>
              </div>

              <section className="settings-management__overtime-policy" aria-label="Thiết lập giới hạn tăng ca">
                <div className="settings-management__policy-header">
                  <div><span>Overtime policy</span><h4>Giới hạn tăng ca theo nhóm vai trò</h4><p>Backend sẽ chặn duyệt nếu số phút tăng ca vượt giới hạn đã cấu hình cho nhóm nhân viên.</p></div>
                  <label className="settings-management__toggle-row"><input type="checkbox" checked={Boolean(form.overtimePolicyEnabled)} disabled={!editMode || updateState.loading} onChange={(event) => setField("overtimePolicyEnabled", event.target.checked)} /><span>Bật kiểm soát giới hạn</span></label>
                </div>

                <div className="settings-management__overtime-grid">
                  <label className="settings-management__overtime-limit-card is-default">
                    <span>Mặc định</span>
                    <small>Áp dụng khi không xác định được nhóm vai trò.</small>
                    <input type="number" min="0" max="1440" inputMode="numeric" value={form.overtimeDefaultMaxMinutes} disabled={!editMode || updateState.loading} onChange={(event) => setField("overtimeDefaultMaxMinutes", event.target.value)} />
                    <strong>{formatMinutes(form.overtimeDefaultMaxMinutes)}/ngày</strong>
                    {formErrors.overtimeDefaultMaxMinutes ? <em>{formErrors.overtimeDefaultMaxMinutes}</em> : null}
                  </label>
                  {OVERTIME_ROLE_GROUPS.map((group) => (
                    <label key={group.key} className="settings-management__overtime-limit-card">
                      <span>{group.label}</span>
                      <small>{group.description}</small>
                      <input type="number" min="0" max="1440" inputMode="numeric" value={form.overtimeLimits[group.key]} disabled={!editMode || updateState.loading} onChange={(event) => setOvertimeLimit(group.key, event.target.value)} />
                      <strong>{formatMinutes(form.overtimeLimits[group.key])}/ngày</strong>
                      {formErrors[`overtime_${group.key}`] ? <em>{formErrors[`overtime_${group.key}`]}</em> : null}
                    </label>
                  ))}
                </div>
              </section>

              <div className="settings-management__module-grid" aria-label="Module nền tảng">
                {Object.entries(MODULE_LABELS).map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(form.modules[key])} disabled={!editMode || updateState.loading} onChange={(event) => setModule(key, event.target.checked)} /><span>{label}</span></label>)}
              </div>
              <label className="settings-management__note-field">Ghi chú cấu hình<textarea aria-label="Ghi chú cấu hình" value={form.note} maxLength={1000} disabled={!editMode || updateState.loading} onChange={(event) => setField("note", event.target.value)} />{formErrors.note ? <em>{formErrors.note}</em> : <small>{form.note.length}/1000 ký tự</small>}</label>
            </form>

            <section className="settings-management__summary" aria-label="Tổng quan cấu hình">
              <article><span>Vận hành</span><ul><li>Múi giờ: {systemSetting.timezone}</li><li>Tiền tệ: {systemSetting.currency}</li><li>Định dạng ngày: {systemSetting.dateFormat}</li></ul></article>
              <article><span>Tăng ca</span><ul><li>Kiểm soát: {overtimePolicy.enabled ? "Bật" : "Tắt"}</li><li>Phục vụ: {formatMinutes(overtimePolicy.roleGroupLimits.service.maxMinutesPerDay)}/ngày</li><li>Bếp: {formatMinutes(overtimePolicy.roleGroupLimits.kitchen.maxMinutesPerDay)}/ngày</li><li>Quản lý ca: {formatMinutes(overtimePolicy.roleGroupLimits.shiftManager.maxMinutesPerDay)}/ngày</li></ul></article>
              <article><span>Bảo mật</span><ul><li>RBAC: {systemSetting.modules?.rbac ? "Bật" : "Tắt"}</li><li>Ngôn ngữ mặc định: {systemSetting.operational?.defaultLanguage || "-"}</li></ul><button type="button" onClick={() => navigateManagerPage("rbac")}>Mở phân quyền</button></article>
              <article><span>Nhà hàng</span><ul><li>Hồ sơ, liên hệ, giờ mở cửa</li><li>Cập nhật gần nhất: {updatedAt}</li></ul><button type="button" onClick={() => navigateManagerPage("restaurant-info-management")}>Mở thông tin nhà hàng</button></article>
              <article><span>Thiết bị</span><ul><li>In ấn: {systemSetting.modules?.printing ? "Bật" : "Tắt"}</li><li>Backup module: {systemSetting.modules?.backup ? "Bật" : "Tắt"}</li></ul><button type="button" onClick={() => navigateManagerPage("print-management")}>Mở quản lý in ấn</button></article>
            </section>
          </div>

          <aside className="settings-management__side-panel" aria-label="Quick actions và checklist">
            <div className="settings-management__section-title"><h3>Quick actions</h3><p>Giữ điều hướng tới các module cấu hình UC20 và module liên quan.</p></div>
            <div className="settings-management__list">{QUICK_ACTIONS.map(([page, title, description], index) => <article key={page}><span>{String(index + 1).padStart(2, "0")}</span><h4>{title}</h4><p>{description}</p><button type="button" onClick={() => navigateManagerPage(page)}>Mở {title}</button></article>)}</div>
          </aside>
        </section>
      ) : null}
    </main>
  );
};

export default SettingsManagement;
