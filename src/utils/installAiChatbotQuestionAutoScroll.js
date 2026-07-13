const USER_MESSAGE_SELECTOR = ".ai-chatbot-message.user";
const SCROLL_CONTAINER_SELECTOR = ".ai-chatbot-body";

let observer = null;
let domReadyListener = null;
const handledMessages = new WeakSet();

const nextFrame = (callback) => {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }
  return window.setTimeout(callback, 0);
};

const getScrollBehavior = () => {
  if (typeof window.matchMedia !== "function") return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
};

const scrollToQuestion = (messageElement) => {
  if (!(messageElement instanceof HTMLElement)) return;

  const scrollContainer =
    messageElement.closest(SCROLL_CONTAINER_SELECTOR) ||
    messageElement.closest(".ai-chatbot-messages");
  if (!(scrollContainer instanceof HTMLElement)) return;

  const containerRect = scrollContainer.getBoundingClientRect();
  const messageRect = messageElement.getBoundingClientRect();
  const top = Math.max(
    0,
    scrollContainer.scrollTop + messageRect.top - containerRect.top - 12,
  );

  if (typeof scrollContainer.scrollTo === "function") {
    scrollContainer.scrollTo({
      top,
      behavior: getScrollBehavior(),
    });
    return;
  }

  scrollContainer.scrollTop = top;
};

const scheduleQuestionScroll = (messageElement) => {
  if (
    !(messageElement instanceof HTMLElement) ||
    handledMessages.has(messageElement)
  ) {
    return;
  }

  handledMessages.add(messageElement);
  nextFrame(() => {
    nextFrame(() => scrollToQuestion(messageElement));
  });
};

const findAddedUserMessages = (node) => {
  if (!(node instanceof HTMLElement)) return [];

  const matches = [];
  if (node.matches(USER_MESSAGE_SELECTOR)) matches.push(node);
  matches.push(...node.querySelectorAll(USER_MESSAGE_SELECTOR));
  return matches;
};

const startObserver = () => {
  if (observer || !document.body || typeof MutationObserver === "undefined") {
    return;
  }

  observer = new MutationObserver((mutations) => {
    const addedUserMessages = [];

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        addedUserMessages.push(...findAddedUserMessages(node));
      }
    }

    const latestQuestion = addedUserMessages.at(-1);
    if (latestQuestion) scheduleQuestionScroll(latestQuestion);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

export const installAiChatbotQuestionAutoScroll = () => {
  if (typeof document === "undefined" || observer) return;

  if (document.body) {
    startObserver();
    return;
  }

  domReadyListener = () => {
    domReadyListener = null;
    startObserver();
  };
  document.addEventListener("DOMContentLoaded", domReadyListener, {
    once: true,
  });
};

export const uninstallAiChatbotQuestionAutoScroll = () => {
  observer?.disconnect();
  observer = null;

  if (domReadyListener) {
    document.removeEventListener("DOMContentLoaded", domReadyListener);
    domReadyListener = null;
  }
};
