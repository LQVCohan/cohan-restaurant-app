import { expect, test } from "@playwright/test";
import { TEST_RESTAURANT } from "./fixtures.js";

const MANAGER_USER = {
  id: "test-manager-1",
  fullName: "Cohan Test Manager",
  username: "cohan_manager",
  email: "manager.test@cohan.local",
  phone: "0900000002",
  roleName: "manager",
  status: "active",
  emailVerified: true,
  phoneVerified: true,
};

const ACTIVE_HANDOFF_THREAD = {
  id: "ai-handoff-thread-open-1",
  restaurantId: TEST_RESTAURANT.id,
  participants: ["guest:guest-1", "role:manager"],
  channel: "ai_chatbot_handoff",
  subject: "AI handoff - Khách cần đặt bàn",
  targetRole: "manager",
  status: "open",
  lastMessageAt: "2026-06-02T09:10:00.000Z",
  lastMessagePreview: "Khách muốn gặp nhân viên để đặt bàn tối nay",
  unreadCount: 1,
  updatedAt: "2026-06-02T09:11:00.000Z",
};

const RESOLVED_HANDOFF_THREAD = {
  id: "ai-handoff-thread-closed-1",
  restaurantId: TEST_RESTAURANT.id,
  participants: ["guest:guest-2", "role:manager"],
  channel: "ai_chatbot_handoff",
  subject: "AI handoff - Đã xử lý đặt bàn",
  targetRole: "manager",
  status: "closed",
  lastMessageAt: "2026-06-01T14:20:00.000Z",
  lastMessagePreview: "Yêu cầu đặt bàn đã xử lý",
  unreadCount: 0,
  updatedAt: "2026-06-01T14:25:00.000Z",
};

const ACTIVE_THREAD_DETAIL = {
  ...ACTIVE_HANDOFF_THREAD,
  messages: [
    {
      senderId: "system",
      senderRole: "system",
      senderName: "Hệ thống",
      messageType: "text",
      content: "[AI HANDOFF] Chatbot chưa đủ chắc chắn nên chuyển khách cho nhân viên.",
      createdAt: "2026-06-02T09:08:00.000Z",
    },
    {
      senderId: "guest-1",
      senderRole: "guest",
      senderName: "Khách hàng",
      messageType: "text",
      content: "Tôi muốn biết quán còn bàn 4 người tối nay không?",
      createdAt: "2026-06-02T09:09:00.000Z",
    },
    {
      senderId: "assistant",
      senderRole: "assistant",
      senderName: "Trợ lý tự động",
      messageType: "text",
      content: "Mình sẽ chuyển bạn cho nhân viên để được hỗ trợ đặt bàn.",
      createdAt: "2026-06-02T09:10:00.000Z",
    },
  ],
};

const RESOLVED_THREAD_DETAIL = {
  ...RESOLVED_HANDOFF_THREAD,
  messages: [
    {
      senderId: "system",
      senderRole: "system",
      senderName: "Hệ thống",
      messageType: "text",
      content: "[AI HANDOFF] Phiên hỗ trợ đã được đóng.",
      createdAt: "2026-06-01T14:00:00.000Z",
    },
    {
      senderId: "manager-1",
      senderRole: "manager",
      senderName: "Quản lý",
      messageType: "text",
      content: "Nhà hàng đã xác nhận bàn cho khách.",
      createdAt: "2026-06-01T14:20:00.000Z",
    },
  ],
};

const jwtLikeToken = () => {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, roleName: "manager" }),
  ).toString("base64url");
  return `smoke.${payload}.token`;
};

const collectPageErrors = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error));
  return errors;
};

const handoffRoot = (page) => page.locator(".ai-handoff-inbox").first();
const handoffTabs = (page) => handoffRoot(page).locator(".ai-handoff-inbox__tabs");
const replyForm = (page) => handoffRoot(page).locator(".ai-handoff-inbox__reply");
const tabButton = (page, name) => handoffTabs(page).getByRole("button", { name, exact: true });
const replyButton = (page, name) => replyForm(page).getByRole("button", { name, exact: true });

