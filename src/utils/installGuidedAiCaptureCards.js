import { compressImageForUpload } from "./compressAvatar";

const INSTALL_KEY = "__cohanGuidedAiCaptureCardsCleanup";
const CARD_SELECTOR =
  ".custom-table-builder-modal .custom-table-builder__image-chip";
const INPUT_SELECTOR = 'input[type="file"][capture="environment"]';
const AI_SECTION_SELECTOR =
  ".custom-table-builder-modal .custom-table-builder__section";
const HIDDEN_AI_FIELD_LABELS = new Set(["prompt", "khu vuc", "scale", "tag"]);
const AI_IMAGE_MAX_DIMENSION = 1920;
const AI_IMAGE_TARGET_BYTES = 4 * 1024 * 1024;
const OPTIMIZED_CHANGE_FLAG = "cohanAiOptimizedChange";
const TABLE_TYPE_LABELS = {
  "round-table": "Bàn tròn",
  "rect-2-seat": "Bàn chữ nhật 2 chỗ",
  "rect-4-seat": "Bàn chữ nhật 4 chỗ",
  "vip-table": "Bàn VIP",
  "booth-sofa": "Booth / sofa",
  "bar-table": "Bàn bar",
  "outdoor-table": "Bàn ngoài trời",
};

let guideSequence = 0;

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

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

const replaceInputFile = (input, file) => {
  if (typeof DataTransfer === "function") {
    const transfer = new DataTransfer();
    if (file) transfer.items.add(file);
    input.files = transfer.files;
    return;
  }

  Object.defineProperty(input, "files", {
    configurable: true,
    value: file ? [file] : [],
  });
};

const dispatchOptimizedChange = (input, file) => {
  replaceInputFile(input, file);
  input.dataset[OPTIMIZED_CHANGE_FLAG] = "true";
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const isAiSection = (section) =>
  normalizeText(
    section?.querySelector(".custom-table-builder__section-heading h4")
      ?.textContent,
  ).includes("tao mau bang ai");

const prepareAiMetadataSection = (section) => {
  if (!section || section.dataset.cohanAiMetadataSimplified === "true") return;
  if (!isAiSection(section)) return;

  const grid = section.querySelector(":scope > .custom-table-builder__grid");
  if (!grid) return;

  const fields = Array.from(grid.children).filter((child) =>
    child.classList?.contains("custom-table-builder__field"),
  );
  if (!fields.length) return;

  fields.forEach((field) => {
    const label = field.querySelector(":scope > .custom-table-builder__label");
    const normalizedLabel = normalizeText(label?.textContent);

    if (HIDDEN_AI_FIELD_LABELS.has(normalizedLabel)) {
      field.hidden = true;
      field.dataset.cohanAiHiddenField = normalizedLabel;
      return;
    }

    if (normalizedLabel === "ten mau") {
      label.textContent = "Tên mẫu (không bắt buộc)";
      const input = field.querySelector("input");
      if (input) input.placeholder = "Ví dụ: Bàn gỗ 4 chỗ";
      return;
    }

    if (normalizedLabel === "loai ban") {
      const select = field.querySelector("select");
      select?.querySelectorAll("option").forEach((option) => {
        option.textContent = TABLE_TYPE_LABELS[option.value] || option.textContent;
      });
      return;
    }

    if (normalizedLabel === "suc chua") {
      label.textContent = "Số chỗ ngồi";
      const input = field.querySelector("input");
      if (input) input.inputMode = "numeric";
    }
  });

  grid.classList.add("cohan-ai-metadata-grid");

  const note = createElement("div", "cohan-ai-metadata-note");
  const noteTitle = createElement(
    "strong",
    "cohan-ai-metadata-note__title",
    "Hi3D tạo model trực tiếp từ 5 ảnh",
  );
  const noteText = createElement(
    "p",
    "cohan-ai-metadata-note__text",
    "Ảnh lớn sẽ tự giảm còn tối đa 1920px và được nén trước khi gửi. Hi3D không nhận prompt và không trả loại bàn hoặc số chỗ ngồi; COHAN chỉ giữ hai thông tin này để lưu mẫu đúng.",
  );
  note.append(noteTitle, noteText);
  grid.insertAdjacentElement("beforebegin", note);

  section.dataset.cohanAiMetadataSimplified = "true";
};

const prepareAllAiMetadataSections = () => {
  document
    .querySelectorAll(AI_SECTION_SELECTOR)
    .forEach(prepareAiMetadataSection);
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

const prepareAll = () => {
  prepareAllAiMetadataSections();
  prepareAllCaptureCards();
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
    status.textContent = "Đã tối ưu";
    fileName.textContent = `${file.name} · ${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    fileName.hidden = false;
  };

  const showCompressionState = (card, message, isError = false) => {
    const shell = card?.querySelector(":scope > .cohan-guided-capture__shell");
    const button = shell?.querySelector(".cohan-guided-capture__button");
    const status = shell?.querySelector(".cohan-guided-capture__status");
    const fileName = shell?.querySelector(".cohan-guided-capture__filename");
    if (!button || !status || !fileName) return;

    button.disabled = !isError;
    button.textContent = isError ? "Chụp lại" : "Đang tối ưu...";
    status.textContent = message;
    fileName.textContent = isError ? message : "Giảm độ phân giải và dung lượng trước khi gửi";
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

  const handleCompressionChange = async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches(INPUT_SELECTOR)) {
      return;
    }

    if (input.dataset[OPTIMIZED_CHANGE_FLAG] === "true") {
      delete input.dataset[OPTIMIZED_CHANGE_FLAG];
      return;
    }

    const file = input.files?.[0];
    if (!file) return;

    const card = input.closest(CARD_SELECTOR);
    if (!card) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();

    dispatchOptimizedChange(input, null);
    showCompressionState(card, "Đang tối ưu ảnh");

    try {
      const optimizedFile = await compressImageForUpload(file, {
        maxDimension: AI_IMAGE_MAX_DIMENSION,
        targetMaxBytes: AI_IMAGE_TARGET_BYTES,
        quality: 0.82,
        keepSmallOriginal: true,
      });
      dispatchOptimizedChange(input, optimizedFile);
    } catch (error) {
      showCompressionState(
        card,
        error?.message || "Không thể tối ưu ảnh này. Vui lòng chụp lại.",
        true,
      );
    }
  };

  const handleChange = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.matches(INPUT_SELECTOR)) {
      return;
    }

    const card = input.closest(CARD_SELECTOR);
    if (!card) return;
    updatePreview(card, input.files?.[0] || null);
    const button = card.querySelector(".cohan-guided-capture__button");
    if (button) button.disabled = false;
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
    prepareAll();
  });

  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleCompressionChange, true);
  document.addEventListener("change", handleChange);
  observer.observe(document.body, { childList: true, subtree: true });
  prepareAll();

  const cleanup = () => {
    observer.disconnect();
    document.removeEventListener("click", handleClick);
    document.removeEventListener("change", handleCompressionChange, true);
    document.removeEventListener("change", handleChange);
    objectUrls.forEach((url) => URL.revokeObjectURL?.(url));
    objectUrls.clear();
    delete window[INSTALL_KEY];
  };

  window[INSTALL_KEY] = cleanup;
  return cleanup;
};
