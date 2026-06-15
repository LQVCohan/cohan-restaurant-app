import { expect, test } from "@playwright/test";
import { installSmokeApiMocks, expectNoPageCrash } from "./graphqlMocks.js";

const collectPageErrors = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error));
  return errors;
};

const pageRoot = (page) => page.locator(".ai-admin-page").first();

const expectAiHeading = async (page, name, options = {}) => {
  await expect(
    pageRoot(page).getByRole("heading", { name, ...options }).first(),
  ).toBeVisible();
};

const expectAiText = async (page, textOrRegex) => {
  await expect(pageRoot(page).getByText(textOrRegex).first()).toBeVisible();
};

const fieldByLabel = (scope, labelText) =>
  scope.locator("label.ai-admin-field").filter({ hasText: labelText }).first();

test.describe("manager AI pages: feature smoke", () => {
  test("settings page lets manager edit, preview, validate and save chatbot settings", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await installSmokeApiMocks(page, { authRole: "manager" });

    await page.goto("/manager#ai-chatbot-settings");
    await expectNoPageCrash(page);
    await expect(pageRoot(page)).toBeVisible();
    await expectAiHeading(page, "Cài đặt Chatbot AI", { level: 2 });
    await expectAiText(page, "Cohan Smoke Bistro");

    const welcomeField = fieldByLabel(page, "Lời chào").locator("textarea");
    await welcomeField.fill("Xin chào từ Playwright. Mình có thể hỗ trợ bạn xem thực đơn, đặt bàn và kiểm tra ưu đãi.");
    await expectAiText(page, "Xin chào từ Playwright");

    const quickRepliesField = fieldByLabel(page, "Gợi ý nhanh").locator("textarea");
    await quickRepliesField.fill([
      "Xem món bán chạy",
      "Hỏi giờ mở cửa",
      "Đặt bàn cho tối nay",
      "Gặp nhân viên",
    ].join("\n"));
    await expectAiText(page, "Hỏi giờ mở cửa");

    await page.locator("summary", { hasText: "Quy trình chuyển nhân viên" }).click();
    await fieldByLabel(page, "Ngưỡng chuyển nhân viên").locator("input").fill("0.55");
    await expectAiText(page, /Ngưỡng\s*55%/i);

    await page.getByRole("button", { name: "Lưu cài đặt" }).click();
    await expect(page.getByText("Đã lưu cài đặt Chatbot AI.").first()).toBeVisible();

    await quickRepliesField.fill([
      "Một", "Hai", "Ba", "Bốn", "Năm", "Sáu", "Bảy", "Tám", "Chín",
    ].join("\n"));
    await page.getByRole("button", { name: "Lưu cài đặt" }).click();
    await expect(page.getByRole("alert").first()).toContainText("Tối đa 8 gợi ý nhanh.");

    expect(pageErrors).toEqual([]);
  });

  test("analytics page shows KPI, filter controls, review modal and knowledge navigation target", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await installSmokeApiMocks(page, { authRole: "manager" });

    await page.goto("/manager#ai-chatbot-analytics");
    await expectNoPageCrash(page);
    await expect(pageRoot(page)).toBeVisible();
    await expectAiHeading(page, "Báo cáo Chatbot AI", { level: 2 });
    await expectAiText(page, "Cuộc trò chuyện");
    await expect(pageRoot(page).locator(".ai-admin-metrics strong").filter({ hasText: "42" }).first()).toBeVisible();
    await expectAiText(page, "Khách hỏi về gì?");
    await expectAiText(page, "Thực đơn");
    await expectAiText(page, "Ai đang nhắn?");
    await expect(pageRoot(page).locator(".ai-analytics-list__label").filter({ hasText: "Chatbot" }).first()).toBeVisible();

    await fieldByLabel(page, "Thời gian").locator("select").selectOption("30");
    await expect(fieldByLabel(page, "Thời gian").locator("select")).toHaveValue("30");

    await page.getByRole("button", { name: "Xem tất cả" }).click();
    const reviewDialog = page.getByRole("dialog", { name: "Việc cần rà soát" });
    await expect(reviewDialog).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/ai-admin-modal-open/);
    await expect(reviewDialog.getByText("Cần bổ sung câu trả lời").first()).toBeVisible();

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
    await expect(pageRoot(page)).toBeVisible();
    await expectAiHeading(page, "Tri thức Chatbot AI", { level: 2 });
    await expectAiText(page, "Giờ mở cửa nhà hàng");

    await page.getByRole("button", { name: "Thêm tri thức" }).first().click();
    const knowledgeEditor = page.locator(".ai-admin-drawer-panel").filter({ hasText: "Tiêu đề" }).first();
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Tiêu đề" }).locator("input").fill("Cách đặt bàn cho khách mới");
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Nội dung" }).locator("textarea").fill("Khách có thể đặt bàn trực tiếp qua chatbot hoặc trang đặt bàn của nhà hàng.");
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Danh mục" }).locator("input").fill("booking");
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Nguồn nội dung" }).locator("select").selectOption("faq");
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Thẻ" }).locator("input").fill("đặt bàn, khách mới");
    await knowledgeEditor.locator("label.ai-admin-field").filter({ hasText: "Ưu tiên" }).locator("input").fill("15");
    await knowledgeEditor.getByRole("button", { name: "Thêm tri thức" }).click();
    await expect(page.getByText("Đã thêm mục tri thức.").first()).toBeVisible();

    await page.getByRole("button", { name: "Gợi ý" }).click();
    await expectAiHeading(page, "Gợi ý bổ sung tri thức", { level: 3 });
    await expectAiText(page, "Món phù hợp cho 2 người");
    await page.locator("article.ai-admin-card").filter({ hasText: "Món phù hợp cho 2 người" }).getByRole("button", { name: "Duyệt" }).click();
    await expect(page.getByText("Đã duyệt gợi ý thành tri thức.").first()).toBeVisible();

    await page.getByRole("button", { name: "Phản hồi" }).click();
    await expectAiHeading(page, "Phản hồi khách hàng", { level: 3 });
    await page.locator("article.ai-admin-card").filter({ hasText: "Nhà hàng có món chay không?" }).getByRole("button", { name: "Đã xem" }).click();
    await expect(page.getByText("Đã đánh dấu feedback đã xem.").first()).toBeVisible();

    await page.getByRole("button", { name: "An toàn" }).click();
    await expectAiHeading(page, "Quy tắc an toàn", { level: 3 });
    await page.getByRole("button", { name: "Thêm quy tắc" }).click();
    const safetyEditor = page.locator(".ai-admin-grid--safety aside.ai-admin-panel").filter({ hasText: "Chủ đề hoặc nội dung cần kiểm soát" }).first();
    await safetyEditor.locator("label.ai-admin-field").filter({ hasText: "Chủ đề hoặc nội dung cần kiểm soát" }).locator("input").fill("dị ứng nghiêm trọng");
    await safetyEditor.locator("label.ai-admin-field").filter({ hasText: "Nội dung cần cảnh báo" }).locator("textarea").fill("Vui lòng gặp nhân viên để được tư vấn an toàn hơn.");
    await safetyEditor.locator("label.ai-admin-field").filter({ hasText: "Ưu tiên" }).locator("input").fill("30");
    await safetyEditor.getByRole("button", { name: "Thêm quy tắc" }).click();
    await expect(page.getByText("Đã thêm quy tắc an toàn.").first()).toBeVisible();

    await page.getByRole("button", { name: "Kiểm thử" }).click();
    await expectAiHeading(page, "Kiểm thử phản hồi", { level: 3 });
    await page.getByPlaceholder("Nhập câu hỏi thử nghiệm từ khách...").fill("Hôm nay nhà hàng mở cửa đến mấy giờ?");
    await page.getByRole("button", { name: "Chạy thử" }).click();
    await expect(page.getByText("Đã chạy kiểm thử.").first()).toBeVisible();
    await expectAiHeading(page, "Kết quả chatbot trả lời", { level: 3 });
    await expectAiText(page, "Độ chắc chắn:");

    expect(pageErrors).toEqual([]);
  });
});
