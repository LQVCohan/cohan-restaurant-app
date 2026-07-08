import { gql } from "@apollo/client";
import { apolloClient } from "@/apollo/client";

const OBSERVER_KEY = "__cohanMergedTableLifecycleUiObserver";
const CARD_CLASS = "cohan-merged-table-card";
const SUMMARY_CLASS = "cohan-merged-table-summary";
const PAYMENT_CLASS = "cohan-merged-payment-customers";

const TABLES_QUERY = gql`
  query MergedTableLifecycleUi($restaurantId: ID!) {
    tables(restaurantId: $restaurantId, limit: 500) {
      id
      code
      capacity
      status
      joinGroupId
      mergedFromTableIds
      mergeAnchorTableId
      mergeDetails
    }
  }
`;

const normalize = (value) => String(value || "").trim();
const normalizeKey = (value) => normalize(value).toLowerCase();

const getRestaurantSelect = () =>
  document.querySelector('select[class*="restaurantSelect"]');

const getRestaurantId = () => normalize(getRestaurantSelect()?.value);

const getTableCards = () =>
  Array.from(
    document.querySelectorAll('[class*="tablesGrid"] [class*="tableItem"]'),
  ).filter((card) => card.querySelector('[class*="tableCode"]'));

const getCardCode = (card) =>
  normalize(card.querySelector('[class*="tableCode"]')?.textContent);

const formatMoney = (value) =>
  `${Math.round(Math.max(0, Number(value) || 0)).toLocaleString("vi-VN")}đ`;

const unique = (values) =>
  Array.from(new Set((values || []).map(normalize).filter(Boolean)));

const parseMergeDetails = (table) => {
  const details = table?.mergeDetails;
  if (!details || typeof details !== "object") return null;

  const sourceCodes = unique(
    details.sourceTableCodes ||
      details.sources?.map((source) => source?.tableCode) ||
      [],
  );
  const customerNames = unique(
    details.customerNames ||
      details.sources?.map((source) => source?.customer?.name) ||
      [],
  );
  const orderSessions = Array.isArray(details.orderSessions)
    ? details.orderSessions
    : [];

  return {
    ...details,
    sourceCodes,
    customerNames,
    customerLabel:
      normalize(details.customerLabel) || customerNames.join(" + "),
    sourceCount: Number(details.sourceCount || sourceCodes.length || 0),
    activeOrderSessionCount: Number(
      details.activeOrderSessionCount || orderSessions.length || 0,
    ),
    activeOrderCount: Number(details.activeOrderCount || 0),
    reservationCount: Number(details.reservationCount || 0),
    totalOpenAmount: Number(details.totalOpenAmount || 0),
  };
};

const makeLine = (className, label, value) => {
  const line = document.createElement("div");
  line.className = className;
  const strong = document.createElement("strong");
  strong.textContent = label;
  const span = document.createElement("span");
  span.textContent = value;
  line.append(strong, span);
  return line;
};

