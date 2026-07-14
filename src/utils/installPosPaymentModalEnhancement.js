const INSTALL_KEY = "__cohanPosPaymentModalEnhancementInstalled";
const TITLE_PATTERN = /thanh\s*toán\s*hóa\s*đơn/i;
const PAYMENT_LINK_PATTERN = /mở\s+(trang|ứng dụng)\s+thanh\s+toán/i;
const METHOD_LABELS = new Set([
  "tiền mặt",
  "thẻ",
  "chuyển khoản",
  "momo",
  "vnpay",
]);

const normalizeText = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

function findTitle(dialog) {
  return Array.from(dialog.querySelectorAll("h1, h2, h3, h4")).find((node) =>
    TITLE_PATTERN.test(node.textContent || ""),
  );
}

function findModalSurface(dialog, title) {
  if (!title) return null;
  const directSurface = title.closest("div");
  if (directSurface && dialog.contains(directSurface)) return directSurface;
  return dialog.firstElementChild || null;
}

function markSemanticRegions(surface) {
  const directChildren = Array.from(surface.children || []);
  const content = directChildren.find((node) => {
    const text = normalizeText(node.textContent);
    return text.includes("chi tiết hóa đơn") && text.includes("chọn phương thức");
  });

  if (content) {
    content.dataset.cohanPaymentContent = "true";
    if (content.children?.[0]) content.children[0].dataset.cohanPaymentItems = "true";
    if (content.children?.[1]) content.children[1].dataset.cohanPaymentControls = "true";
  }

  const buttons = Array.from(surface.querySelectorAll("button"));
  const methodButtons = buttons.filter((button) =>
    METHOD_LABELS.has(normalizeText(button.textContent)),
  );
  const methodContainer = methodButtons[0]?.parentElement;
  if (methodContainer && methodButtons.every((button) => button.parentElement === methodContainer)) {
    methodContainer.dataset.cohanPaymentMethods = "true";
  }

  const currencyButtons = buttons.filter((button) =>
    ["vnd", "usd"].includes(normalizeText(button.textContent)),
  );
  const currencyContainer = currencyButtons[0]?.parentElement;
  if (
    currencyContainer &&
    currencyButtons.length === 2 &&
    currencyButtons.every((button) => button.parentElement === currencyContainer)
  ) {
    currencyContainer.dataset.cohanPaymentCurrency = "true";
  }

  const actions = directChildren.find((node) => {
    const text = normalizeText(node.textContent);
    return (
      text.includes("quay lại") &&
      (text.includes("hoàn tất thanh toán") || text.includes("xác nhận"))
    );
  });
  if (actions) actions.dataset.cohanPaymentActions = "true";

  Array.from(surface.querySelectorAll("a[href]")).forEach((link) => {
    if (!PAYMENT_LINK_PATTERN.test(link.textContent || "")) return;
    link.dataset.cohanPaymentLaunch = "true";
    link.setAttribute("aria-label", `${link.textContent.trim()} trong cửa sổ thanh toán an toàn`);
    const onlinePanel = link.parentElement?.parentElement;
    if (onlinePanel && surface.contains(onlinePanel)) {
      onlinePanel.dataset.cohanPaymentOnlinePanel = "true";
    }
  });
}

function ensureProgress(surface) {
  let progress = surface.querySelector(":scope > [data-cohan-payment-progress]");
  if (progress) return progress;

  progress = document.createElement("section");
  progress.dataset.cohanPaymentProgress = "true";
  progress.hidden = true;
  progress.setAttribute("aria-label", "Tiến trình thanh toán online");
  progress.innerHTML = `
    <div class="cohan-payment-progress__steps" aria-hidden="true">
      <div data-step="created"><span>1</span><b>Tạo giao dịch</b></div>
      <i></i>
      <div data-step="gateway"><span>2</span><b>Thanh toán VNPAY</b></div>
      <i></i>
      <div data-step="verified"><span>3</span><b>COHAN xác nhận</b></div>
    </div>
    <p class="cohan-payment-progress__message" role="status" aria-live="polite"></p>
  `;

  const orderInfo = Array.from(surface.children || []).find((node) => {
    const text = normalizeText(node.textContent);
    return text.startsWith("bàn:") && text.includes("hóa đơn:");
  });
  if (orderInfo?.nextSibling) {
    surface.insertBefore(progress, orderInfo.nextSibling);
  } else {
    surface.insertBefore(progress, surface.children?.[1] || null);
  }
  return progress;
}

