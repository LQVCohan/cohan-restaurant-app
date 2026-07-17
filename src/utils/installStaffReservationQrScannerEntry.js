import React from "react";
import { createRoot } from "react-dom/client";
import StaffReservationQrScanner from "@/components/Staff/StaffReservationQrScanner";

export const STAFF_SCAN_URL = "/staff/orders?scanner=reservation";
const LEGACY_STAFF_SCAN_PATH = "/scan-table";
const STAFF_SCANNER_HOST_ID = "cohan-staff-reservation-scanner-root";

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

export function isStaffScannerLocation(locationLike = window.location) {
  const params = new URLSearchParams(locationLike?.search || "");
  return (
    locationLike?.pathname === "/staff/orders" &&
    params.get("scanner") === "reservation"
  );
}

export function isLegacyStaffScannerLocation(locationLike = window.location) {
  const params = new URLSearchParams(locationLike?.search || "");
  return (
    locationLike?.pathname === LEGACY_STAFF_SCAN_PATH &&
    params.get("source") === "staff"
  );
}

function createPopStateEvent() {
  if (typeof PopStateEvent === "function") {
    return new PopStateEvent("popstate", { state: window.history.state });
  }
  return new Event("popstate");
}

export function navigateWithinApp(href, { replace = false } = {}) {
  if (typeof window === "undefined") return false;

  let target;
  try {
    target = new URL(href, window.location.href);
  } catch {
    return false;
  }

  if (target.origin !== window.location.origin) return false;

  const nextPath = `${target.pathname}${target.search}${target.hash}`;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextPath === currentPath) return true;

  const method = replace ? "replaceState" : "pushState";
  window.history[method](window.history.state, "", nextPath);
  window.dispatchEvent(createPopStateEvent());
  return true;
}

function shouldHandleInternalAnchorClick(event, anchor) {
  if (!anchor || event.defaultPrevented) return false;
  if (typeof event.button === "number" && event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (anchor.hasAttribute("download")) return false;
  const target = String(anchor.getAttribute("target") || "").toLowerCase();
  if (target && target !== "_self") return false;

  try {
    return new URL(anchor.href, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function attachInternalNavigation(anchor) {
  anchor.addEventListener("click", (event) => {
    if (!shouldHandleInternalAnchorClick(event, anchor)) return;
    event.preventDefault();
    navigateWithinApp(anchor.href);
  });
  return anchor;
}

function normalizeLegacyStaffScannerRoute() {
  if (!isLegacyStaffScannerLocation()) return false;
  return navigateWithinApp(STAFF_SCAN_URL, { replace: true });
}

function createLink({ className, href, label, title, iconSize = 20 }) {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.setAttribute("aria-label", label);
  link.title = title || label;
  link.innerHTML = `${qrIcon(iconSize)}<span>${label}</span>`;
  return attachInternalNavigation(link);
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
  grid.prepend(attachInternalNavigation(card));
}

function bindScannerInternalNavigation(host) {
  if (host.dataset.internalNavigationBound === "true") return;
  host.dataset.internalNavigationBound = "true";
  host.addEventListener("click", (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor || !host.contains(anchor)) return;
    if (!shouldHandleInternalAnchorClick(event, anchor)) return;
    event.preventDefault();
    navigateWithinApp(anchor.href);
  });
}

function mountStaffScanner() {
  const active = isStaffScannerLocation();
  document.documentElement.classList.toggle(
    "staff-reservation-qr-scanner-mode",
    active,
  );

  if (!active) {
    if (scannerRoot) {
      scannerRoot.unmount();
      scannerRoot = null;
    }
    document.getElementById(STAFF_SCANNER_HOST_ID)?.remove();
    return;
  }

  let host = document.getElementById(STAFF_SCANNER_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = STAFF_SCANNER_HOST_ID;
    bindScannerInternalNavigation(host);
    document.body.append(host);
  }

  if (!scannerRoot) {
    scannerRoot = createRoot(host);
    scannerRoot.render(React.createElement(StaffReservationQrScanner));
  }
}

function applyStaffReservationQrUi() {
  if (normalizeLegacyStaffScannerRoute()) return;
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
