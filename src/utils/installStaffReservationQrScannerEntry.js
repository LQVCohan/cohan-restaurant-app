import React from "react";
import { createRoot } from "react-dom/client";
import StaffReservationQrScanner from "@/components/Staff/StaffReservationQrScanner";

const STAFF_SCAN_URL = "/scan-table?source=staff";
const STAFF_SCANNER_HOST_ID = "cohan-staff-reservation-scanner-root";
const CUSTOMER_SCANNER_HIDDEN_CLASS =
  "staff-reservation-qr-customer-scanner-hidden";

let scannerRoot = null;

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

function isStaffScannerRoute() {
  const params = new URLSearchParams(window.location.search);
  return (
    window.location.pathname === "/scan-table" && params.get("source") === "staff"
  );
}

export function resolveStaffScannerMountTarget(root = document) {
  return (
    root.querySelector("#root .mobile-customer-shell__main") ||
    root.querySelector("#root") ||
    root.body
  );
}

function findCustomerScanner(root = document) {
  return root.querySelector(
    "#root .table-qr-scanner:not(.staff-reservation-scanner-overlay)",
  );
}

function restoreCustomerScanner(root = document) {
  root
    .querySelectorAll(`.${CUSTOMER_SCANNER_HIDDEN_CLASS}`)
    .forEach((scanner) => {
      scanner.hidden = false;
      scanner.classList.remove(CUSTOMER_SCANNER_HIDDEN_CLASS);
      scanner.removeAttribute("aria-hidden");
      scanner.removeAttribute("inert");
    });
}

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

function unmountStaffScanner() {
  restoreCustomerScanner();
  if (scannerRoot) {
    scannerRoot.unmount();
    scannerRoot = null;
  }
  document.getElementById(STAFF_SCANNER_HOST_ID)?.remove();
}

function mountStaffScanner() {
  const active = isStaffScannerRoute();

  // The old implementation toggled a global selector that hid every scanner
  // inside #root. The staff scanner is now mounted in the route content itself,
  // so only the customer scanner being replaced should be hidden.
  document.documentElement.classList.remove("staff-reservation-qr-scanner-mode");

  if (!active) {
    unmountStaffScanner();
    return;
  }

  const customerScanner = findCustomerScanner();
  if (customerScanner) {
    customerScanner.hidden = true;
    customerScanner.classList.add(CUSTOMER_SCANNER_HIDDEN_CLASS);
    customerScanner.setAttribute("aria-hidden", "true");
    customerScanner.setAttribute("inert", "");
  }

  const mountTarget = resolveStaffScannerMountTarget();
  let host = document.getElementById(STAFF_SCANNER_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = STAFF_SCANNER_HOST_ID;
  }

  // Keep the scanner inside MobileCustomerShell.__main. Appending it to body
  // placed it after a 100dvh shell, which produced a blank first screen on mobile.
  if (host.parentElement !== mountTarget) {
    mountTarget.append(host);
  }

  if (!scannerRoot) {
    scannerRoot = createRoot(host);
    scannerRoot.render(React.createElement(StaffReservationQrScanner));
  }
}

function applyStaffReservationQrUi() {
  addStaffHeaderLauncher(document);
  addStaffDashboardCard(document);
  mountStaffScanner();
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