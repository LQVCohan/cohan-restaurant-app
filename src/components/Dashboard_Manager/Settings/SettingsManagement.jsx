import React, { useContext, useEffect, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "../../../context/AuthContext";
import useManagerRestaurantSelection from "../../../hooks/useManagerRestaurantSelection";
import { hasPermission } from "../../../utils/frontendPermissionAccess";
import "./SettingsManagement.scss";
import "./SettingsOvertimePolicy.scss";
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
    description: "Phục vụ, lễ tân và điều phối sảnh",
    defaultMinutes: 120,
  },
  {
    key: "kitchen",
    label: "Bộ phận bếp",
    description: "Bếp trưởng, đầu bếp và phụ bếp",
    defaultMinutes: 180,
  },
  {
    key: "shiftManager",
    label: "Quản lý ca",
    description: "Giám sát ca và trưởng ca trực",
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
  operational: { businessDayStartHour: 5, defaultLanguage: "vi" },
  modules: { scheduling: true, rbac: true, printing: true, backup: true },
  overtimePolicy: FALLBACK_OVERTIME_POLICY,
  metadata: { version: 1, note: "Đang hiển thị cấu hình mặc định của hệ thống." },
  updatedAt: null,
};

const QUICK_ACTIONS = [
  ["schedules", "Lịch làm việc", "Kiểm tra ca làm, quy tắc phân công và quyền chỉnh sửa lịch."],
  ["rbac", "Phân quyền nhân viên", "Kiểm tra vai trò, quyền truy cập và tài khoản quản trị."],
  ["print-management", "Quản lý in ấn", "Kiểm tra máy in bếp, mẫu hóa đơn và tác vụ in lỗi."],
  ["restaurant-info-management", "Thông tin nhà hàng", "Kiểm tra hồ sơ, địa chỉ, liên hệ và giờ mở cửa."],
  ["backup", "Sao lưu cấu hình", "Kiểm tra mức sẵn sàng, tải file và lịch sử sao lưu."],
];

const MODULE_LABELS = {
  scheduling: "Lịch làm việc",
  rbac: "Phân quyền",
  printing: "In ấn",
  backup: "Sao lưu",
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
    if (!String(form[field] || "").trim()) errors[field] = "Trường này không được để trống.";
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
  if (hours && remain) return `${hours} giờ ${remain} phút`;
  if (hours) return `${hours} giờ`;
  return `${remain} phút`;
};

const SettingsSkeleton = () => (
  <section className="settings-management__skeleton-grid" aria-label="Đang tải cấu hình" aria-live="polite">
    {Array.from({ length: 4 }).map((_, index) => <div key={index} className="settings-management__skeleton-card" />)}
  </section>
);