function detectOnlineState(surface) {
  const text = normalizeText(surface.textContent);
  const hasLaunchLink = Boolean(surface.querySelector("[data-cohan-payment-launch]"));
  const hasReference = text.includes("mã tham chiếu:");
  const hasOnlineSession = hasLaunchLink || (hasReference && text.includes("số tiền thanh toán"));

  if (!hasOnlineSession) return { active: false, state: "idle", message: "" };
  if (
    text.includes("đã thanh toán") ||
    text.includes("đã nhận thanh toán") ||
    text.includes("hóa đơn đang được hoàn tất")
  ) {
    return {
      active: true,
      state: "success",
      message: "Thanh toán đã được xác nhận. COHAN đang hoàn tất hóa đơn.",
    };
  }
  if (
    text.includes("không thành công") ||
    text.includes("đã hết hạn") ||
    text.includes("lệch số tiền")
  ) {
    return {
      active: true,
      state: "failed",
      message: "Giao dịch chưa hoàn tất. Bạn có thể kiểm tra lại hoặc tạo mã thanh toán mới.",
    };
  }
  if (text.includes("đang chờ xác nhận") || text.includes("đang chờ hệ thống")) {
    return {
      active: true,
      state: "pending",
      message: "Đang chờ VNPAY phản hồi. Không cần bấm xác nhận thêm lần nữa.",
    };
  }
  return {
    active: true,
    state: "ready",
    message: "Mở VNPAY, hoàn tất giao dịch rồi quay lại đây. Trạng thái sẽ tự cập nhật.",
  };
}

function updateProgress(surface) {
  const progress = ensureProgress(surface);
  const status = detectOnlineState(surface);
  progress.hidden = !status.active;
  surface.dataset.cohanOnlinePaymentState = status.state;
  progress.dataset.state = status.state;

  const message = progress.querySelector(".cohan-payment-progress__message");
  if (message && message.textContent !== status.message) message.textContent = status.message;

  const created = progress.querySelector('[data-step="created"]');
  const gateway = progress.querySelector('[data-step="gateway"]');
  const verified = progress.querySelector('[data-step="verified"]');
  [created, gateway, verified].forEach((node) => node?.removeAttribute("data-active"));

  if (!status.active) return;
  created?.setAttribute("data-active", "done");
  if (["ready", "pending", "success", "failed"].includes(status.state)) {
    gateway?.setAttribute(
      "data-active",
      status.state === "success" ? "done" : status.state === "failed" ? "error" : "current",
    );
  }
  if (status.state === "success") verified?.setAttribute("data-active", "done");
  if (status.state === "pending") verified?.setAttribute("data-active", "waiting");
  if (status.state === "failed") verified?.setAttribute("data-active", "error");
}

function enhanceDialog(dialog) {
  if (!(dialog instanceof HTMLElement)) return;
  const title = findTitle(dialog);
  const surface = findModalSurface(dialog, title);
  if (!surface) return;

  dialog.dataset.cohanPosPaymentBackdrop = "true";
  surface.dataset.cohanPosPaymentModal = "true";
  title.dataset.cohanPaymentTitle = "true";
  markSemanticRegions(surface);
  updateProgress(surface);
}

function enhanceAll(root = document) {
  const dialogs = [];
  if (root instanceof HTMLElement && root.matches?.('[role="dialog"]')) dialogs.push(root);
  if (root.querySelectorAll) dialogs.push(...root.querySelectorAll('[role="dialog"]'));
  dialogs.forEach(enhanceDialog);
}

function setPopupStatus(surface, message, state = "pending") {
  const progress = ensureProgress(surface);
  progress.hidden = false;
  progress.dataset.state = state;
  surface.dataset.cohanOnlinePaymentState = state;
  const live = progress.querySelector(".cohan-payment-progress__message");
  if (live) live.textContent = message;
}

function openPaymentWindow(link, surface) {
  const href = link.getAttribute("href");
  if (!href) return;

  const availableWidth = window.screen?.availWidth || window.innerWidth || 1280;
  const availableHeight = window.screen?.availHeight || window.innerHeight || 800;
  const width = Math.max(420, Math.min(820, availableWidth - 48));
  const height = Math.max(620, Math.min(900, availableHeight - 48));
  const left = Math.max(0, Math.round((availableWidth - width) / 2));
  const top = Math.max(0, Math.round((availableHeight - height) / 2));
  const features = [
    "popup=yes",
    "resizable=yes",
    "scrollbars=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
  ].join(",");

  const popup = window.open(href, "cohan-payment-gateway", features);
  if (!popup) {
    setPopupStatus(
      surface,
      "Trình duyệt đang chặn cửa sổ thanh toán. Hãy cho phép pop-up cho COHAN rồi bấm mở lại.",
      "failed",
    );
    return;
  }

  popup.opener = null;
  popup.focus?.();
  setPopupStatus(
    surface,
    "Cổng VNPAY đã được mở trong cửa sổ riêng. Hoàn tất giao dịch rồi quay lại COHAN.",
    "pending",
  );
}

function handlePaymentLinkClick(event) {
  const link = event.target?.closest?.("a[data-cohan-payment-launch]");
  if (!link) return;
  const surface = link.closest('[data-cohan-pos-payment-modal="true"]');
  if (!surface) return;

  event.preventDefault();
  event.stopPropagation();
  openPaymentWindow(link, surface);
}

export function installPosPaymentModalEnhancement() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window[INSTALL_KEY]) return;
  window[INSTALL_KEY] = true;

  let scheduled = false;
  const scheduleEnhance = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      enhanceAll(document);
    });
  };

  enhanceAll(document);
  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["href", "class", "disabled"],
  });
  document.addEventListener("click", handlePaymentLinkClick, true);
}

export default installPosPaymentModalEnhancement;
