const OBSERVER_KEY = "__cohanTableEmptyStateObserver";
const CLICK_HANDLER_KEY = "__cohanTableEmptyStateClickHandler";

const restoreStoredText = (element) => {
  if (!element?.dataset) return;
  const original = element.dataset.tableEmptyOriginalText;
  if (original != null) element.textContent = original;
  delete element.dataset.tableEmptyOriginalText;
  delete element.dataset.tableEmptyOriginalTextEnhanced;
};

const cleanupLegacyEnhancement = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  window[OBSERVER_KEY]?.disconnect?.();
  delete window[OBSERVER_KEY];

  const clickHandler = window[CLICK_HANDLER_KEY];
  if (clickHandler) document.removeEventListener("click", clickHandler, true);
  delete window[CLICK_HANDLER_KEY];

  document
    .querySelectorAll(
      ".tm-setup-note, .tm-empty__eyebrow, .tm-empty__title, .tm-empty__steps",
    )
    .forEach((element) => element.remove());

  document.querySelectorAll(".tm-container--no-floors").forEach((element) => {
    element.classList.remove("tm-container--no-floors");
  });

  document.querySelectorAll(".tm-empty--setup").forEach((element) => {
    element.classList.remove("tm-empty--setup");
    element.removeAttribute("role");
    element.removeAttribute("aria-live");
  });

  document.querySelectorAll(".tm-empty__icon").forEach((element) => {
    element.classList.remove("tm-empty__icon");
  });

  document.querySelectorAll(".tm-empty__message").forEach((element) => {
    element.classList.remove("tm-empty__message");
    restoreStoredText(element);
  });

  document.querySelectorAll(".tm-empty__action").forEach((element) => {
    element.classList.remove("tm-empty__action");
    restoreStoredText(element.querySelector(".btn__text"));
  });

  document.querySelectorAll(".tm-first-floor-action").forEach((element) => {
    element.classList.remove("tm-first-floor-action");
    restoreStoredText(element.querySelector("span"));
  });
};

// Kept under the existing name so Vite HMR runs the cleanup immediately.
export const installTableEmptyStateEnhancement = cleanupLegacyEnhancement;

export const __testables = {
  OBSERVER_KEY,
  CLICK_HANDLER_KEY,
  cleanupLegacyEnhancement,
};
