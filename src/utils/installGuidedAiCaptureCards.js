const INSTALL_KEY = "__cohanGuidedAiCaptureCardsCleanup";
const CARD_SELECTOR =
  ".custom-table-builder-modal .custom-table-builder__image-chip";
const INPUT_SELECTOR = 'input[type="file"][capture="environment"]';

let guideSequence = 0;

const getDirectChild = (element, tagName) =>
  Array.from(element?.children || []).find(
    (child) => child.tagName?.toLowerCase() === tagName,
  );

const getCaptureInput = (card) => card?.querySelector(INPUT_SELECTOR);

const createElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  element.className = className;
  if (text) element.textContent = text;
  return element;
};

const prepareCaptureCard = (card, index) => {
  if (!card || card.querySelector(":scope > .cohan-guided-capture__shell")) {
    return;
  }

  const input = getCaptureInput(card);
  if (!input) return;

  const sourceTitle = getDirectChild(card, "span")?.textContent?.trim();
  const sourceHint = getDirectChild(card, "small")?.textContent?.trim();
  const title = sourceTitle || `Ảnh ${index + 1}`;
  const hint =
    sourceHint || "Giữ toàn bộ bàn trong khung và chụp rõ các cạnh bàn.";
  const guideId = `cohan-guided-capture-guide-${guideSequence++}`;

  card.classList.add("cohan-guided-capture");
  input.classList.add("cohan-guided-capture__input");
  input.setAttribute("aria-describedby", guideId);

  const shell = createElement("div", "cohan-guided-capture__shell");
  const frame = createElement("div", "cohan-guided-capture__frame");
  const badge = createElement(
    "span",
    "cohan-guided-capture__badge",
    `Ảnh ${index + 1}/5`,
  );
  const target = createElement("span", "cohan-guided-capture__target");
  target.setAttribute("aria-hidden", "true");

  const preview = createElement("img", "cohan-guided-capture__preview");
  preview.hidden = true;

  const guide = createElement("div", "cohan-guided-capture__guide");
  guide.id = guideId;
  const guideTitle = createElement(
    "strong",
    "cohan-guided-capture__guide-title",
    title,
  );
  const guideText = createElement(
    "p",
    "cohan-guided-capture__guide-text",
    hint,
  );
  guide.append(guideTitle, guideText);
  frame.append(preview, target, badge, guide);

  const actions = createElement("div", "cohan-guided-capture__actions");
  const status = createElement(
    "span",
    "cohan-guided-capture__status",
    "Chưa chụp",
  );
  status.setAttribute("aria-live", "polite");

  const captureButton = createElement(
    "button",
    "cohan-guided-capture__button",
    "Mở camera",
  );
  captureButton.type = "button";
  captureButton.dataset.guidedCaptureOpen = "true";
  captureButton.setAttribute("aria-label", `Mở camera cho ${title}`);
  captureButton.setAttribute("aria-describedby", guideId);

  const fileName = createElement("small", "cohan-guided-capture__filename");
  fileName.hidden = true;

  actions.append(status, captureButton);
  shell.append(frame, actions, fileName);
  card.append(shell);
};

const prepareAllCaptureCards = () => {
  document.querySelectorAll(CARD_SELECTOR).forEach(prepareCaptureCard);
};

export const installGuidedAiCaptureCards = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  if (window[INSTALL_KEY]) return window[INSTALL_KEY];

  const objectUrls = new Map();

  const releasePreview = (card) => {
    const url = objectUrls.get(card);
    if (url && URL.revokeObjectURL) URL.revokeObjectURL(url);
    objectUrls.delete(card);
  };

  const updatePreview = (card, file) => {
    const shell = card.querySelector(":scope > .cohan-guided-capture__shell");
    const preview = shell?.querySelector(".cohan-guided-capture__preview");
    const button = shell?.querySelector(".cohan-guided-capture__button");
    const status = shell?.querySelector(".cohan-guided-capture__status");
    const fileName = shell?.querySelector(".cohan-guided-capture__filename");
    if (!shell || !preview || !button || !status || !fileName) return;

    releasePreview(card);

    if (!file) {
      preview.hidden = true;
      preview.removeAttribute("src");
      card.classList.remove("is-complete");
      button.textContent = "Mở camera";
      status.textContent = "Chưa chụp";
      fileName.hidden = true;
      fileName.textContent = "";
      return;
    }

    if (URL.createObjectURL) {
      const url = URL.createObjectURL(file);
      objectUrls.set(card, url);
      preview.src = url;
      preview.hidden = false;
    }

    const title =
      card.querySelector(".cohan-guided-capture__guide-title")?.textContent ||
      "Ảnh đã chụp";
    preview.alt = `${title}: ${file.name}`;
    card.classList.add("is-complete");
    button.textContent = "Chụp lại";
    status.textContent = "Đã chụp";
    fileName.textContent = file.name;
    fileName.hidden = false;
  };

  const handleClick = (event) => {
    const button = event.target.closest?.("[data-guided-capture-open]");
    if (!button) return;

    const card = button.closest(CARD_SELECTOR);
    const input = getCaptureInput(card);
    if (!input) return;

    input.value = "";
    input.click();
  };

  const handleChange = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches(INPUT_SELECTOR)) {
      return;
    }

    const card = input.closest(CARD_SELECTOR);
    if (!card) return;
    updatePreview(card, input.files?.[0] || null);
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        const cards = node.matches?.(CARD_SELECTOR)
          ? [node]
          : Array.from(node.querySelectorAll?.(CARD_SELECTOR) || []);
        cards.forEach(releasePreview);
      });
    });
    prepareAllCaptureCards();
  });

  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  observer.observe(document.body, { childList: true, subtree: true });
  prepareAllCaptureCards();

  const cleanup = () => {
    observer.disconnect();
    document.removeEventListener("click", handleClick);
    document.removeEventListener("change", handleChange);
    objectUrls.forEach((url) => URL.revokeObjectURL?.(url));
    objectUrls.clear();
    delete window[INSTALL_KEY];
  };

  window[INSTALL_KEY] = cleanup;
  return cleanup;
};
