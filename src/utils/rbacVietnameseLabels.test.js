import { afterEach, describe, expect, it } from "vitest";
import {
  applyRbacVietnameseLabels,
  getRbacGroupLabel,
  getRbacPermissionLabel,
  getRbacPermissionMeta,
  getRbacRoleLabel,
} from "./rbacVietnameseLabels";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("rbacVietnameseLabels", () => {
  it("maps every permission group currently seeded by the backend", () => {
    const groups = {
      "admin-security": "Bảo mật quản trị",
      "ai-chatbot": "Trợ lý AI",
      cleaning: "Vệ sinh",
      customer: "Khách hàng",
      dashboard: "Tổng quan",
      delivery: "Giao hàng",
      finance: "Tài chính & đối soát",
      inventory: "Kho hàng",
      kitchen: "Bếp",
      menu: "Thực đơn",
      order: "Đơn hàng",
      payment: "Thanh toán",
      print: "In ấn",
      promotion: "Khuyến mãi",
      report: "Báo cáo",
      reservation: "Đặt bàn",
      restaurant: "Nhà hàng",
      review: "Đánh giá",
      shift: "Ca làm",
      staff: "Nhân sự",
      system: "Quản trị hệ thống",
      table: "Bàn & khu vực",
    };

    for (const [group, label] of Object.entries(groups)) {
      expect(getRbacGroupLabel(group)).toBe(label);
    }
  });

  it("uses final-product Vietnamese permission and role wording", () => {
    expect(getRbacPermissionLabel("ai.chatbot.analytics.read")).toBe("Xem báo cáo trợ lý AI");
    expect(getRbacPermissionLabel("ai.chatbot.handoff")).toBe("Tiếp nhận hội thoại cần hỗ trợ");
    expect(getRbacPermissionLabel("dashboard.read")).toBe("Xem tổng quan vận hành");
    expect(getRbacPermissionLabel("menu.price.update")).toBe("Cập nhật giá món ăn");
    expect(getRbacPermissionLabel("review.report.resolve")).toBe("Xử lý báo cáo vi phạm đánh giá");
    expect(getRbacPermissionMeta("customer.read")).toBe("Mã quyền: customer.read");
    expect(getRbacRoleLabel({ slug: "bartender", name: "Bartender" })).toBe("Nhân viên pha chế");
    expect(getRbacRoleLabel({ slug: "cleaner", name: "Cleaner" })).toBe("Nhân viên vệ sinh");
    expect(getRbacRoleLabel({ slug: "shipper", name: "Shipper" })).toBe("Nhân viên giao hàng");
  });

  it("updates RBAC copy without dropping permission rows or tab icons", () => {
    document.body.innerHTML = `
      <main class="rbac-page">
        <span>An toàn truy cập</span>
        <div class="rbac-premium-metrics">
          <div class="rbac-premium-metric"><strong>17</strong></div>
          <div class="rbac-premium-metric"><strong>14</strong></div>
          <div class="rbac-premium-metric"><strong>Bật</strong></div>
        </div>
        <nav class="rbac-tabs">
          <button><svg data-tab-icon="overview"></svg>Vai trò & quyền</button>
          <button><svg data-tab-icon="assignment"></svg>Gán vai trò</button>
          <button><svg data-tab-icon="roles"></svg>Tạo vai trò</button>
        </nav>
        <span class="rbac-count-pill">2 quyền hạn</span>
        <section class="rbac-permission-group">
          <div class="rbac-permission-group__title"><h4>ai-chatbot</h4></div>
          <div class="rbac-checkbox-row">
            <input type="checkbox" />
            <span><strong>Xem analytics AI chatbot</strong><small>ai.chatbot.analytics.read</small></span>
          </div>
          <div class="rbac-checkbox-row">
            <input type="checkbox" />
            <span><strong>Xử lý handoff AI chatbot</strong><small>ai.chatbot.handoff</small></span>
          </div>
        </section>
        <button class="rbac-role-row">
          <span class="rbac-role-row__top"><strong>Bartender</strong></span>
          <span class="rbac-role-row__meta">Tên rút gọn: bartender</span>
        </button>
        <div class="rbac-selected-role"><h4>Manager</h4><span>Nhóm kế thừa: Manager</span></div>
        <form class="rbac-form--assignment">
          <label>Nhà hàng<select><option>Nhà hàng A</option></select></label>
          <label>Nhân viên<select><option>Demo Bartender (Bartender)</option></select></label>
        </form>
      </main>
    `;

    const before = document.querySelectorAll(".rbac-checkbox-row").length;
    const changes = applyRbacVietnameseLabels(document);

    expect(changes).toBeGreaterThan(0);
    expect(document.querySelectorAll(".rbac-checkbox-row")).toHaveLength(before);
    expect(document.querySelector(".rbac-permission-group__title h4")).toHaveTextContent("Trợ lý AI");
    expect(document.querySelectorAll(".rbac-checkbox-row strong")[0]).toHaveTextContent("Xem báo cáo trợ lý AI");
    expect(document.querySelectorAll(".rbac-checkbox-row strong")[1]).toHaveTextContent("Tiếp nhận hội thoại cần hỗ trợ");
    expect(document.querySelectorAll(".rbac-checkbox-row small")[0]).toHaveTextContent("Mã quyền: ai.chatbot.analytics.read");
    expect(document.querySelector(".rbac-role-row__top strong")).toHaveTextContent("Nhân viên pha chế");
    expect(document.querySelector(".rbac-role-row__meta")).toHaveTextContent("Mã vai trò: bartender");
    expect(document.querySelector(".rbac-selected-role > span")).toHaveTextContent("Kế thừa từ: Quản lý nhà hàng");
    expect(document.querySelector(".rbac-form--assignment label:nth-child(2) option")).toHaveTextContent("Demo Bartender (Nhân viên pha chế)");
    expect(document.querySelector(".rbac-count-pill")).toHaveTextContent("2 quyền");
    expect(document.querySelector(".rbac-premium-metric:nth-child(3) strong")).toHaveTextContent("Đang ghi");
    expect(document.querySelectorAll(".rbac-tabs button")[1]).toHaveTextContent("Cập nhật vai trò");
    expect(document.querySelectorAll(".rbac-tabs button")[2]).toHaveTextContent("Quản lý vai trò");
    expect(document.querySelectorAll(".rbac-tabs svg")).toHaveLength(3);
    expect(document.querySelector(".rbac-page > span")).toHaveTextContent("Kiểm soát truy cập");
  });
});