const renderCardSummary = (card, table) => {
  const details = parseMergeDetails(table);
  const isMerged =
    details?.sourceCount > 1 ||
    (Array.isArray(table?.mergedFromTableIds) &&
      table.mergedFromTableIds.length > 1);

  if (!isMerged) {
    card.classList.remove(CARD_CLASS);
    card.querySelector(`.${SUMMARY_CLASS}`)?.remove();
    return;
  }

  card.classList.add(CARD_CLASS);
  card.dataset.mergedTableId = normalize(table.id);
  card.dataset.mergedTableCode = normalize(table.code);
  card.title = [
    `Bàn ghép ${table.code}`,
    details?.sourceCodes.length
      ? `Bàn nguồn: ${details.sourceCodes.join(", ")}`
      : "",
    details?.customerLabel ? `Khách: ${details.customerLabel}` : "",
    details?.activeOrderSessionCount
      ? `${details.activeOrderSessionCount} phiên order đang mở`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  let summary = card.querySelector(`.${SUMMARY_CLASS}`);
  if (!summary) {
    summary = document.createElement("section");
    summary.className = SUMMARY_CLASS;
    summary.setAttribute("aria-label", "Thông tin bàn ghép");
    const badges = card.querySelector('[class*="badgeStack"]');
    if (badges) card.insertBefore(summary, badges);
    else card.appendChild(summary);
  }

  summary.replaceChildren();
  const sourceLabel = details?.sourceCodes.length
    ? details.sourceCodes.join(" · ")
    : `${details?.sourceCount || table.mergedFromTableIds?.length || 2} bàn nguồn`;
  summary.appendChild(
    makeLine(
      `${SUMMARY_CLASS}__line ${SUMMARY_CLASS}__sources`,
      "Bàn nguồn",
      sourceLabel,
    ),
  );

  if (details?.customerLabel) {
    summary.appendChild(
      makeLine(
        `${SUMMARY_CLASS}__line ${SUMMARY_CLASS}__customers`,
        "Khách",
        details.customerLabel,
      ),
    );
  }

  const metrics = document.createElement("div");
  metrics.className = `${SUMMARY_CLASS}__metrics`;
  if (details?.reservationCount) {
    const badge = document.createElement("span");
    badge.textContent = `${details.reservationCount} đặt bàn`;
    metrics.appendChild(badge);
  }
  if (details?.activeOrderSessionCount) {
    const badge = document.createElement("span");
    badge.textContent = `${details.activeOrderSessionCount} phiên order`;
    metrics.appendChild(badge);
  }
  if (details?.activeOrderCount) {
    const badge = document.createElement("span");
    badge.textContent = `${details.activeOrderCount} lượt gọi món`;
    metrics.appendChild(badge);
  }
  if (details?.totalOpenAmount > 0) {
    const badge = document.createElement("strong");
    badge.textContent = formatMoney(details.totalOpenAmount);
    metrics.appendChild(badge);
  }
  if (metrics.childNodes.length) summary.appendChild(metrics);
};

const findPaymentDialog = () =>
  Array.from(document.querySelectorAll('[role="dialog"]')).find((dialog) =>
    normalize(dialog.textContent).includes("Thanh Toán Hóa Đơn"),
  );

const renderPaymentCustomerLabel = (tablesByCode) => {
  const dialog = findPaymentDialog();
  if (!dialog) return;

  const info = dialog.querySelector('[class*="orderInfo"]');
  if (!info) return;
  const match = normalize(info.textContent).match(/Bàn:\s*([^|]+)/i);
  const table = tablesByCode.get(normalizeKey(match?.[1]));
  const details = parseMergeDetails(table);

  info.querySelector(`.${PAYMENT_CLASS}`)?.remove();
  if (!details?.customerLabel) return;

  const label = document.createElement("span");
  label.className = PAYMENT_CLASS;
  label.append(" · Khách: ");
  const strong = document.createElement("b");
  strong.textContent = details.customerLabel;
  label.appendChild(strong);
  info.appendChild(label);
};

const installState = {
  restaurantId: "",
  tablesByCode: new Map(),
  loading: null,
  scheduled: false,
  lastFetchAt: 0,
};

const hasUnknownCard = () =>
  getTableCards().some(
    (card) => !installState.tablesByCode.has(normalizeKey(getCardCode(card))),
  );

const loadTables = async ({ force = false } = {}) => {
  const restaurantId = getRestaurantId();
  if (!restaurantId) return;

  const restaurantChanged = restaurantId !== installState.restaurantId;
  const stale = Date.now() - installState.lastFetchAt > 5000;
  if (
    !force &&
    !restaurantChanged &&
    !stale &&
    installState.tablesByCode.size > 0
  ) {
    return;
  }
  if (installState.loading) return installState.loading;

  installState.loading = apolloClient
    .query({
      query: TABLES_QUERY,
      variables: { restaurantId },
      fetchPolicy: force || restaurantChanged ? "network-only" : "cache-first",
    })
    .then(({ data }) => {
      installState.restaurantId = restaurantId;
      installState.lastFetchAt = Date.now();
      installState.tablesByCode = new Map(
        (data?.tables || []).map((table) => [normalizeKey(table.code), table]),
      );
    })
    .catch(() => {})
    .finally(() => {
      installState.loading = null;
    });

  return installState.loading;
};

const enhance = async () => {
  const restaurantId = getRestaurantId();
  if (!restaurantId) return;
  await loadTables({
    force:
      restaurantId !== installState.restaurantId ||
      installState.tablesByCode.size === 0 ||
      hasUnknownCard(),
  });

  getTableCards().forEach((card) => {
    const table = installState.tablesByCode.get(normalizeKey(getCardCode(card)));
    if (table) renderCardSummary(card, table);
  });
  renderPaymentCustomerLabel(installState.tablesByCode);
};

const scheduleEnhance = () => {
  if (installState.scheduled) return;
  installState.scheduled = true;
  window.requestAnimationFrame(() => {
    installState.scheduled = false;
    enhance();
  });
};

export function installMergedTableLifecycleUi() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window[OBSERVER_KEY]) return;

  const observer = new MutationObserver(scheduleEnhance);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("change", (event) => {
      if (event.target === getRestaurantSelect()) {
        installState.restaurantId = "";
        installState.tablesByCode = new Map();
        scheduleEnhance();
      }
    });
    scheduleEnhance();
  };

  if (document.body) start();
  else window.addEventListener("DOMContentLoaded", start, { once: true });
  window[OBSERVER_KEY] = observer;
}