async function installHandoffMocks(page, { mode = "normal" } = {}) {
  await page.route("**/api/auth/refresh", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: jwtLikeToken(), user: MANAGER_USER }),
    });
  });

  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/graphql", async (route) => {
    const payload = route.request().postDataJSON();
    const operationName = payload?.operationName || "";
    const variables = payload?.variables || {};
    const data = buildHandoffGraphqlData(operationName, variables, mode);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data }),
    });
  });
}

function buildHandoffGraphqlData(operationName, variables, mode) {
  switch (operationName) {
    case "Me":
      return { me: MANAGER_USER };

    case "GetRestaurants":
    case "ScopedRestaurants":
      return {
        refRestaurants: [],
        scopedRestaurants: {
          edges:
            mode === "noRestaurants"
              ? []
              : [{ cursor: TEST_RESTAURANT.id, node: TEST_RESTAURANT }],
          pageInfo: {
            endCursor: mode === "noRestaurants" ? null : TEST_RESTAURANT.id,
            hasNextPage: false,
          },
        },
      };

    case "ChatThreads": {
      if (mode === "noRestaurants") return { chatThreads: [] };
      if (mode === "missingThreadNotification") return { chatThreads: [] };
      return {
        chatThreads:
          variables.status === "closed"
            ? [RESOLVED_HANDOFF_THREAD]
            : [ACTIVE_HANDOFF_THREAD],
      };
    }

    case "Notifications":
      if (mode === "noRestaurants") return { notifications: [] };
      if (mode === "missingThreadNotification") {
        return {
          notifications: [
            {
              id: "ai-handoff-notification-missing-thread",
              toUserId: MANAGER_USER.id,
              toRole: "manager",
              restaurantId: TEST_RESTAURANT.id,
              type: "ai_chatbot_handoff",
              uniqueKey: "ai-handoff-missing-thread",
              payload: {
                title: "Yêu cầu thiếu hội thoại",
                messagePreview: "Khách cần hỗ trợ nhưng thiếu mã hội thoại",
              },
              readAt: null,
              createdAt: "2026-06-02T09:12:00.000Z",
            },
          ],
        };
      }
      return {
        notifications: [
          {
            id: "ai-handoff-notification-1",
            toUserId: MANAGER_USER.id,
            toRole: "manager",
            restaurantId: TEST_RESTAURANT.id,
            type: "ai_chatbot_handoff",
            uniqueKey: "ai-handoff-open-1",
            payload: {
              threadId: ACTIVE_HANDOFF_THREAD.id,
              title: "Khách cần hỗ trợ",
              messagePreview: "Khách muốn gặp nhân viên để đặt bàn tối nay",
            },
            readAt: null,
            createdAt: "2026-06-02T09:12:00.000Z",
          },
        ],
      };

    case "UnreadNotificationCount":
      return { unreadNotificationCount: mode === "noRestaurants" ? 0 : 1 };

    case "ChatThread":
      return {
        chatThread:
          variables.id === RESOLVED_HANDOFF_THREAD.id
            ? RESOLVED_THREAD_DETAIL
            : ACTIVE_THREAD_DETAIL,
      };

    case "SendChatMessage":
      return {
        sendChatMessage: {
          ...ACTIVE_HANDOFF_THREAD,
          unreadCount: 0,
          lastMessageAt: new Date().toISOString(),
          lastMessagePreview: variables.input?.content || "Nhân viên đã phản hồi khách.",
          messages: [
            ...ACTIVE_THREAD_DETAIL.messages,
            {
              senderId: MANAGER_USER.id,
              senderRole: "manager",
              senderName: MANAGER_USER.fullName,
              content: variables.input?.content || "Nhân viên đã phản hồi khách.",
              createdAt: new Date().toISOString(),
            },
          ],
        },
      };

    case "MarkChatThreadRead":
    case "MarkNotificationRead":
      return {
        markChatThreadRead: true,
        markNotificationRead: true,
      };

    case "ResolveAiChatbotHandoff":
      return {
        resolveAiChatbotHandoff: {
          ok: true,
          conversationId: "ai-conversation-1",
          chatThreadId: variables.input?.chatThreadId || ACTIVE_HANDOFF_THREAD.id,
          status: "closed",
          alreadyClosed: false,
          message: "Đã đánh dấu xử lý.",
        },
      };

    default:
      return {};
  }
}

