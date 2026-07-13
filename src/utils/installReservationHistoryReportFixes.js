import { gql } from "@apollo/client";
import { apolloClient } from "@/apollo/client";

const RESERVATION_HISTORY_QC = gql`
  query ReservationHistoryQc($limit: Int = 100) {
    myReservations(limit: $limit) {
      id
      orderCode
      restaurantName
      tableId
      tableCode
      tableName
      timeTo
      depositAmount
      depositStatus
      status
      hasUserOverlap
      overlapReservationCodes
      canCheckIn
      checkInQrDataUrl
    }
  }
`;

let historyPromise = null;
let observer = null;

const normalizeCode = (value) => String(value || "").replace(/^#/, "").trim();

function createInfoCell(label, value) {
  const cell = document.createElement("div");
  cell.className = "info-cell reservation-qc-cell";
  const labelNode = document.createElement("span");
  labelNode.className = "label";
  labelNode.textContent = label;
  const valueNode = document.createElement("span");
  valueNode.className = "value";
  valueNode.textContent = value;
  cell.append(labelNode, valueNode);
  return cell;
}

function openCheckInDialog(reservation) {
  document.querySelector(".reservation-checkin-overlay")?.remove();
  const overlay = document.createElement("div");
  overlay.className = "reservation-checkin-overlay";
  overlay.setAttribute("role", "presentation");

  const panel = document.createElement("section");
  panel.className = "reservation-checkin-dialog";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "reservation-checkin-title");

  const close = document.createElement("button");
  close.type = "button";
  close.className = "reservation-checkin-close";
  close.setAttribute("aria-label", "Đóng mã check-in");
  close.textContent = "×";

  const title = document.createElement("h2");
  title.id = "reservation-checkin-title";
  title.textContent = "Mã QR check-in đặt bàn";

  const description = document.createElement("p");
  description.textContent = "Đưa mã này cho nhân viên quét khi bạn đến nhà hàng.";

  const image = document.createElement("img");
  image.src = reservation.checkInQrDataUrl;
  image.alt = `Mã QR check-in ${reservation.orderCode || reservation.id}`;

  const meta = document.createElement("div");
  meta.className = "reservation-checkin-meta";
  const tableLabel = reservation.tableName || reservation.tableCode || "Bàn đã đặt";
  meta.textContent = `${reservation.orderCode || reservation.id} • ${tableLabel}`;

  const closeDialog = () => overlay.remove();
  close.addEventListener("click", closeDialog);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeDialog();
  });
  document.addEventListener("keydown", function onEscape(event) {
    if (event.key !== "Escape" || !overlay.isConnected) return;
    document.removeEventListener("keydown", onEscape);
    closeDialog();
  });

  panel.append(close, title, description, image, meta);
  overlay.append(panel);
  document.body.append(overlay);
  close.focus();
}

function patchReservationCard(card, reservation) {
  if (!card || !reservation) return;
  card.dataset.reservationQc = reservation.id;

  const infoGrid = card.querySelector(".info-grid");
  if (infoGrid && !infoGrid.querySelector(".reservation-qc-cell")) {
    infoGrid.append(createInfoCell("Bàn", reservation.tableName || reservation.tableCode || "Đang cập nhật"));
  }

  card.querySelectorAll(".info-cell").forEach((cell) => {
    const label = cell.querySelector(".label")?.textContent?.trim();
    if (label !== "Tiền cọc") return;
    const value = cell.querySelector(".value");
    if (value && Number(reservation.depositAmount || 0) <= 0) value.textContent = "Miễn phí";
  });

  card.querySelectorAll(".btn-action").forEach((button) => {
    if (button.textContent?.trim() === "Thanh toán cọc" && Number(reservation.depositAmount || 0) <= 0) {
      button.remove();
    }
  });

  const cardBody = card.querySelector(".card-body");
  if (reservation.hasUserOverlap && cardBody && !cardBody.querySelector(".reservation-overlap-warning")) {
    const warning = document.createElement("div");
    warning.className = "reservation-overlap-warning";
    warning.setAttribute("role", "alert");
    const codes = (reservation.overlapReservationCodes || []).join(", ");
    warning.textContent = `Lịch này trùng giờ với ${codes || "một lịch đặt bàn khác"}. Vui lòng đổi hoặc hủy một lịch.`;
    cardBody.prepend(warning);
  }

  const actions = card.querySelector(".action-group");
  if (reservation.canCheckIn && reservation.checkInQrDataUrl && actions && !actions.querySelector(".btn-checkin-qr")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-action btn-primary btn-checkin-qr";
    button.textContent = "Mã QR check-in";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openCheckInDialog(reservation);
    });
    actions.prepend(button);
  }
}

function patchOpenReceipt(reservations) {
  const modal = document.querySelector(".reservation-receipt-modal");
  if (!modal) return;
  const code = normalizeCode(modal.querySelector(".receipt-summary-card strong")?.textContent);
  const reservation = reservations.find((item) => normalizeCode(item.orderCode || item.id) === code);
  if (!reservation) return;

  modal.querySelectorAll(".detail-row").forEach((row) => {
    const label = row.querySelector(".detail-label")?.textContent?.trim();
    const value = row.querySelector(".detail-value");
    if (!value) return;
    if (label === "Bàn") value.textContent = reservation.tableName || reservation.tableCode || value.textContent;
    if (label === "Tiền cọc" && Number(reservation.depositAmount || 0) <= 0) value.textContent = "Miễn phí";
  });
  const amount = modal.querySelector(".receipt-summary-amount strong");
  if (amount && Number(reservation.depositAmount || 0) <= 0) amount.textContent = "Miễn phí";
}

async function patchPage() {
  const page = document.querySelector(".orders-page");
  if (!page) return;
  historyPromise ||= apolloClient.query({
    query: RESERVATION_HISTORY_QC,
    variables: { limit: 100 },
    fetchPolicy: "network-only",
  }).then((result) => result?.data?.myReservations || []).catch(() => []);

  const reservations = await historyPromise;
  const byCode = new Map(reservations.map((item) => [normalizeCode(item.orderCode || item.id), item]));
  page.querySelectorAll(".order-card--reservation").forEach((card) => {
    const code = normalizeCode(card.querySelector(".order-id")?.textContent);
    patchReservationCard(card, byCode.get(code));
  });
  patchOpenReceipt(reservations);
}

export function installReservationHistoryReportFixes() {
  if (typeof window === "undefined" || observer) return;
  const schedule = () => window.requestAnimationFrame(() => patchPage());
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("popstate", () => {
    historyPromise = null;
    schedule();
  });
  schedule();
}
