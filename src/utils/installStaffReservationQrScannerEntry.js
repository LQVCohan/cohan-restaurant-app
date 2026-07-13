const STAFF_SCAN_URL = "/scan-table?source=staff";
const STAFF_ORDER_URL = "/staff/orders";

const qrIcon = (size = 20) => `
  <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 3h6v6H3V3Zm12 0h6v6h-6V3ZM3 15h6v6H3v-6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M15 15h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z" fill="currentColor"/>
  </svg>
`;

const arrowIcon = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`;

function createLink({ className, href, label, title, iconSize = 20 }) {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.setAttribute("aria-label", label);
  link.title = title || label;
  link.innerHTML = `${qrIcon(iconSize)}<span>${label}</span>`;
  return link;
}

function addStaffHeaderLauncher(root) {
  if (!window.location.pathname.startsWith("/staff")) return;
  const portalActions = root.querySelector(".staff-shell__portal-actions");
  if (!portalActions || portalActions.querySelector(".staff-reservation-qr-launcher")) {
    return;
  }

  const launcher = createLink({
    className: "staff-reservation-qr-launcher",
    href: STAFF_SCAN_URL,
    label: "Quét QR đặt bàn",
    title: "Quét mã QR đặt bàn của khách",
  });
  portalActions.prepend(launcher);
}

function addStaffDashboardCard(root) {
  if (window.location.pathname !== "/staff/dashboard") return;
  const grid = root.querySelector(".staff-dashboard-action-grid");
  if (!grid || grid.querySelector(".staff-reservation-qr-dashboard-action")) {
    return;
  }

  const card = document.createElement("a");
  card.className =
    "staff-dashboard-action staff-reservation-qr-dashboard-action is-emphasis";
  card.href = STAFF_SCAN_URL;
  card.setAttribute("aria-label", "Quét QR đặt bàn của khách");
  card.innerHTML = `
    <span class="staff-dashboard-action__icon" aria-hidden="true">${qrIcon(20)}</span>
    <span class="staff-dashboard-action__copy">
      <strong>Quét QR đặt bàn</strong>
      <small>Nhận khách và mở bàn nhanh</small>
    </span>
    <span class="staff-dashboard-action__arrow" aria-hidden="true">${arrowIcon}</span>
  `;
  grid.prepend(card);
}

function decorateStaffScanner(root) {
  const params = new URLSearchParams(window.location.search);
  const isStaffScanner =
    window.location.pathname === "/scan-table" && params.get("source") === "staff";

  document.documentElement.classList.toggle(
    "staff-reservation-qr-scanner-mode",
    isStaffScanner,
  );
  if (!isStaffScanner) return;

  const container = root.querySelector(".table-qr-scanner__container");
  if (!container) return;

  if (!container.querySelector(".staff-reservation-qr-returnbar")) {
    const returnBar = document.createElement("div");
    returnBar.className = "staff-reservation-qr-returnbar";
    returnBar.innerHTML = `
      <a href="${STAFF_ORDER_URL}" aria-label="Quay lại khu vực order nhân viên">
        <span aria-hidden="true">←</span>
        Quay lại khu nhân viên
      </a>
      <span>Tiếp nhận khách đặt bàn</span>
    `;
    container.prepend(returnBar);
  }

  const intro = container.querySelector(".table-qr-scanner__intro");
  if (intro && intro.dataset.staffReservationQrCopy !== "1") {
    intro.dataset.staffReservationQrCopy = "1";
    const eyebrow = intro.querySelector(".table-qr-scanner__eyebrow");
    const title = intro.querySelector("h1");
    const description = intro.querySelector("p:not(.table-qr-scanner__eyebrow)");
    if (eyebrow) eyebrow.textContent = "Tiếp nhận khách đặt bàn";
    if (title) title.textContent = "Quét QR đặt bàn của khách";
    if (description) {
      description.textContent =
        "Đưa mã QR khách cung cấp vào khung. Hệ thống sẽ kiểm tra lịch đặt, nhận khách và mở phiên bàn theo đúng quyền nhân viên.";
    }
  }

  const successFeedback = container.querySelector(
    ".table-qr-scanner__feedback--success",
  );
  if (
    successFeedback &&
    !successFeedback.nextElementSibling?.classList.contains(
      "staff-reservation-qr-success-actions",
    )
  ) {
    const actions = document.createElement("div");
    actions.className = "staff-reservation-qr-success-actions";
    actions.innerHTML = `
      <a class="is-primary" href="${STAFF_ORDER_URL}">Mở khu order</a>
      <a href="${STAFF_SCAN_URL}">Quét mã tiếp theo</a>
    `;
    successFeedback.insertAdjacentElement("afterend", actions);
  }
}

function applyStaffReservationQrUi() {
  addStaffHeaderLauncher(document);
  addStaffDashboardCard(document);
  decorateStaffScanner(document);
}

export function installStaffReservationQrScannerEntry() {
  if (
    typeof window === "undefined" ||
    window.__cohanStaffReservationQrScannerEntryInstalled
  ) {
    return;
  }

  window.__cohanStaffReservationQrScannerEntryInstalled = true;
  let frame = null;
  const schedule = () => {
    if (frame != null) return;
    frame = window.requestAnimationFrame(() => {
      frame = null;
      applyStaffReservationQrUi();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", schedule);
  window.addEventListener("hashchange", schedule);
  schedule();
}
