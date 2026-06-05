import React, { useContext, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { AuthContext } from "../../../context/AuthContext";
import "./SettingsManagement.scss";
import ManagementPageHeader from "../shared/ManagementPageHeader";

const Q_SYSTEM_SETTING = gql`
  query SystemSetting($restaurantId: ID!) {
    systemSetting(restaurantId: $restaurantId) {
      timezone
      currency
      dateFormat
      operational {
        businessDayStartHour
        defaultLanguage
      }
      modules {
        scheduling
        rbac
        printing
        backup
      }
      metadata {
        version
        note
      }
      updatedAt
    }
  }
`;

const FALLBACK_SYSTEM_SETTING = {
  timezone: "Asia/Ho_Chi_Minh",
  currency: "VND",
  dateFormat: "DD/MM/YYYY",
  operational: { businessDayStartHour: 6, defaultLanguage: "vi" },
  modules: { scheduling: true, rbac: true, printing: true, backup: false },
  metadata: {
    version: "N/A",
    note: "Đang hiển thị cấu hình tham chiếu mặc định.",
  },
  updatedAt: null,
};

const CHECKLIST_ITEMS = [
  {
    title: "Phân quyền nhân viên",
    description: "Kiểm tra role, quyền truy cập và tài khoản quản trị.",
  },
  {
    title: "Thông tin nhà hàng",
    description: "Kiểm tra hồ sơ, địa chỉ, hotline, giờ mở cửa.",
  },
  {
    title: "Máy in",
    description: "Kiểm tra máy in bếp, mẫu hóa đơn và retry print job.",
  },
  {
    title: "Lịch làm việc",
    description: "Kiểm tra ca làm, quy tắc phân công, quyền chỉnh sửa lịch.",
  },
  {
    title: "Sao lưu dữ liệu",
    description: "Kiểm tra báo cáo và quy trình export/snapshot.",
  },
  {
    title: "Tài chính",
    description: "Kiểm tra đối soát, hoàn tiền, giao dịch.",
  },
];

const buildSettingGroups = (setting) => [
  {
    icon: "OPS",
    title: "Thông tin vận hành",
    description: "Múi giờ, tiền tệ và định dạng ngày đang dùng cho toàn hệ thống.",
    status: "Đang cấu hình",
    reference: [
      `Múi giờ: ${setting.timezone}`,
      `Tiền tệ: ${setting.currency}`,
      `Định dạng ngày: ${setting.dateFormat}`,
      `Giờ bắt đầu ngày vận hành: ${setting.operational?.businessDayStartHour ?? "-"}:00`,
      `Ngôn ngữ mặc định: ${setting.operational?.defaultLanguage ?? "-"}`,
    ],
    note: `Version: ${setting.metadata?.version || "N/A"} • ${setting.metadata?.note || "Không có ghi chú"}`,
  },
  {
    icon: "CAL",
    title: "Lịch làm việc & ca làm",
    description: "Quản lý ca làm, quy tắc phân công và lịch vận hành.",
    status: setting.modules?.scheduling ? "Đang bật" : "Đang tắt",
    action: { label: "Mở lịch làm việc", page: "schedules" },
  },
  {
    icon: "RBAC",
    title: "Phân quyền",
    description: "Thiết lập RBAC, role và phạm vi truy cập cho từng nhóm người dùng.",
    status: setting.modules?.rbac ? "Đang bật" : "Đang tắt",
    action: { label: "Mở phân quyền", page: "rbac" },
  },
  {
    icon: "PRINT",
    title: "In ấn",
    description: "Cấu hình máy in, mẫu in và quy trình retry cho phiếu bếp/hóa đơn.",
    status: setting.modules?.printing ? "Đang bật" : "Đang tắt",
    action: { label: "Mở quản lý in ấn", page: "print-management" },
  },
  {
    icon: "STORE",
    title: "Thông tin nhà hàng",
    description: "Cập nhật hồ sơ nhà hàng, địa chỉ, hotline và giờ mở cửa.",
    status: "Mở trang liên quan",
    action: { label: "Mở thông tin nhà hàng", page: "restaurant-info-management" },
  },
  {
    icon: "BACKUP",
    title: "Sao lưu",
    description: "Chuẩn bị quy trình đối soát và sao lưu vận hành trước khi chốt ngày.",
    status: setting.modules?.backup ? "Đang bật" : "Đang tắt",
    action: { label: "Mở sao lưu", page: "backup" },
  },
];

const buildSummaryCards = (setting) => [
  {
    title: "Vận hành",
    lines: [
      `Múi giờ: ${setting.timezone}`,
      `Tiền tệ: ${setting.currency}`,
      `Định dạng ngày: ${setting.dateFormat}`,
    ],
  },
  {
    title: "Bảo mật",
    lines: [
      `RBAC: ${setting.modules?.rbac ? "Bật" : "Tắt"}`,
      `Ngôn ngữ mặc định: ${setting.operational?.defaultLanguage ?? "-"}`,
    ],
    action: { label: "Mở phân quyền", page: "rbac" },
  },
  {
    title: "Nhà hàng",
    lines: [
      "Hồ sơ, liên hệ, giờ mở cửa",
      `Cập nhật gần nhất: ${
        setting.updatedAt ? new Date(setting.updatedAt).toLocaleString("vi-VN") : "Chưa có"
      }`,
    ],
    action: { label: "Mở thông tin nhà hàng", page: "restaurant-info-management" },
  },
  {
    title: "Thiết bị",
    lines: [
      `In ấn: ${setting.modules?.printing ? "Bật" : "Tắt"}`,
      `Backup module: ${setting.modules?.backup ? "Bật" : "Tắt"}`,
    ],
    action: { label: "Mở quản lý in ấn", page: "print-management" },
  },
];

const getRestaurantId = (restaurant) => String(restaurant?.id || restaurant?.restaurantId || "");

const SettingsSkeleton = () => (
  <section className="settings-management__skeleton-grid" aria-label="Đang tải cấu hình">
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className="settings-management__skeleton-card" />
    ))}
  </section>
);

