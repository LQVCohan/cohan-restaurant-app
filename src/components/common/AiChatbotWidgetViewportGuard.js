const normalizeText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .trim();

const isNavigationHelpRequest = (value = "") => {
  const text = normalizeText(value);
  return /\b(ban co the giup|co the giup|giup gi|lam duoc gi|dieu huong|huong dan|mo trang|vao trang|di toi|cho toi vao|mo giup|dashboard|quan ly kho|ton kho|quan ly chatbot|trang quan ly)\b/.test(text);
};

const hasResultBlock = (panel) =>
  Boolean(
    panel.querySelector(
      ".ai-chatbot-menu-cards, .ai-chatbot-menu-detail, .ai-chatbot-cart-notice",
    ),
  );

const getLastMessageText = (panel, role) => {
  const nodes = panel.querySelectorAll(`.ai-chatbot-message.${role} p`);
  return nodes.length ? nodes[nodes.length - 1].textContent || "" : "";
};

const getLastAssistantMessage = (panel) => {
  const nodes = panel.querySelectorAll(".ai-chatbot-message.assistant");
  return nodes.length ? nodes[nodes.length - 1] : null;
};

const updatePanelSuggestionMode = (panel) => {
  if (!panel) return;

  const resultMode = hasResultBlock(panel);
  const lastUserText = getLastMessageText(panel, "user");
  const helpMode = isNavigationHelpRequest(lastUserText);
  const latestAssistant = getLastAssistantMessage(panel);
  const hasActionCards = Boolean(panel.querySelector(".ai-chatbot-action-cards"));
  const hasQuickReplies = Boolean(panel.querySelector(".ai-chatbot-quick-replies"));

  panel.classList.toggle("ai-chatbot-hide-result-suggestions", resultMode);
  panel.classList.toggle(
    "ai-chatbot-hide-secondary-actions",
    !resultMode && hasActionCards && !helpMode,
  );
  panel.classList.toggle(
    "ai-chatbot-compact-suggestion-strip",
    !resultMode && hasQuickReplies && !hasActionCards,
  );

  const body = panel.querySelector(".ai-chatbot-body");
  if (!body || !latestAssistant) return;

  window.requestAnimationFrame(() => {
    latestAssistant.scrollIntoView({ block: "end", inline: "nearest" });
    body.scrollTop = body.scrollHeight;
  });
};

const scheduleUpdate = (() => {
  let frame = 0;
  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      document
        .querySelectorAll(".ai-chatbot-panel")
        .forEach(updatePanelSuggestionMode);
    });
  };
})();

export const installAiChatbotViewportGuard = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__cohanAiChatbotViewportGuardInstalled) return;
  window.__cohanAiChatbotViewportGuardInstalled = true;

  const observer = new MutationObserver(scheduleUpdate);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("click", scheduleUpdate, { passive: true });
  scheduleUpdate();
};

export default installAiChatbotViewportGuard;
