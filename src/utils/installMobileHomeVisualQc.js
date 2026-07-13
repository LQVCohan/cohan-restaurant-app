const HOME_SELECTOR = ".mobile-home";
const PRICE_SELECTOR = `${HOME_SELECTOR} .res-card__price`;
const IMAGE_SELECTOR = `${HOME_SELECTOR} .res-card__img`;
const FALLBACK_IMAGE = "/cohan_logo_icon.svg";
const OBSERVER_KEY = "__cohanMobileHomeVisualQcObserver";

const vndNumberFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const parsePriceNumber = (value) => {
  const normalized = normalizeText(value)
    .replace(/^từ\s+/i, "")
    .replace(/\s*(?:vnd|vnđ|₫|đ)\s*$/i, "")
    .trim();

  if (!/^\d[\d.,\s]*$/.test(normalized)) return null;
  const digits = normalized.replace(/\D/g, "");
  if (!digits) return null;

  const number = Number(digits);
  return Number.isFinite(number) ? number : null;
};

export const formatRestaurantPriceText = (value) => {
  const original = normalizeText(value);
  if (!original) return "";

  const withoutCurrency = original
    .replace(/^từ\s+/i, "")
    .replace(/\s*(?:vnd|vnđ|₫|đ)\s*$/i, "")
    .trim();
  const rangeParts = withoutCurrency.split(/\s*[-–—]\s*/);

  if (rangeParts.length === 1) {
    const amount = parsePriceNumber(rangeParts[0]);
    return amount == null ? original : `${vndNumberFormatter.format(amount)} ₫`;
  }

  if (rangeParts.length === 2) {
    const lower = parsePriceNumber(rangeParts[0]);
    const upper = parsePriceNumber(rangeParts[1]);
    if (lower == null || upper == null) return original;
    return `${vndNumberFormatter.format(lower)}–${vndNumberFormatter.format(upper)} ₫`;
  }

  return original;
};

const formatPriceElement = (element) => {
  if (!(element instanceof HTMLElement)) return;
  const formatted = formatRestaurantPriceText(element.textContent);
  if (formatted && formatted !== normalizeText(element.textContent)) {
    element.textContent = formatted;
  }
};

const applyImageFallback = (image) => {
  if (!(image instanceof HTMLImageElement)) return;
  if (image.dataset.cohanFallbackApplied === "true") return;

  image.dataset.cohanFallbackApplied = "true";
  image.classList.add("is-fallback");
  image.alt = "Ảnh minh họa nhà hàng";
  image.src = FALLBACK_IMAGE;
};

const prepareImage = (image) => {
  if (!(image instanceof HTMLImageElement)) return;
  if (image.dataset.cohanImageRepairBound === "true") return;

  image.dataset.cohanImageRepairBound = "true";
  image.addEventListener("error", () => applyImageFallback(image), { once: true });

  if (image.complete && image.naturalWidth === 0) {
    applyImageFallback(image);
  }
};

const syncVisuals = (root) => {
  root.querySelectorAll(PRICE_SELECTOR).forEach(formatPriceElement);
  root.querySelectorAll(IMAGE_SELECTOR).forEach(prepareImage);
};

export const installMobileHomeVisualQc = ({ root = document } = {}) => {
  if (!root || typeof MutationObserver === "undefined") return () => {};

  if (typeof window !== "undefined") {
    window[OBSERVER_KEY]?.disconnect?.();
  }

  syncVisuals(root);

  let scheduled = false;
  const scheduleSync = () => {
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      syncVisuals(root);
    };

    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  };

  const observer = new MutationObserver(scheduleSync);
  observer.observe(root.body || root, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  if (typeof window !== "undefined") {
    window[OBSERVER_KEY] = observer;
  }

  return () => {
    observer.disconnect();
    if (typeof window !== "undefined" && window[OBSERVER_KEY] === observer) {
      delete window[OBSERVER_KEY];
    }
  };
};

export const __testables = {
  FALLBACK_IMAGE,
  OBSERVER_KEY,
  parsePriceNumber,
};

export default installMobileHomeVisualQc;
