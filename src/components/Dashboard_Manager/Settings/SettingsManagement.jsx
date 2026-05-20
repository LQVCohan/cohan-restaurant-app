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
  metadata: { version: "N/A", note: "Đang hiển thị cấu hình tham chiếu mặc định." },
  updatedAt: null,
};

const baseGroups = (setting) => [
  {
    icon: "⚙️",
    title: "Thông tin vận hành",
    description: "Timezone, currency, date format đang dùng cho toàn hệ thống.",
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
    icon: "📅", title: "Lịch làm việc & ca làm", description: "Quản lý ca làm, quy tắc phân công và lịch vận hành.", status: setting.modules?.scheduling ? "Đang bật" : "Đang tắt", action: { label: "Mở lịch làm việc", page: "schedules" },
  },
  { icon: "🔐", title: "Quyền và bảo mật", description: "Thiết lập RBAC, role và phạm vi truy cập cho từng nhóm người dùng.", status: setting.modules?.rbac ? "Đang bật" : "Đang tắt", action: { label: "Mở phân quyền", page: "rbac" } },
  { icon: "🖨️", title: "In ấn", description: "Cấu hình máy in, mẫu in và quy trình retry cho phiếu bếp/hóa đơn.", status: setting.modules?.printing ? "Đang bật" : "Đang tắt", action: { label: "Mở quản lý in ấn", page: "print-management" } },
  { icon: "🏪", title: "Thông tin nhà hàng", description: "Cập nhật hồ sơ nhà hàng, địa chỉ, hotline và giờ mở cửa.", status: "Mở trang liên quan", action: { label: "Mở thông tin nhà hàng", page: "restaurant-info-management" } },
  { icon: "💾", title: "Sao lưu dữ liệu", description: "Chuẩn bị quy trình đối soát và sao lưu vận hành trước khi chốt ngày.", status: setting.modules?.backup ? "Đang bật" : "Đang tắt", action: { label: "Mở sao lưu", page: "backup" } },
];

const CHECKLIST_ITEMS = [
  { title: "Phân quyền nhân viên", description: "Kiểm tra role, quyền truy cập và tài khoản quản trị." },
  { title: "Thông tin nhà hàng", description: "Kiểm tra hồ sơ, địa chỉ, hotline, giờ mở cửa." },
  { title: "Máy in", description: "Kiểm tra máy in bếp, mẫu hóa đơn và retry print job." },
  { title: "Lịch làm việc", description: "Kiểm tra ca làm, quy tắc phân công, quyền chỉnh sửa lịch." },
  { title: "Sao lưu dữ liệu", description: "Kiểm tra báo cáo và quy trình export/snapshot." },
  { title: "Tài chính", description: "Kiểm tra đối soát, hoàn tiền, giao dịch." },
];

const SettingsManagement = () => {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const [restaurantId, setRestaurantId] = useState("");

  useEffect(() => {
    if (!restaurantId && restaurants.length > 0) setRestaurantId(String(restaurants[0]?.id || restaurants[0]?.restaurantId || ""));
  }, [restaurantId, restaurants]);

  const { data, loading, error } = useQuery(Q_SYSTEM_SETTING, { variables: { restaurantId }, skip: !restaurantId, fetchPolicy: "network-only" });

  const systemSetting = data?.systemSetting || FALLBACK_SYSTEM_SETTING;
  const summaryCards = useMemo(() => ([
    { title: "Vận hành", lines: [`Múi giờ: ${systemSetting.timezone}`, `Tiền tệ: ${systemSetting.currency}`, `Định dạng ngày: ${systemSetting.dateFormat}`] },
    { title: "Bảo mật", lines: [`RBAC: ${systemSetting.modules?.rbac ? "Bật" : "Tắt"}`, `Ngôn ngữ mặc định: ${systemSetting.operational?.defaultLanguage ?? "-"}`], action: { label: "Mở phân quyền", page: "rbac" } },
    { title: "Nhà hàng", lines: ["Hồ sơ, liên hệ, giờ mở cửa", `Cập nhật gần nhất: ${systemSetting.updatedAt ? new Date(systemSetting.updatedAt).toLocaleString("vi-VN") : "Chưa có"}`], action: { label: "Mở thông tin nhà hàng", page: "restaurant-info-management" } },
    { title: "Thiết bị", lines: [`In ấn: ${systemSetting.modules?.printing ? "Bật" : "Tắt"}`, `Backup module: ${systemSetting.modules?.backup ? "Bật" : "Tắt"}`], action: { label: "Mở quản lý in ấn", page: "print-management" } },
  ]), [systemSetting]);

  const settingsGroups = useMemo(() => baseGroups(systemSetting), [systemSetting]);
  const warning = !restaurantId
    ? "Chưa xác định nhà hàng để đọc cấu hình"
    : error
      ? "Không đọc được cấu hình hệ thống, đang hiển thị giá trị mặc định."
      : "";

  const navigateManagerPage = (page) => { if (!page) return; window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page, source: "settings-management" } })); if (window.location.hash !== `#${page}`) window.location.hash = page; };

  return (<div className="settings-management"><ManagementPageHeader
    eyebrow="SYSTEM SETTINGS"
    title="Cài đặt hệ thống"
    subtitle="Quản lý cấu hình vận hành, bảo mật, phân quyền và các thiết lập liên quan đến nhà hàng."
    icon="⚙️"
    stats={[
      {
        label: "Nhà hàng",
        value: restaurants.length,
        icon: "🏬",
      },
      {
        label: "Trạng thái",
        value: loading ? "Đang tải" : "Sẵn sàng",
        icon: "📡",
      },
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
    {warning ? <section className="settings-management__alert" role="note">{warning}</section> : null}
    <section className="settings-management__summary" aria-label="Tổng quan cấu hình">{loading ? <p className="settings-management__note">Đang tải cấu hình hệ thống...</p> : null}{summaryCards.map((item) => (<article key={item.title} className="settings-management__card"><h3>{item.title}</h3><ul>{item.lines.map((line) => (<li key={line}>{line}</li>))}</ul>{item.action ? (<button type="button" onClick={() => navigateManagerPage(item.action.page)}>{item.action.label}</button>) : null}</article>))}</section>
    <section className="settings-management__grid" aria-label="Nhóm thiết lập">{settingsGroups.map((group) => (<article key={group.title} className="settings-management__card"><p className="settings-management__icon" aria-hidden="true">{group.icon}</p><h3>{group.title}</h3><p>{group.description}</p><p className="settings-management__status-chip">{group.status}</p>{group.reference ? (<ul>{group.reference.map((line) => (<li key={line}>{line}</li>))}</ul>) : null}{group.note ? <p className="settings-management__note">{group.note}</p> : null}{group.action ? (<button type="button" onClick={() => navigateManagerPage(group.action.page)}>{group.action.label}</button>) : null}</article>))}</section>
    <section className="settings-management__checklist" aria-label="Checklist cấu hình khuyến nghị"><div className="settings-management__section-title"><h3>Checklist cấu hình khuyến nghị</h3><p>Danh sách local checklist để rà soát vận hành, không lưu lên server.</p></div><div className="settings-management__list">{CHECKLIST_ITEMS.map((item) => (<article key={item.title}><h4>{item.title}</h4><p>{item.description}</p></article>))}</div></section></div>);
};

export default SettingsManagement;
