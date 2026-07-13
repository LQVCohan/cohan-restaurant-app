const PANEL_SELECTOR = ".ai-chatbot-panel";
const USER_MESSAGE_SELECTOR = ".ai-chatbot-message.user";
const ASSISTANT_MESSAGE_SELECTOR =
  ".ai-chatbot-message.assistant, .ai-chatbot-message.staff";
const MENU_LIST_SELECTOR = ".ai-chatbot-menu-cards";
const MENU_CARD_SELECTOR = ".ai-chatbot-menu-card";
const RESULT_HEADER_SELECTOR = ".ai-chatbot-menu-results__header";
const DEFAULT_LIMIT = 3;

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

export const getLatestUserMessageSignature = (panel) => {
  if (!panel) return "";
  const messages = [...panel.querySelectorAll(USER_MESSAGE_SELECTOR)];
  const latest = messages.at(-1);
  if (!latest) return "";
  return `${messages.length}:${normalizeText(latest.textContent)}`;
};

const setButtonText = (button, text) => {
  if (!button || normalizeText(button.textContent) === text) return;
  button.textContent = text;
};

const ensureResultHeader = (menuList, visibleCount) => {
  if (!menuList) return null;
  const doc = menuList.ownerDocument;
  let header = menuList.querySelector(RESULT_HEADER_SELECTOR);

  if (!header) {
    header = doc.createElement("div");
    header.className = "ai-chatbot-menu-results__header";

    const marker = doc.createElement("span");
    marker.className = "ai-chatbot-menu-results__marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = "★";

    const copy = doc.createElement("span");
    copy.className = "ai-chatbot-menu-results__copy";

    const title = doc.createElement("strong");
    title.className = "ai-chatbot-menu-results__title";

    const subtitle = doc.createElement("small");
    subtitle.textContent = "Ưu tiên theo lượt gọi và đánh giá";

    copy.append(title, subtitle);
    header.append(marker, copy);
    menuList.prepend(header);
  }

  const title = header.querySelector(".ai-chatbot-menu-results__title");
  const nextTitle = `Top ${visibleCount} món nổi bật`;
  if (title && title.textContent !== nextTitle) title.textContent = nextTitle;
  return header;
};

const polishSuggestionCard = (card, index) => {
  card.dataset.aiSuggestionRank = String(index + 1);
  card.setAttribute("role", "group");

  const itemName = normalizeText(
    card.querySelector("strong")?.textContent || `món số ${index + 1}`,
  );
  card.setAttribute("aria-label", `Gợi ý ${index + 1}: ${itemName}`);

  const buttons = [
    ...card.querySelectorAll(".ai-chatbot-menu-card__actions button"),
  ];
  if (buttons[0]) {
    buttons[0].dataset.aiMenuAction = "details";
    buttons[0].setAttribute("aria-label", `Xem chi tiết ${itemName}`);
    setButtonText(buttons[0], "Chi tiết");
  }
  if (buttons[1]) {
    buttons[1].dataset.aiMenuAction = "select";
    buttons[1].setAttribute("aria-label", `Chọn ${itemName}`);
    setButtonText(buttons[1], "Chọn");
  }
};

export const compactAiMenuSuggestionList = (
  menuList,
  limit = DEFAULT_LIMIT,
) => {
  if (!menuList) return 0;
  const safeLimit = Math.max(1, Number(limit) || DEFAULT_LIMIT);
  const cards = [...menuList.querySelectorAll(MENU_CARD_SELECTOR)];
  const visibleCount = Math.min(cards.length, safeLimit);

  cards.forEach((card, index) => {
    const shouldShow = index < safeLimit;
    card.hidden = !shouldShow;
    card.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    card.classList.toggle(
      "is-last-visible-ai-suggestion",
      shouldShow && index === visibleCount - 1,
    );
    polishSuggestionCard(card, index);
  });

  menuList.classList.add("ai-chatbot-menu-results");
  menuList.setAttribute("role", "region");
  menuList.setAttribute(
    "aria-label",
    `${visibleCount} món nổi bật được đề xuất`,
  );
  menuList.dataset.aiSuggestionCount = String(visibleCount);
  menuList.dataset.aiSuggestionLimit = String(safeLimit);
  ensureResultHeader(menuList, visibleCount);
  return visibleCount;
};

