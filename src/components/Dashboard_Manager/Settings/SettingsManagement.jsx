import React from "react";
import "./SettingsManagement.scss";

const SUMMARY_CARDS = [
  {
    title: "Vận hành",
    lines: ["Múi giờ: Asia/Ho_Chi_Minh", "Tiền tệ: VND", "Định dạng ngày: DD/MM/YYYY"],
  },
  {
    title: "Bảo mật",
    lines: ["Quản lý qua RBAC", "Vai trò và quyền truy cập nội bộ"],
    action: { label: "Đi tới #rbac", page: "rbac" },
  },
  {
    title: "Nhà hàng",
    lines: ["Hồ sơ, liên hệ, giờ mở cửa", "Cấu hình thông tin hiển thị"],
    action: { label: "Đi tới #restaurant-info-management", page: "restaurant-info-management" },
  },
  {
    title: "Thiết bị",
    lines: ["Máy in, mẫu in", "Phiếu bếp/hóa đơn"],
    action: { label: "Đi tới #print-management", page: "print-management" },
  },
];

const SETTINGS_GROUPS = [
  {
    icon: "⚙️",
    title: "Thông tin vận hành",
    description: "Timezone, currency, date format đang dùng cho toàn hệ thống.",
    status: "Đang cấu hình",
    reference: ["Múi giờ: Asia/Ho_Chi_Minh", "Tiền tệ: VND", "Định dạng ngày: DD/MM/YYYY"],
    note: "Các giá trị này đang hiển thị dạng cấu hình tham chiếu. Cần API cấu hình hệ thống để chỉnh sửa trực tiếp.",
  },
  {
    icon: "📅",
    title: "Lịch làm việc & ca làm",
    description: "Quản lý ca làm, quy tắc phân công và lịch vận hành.",
    status: "Điều hướng",
    action: { label: "Mở lịch làm việc", page: "schedules" },
  },
  {
    icon: "🔐",
    title: "Quyền và bảo mật",
    description: "Thiết lập RBAC, role và phạm vi truy cập cho từng nhóm người dùng.",
    status: "Cần kiểm tra",
    action: { label: "Mở phân quyền", page: "rbac" },
  },
  {
    icon: "🖨️",
    title: "In ấn",
    description: "Cấu hình máy in, mẫu in và quy trình retry cho phiếu bếp/hóa đơn.",
    status: "Cần kiểm tra",
    action: { label: "Mở quản lý in ấn", page: "print-management" },
  },
  {
    icon: "🏪",
    title: "Thông tin nhà hàng",
    description: "Cập nhật hồ sơ nhà hàng, địa chỉ, hotline và giờ mở cửa.",
    status: "Điều hướng",
    action: { label: "Mở thông tin nhà hàng", page: "restaurant-info-management" },
  },
  {
    icon: "💾",
    title: "Sao lưu dữ liệu",
    description: "Chuẩn bị quy trình đối soát và sao lưu vận hành trước khi chốt ngày.",
    status: "Điều hướng",
    action: { label: "Mở sao lưu", page: "backup" },
  },
];

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

const SettingsManagement = () => {
  const navigateManagerPage = (page) => {
    if (!page) return;
    window.dispatchEvent(
      new CustomEvent("manager:navigate", {
        detail: { page, source: "settings-management" },
      }),
    );
    if (window.location.hash !== `#${page}`) {
      window.location.hash = page;
    }
  };

  return (
    <div className="settings-management">
      <header className="settings-management__hero">
        <div>
          <h2>Cài đặt hệ thống</h2>
          <p>Quản lý cấu hình vận hành, bảo mật, phân quyền và các thiết lập liên quan đến nhà hàng.</p>
        </div>
        <div className="settings-management__badges" aria-label="Trạng thái trang">
          <span>Frontend-only</span>
          <span>Không gọi API</span>
          <span>Cần backend để lưu cấu hình</span>
        </div>
      </header>

      <section className="settings-management__summary" aria-label="Tổng quan cấu hình">
        {SUMMARY_CARDS.map((item) => (
          <article key={item.title} className="settings-management__card">
            <h3>{item.title}</h3>
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
        {SETTINGS_GROUPS.map((group) => (
          <article key={group.title} className="settings-management__card">
            <p className="settings-management__icon" aria-hidden="true">{group.icon}</p>
            <h3>{group.title}</h3>
            <p>{group.description}</p>
            <p className="settings-management__status-chip">{group.status}</p>
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

      <section className="settings-management__checklist" aria-label="Checklist cấu hình khuyến nghị">
        <div className="settings-management__section-title">
          <h3>Checklist cấu hình khuyến nghị</h3>
          <p>Danh sách local checklist để rà soát vận hành, không lưu lên server.</p>
        </div>
        <div className="settings-management__list">
          {CHECKLIST_ITEMS.map((item) => (
            <article key={item.title}>
              <h4>{item.title}</h4>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="settings-management__roadmap" aria-label="Backend cần bổ sung sau này">
        <h3>Backend cần bổ sung sau này</h3>
        <ul>
          <li>GET /system-settings</li>
          <li>PATCH /system-settings</li>
          <li>Audit log cho thay đổi cấu hình</li>
          <li>Phân quyền riêng cho từng nhóm settings</li>
          <li>Versioning/cấu hình theo nhà hàng</li>
        </ul>
      </section>
    </div>
  );
};

export default SettingsManagement;