const SettingsEmptyState = () => (
  <section className="settings-management__empty" role="status">
    <span className="settings-management__empty-kicker">Cần ngữ cảnh nhà hàng</span>
    <h2>Chưa có restaurantId để đọc cấu hình</h2>
    <p>
      Hãy chọn hoặc gán nhà hàng cho tài khoản quản lý. Sau đó trang sẽ tải lại cấu hình
      vận hành, phân quyền, in ấn và sao lưu.
    </p>
  </section>
);

const SettingsManagement = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");

  useEffect(() => {
    if (!restaurantId && restaurants.length > 0) setRestaurantId(getRestaurantId(restaurants[0]));
  }, [restaurantId, restaurants]);

  const { data, loading, error, refetch } = useQuery(Q_SYSTEM_SETTING, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  const systemSetting = data?.systemSetting || FALLBACK_SYSTEM_SETTING;
  const summaryCards = useMemo(() => buildSummaryCards(systemSetting), [systemSetting]);
  const settingsGroups = useMemo(() => buildSettingGroups(systemSetting), [systemSetting]);
  const enabledModules = [
    systemSetting.modules?.scheduling,
    systemSetting.modules?.rbac,
    systemSetting.modules?.printing,
    systemSetting.modules?.backup,
  ].filter(Boolean).length;
  const updatedAt = systemSetting.updatedAt
    ? new Date(systemSetting.updatedAt).toLocaleString("vi-VN")
    : "Chưa có dữ liệu";

  const navigateManagerPage = (page) => {
    if (!page) return;
    window.dispatchEvent(
      new CustomEvent("manager:navigate", { detail: { page, source: "settings-management" } }),
    );
    if (window.location.hash !== `#${page}`) window.location.hash = page;
  };

  return (
    <main className="settings-management">
      <ManagementPageHeader
        eyebrow="SYSTEM CONTROL CENTER"
        title="Cài đặt hệ thống"
        subtitle="Trung tâm kiểm soát cấu hình vận hành, phân quyền và module nền tảng của nhà hàng."
        icon="⚙️"
        stats={[
          { label: "Nhà hàng", value: restaurants.length, icon: "🏬" },
          { label: "Module bật", value: `${enabledModules}/4`, icon: "📡" },
        ]}
        customControls={(
          <div className="settings-management__badges" aria-label="Trạng thái trang">
            <span>Backend foundation</span>
            <span>Đọc cấu hình</span>
            <span>Chỉnh sửa ở PR sau</span>
          </div>
        )}
        showTimeWidget={false}
      />

      <section className="settings-management__hero" aria-label="Tổng quan control center">
        <div>
          <span className="settings-management__eyebrow">System control center</span>
          <h2>Điểm vào mặc định cho quản lý vận hành</h2>
          <p>
            Đọc cấu hình từ backend, hiển thị fallback an toàn khi API chưa sẵn sàng và
            điều hướng nhanh tới các module nghiệp vụ.
          </p>
        </div>
        <div className="settings-management__hero-metrics">
          <article>
            <strong>{restaurants.length}</strong>
            <span>Nhà hàng</span>
          </article>
          <article>
            <strong>{loading ? "Sync" : error ? "Fallback" : "Ready"}</strong>
            <span>Trạng thái backend</span>
          </article>
          <article>
            <strong>{updatedAt}</strong>
            <span>Cập nhật gần nhất</span>
          </article>
        </div>
      </section>

      {!restaurantId ? <SettingsEmptyState /> : null}
      {error ? (
        <section className="settings-management__alert" role="alert">
          <div>
            <strong>Không đọc được cấu hình hệ thống.</strong>
            <p>Trang đang dùng giá trị fallback để không chặn thao tác điều hướng.</p>
          </div>
          <button type="button" onClick={() => refetch?.()}>
            Thử lại
          </button>
        </section>
      ) : null}
      {loading ? <SettingsSkeleton /> : null}

      {restaurantId && !loading ? (
        <section className="settings-management__workspace" aria-label="Không gian cấu hình">
          <div className="settings-management__primary-column">
            <section className="settings-management__summary" aria-label="Tổng quan cấu hình">
              {summaryCards.map((item) => (
                <article key={item.title} className="settings-management__insight">
                  <span>{item.title}</span>
                  <ul>
                    {item.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {item.action ? (
                    <button type="button" onClick={() => navigateManagerPage(item.action.page)}>
                      {item.action.label}
                    </button>
                  ) : null}
                </article>
              ))}
            </section>

            <section className="settings-management__grid" aria-label="Nhóm thiết lập">
              {settingsGroups.map((group) => (
                <article key={group.title} className="settings-management__card">
                  <div className="settings-management__card-top">
                    <p className="settings-management__icon" aria-hidden="true">
                      {group.icon}
                    </p>
                    <p
                      className={`settings-management__status-chip ${
                        group.status.includes("tắt") ? "is-off" : "is-on"
                      }`}
                    >
                      {group.status}
                    </p>
                  </div>
                  <h3>{group.title}</h3>
                  <p>{group.description}</p>
                  {group.reference ? (
                    <ul>
                      {group.reference.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                  {group.note ? <p className="settings-management__note">{group.note}</p> : null}
                  {group.action ? (
                    <button type="button" onClick={() => navigateManagerPage(group.action.page)}>
                      {group.action.label}
                    </button>
                  ) : null}
                </article>
              ))}
            </section>
          </div>

          <aside className="settings-management__side-panel" aria-label="Quick actions và checklist">
            <div className="settings-management__section-title">
              <h3>Quick actions</h3>
              <p>Rà soát nhanh trước giờ vận hành cao điểm.</p>
            </div>
            <div className="settings-management__list">
              {CHECKLIST_ITEMS.map((item, index) => (
                <article key={item.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </aside>
        </section>
      ) : null}
    </main>
  );
};

export default SettingsManagement;