const setPanelResultState = (panel, state = "") => {
  if (!panel) return;
  if (state) {
    panel.dataset.aiMenuResultState = state;
    panel.classList.add("has-ai-menu-results");
  } else {
    delete panel.dataset.aiMenuResultState;
    panel.classList.remove("has-ai-menu-results");
  }
};

const hideSuggestionLists = (panel) => {
  panel.querySelectorAll(MENU_LIST_SELECTOR).forEach((menuList) => {
    menuList.hidden = true;
    menuList.setAttribute("aria-hidden", "true");
    menuList.classList.add("is-stale-ai-menu-suggestions");
  });
  setPanelResultState(panel, "waiting");
};

const revealFreshSuggestionLists = (panel) => {
  let visibleCount = 0;
  panel.querySelectorAll(MENU_LIST_SELECTOR).forEach((menuList) => {
    visibleCount += compactAiMenuSuggestionList(menuList);
    menuList.hidden = false;
    menuList.setAttribute("aria-hidden", "false");
    menuList.classList.remove("is-stale-ai-menu-suggestions");
    menuList.classList.add("is-fresh-ai-menu-suggestions");
  });
  setPanelResultState(panel, visibleCount ? "visible" : "");
  return visibleCount;
};

const countAssistantMessages = (panel) =>
  panel?.querySelectorAll(ASSISTANT_MESSAGE_SELECTOR).length || 0;

const preparePanel = (panel) => {
  let visibleCount = 0;
  panel.querySelectorAll(MENU_LIST_SELECTOR).forEach((menuList) => {
    const count = compactAiMenuSuggestionList(menuList);
    if (
      !menuList.hidden &&
      !menuList.classList.contains("is-stale-ai-menu-suggestions")
    ) {
      visibleCount += count;
    }
  });
  setPanelResultState(panel, visibleCount ? "visible" : "");
};

export const installAiChatbotMenuSuggestionLifecycle = ({
  root = document,
} = {}) => {
  if (typeof MutationObserver === "undefined" || !root) return () => {};

  const panelState = new WeakMap();

  const syncPanel = (panel) => {
    if (!panel) return;
    const previous = panelState.get(panel) || {
      userSignature: "",
      assistantCountAtQuestion: countAssistantMessages(panel),
      awaitingFreshSuggestions: false,
    };

    const nextUserSignature = getLatestUserMessageSignature(panel);
    const assistantCount = countAssistantMessages(panel);

    if (
      nextUserSignature &&
      previous.userSignature &&
      nextUserSignature !== previous.userSignature
    ) {
      hideSuggestionLists(panel);
      previous.awaitingFreshSuggestions = true;
      previous.assistantCountAtQuestion = assistantCount;
    }

    if (!previous.userSignature && nextUserSignature) {
      previous.userSignature = nextUserSignature;
      previous.assistantCountAtQuestion = assistantCount;
    } else {
      previous.userSignature = nextUserSignature;
    }

    if (
      previous.awaitingFreshSuggestions &&
      assistantCount > previous.assistantCountAtQuestion
    ) {
      revealFreshSuggestionLists(panel);
      previous.awaitingFreshSuggestions = false;
    } else if (!previous.awaitingFreshSuggestions) {
      preparePanel(panel);
    }

    panelState.set(panel, previous);
  };

  const syncAllPanels = () => {
    root.querySelectorAll(PANEL_SELECTOR).forEach(syncPanel);
  };

  syncAllPanels();

  const observer = new MutationObserver((mutations) => {
    const panels = new Set();
    mutations.forEach((mutation) => {
      const targetPanel = mutation.target?.closest?.(PANEL_SELECTOR);
      if (targetPanel) panels.add(targetPanel);
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches(PANEL_SELECTOR)) panels.add(node);
        node.querySelectorAll?.(PANEL_SELECTOR).forEach((panel) =>
          panels.add(panel),
        );
      });
    });

    if (!panels.size) syncAllPanels();
    else panels.forEach(syncPanel);
  });

  observer.observe(root.body || root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return () => observer.disconnect();
};

export default installAiChatbotMenuSuggestionLifecycle;