test.describe("AI handoff inbox smoke", () => {
  test("manager can open active handoff, send reply, resolve it, then review resolved threads", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await installHandoffMocks(page);

    await page.goto("/manager#ai-handoff");
    await expectNoHandoffCrash(page);
    await expect(handoffRoot(page).getByRole("heading", { name: "Yêu cầu cần hỗ trợ" })).toBeVisible();
    await expect(handoffRoot(page).getByRole("combobox", { name: "Nhà hàng" })).toHaveValue(TEST_RESTAURANT.id);
    await expect(handoffRoot(page).getByText("Khách muốn gặp nhân viên để đặt bàn tối nay").first()).toBeVisible();
    await expect(handoffRoot(page).getByText("Chọn một yêu cầu cần hỗ trợ để xem chi tiết.")).toBeVisible();

    await handoffRoot(page).locator(".ai-handoff-inbox__item").filter({ hasText: "Khách muốn gặp nhân viên" }).click();
    await expect(handoffRoot(page).getByText("Tôi muốn biết quán còn bàn 4 người tối nay không?")).toBeVisible();
    await expect(handoffRoot(page).getByText("Mình sẽ chuyển bạn cho nhân viên")).toBeVisible();

    const replyBox = handoffRoot(page).getByLabel("Nội dung phản hồi cho khách");
    await replyBox.fill("Dạ nhà hàng còn bàn cho 4 người lúc 19:00. Mình giữ bàn giúp bạn nhé.");
    await replyButton(page, "Gửi phản hồi").click();
    await expect(replyBox).toHaveValue("");

    await replyButton(page, "Đánh dấu đã xử lý").click();
    await expect(handoffRoot(page).getByText("Chưa có yêu cầu cần hỗ trợ")).toBeVisible();

    await tabButton(page, "Đã xử lý").click();
    await expect(handoffRoot(page).getByText("Yêu cầu đặt bàn đã xử lý")).toBeVisible();
    await handoffRoot(page).locator(".ai-handoff-inbox__item").filter({ hasText: "Yêu cầu đặt bàn đã xử lý" }).click();
    await expect(handoffRoot(page).getByText("Nhà hàng đã xác nhận bàn cho khách.")).toBeVisible();
    await expect(replyBox).toBeDisabled();
    await expect(replyButton(page, "Đã xử lý")).toBeDisabled();

    expect(pageErrors).toEqual([]);
  });

  test("shows a clear warning when a handoff notification has no thread id", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await installHandoffMocks(page, { mode: "missingThreadNotification" });

    await page.goto("/manager#ai-handoff");
    await expectNoHandoffCrash(page);
    await expect(handoffRoot(page).getByText("Khách cần hỗ trợ nhưng thiếu mã hội thoại")).toBeVisible();
    await handoffRoot(page).locator(".ai-handoff-inbox__item").filter({ hasText: "Khách cần hỗ trợ" }).click();
    await expect(handoffRoot(page).getByText("Thiếu thông tin hội thoại để gửi phản hồi")).toBeVisible();
    await expect(replyButton(page, "Gửi phản hồi")).toBeDisabled();

    expect(pageErrors).toEqual([]);
  });

  test("shows restaurant assignment empty state when manager has no restaurant", async ({ page }) => {
    const pageErrors = collectPageErrors(page);
    await installHandoffMocks(page, { mode: "noRestaurants" });

    await page.goto("/manager#ai-handoff");
    await expectNoHandoffCrash(page);
    await expect(handoffRoot(page).getByText("Chưa xác định được nhà hàng")).toBeVisible();
    await expect(handoffRoot(page).getByText("Vui lòng đảm bảo tài khoản quản lý đã được gán nhà hàng")).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

async function expectNoHandoffCrash(page) {
  await page.waitForLoadState("domcontentloaded");
  await expect(handoffRoot(page)).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Cannot read properties");
}
