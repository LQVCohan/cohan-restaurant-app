import React from "react";
import "./BackupManagement.scss";

const SUMMARY_ITEMS = [
  {
    title: "Báo cáo",
    description: "Cần kiểm tra báo cáo cuối ngày.",
    action: { label: "Mở báo cáo", page: "reports" },
  },
  {
    title: "Giao dịch",
    description: "Cần đối soát thanh toán/hoàn tiền.",
    action: { label: "Mở giao dịch", page: "transactions" },
  },
  {
    title: "Cấu hình",
    description: "Cần kiểm tra settings/RBAC/nhà hàng/in ấn.",
    action: { label: "Mở cài đặt", page: "settings" },
  },
  {
    title: "Xuất dữ liệu",
    description: "Hiện chưa có API tự động.",
    note: "Không có nút download giả.",
  },
];

const TIMELINE_STEPS = [
  {
    title: "Kiểm tra báo cáo cuối ngày",
    description: "Mở báo cáo, kiểm tra doanh thu, đơn hàng, dữ liệu vận hành.",
    action: { label: "Mở báo cáo", page: "reports" },
  },
  {
    title: "Đối soát giao dịch",
    description: "Kiểm tra thanh toán, hoàn tiền, giao dịch lỗi/chờ xử lý.",
    action: { label: "Mở giao dịch", page: "transactions" },
  },
  {
    title: "Kiểm tra cấu hình hệ thống",
    description: "Kiểm tra settings, RBAC, thông tin nhà hàng, in ấn.",
    action: { label: "Mở cài đặt", page: "settings" },
  },
  {
    title: "Xuất dữ liệu cần lưu",
    description: "Hiện chưa có API backup tự động. Cần chuẩn bị quy trình export/snapshot khi backend hỗ trợ.",
  },
  {
    title: "Lưu bản sao an toàn",
    description: "Gợi ý lưu ở nơi an toàn/offline/cloud nội bộ theo quy định vận hành.",
  },
  {
    title: "Ghi nhận người thực hiện và thời điểm",
    description: "Gợi ý ghi log thủ công cho đến khi có audit log backend.",
  },
];

const DATA_CARDS = [
  ["Đơn hàng & thanh toán", "Bao gồm đơn bán, trạng thái thanh toán, hoàn tiền và dữ liệu liên quan."],
  ["Bàn & sơ đồ tầng", "Lưu cấu hình bàn, khu vực và sơ đồ phục vụ."],
  ["Menu & giá bán", "Đảm bảo thực đơn, giá và danh mục sản phẩm được sao lưu."],
  ["Kho & nguyên liệu", "Bao gồm tồn kho, nhập-xuất và định mức nguyên liệu."],
  ["Nhân viên & phân quyền", "Lưu role, quyền truy cập và trạng thái tài khoản nội bộ."],
  ["Lịch làm việc", "Sao lưu lịch ca, phân công và thay đổi đang chờ duyệt."],
  ["Khách hàng & khuyến mãi", "Gồm dữ liệu khách hàng, nhóm khách và lịch sử khuyến mãi."],
  ["Báo cáo & đối soát", "Lưu báo cáo cuối ngày và thông tin đối soát định kỳ."],
];

const RISKS = [
  "Chưa đối soát giao dịch",
  "Báo cáo cuối ngày chưa kiểm tra",
  "Thay đổi phân quyền chưa xác nhận",
  "Dữ liệu lịch/ca đang có draft hoặc pending changes",
  "Máy in hoặc báo cáo có lỗi chưa xử lý",
];

const BackupManagement = () => {
  const navigateManagerPage = (page) => {
    if (!page) return;
    window.dispatchEvent(
      new CustomEvent("manager:navigate", {
        detail: { page, source: "backup-management" },
      }),
    );
    if (window.location.hash !== `#${page}`) {
      window.location.hash = page;
    }
  };

  return (
    <div className="backup-management">
      <header className="backup-management__hero">
        <div>
          <h2>Sao lưu &amp; khôi phục</h2>
          <p>Theo dõi quy trình chuẩn bị sao lưu, đối soát dữ liệu và điều hướng tới các khu vực cần kiểm tra.</p>
        </div>
        <div className="backup-management__badges" aria-label="Trạng thái trang">
          <span>Frontend-only</span>
          <span>Checklist vận hành</span>
          <span>Không restore tự động</span>
        </div>
      </header>

      <section className="backup-management__alert" role="note">
        Chưa có API sao lưu tự động. Trang này không tạo file backup, không khôi phục dữ liệu và không thay đổi dữ liệu hệ thống.
      </section>

      <section className="backup-management__summary" aria-label="Tổng quan trước sao lưu">
        {SUMMARY_ITEMS.map((item) => (
          <article key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            {item.action ? (
              <button type="button" onClick={() => navigateManagerPage(item.action.page)}>{item.action.label}</button>
            ) : null}
            {item.note ? <p className="backup-management__note">{item.note}</p> : null}
          </article>
        ))}
      </section>

      <section className="backup-management__timeline" aria-label="Quy trình sao lưu khuyến nghị">
        <h3>Quy trình sao lưu khuyến nghị</h3>
        <ol>
          {TIMELINE_STEPS.map((step) => (
            <li key={step.title}>
              <div>
                <h4>{step.title}</h4>
                <p>{step.description}</p>
                {step.action ? (
                  <button type="button" onClick={() => navigateManagerPage(step.action.page)}>{step.action.label}</button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="backup-management__data-grid" aria-label="Dữ liệu nên đưa vào backup">
        <h3>Dữ liệu nên đưa vào backup</h3>
        <div>
          {DATA_CARDS.map(([title, desc]) => (
            <article key={title}>
              <h4>{title}</h4>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="backup-management__risk-grid" aria-label="Rủi ro trước khi backup">
        <h3>Rủi ro trước khi backup</h3>
        <div>
          {RISKS.map((risk) => (
            <article key={risk}>
              <h4>{risk}</h4>
            </article>
          ))}
        </div>
      </section>

      <section className="backup-management__roadmap" aria-label="Backend cần bổ sung sau này">
        <h3>Backend cần bổ sung sau này</h3>
        <ul>
          <li>POST /backups</li>
          <li>GET /backups</li>
          <li>GET /backups/:id/download</li>
          <li>POST /backups/:id/restore</li>
          <li>Audit log cho backup/restore</li>
          <li>Permission riêng: backup.read, backup.write, backup.restore</li>
          <li>Trạng thái backup: pending, running, completed, failed</li>
        </ul>
      </section>
    </div>
  );
};

export default BackupManagement;
