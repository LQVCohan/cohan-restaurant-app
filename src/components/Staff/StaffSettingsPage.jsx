import React from "react";
import "./StaffSettingsPage.scss";

const StaffSettingsPage = () => (
  <div className="staff-settings staff-page" aria-labelledby="staff-settings-title">
    <header className="staff-settings__header">
      <h1 id="staff-settings-title">Cài đặt</h1>
      <p>Quản lý các tùy chọn hiển thị và thông tin ứng dụng dành cho nhân viên.</p>
    </header>

    <section className="staff-settings__grid" aria-label="Tùy chọn cài đặt">
      <article className="staff-settings__card">
        <span>Tùy chọn hiển thị</span>
        <h2>Giao diện làm việc</h2>
        <p>Giao diện nhân viên đang dùng chế độ sáng, ưu tiên thao tác nhanh và dễ nhìn trong ca làm.</p>
      </article>
      <article className="staff-settings__card">
        <span>Ứng dụng</span>
        <h2>Thông tin thiết bị</h2>
        <p>Các tùy chọn nâng cao sẽ được bổ sung sau. Nếu cần thay đổi quyền truy cập, vui lòng liên hệ quản lý.</p>
      </article>
    </section>
  </div>
);

export default StaffSettingsPage;
