import { expect, test } from "@playwright/test";
import { installSmokeApiMocks, expectNoPageCrash } from "./graphqlMocks.js";

const collectPageErrors = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error));
  return errors;
};

const fieldByLabel = (scope, labelText) =>
  scope.locator("label.ai-admin-field").filter({ hasText: labelText }).first();

test.describe("manager AI pages: feature smoke", () => {
  test("settings page lets manager edit, preview, validate and save chatbot settings", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await installSmokeApiMocks(page, { authRole: "manager" });

    await page.goto("/manager#ai-chatbot-settings");
    await expectNoPageCrash(page);
    await expect(page.getByRole("heading", { name: "Cài đặt Chatbot AI" })).toBeVisible();
    await expect(page.getByText("Cohan Smoke Bistro")).toBeVisible();

    const welcomeField = fieldByLabel(page, "Lời chào").locator("textarea");
    await welcomeField.fill("Xin chào từ Playwright. Mình có thể hỗ trợ bạn xem thực đơn, đặt bàn và kiểm tra ưu đãi.");
    await expect(page.getByText("Xin chào từ Playwright")).toBeVisible();

    const quickRepliesField = fieldByLabel(page, "Gợi ý nhanh").locator("textarea");
    await quickRepliesField.fill([
      "Xem món bán chạy",
      "Hỏi giờ mở cửa",
      "Đặt bàn cho tối nay",
      "Gặp nhân viên",
    ].join("\n"));
    await expect(page.getByText("Hỏi giờ mở cửa")).toBeVisible();

    await page.locator("summary", { hasText: "Quy trình chuyển nhân viên" }).click();
    await fieldByLabel(page, "Ngưỡng chuyển nhân viên").locator("input").fill("0.55");
    await expect(page.getByText("Ngưỡng 55%")).toBeVisible();

    await page.getByRole("button", { name: "Lưu cài đặt" }).click();
    await expect(page.getByText("Đã lưu cài đặt Chatbot AI.")).toBeVisible();

    await quickRepliesField.fill([
      "Một", "Hai", "Ba", "Bốn", "Năm", "Sáu", "Bảy", "Tám", "Chín",
    ].join("\n"));
    await page.getByRole("button", { name: "Lưu cài đặt" }).click();
    await expect(page.getByRole("alert")).toContainText("Tối đa 8 gợi ý nhanh.");

    expect(pageErrors).toEqual([]);
  });

  test("analytics page shows KPI, filter controls, review modal and knowledge navigation target", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await installSmokeApiMocks(page, { authRole: "manager" });

    await page.goto("/manager#ai-chatbot-analytics");
    await expectNoPageCrash(page);
    await expect(page.getByRole("heading", { name: "Báo cáo Chatbot AI" })).toBeVisible();
    await expect(page.getByText("Cuộc trò chuyện")).toBeVisible();
    await expect(page.getByText("42")).toBeVisible();
    await expect(page.getByText("Khách hỏi về gì?")).toBeVisible();
    await expect(page.getByText("Thực đơn")).toBeVisible();
    await expect(page.getByText("Ai đang nhắn?")).toBeVisible();
    await expect(page.getByText("Chatbot")).toBeVisible();

    await fieldByLabel(page, "Thời gian").locator("select").selectOption("30");
    await expect(fieldByLabel(page, "Thời gian").locator("select")).toHaveValue("30");

    await page.getByRole("button", { name: "Xem tất cả" }).click();
    const reviewDialog = page.getByRole("dialog", { name: "Việc cần rà soát" });
    await expect(reviewDialog).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/ai-admin-modal-open/);
    await expect(reviewDialog.getByText("Cần bổ sung câu trả lời")).toBeVisible();

    await reviewDialog.getByRole("button", { name: "Mở Gợi ý" }).click();
    await expect(reviewDialog).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = window.sessionStorage.getItem("aiChatbotKnowledgeTarget");
          return raw ? JSON.parse(raw).tab : null;
        }),
      )
      .toBe("suggestions");

    await page.getByRole("button", { name: "Xem tất cả" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Việc cần rà soát" })).toBeHidden();

    expect(pageErrors).toEqual([]);
  });

  test("knowledge page supports main tabs and representative knowledge operations", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await installSmokeApiMocks(page, { authRole: "manager" });

    await page.goto("/manager#ai-chatbot-knowledge");
    await expectNoPageCrash(page);
    await expect(page.getByRole("heading", { name: "Tri thức Chatbot AI" })).toBeVisible();
    await expect(page.getByText("Giờ mở cửa nhà hàng")).toBeVisible();

    await page.getByRole("button", { name: "Thêm tri thức" }).first().click();
    const knowledgeEditor = page.locator(".ai-admin-drawer-panel").filter({ hasText: "Tiêu đề" }).first();
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Tiêu đề" }).locator("input").fill("Cách đặt bàn cho khách mới");
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Nội dung" }).locator("textarea").fill("Khách có thể đặt bàn trực tiếp qua chatbot hoặc trang đặt bàn của nhà hàng.");
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Danh mục" }).locator("input").fill("booking");
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Nguồn nội dung" }).locator("select").selectOption("faq");
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Thẻ" }).locator("input").fill("đặt bàn, khách mới");
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Ưu tiên" }).locator("input").fill("15");
    await knowledgeEditor.getByRole("button", { name: "Thêm tri thức" }).click();
    await expect(page.getByText("Đã thêm mục tri thức.")).toBeVisible();

    await page.getByRole("button", { name: "Gợi ý" }).click();
    await expect(page.getByRole("heading", { name: "Gợi ý bổ sung tri thức" })).toBeVisible();
    await expect(page.getByText("Món phù hợp cho 2 người")).toBeVisible();
    await page.locator("article.ai-admin-card").filter({ hasText: "Món phù hợp cho 2 người" }).getByRole("button", { name: "Duyệt" }).click();
    await expect(page.getByText("Đã duyệt gợi ý thành tri thức.")).toBeVisible();

    await page.getByRole("button", { name: "Phản hồi" }).click();
    await expect(page.getByRole("heading", { name: "Phản hồi khách hàng" })).toBeVisible();
    await page.locator("article.ai-admin-card").filter({ hasText: "Nhà hàng có món chay không?" }).getByRole("button", { name: "Đã xem" }).click();
    await expect(page.getByText("Đã đánh dấu feedback đã xem.")).toBeVisible();

    await page.getByRole("button", { name: "An toàn" }).click();
    await expect(page.getByRole("heading", { name: "Quy tắc an toàn" })).toBeVisible();
    await page.getByRole("button", { name: "Thêm quy tắc" }).click();
    const safetyEditor = page.locator(".ai-admin-grid--safety aside.ai-admin-panel").filter({ hasText: "Chủ đề hoặc nội dung cần kiểm soát" }).first();
    await safetyEditor.locator("label.ai-admin-field").filter({ hasText: "Chủ đề hoặc nội dung cần kiểm soát" }).locator("input").fill("dị ứng nghiêm trọng");
    await safetyEditor.locator("label.ai-admin-field").filter({ hasText: "Nội dung cần cảnh báo" }).locator("textarea").fill("Vui lòng gặp nhân viên để được tư vấn an toàn hơn.");
    await safetyEditor.locator("label.ai-admin-field").filter({ hasText: "Ưu tiên" }).locator("input").fill("30");
    await safetyEditor.getByRole("button", { name: "Thêm quy tắc" }).click();
    await expect(page.getByText("Đã thêm quy tắc an toàn.")).toBeVisible();

    await page.getByRole("button", { name: "Kiểm thử" }).click();
    await expect(page.getByRole("heading", { name: "Kiểm thử phản hồi" })).toBeVisible();
    await page.getByPlaceholder("Nhập câu hỏi thử nghiệm từ khách...").fill("Hôm nay nhà hàng mở cửa đến mấy giờ?");
    await page.getByRole("button", { name: "Chạy thử" }).click();
    await expect(page.getByText("Đã chạy kiểm thử.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Kết quả chatbot trả lời" })).toBeVisible();
    await expect(page.getByText("Độ chắc chắn:")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});
