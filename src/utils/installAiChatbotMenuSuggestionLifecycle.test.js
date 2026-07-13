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

    const name = document.createElement("strong");
    name.textContent = `Món ${index + 1}`;

    const restaurant = document.createElement("span");
    restaurant.className = "ai-chatbot-menu-card__restaurant";
    restaurant.textContent = "Nhà hàng Việt";

    const price = document.createElement("span");
    price.className = "ai-chatbot-menu-card__price";
    price.textContent = `${30 + index}.000đ`;

    const actions = document.createElement("div");
    actions.className = "ai-chatbot-menu-card__actions";
    const details = document.createElement("button");
    details.textContent = "Xem món";
    const select = document.createElement("button");
    select.textContent = "Chọn món";
    actions.append(details, select);

    card.append(name, restaurant, price, actions);
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
  it("turns the first three dishes into one ranked result stack", () => {
    const list = buildCardList(5);
    document.body.appendChild(list);

    expect(compactAiMenuSuggestionList(list)).toBe(3);
    const cards = [...list.querySelectorAll(".ai-chatbot-menu-card")];
    expect(cards.slice(0, 3).every((card) => !card.hidden)).toBe(true);
    expect(cards.slice(3).every((card) => card.hidden)).toBe(true);
    expect(cards[0].dataset.aiSuggestionRank).toBe("1");
    expect(cards[2].dataset.aiSuggestionRank).toBe("3");
    expect(list.classList.contains("ai-chatbot-menu-results")).toBe(true);
    expect(list.getAttribute("aria-label")).toContain("3 món nổi bật");
    expect(
      list.querySelector(".ai-chatbot-menu-results__title")?.textContent,
    ).toBe("Top 3 món nổi bật");
    expect(cards[0].querySelectorAll("button")[0].textContent).toBe("Chi tiết");
    expect(cards[0].querySelectorAll("button")[1].textContent).toBe("Chọn");
    expect(cards[0].getAttribute("aria-label")).toContain("Gợi ý 1: Món 1");
  });

  it("hides duplicate companion actions while results are current", async () => {
    const panel = document.createElement("section");
    panel.className = "ai-chatbot-panel";
    panel.innerHTML = `
      <div class="ai-chatbot-messages"></div>
      <div class="ai-chatbot-actions ai-chatbot-action-cards"></div>
      <div class="ai-chatbot-quick-replies"></div>
    `;
    addMessage(panel, "user", "Gợi ý món bán chạy cho tôi");
    addMessage(panel, "assistant", "Mình tìm được vài món phù hợp.");
    panel.appendChild(buildCardList(4));
    document.body.appendChild(panel);

    const dispose = installAiChatbotMenuSuggestionLifecycle();
    expect(panel.dataset.aiMenuResultState).toBe("visible");
    expect(panel.classList.contains("has-ai-menu-results")).toBe(true);
    dispose();
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
    expect(panel.dataset.aiMenuResultState).toBe("waiting");

    oldList.remove();
    addMessage(panel, "assistant", "Nhà hàng mở cửa tới 22:00.");
    await flushMutations();
    expect(panel.querySelector(".ai-chatbot-menu-cards")).toBeNull();
    expect(panel.dataset.aiMenuResultState).toBeUndefined();

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
    expect(panel.dataset.aiMenuResultState).toBe("visible");
    dispose();
  });
});
