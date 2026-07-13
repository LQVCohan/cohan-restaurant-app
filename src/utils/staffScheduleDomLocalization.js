const INSTALL_FLAG = "__cohanStaffScheduleDomLocalizationInstalled";
const NO_TRANSLATE_ATTRIBUTE = "data-staff-schedule-no-translate";
const RESTAURANT_NAME_ATTRIBUTE = "data-staff-schedule-restaurant-name";

const translateWithCase = (value, pattern, lowerLabel, upperLabel) =>
  value.replace(pattern, (match) =>
    match.charAt(0) === match.charAt(0).toUpperCase()
      ? upperLabel
      : lowerLabel,
  );

export function translateStaffScheduleText(value) {
  let translated = String(value ?? "");
  translated = translateWithCase(
    translated,
    /availability/gi,
    "lịch khả dụng",
    "Lịch khả dụng",
  );
  translated = translateWithCase(
    translated,
    /check-in/gi,
    "chấm công vào ca",
    "Chấm công vào ca",
  );
  translated = translateWithCase(
    translated,
    /check-out/gi,
    "chấm công kết thúc ca",
    "Chấm công kết thúc ca",
  );
  return translated;
}

const getDocument = (root) => {
  if (!root) return null;
  if (root.nodeType === 9) return root;
  return root.ownerDocument || null;
};

const getTextNodes = (root) => {
  const doc = getDocument(root);
  if (!doc?.createTreeWalker) return [];

  const showText = doc.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
  const walker = doc.createTreeWalker(root, showText);
  const nodes = [];
  let current = walker.nextNode();

  while (current) {
    nodes.push(current);
    current = walker.nextNode();
  }

  return nodes;
};

export function resolveStaffShellRestaurantName(root = document) {
  const shellLabel = root?.querySelector?.(
    ".staff-shell__identity-copy small",
  );
  const rawLabel = String(shellLabel?.textContent || "").trim();
  const restaurantName = rawLabel.split("•")[0]?.trim() || "";

  if (!restaurantName || restaurantName === "Chưa xác định cơ sở làm việc") {
    return "";
  }

  return restaurantName;
}

const replaceRestaurantIds = (page, restaurantName) => {
  if (!restaurantName) return false;

  let changed = false;
  getTextNodes(page).forEach((node) => {
    const currentValue = String(node.nodeValue || "");
    if (!/^\s*Nhà hàng:\s*/.test(currentValue)) return;

    const leadingWhitespace = currentValue.match(/^\s*/)?.[0] || "";
    const trailingWhitespace = currentValue.match(/\s*$/)?.[0] || "";
    const nextValue = `${leadingWhitespace}Nhà hàng: ${restaurantName}${trailingWhitespace}`;

    if (node.nodeValue !== nextValue) {
      node.nodeValue = nextValue;
      changed = true;
    }

    const parentElement = node.parentElement;
    if (
      parentElement &&
      !parentElement.hasAttribute(NO_TRANSLATE_ATTRIBUTE)
    ) {
      parentElement.setAttribute(NO_TRANSLATE_ATTRIBUTE, "true");
      parentElement.setAttribute(RESTAURANT_NAME_ATTRIBUTE, "true");
      changed = true;
    }
  });

  return changed;
};

const ensureRestaurantBadge = (page, restaurantName) => {
  if (!restaurantName) return false;

  const meta = page.querySelector(".staff-schedule-hero__meta");
  if (!meta) return false;

  let badge = meta.querySelector(`[${RESTAURANT_NAME_ATTRIBUTE}="hero"]`);
  let changed = false;

  if (!badge) {
    badge = page.ownerDocument.createElement("span");
    badge.setAttribute(RESTAURANT_NAME_ATTRIBUTE, "hero");
    badge.setAttribute(NO_TRANSLATE_ATTRIBUTE, "true");
    meta.prepend(badge);
    changed = true;
  }

  const nextLabel = `Nhà hàng: ${restaurantName}`;
  if (badge.textContent !== nextLabel) {
    badge.textContent = nextLabel;
    changed = true;
  }

  return changed;
};

const translateTextNodes = (root) => {
  let changed = false;

  getTextNodes(root).forEach((node) => {
    const parentElement = node.parentElement;
    if (!parentElement) return;
    if (parentElement.closest(`[${NO_TRANSLATE_ATTRIBUTE}]`)) return;
    if (parentElement.closest("script, style")) return;

    const nextValue = translateStaffScheduleText(node.nodeValue);
    if (nextValue !== node.nodeValue) {
      node.nodeValue = nextValue;
      changed = true;
    }
  });

  return changed;
};

const translateElementAttributes = (root) => {
  const attributes = ["aria-label", "title", "placeholder"];
  const elements = [root, ...root.querySelectorAll("*")];
  let changed = false;

  elements.forEach((element) => {
    if (element.closest?.(`[${NO_TRANSLATE_ATTRIBUTE}]`)) return;

    attributes.forEach((attribute) => {
      if (!element.hasAttribute?.(attribute)) return;
      const currentValue = element.getAttribute(attribute);
      const nextValue = translateStaffScheduleText(currentValue);
      if (nextValue !== currentValue) {
        element.setAttribute(attribute, nextValue);
        changed = true;
      }
    });
  });

  return changed;
};

export function localizeStaffScheduleDom(root = document) {
  const page = root?.querySelector?.(".staff-schedule-page");
  if (!page) return false;

  const restaurantName = resolveStaffShellRestaurantName(root);
  let changed = false;

  changed = replaceRestaurantIds(page, restaurantName) || changed;
  changed = ensureRestaurantBadge(page, restaurantName) || changed;
  changed = translateTextNodes(page) || changed;
  changed = translateElementAttributes(page) || changed;

  const staffSubtitle = root.querySelector?.(".staff-shell__subtitle");
  if (staffSubtitle) {
    changed = translateTextNodes(staffSubtitle) || changed;
    changed = translateElementAttributes(staffSubtitle) || changed;
  }

  return changed;
}

export function installStaffScheduleDomLocalization() {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof MutationObserver === "undefined"
  ) {
    return;
  }

  const start = () => {
    if (window[INSTALL_FLAG] || !document.documentElement) return;

    let scheduled = false;
    const run = () => {
      scheduled = false;
      localizeStaffScheduleDom(document);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      if (typeof queueMicrotask === "function") {
        queueMicrotask(run);
      } else {
        Promise.resolve().then(run);
      }
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window[INSTALL_FLAG] = { observer, schedule };
    schedule();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

installStaffScheduleDomLocalization();
