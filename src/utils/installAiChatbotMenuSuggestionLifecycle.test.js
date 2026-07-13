import { afterEach, describe, expect, it } from "vitest";
import {
  compactAiMenuSuggestionList,
  getLatestUserMessageSignature,
  installAiChatbotMenuSuggestionLifecycle,
} from "./installAiChatbotMenuSuggestionLifecycle";

const flushMutations = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const buildCardList = (count = 4) => {
  const list = document.createElement("div");
  list.className = "ai-chatbot-menu-cards";
  for (let index = 0; index < count; index += 1) {
    const card = document.createElement("article");
    card.className = "ai-chatbot-menu-card";
    card.textContent = `Món ${index + 1}`;
    list.appendChild(card);
  }
  return list;
};

const addMessage = (panel, role, content) => {
  const messages = panel.querySelector(".ai-chatbot-messages");
  const message = document.createElement("div");
  message.className = `ai-chatbot-message ${role}`;
  message.textContent = content;
  messages.appendChild(message);
  return message;
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("AI chatbot menu suggestion lifecycle", () => {
  it("keeps only the first three ranked cards visible", () => {
    const list = buildCardList(5);
    document.body.appendChild(list);

    expect(compactAiMenuSuggestionList(list)).toBe(3);
    const cards = [...list.querySelectorAll(".ai-chatbot-menu-card")];
    expect(cards.slice(0, 3).every((card) => !card.hidden)).toBe(true);
    expect(cards.slice(3).every((card) => card.hidden)).toBe(true);
    expect(cards[0].dataset.aiSuggestionRank).toBe("1");
    expect(cards[2].dataset.aiSuggestionRank).toBe("3");
  });

  it("hides old dishes on a new question and reveals only fresh results", async () => {
    const panel = document.createElement("section");
    panel.className = "ai-chatbot-panel";
    panel.innerHTML = '<div class="ai-chatbot-messages"></div>';
    addMessage(panel, "user", "Gợi ý món bán chạy cho tôi");
    addMessage(panel, "assistant", "Mình tìm được vài món phù hợp.");
    const oldList = buildCardList(4);
    panel.appendChild(oldList);
    document.body.appendChild(panel);

    const dispose = installAiChatbotMenuSuggestionLifecycle();
    expect(getLatestUserMessageSignature(panel)).toContain(
      "Gợi ý món bán chạy cho tôi",
    );
    expect(oldList.querySelectorAll(".ai-chatbot-menu-card[hidden]")).toHaveLength(
      1,
    );

    addMessage(panel, "user", "Nhà hàng mở cửa tới mấy giờ?");
    await flushMutations();
    expect(oldList.hidden).toBe(true);
    expect(oldList.classList.contains("is-stale-ai-menu-suggestions")).toBe(true);

    oldList.remove();
    addMessage(panel, "assistant", "Nhà hàng mở cửa tới 22:00.");
    await flushMutations();
    expect(panel.querySelector(".ai-chatbot-menu-cards")).toBeNull();

    addMessage(panel, "user", "Gợi ý món bán chạy khác");
    await flushMutations();
    const freshList = buildCardList(5);
    panel.appendChild(freshList);
    addMessage(panel, "assistant", "Đây là ba món nổi bật nhất.");
    await flushMutations();

    expect(freshList.hidden).toBe(false);
    expect(
      freshList.querySelectorAll(".ai-chatbot-menu-card:not([hidden])"),
    ).toHaveLength(3);
    dispose();
  });
});
