import React from "react";
import "./BackupManagement.scss";

const BACKUP_STEPS = [
  "Kiểm tra báo cáo cuối ngày",
  "Đối soát giao dịch",
  "Xuất dữ liệu cần lưu",
  "Lưu bản sao an toàn",
  "Ghi nhận người thực hiện và thời điểm",
];

const BackupManagement = () => {
  const navigateManagerPage = (page) => {
    if (!page) return;
    window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page, source: "backup-management" } }));
    if (window.location.hash !== `#${page}`) window.location.hash = page;
  };

  return (
    <div className="backup-management">
      <header className="backup-management__header">
        <h2>Sao lưu &amp; khôi phục</h2>
        <p>Chưa có API sao lưu tự động. Trang này đóng vai trò trung tâm điều hướng và checklist vận hành.</p>
      </header>

      <section className="backup-management__grid">
        <article className="backup-management__card">
          <h3>Sao lưu dữ liệu</h3>
          <p>Kiểm tra báo cáo, xuất dữ liệu vận hành, lưu snapshot ngoài hệ thống.</p>
          <button type="button" onClick={() => navigateManagerPage("reports")}>Đi tới báo cáo</button>
        </article>

        <article className="backup-management__card">
          <h3>Tài chính &amp; giao dịch</h3>
          <p>Cần đối soát thanh toán, hoàn tiền, giao dịch trước khi chốt backup.</p>
          <button type="button" onClick={() => navigateManagerPage("transactions")}>Đi tới giao dịch</button>
        </article>

        <article className="backup-management__card">
          <h3>Cấu hình hệ thống</h3>
          <p>Kiểm tra quyền, thông tin nhà hàng, in ấn trước khi lưu bản sao.</p>
          <button type="button" onClick={() => navigateManagerPage("settings")}>Đi tới cài đặt hệ thống</button>
        </article>
      </section>

      <section className="backup-management__timeline">
        <h3>Checklist khuyến nghị</h3>
        <ol>{BACKUP_STEPS.map((item) => <li key={item}>{item}</li>)}</ol>
      </section>
    </div>
  );
};

export default BackupManagement;
