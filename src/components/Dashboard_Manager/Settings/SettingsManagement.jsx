import React from "react";
import "./SettingsManagement.scss";

const SETTINGS_STATUS = ["Phân quyền nhân viên", "Thông tin nhà hàng", "Máy in", "Sao lưu dữ liệu"];

const SettingsManagement = () => {
  const navigateManagerPage = (page) => {
    if (!page) return;
    window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page, source: "settings-management" } }));
    if (window.location.hash !== `#${page}`) window.location.hash = page;
  };

  return (
    <div className="settings-management">
      <header className="settings-management__header">
        <h2>Cài đặt hệ thống</h2>
        <p>Trung tâm cấu hình vận hành nhà hàng.</p>
      </header>

      <section className="settings-management__grid">
        <article className="settings-management__card">
          <h3>Thông tin vận hành</h3>
          <ul>
            <li><strong>Múi giờ:</strong> Asia/Ho_Chi_Minh</li>
            <li><strong>Tiền tệ:</strong> VND</li>
            <li><strong>Định dạng ngày:</strong> DD/MM/YYYY</li>
          </ul>
          <p className="settings-management__note">Đây là thông tin cấu hình hiện hành, không phải form lưu nếu chưa có API.</p>
        </article>

        <article className="settings-management__card">
          <h3>Lịch làm việc &amp; ca làm</h3>
          <p>Cấu hình ca, phân công, quy tắc lịch nằm ở trang lịch làm việc.</p>
          <button type="button" onClick={() => navigateManagerPage("schedules")}>Đi tới lịch làm việc</button>
        </article>

        <article className="settings-management__card">
          <h3>Quyền và bảo mật</h3>
          <p>Quản lý vai trò, quyền hạn, quyền truy cập nhân viên.</p>
          <button type="button" onClick={() => navigateManagerPage("rbac")}>Đi tới phân quyền</button>
        </article>

        <article className="settings-management__card">
          <h3>In ấn</h3>
          <p>Cấu hình máy in, mẫu in, phiếu bếp/hóa đơn.</p>
          <button type="button" onClick={() => navigateManagerPage("print-management")}>Đi tới quản lý in ấn</button>
        </article>

        <article className="settings-management__card">
          <h3>Thông tin nhà hàng</h3>
          <p>Hồ sơ nhà hàng, địa chỉ, liên hệ, giờ mở cửa.</p>
          <button type="button" onClick={() => navigateManagerPage("restaurant-info-management")}>Đi tới thông tin nhà hàng</button>
        </article>
      </section>

      <section className="settings-management__status">
        <h3>Trạng thái cấu hình</h3>
        <ul>{SETTINGS_STATUS.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
    </div>
  );
};

export default SettingsManagement;
