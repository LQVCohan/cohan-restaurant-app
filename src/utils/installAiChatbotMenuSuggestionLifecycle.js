const PANEL_SELECTOR = ".ai-chatbot-panel";
const MESSAGE_SELECTOR = ".ai-chatbot-message";
const USER_MESSAGE_SELECTOR = ".ai-chatbot-message.user";
const ASSISTANT_MESSAGE_SELECTOR =
  ".ai-chatbot-message.assistant, .ai-chatbot-message.staff";
const MENU_LIST_SELECTOR = ".ai-chatbot-menu-cards";
const MENU_CARD_SELECTOR = ".ai-chatbot-menu-card";
const DEFAULT_LIMIT = 3;

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

export const getLatestUserMessageSignature = (panel) => {
  if (!panel) return "";
  const messages = [...panel.querySelectorAll(USER_MESSAGE_SELECTOR)];
  const latest = messages.at(-1);
  if (!latest) return "";
  return `${messages.length}:${normalizeText(latest.textContent)}`;
};

export const compactAiMenuSuggestionList = (
  menuList,
  limit = DEFAULT_LIMIT,
) => {
  if (!menuList) return 0;
  const safeLimit = Math.max(1, Number(limit) || DEFAULT_LIMIT);
  const cards = [...menuList.querySelectorAll(MENU_CARD_SELECTOR)];

  cards.forEach((card, index) => {
    const shouldShow = index < safeLimit;
    card.hidden = !shouldShow;
    card.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    card.dataset.aiSuggestionRank = String(index + 1);
  });

  menuList.dataset.aiSuggestionCount = String(
    Math.min(cards.length, safeLimit),
  );
  menuList.dataset.aiSuggestionLimit = String(safeLimit);
  return Math.min(cards.length, safeLimit);
};

const hideSuggestionLists = (panel) => {
  panel.querySelectorAll(MENU_LIST_SELECTOR).forEach((menuList) => {
    menuList.hidden = true;
    menuList.setAttribute("aria-hidden", "true");
    menuList.classList.add("is-stale-ai-menu-suggestions");
  });
};

const revealFreshSuggestionLists = (panel) => {
  panel.querySelectorAll(MENU_LIST_SELECTOR).forEach((menuList) => {
    compactAiMenuSuggestionList(menuList);
    menuList.hidden = false;
    menuList.setAttribute("aria-hidden", "false");
    menuList.classList.remove("is-stale-ai-menu-suggestions");
    menuList.classList.add("is-fresh-ai-menu-suggestions");
  });
};

const countAssistantMessages = (panel) =>
  panel?.querySelectorAll(ASSISTANT_MESSAGE_SELECTOR).length || 0;

const preparePanel = (panel) => {
  panel.querySelectorAll(MENU_LIST_SELECTOR).forEach((menuList) =>
    compactAiMenuSuggestionList(menuList),
  );
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