const SettingsEmptyState = () => (
  <section className="settings-management__empty" role="status">
    <span className="settings-management__empty-kicker">Cần chọn nhà hàng</span>
    <h2>Chưa có nhà hàng để đọc cấu hình</h2>
    <p>Hãy chọn hoặc gán nhà hàng cho tài khoản quản lý. Trang sẽ tải cấu hình vận hành, phân quyền, in ấn và sao lưu ngay sau đó.</p>
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
      setSaveMessage("Đã lưu cấu hình hệ thống và tạo phiên bản mới.");
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
  const metadataVersion = systemSetting.metadata?.version || 1;
  const statusType = saveMessage.toLowerCase().includes("không") ? "error" : "success";
  const backendState = loading ? "Đang đồng bộ" : error ? "Dùng cấu hình dự phòng" : "Sẵn sàng";

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
        eyebrow="VẬN HÀNH HỆ THỐNG"
        title="Cài đặt hệ thống"
        subtitle="Quản lý cấu hình vận hành, phân quyền và các phân hệ nền tảng của từng nhà hàng."
        icon="⚙️"
        stats={[{ label: "Nhà hàng", value: restaurantOptions.length, icon: "🏬" }, { label: "Phân hệ đang bật", value: `${enabledModules}/4`, icon: "📡" }]}
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={setSelectedRestaurantId}
        restaurantList={restaurantOptions}
        restaurantDisabled={restaurantsLoading || !hasRestaurants || updateState.loading}
        restaurantPlaceholder={restaurantsLoading ? "Đang tải nhà hàng..." : "Chưa có nhà hàng"}
        customControls={<div className="settings-management__badges" aria-label="Trạng thái trang"><span>Theo quyền truy cập</span><span>Có thể chỉnh sửa</span><span>Có nhật ký thay đổi</span></div>}
        showTimeWidget={false}
      />

      <section className="settings-management__hero" aria-label="Tổng quan cài đặt hệ thống">
        <div className="settings-management__hero-copy">
          <span className="settings-management__eyebrow">Bảng điều khiển vận hành</span>
          <h2>Một nơi quản lý cấu hình dùng chung của nhà hàng</h2>
          <p>Thiết lập múi giờ, tiền tệ, định dạng ngày, giới hạn tăng ca và trạng thái các phân hệ. Mọi thay đổi đều được kiểm tra quyền và ghi nhận lịch sử.</p>
        </div>
        <div className="settings-management__hero-metrics">
          <article><strong>v{metadataVersion}</strong><span>Phiên bản cấu hình</span></article>
          <article><strong>{backendState}</strong><span>Trạng thái dữ liệu</span></article>
          <article><strong>{overtimePolicy.enabled ? "Đang kiểm soát" : "Đã tắt"}</strong><span>Giới hạn tăng ca</span></article>
          <article><strong>{updatedAt}</strong><span>Cập nhật gần nhất</span></article>
        </div>
      </section>

      {!restaurantsLoading && !hasRestaurants ? <SettingsEmptyState /> : null}
      {error ? <section className="settings-management__alert is-error" role="alert"><div><strong>Không đọc được cấu hình hệ thống.</strong><p>Trang đang dùng cấu hình dự phòng để không chặn thao tác điều hướng.</p></div><button type="button" onClick={() => refetch?.()}>Thử lại</button></section> : null}
      {saveMessage ? <section className={`settings-management__alert is-${statusType}`} role={statusType === "error" ? "alert" : "status"} aria-live="polite">{saveMessage}</section> : null}
      {!canManageSystem ? <section className="settings-management__alert is-warning" role="note"><strong>Chế độ chỉ xem.</strong> Tài khoản cần quyền quản lý hệ thống để chỉnh sửa cấu hình.</section> : null}
      {(restaurantsLoading || loading) ? <SettingsSkeleton /> : null}

      {selectedRestaurantId && !loading ? (
        <section className="settings-management__workspace" aria-label="Không gian cấu hình">
          <div className="settings-management__primary-column">
            <form className={`settings-management__form ${editMode ? "is-editing" : ""}`} onSubmit={handleSave} aria-label="Biểu mẫu cấu hình hệ thống" noValidate>
              <div className="settings-management__form-header">
                <div>
                  <span>Cấu hình vận hành</span>
                  <h3>Thiết lập dùng chung</h3>
                  <p>Phiên bản {metadataVersion} • cập nhật {updatedAt}</p>
                </div>
                <div className="settings-management__form-controls">
                  <span className={`settings-management__edit-state ${editMode ? "is-editing" : ""}`}>{editMode ? "Đang chỉnh sửa" : "Chỉ đọc"}</span>
                  <div className="settings-management__actions">
                    {!editMode ? <button type="button" onClick={handleEdit} disabled={!canManageSystem}>Chỉnh sửa</button> : <><button type="submit" disabled={updateState.loading}>{updateState.loading ? "Đang lưu..." : "Lưu cấu hình"}</button><button type="button" className="settings-management__secondary-button" onClick={handleCancel} disabled={updateState.loading}>Hủy thay đổi</button></>}
                  </div>
                </div>
              </div>

              <div className="settings-management__form-grid">
                <label>Múi giờ<input aria-label="Múi giờ" aria-invalid={Boolean(formErrors.timezone)} value={form.timezone} disabled={!editMode || updateState.loading} onChange={(event) => setField("timezone", event.target.value)} />{formErrors.timezone ? <em>{formErrors.timezone}</em> : null}</label>
                <label>Đơn vị tiền tệ<input aria-label="Đơn vị tiền tệ" aria-invalid={Boolean(formErrors.currency)} value={form.currency} disabled={!editMode || updateState.loading} onChange={(event) => setField("currency", event.target.value)} />{formErrors.currency ? <em>{formErrors.currency}</em> : null}</label>
                <label>Định dạng ngày<input aria-label="Định dạng ngày" aria-invalid={Boolean(formErrors.dateFormat)} value={form.dateFormat} disabled={!editMode || updateState.loading} onChange={(event) => setField("dateFormat", event.target.value)} />{formErrors.dateFormat ? <em>{formErrors.dateFormat}</em> : null}</label>
                <label>Giờ bắt đầu ngày vận hành<input aria-label="Giờ bắt đầu ngày vận hành" aria-invalid={Boolean(formErrors.businessDayStartHour)} type="number" min="0" max="23" inputMode="numeric" value={form.businessDayStartHour} disabled={!editMode || updateState.loading} onChange={(event) => setField("businessDayStartHour", event.target.value)} />{formErrors.businessDayStartHour ? <em>{formErrors.businessDayStartHour}</em> : null}</label>
                <label>Ngôn ngữ mặc định<input aria-label="Ngôn ngữ mặc định" aria-invalid={Boolean(formErrors.defaultLanguage)} value={form.defaultLanguage} disabled={!editMode || updateState.loading} onChange={(event) => setField("defaultLanguage", event.target.value)} />{formErrors.defaultLanguage ? <em>{formErrors.defaultLanguage}</em> : null}</label>
              </div>

              <section className="settings-management__overtime-policy" aria-label="Thiết lập giới hạn tăng ca">
                <div className="settings-management__policy-header">
                  <div><span>Chính sách tăng ca</span><h4>Giới hạn theo nhóm nhân viên</h4><p>Hệ thống chặn phê duyệt khi số phút tăng ca vượt giới hạn đã cấu hình cho nhóm nhân viên.</p></div>
                  <label className="settings-management__toggle-row"><input type="checkbox" checked={Boolean(form.overtimePolicyEnabled)} disabled={!editMode || updateState.loading} onChange={(event) => setField("overtimePolicyEnabled", event.target.checked)} /><span>Bật kiểm soát giới hạn</span></label>
                </div>

                <div className="settings-management__overtime-grid">
                  <label className="settings-management__overtime-limit-card is-default">
                    <span>Mặc định</span>
                    <small>Áp dụng khi chưa xác định được nhóm nhân viên.</small>
                    <input aria-label="Giới hạn tăng ca mặc định" type="number" min="0" max="1440" inputMode="numeric" value={form.overtimeDefaultMaxMinutes} disabled={!editMode || updateState.loading} onChange={(event) => setField("overtimeDefaultMaxMinutes", event.target.value)} />
                    <strong>{formatMinutes(form.overtimeDefaultMaxMinutes)}/ngày</strong>
                    {formErrors.overtimeDefaultMaxMinutes ? <em>{formErrors.overtimeDefaultMaxMinutes}</em> : null}
                  </label>
                  {OVERTIME_ROLE_GROUPS.map((group) => (
                    <label key={group.key} className="settings-management__overtime-limit-card">
                      <span>{group.label}</span>
                      <small>{group.description}</small>
                      <input aria-label={`Giới hạn tăng ca ${group.label}`} type="number" min="0" max="1440" inputMode="numeric" value={form.overtimeLimits[group.key]} disabled={!editMode || updateState.loading} onChange={(event) => setOvertimeLimit(group.key, event.target.value)} />
                      <strong>{formatMinutes(form.overtimeLimits[group.key])}/ngày</strong>
                      {formErrors[`overtime_${group.key}`] ? <em>{formErrors[`overtime_${group.key}`]}</em> : null}
                    </label>
                  ))}
                </div>
              </section>

              <section className="settings-management__module-section" aria-labelledby="settings-module-title">
                <div><span>Phân hệ nền tảng</span><h4 id="settings-module-title">Bật hoặc tắt theo nhu cầu vận hành</h4><p>Việc truy cập thực tế vẫn tuân theo vai trò và quyền của từng tài khoản.</p></div>
                <div className="settings-management__module-grid">
                  {Object.entries(MODULE_LABELS).map(([key, label]) => <label key={key}><input aria-label={label} type="checkbox" checked={Boolean(form.modules[key])} disabled={!editMode || updateState.loading} onChange={(event) => setModule(key, event.target.checked)} /><span>{label}</span><small>{form.modules[key] ? "Đang bật" : "Đang tắt"}</small></label>)}
                </div>
              </section>

              <label className="settings-management__note-field">Ghi chú cấu hình<textarea aria-label="Ghi chú cấu hình" value={form.note} maxLength={1000} disabled={!editMode || updateState.loading} onChange={(event) => setField("note", event.target.value)} placeholder="Ghi lại lý do hoặc phạm vi thay đổi để dễ đối chiếu sau này." />{formErrors.note ? <em>{formErrors.note}</em> : <small>{form.note.length}/1000 ký tự</small>}</label>
            </form>

            <section className="settings-management__summary" aria-label="Tổng quan cấu hình">
              <article><span>Vận hành</span><ul><li>Múi giờ: {systemSetting.timezone}</li><li>Tiền tệ: {systemSetting.currency}</li><li>Định dạng ngày: {systemSetting.dateFormat}</li></ul></article>
              <article><span>Tăng ca</span><ul><li>Kiểm soát: {overtimePolicy.enabled ? "Bật" : "Tắt"}</li><li>Phục vụ: {formatMinutes(overtimePolicy.roleGroupLimits.service.maxMinutesPerDay)}/ngày</li><li>Bếp: {formatMinutes(overtimePolicy.roleGroupLimits.kitchen.maxMinutesPerDay)}/ngày</li><li>Quản lý ca: {formatMinutes(overtimePolicy.roleGroupLimits.shiftManager.maxMinutesPerDay)}/ngày</li></ul></article>
              <article><span>Truy cập</span><ul><li>Phân quyền: {systemSetting.modules?.rbac ? "Bật" : "Tắt"}</li><li>Ngôn ngữ mặc định: {systemSetting.operational?.defaultLanguage || "-"}</li></ul><button type="button" onClick={() => navigateManagerPage("rbac")}>Mở phân quyền</button></article>
              <article><span>Nhà hàng</span><ul><li>Hồ sơ, liên hệ và giờ mở cửa</li><li>Cập nhật gần nhất: {updatedAt}</li></ul><button type="button" onClick={() => navigateManagerPage("restaurant-info-management")}>Mở thông tin nhà hàng</button></article>
              <article><span>Hệ thống</span><ul><li>In ấn: {systemSetting.modules?.printing ? "Bật" : "Tắt"}</li><li>Sao lưu: {systemSetting.modules?.backup ? "Bật" : "Tắt"}</li></ul><button type="button" onClick={() => navigateManagerPage("print-management")}>Mở quản lý in ấn</button></article>
            </section>
          </div>

          <aside className="settings-management__side-panel" aria-label="Lối tắt cấu hình">
            <div className="settings-management__section-title"><span>Điều hướng nhanh</span><h3>Lối tắt cấu hình</h3><p>Mở trực tiếp các khu vực có liên quan đến cấu hình nhà hàng.</p></div>
            <div className="settings-management__list">{QUICK_ACTIONS.map(([page, title, description], index) => <article key={page}><span>{String(index + 1).padStart(2, "0")}</span><h4>{title}</h4><p>{description}</p><button type="button" onClick={() => navigateManagerPage(page)}>Mở trang</button></article>)}</div>
          </aside>
        </section>
      ) : null}
    </main>
  );
};

export default SettingsManagement;
