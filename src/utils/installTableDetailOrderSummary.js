import { gql } from "@apollo/client";
import { apolloClient } from "@/apollo/client";

const SECTION_CLASS = "cohan-table-order-summary";
const INSTALL_KEY = "__cohanTableDetailOrderSummaryInstalled";
const TERMINAL_STATUSES = new Set([
  "archived",
  "cancelled",
  "canceled",
  "completed",
  "failed",
  "refunded",
  "rejected",
  "void",
  "voided",
]);
const OFF_PREMISE_TYPES = new Set(["delivery", "takeaway"]);

const TABLE_ORDERS_QUERY = gql`
  query TableDetailActiveOrders($restaurantId: ID!, $limit: Int) {
    ordersByRestaurantNow(restaurantId: $restaurantId, limit: $limit) {
      edges {
        node {
          id
          orderCode
          tableCode
          restaurantId
          orderType
          currentStatus
          payment {
            status
            requestedAt
            paidAt
          }
          totals {
            grandTotal
          }
          customerInfo {
            name
            phone
            email
            partySize
          }
        }
      }
    }
  }
`;

const normalize = (value) => String(value || "").trim();
const normalizeKey = (value) => normalize(value).toLocaleLowerCase("vi");

export const filterActiveTableOrders = (orders = [], tableCode = "") => {
  const wantedTableCode = normalizeKey(tableCode);
  if (!wantedTableCode) return [];

  const seen = new Set();
  return (Array.isArray(orders) ? orders : [])
    .filter(Boolean)
    .filter((order) => normalizeKey(order.tableCode) === wantedTableCode)
    .filter((order) => !OFF_PREMISE_TYPES.has(normalizeKey(order.orderType)))
    .filter((order) => !TERMINAL_STATUSES.has(normalizeKey(order.currentStatus)))
    .filter((order) => {
      const identity = normalize(order.id || order.orderCode);
      if (!identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    })
    .sort((left, right) => {
      const leftPaymentRequested =
        normalizeKey(left?.payment?.status) === "payment_requested" ? 1 : 0;
      const rightPaymentRequested =
        normalizeKey(right?.payment?.status) === "payment_requested" ? 1 : 0;
      if (leftPaymentRequested !== rightPaymentRequested) {
        return rightPaymentRequested - leftPaymentRequested;
      }
      return normalize(left?.orderCode).localeCompare(
        normalize(right?.orderCode),
        "vi",
        { numeric: true },
      );
    });
};

export const summarizeTableOrders = (orders = []) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  return safeOrders.reduce(
    (summary, order) => {
      summary.orderCount += 1;
      summary.totalAmount += Math.max(0, Number(order?.totals?.grandTotal || 0));
      const paymentStatus = normalizeKey(order?.payment?.status);
      if (paymentStatus === "payment_requested") summary.paymentRequestedCount += 1;
      if (paymentStatus === "paid" || paymentStatus === "completed") {
        summary.paidCount += 1;
      }
      return summary;
    },
    {
      orderCount: 0,
      paymentRequestedCount: 0,
      paidCount: 0,
      totalAmount: 0,
    },
  );
};

const getRestaurantId = () =>
  normalize(document.querySelector(".management-page-header .mph-select")?.value);

const getTableCode = (modal) =>
  normalize(
    modal.querySelector(".talite-title b")?.textContent ||
      Array.from(modal.querySelectorAll(".talite-info .kv")).find((row) =>
        normalizeKey(row.querySelector(".k")?.textContent).startsWith("mã bàn"),
      )?.querySelector(".v")?.textContent,
  );

const makeElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

const formatMoney = (value) =>
  `${Math.round(Math.max(0, Number(value) || 0)).toLocaleString("vi-VN")}đ`;

const statusLabel = (status) => {
  const key = normalizeKey(status);
  return (
    {
      pending: "Chờ xác nhận",
      confirmed: "Đã xác nhận",
      preparing: "Đang chuẩn bị",
      ready: "Sẵn sàng",
      served: "Đã phục vụ",
      occupied: "Đang phục vụ",
      payment_pending: "Chờ thanh toán",
      payment_requested: "Khách yêu cầu thanh toán",
    }[key] || normalize(status) || "Đang xử lý"
  );
};

const paymentLabel = (status) => {
  const key = normalizeKey(status);
  return (
    {
      paid: "Đã thanh toán",
      completed: "Đã thanh toán",
      payment_requested: "Yêu cầu thanh toán",
      pending: "Chưa thanh toán",
      unpaid: "Chưa thanh toán",
      failed: "Thanh toán lỗi",
    }[key] || "Chưa thanh toán"
  );
};

const paymentTone = (status) => {
  const key = normalizeKey(status);
  if (key === "paid" || key === "completed") return "paid";
  if (key === "payment_requested") return "requested";
  if (key === "failed") return "failed";
  return "unpaid";
};

const getCustomerLabel = (order) => {
  const customer = order?.customerInfo || {};
  return normalize(customer.name) || normalize(customer.phone) || "Khách tại bàn";
};

const ensureSection = (modal) => {
  const body = modal.querySelector(".talite-body");
  if (!body) return null;

  let section = body.querySelector(`:scope > .${SECTION_CLASS}`);
  if (section) return section;

  section = makeElement("section", SECTION_CLASS);
  section.dataset.tableDetailSection = "orders";
  section.dataset.tableDetailKind = "orders";
  section.hidden = true;
  section.setAttribute("aria-live", "polite");

  const customerSection = body.querySelector(
    ":scope > .cohan-table-customer-profiles",
  );
  if (customerSection) customerSection.insertAdjacentElement("afterend", section);
  else body.appendChild(section);
  return section;
};

const buildHeader = (tableCode, summary) => {
  const header = makeElement("div", `${SECTION_CLASS}__header`);
  const headingWrap = makeElement("div", `${SECTION_CLASS}__heading-wrap`);
  const heading = makeElement("div", `${SECTION_CLASS}__heading`);
  heading.append(
    makeElement("span", `${SECTION_CLASS}__icon`, ""),
    makeElement("strong", "", `Đơn đang phục vụ tại bàn ${tableCode}`),
  );
  headingWrap.append(
    heading,
    makeElement(
      "p",
      `${SECTION_CLASS}__description`,
      "Hiển thị đầy đủ mọi đơn còn hoạt động. Danh sách tự cuộn khi có nhiều đơn để không làm vỡ modal.",
    ),
  );

  const metrics = makeElement("div", `${SECTION_CLASS}__metrics`);
  metrics.append(
    makeElement(
      "span",
      "",
      `${summary.orderCount} ${summary.orderCount === 1 ? "đơn" : "đơn"}`,
    ),
  );
  if (summary.paymentRequestedCount) {
    metrics.append(
      makeElement(
        "span",
        `${SECTION_CLASS}__metric--requested`,
        `${summary.paymentRequestedCount} yêu cầu thanh toán`,
      ),
    );
  }
  metrics.append(
    makeElement("strong", "", formatMoney(summary.totalAmount)),
  );
  header.append(headingWrap, metrics);
  return header;
};

const buildOrderCard = (order, index) => {
  const card = makeElement("article", `${SECTION_CLASS}__card`);
  card.setAttribute("role", "listitem");

  const top = makeElement("div", `${SECTION_CLASS}__card-top`);
  const identity = makeElement("div", `${SECTION_CLASS}__identity`);
  identity.append(
    makeElement(
      "span",
      `${SECTION_CLASS}__sequence`,
      String(index + 1).padStart(2, "0"),
    ),
    makeElement(
      "strong",
      `${SECTION_CLASS}__order-code`,
      normalize(order?.orderCode) || "Đơn chưa có mã",
    ),
  );
  const status = makeElement(
    "span",
    `${SECTION_CLASS}__status`,
    statusLabel(order?.currentStatus),
  );
  status.dataset.tone = normalizeKey(order?.currentStatus) || "pending";
  top.append(identity, status);

  const middle = makeElement("div", `${SECTION_CLASS}__card-middle`);
  const customer = makeElement("div", `${SECTION_CLASS}__customer`);
  customer.append(
    makeElement("strong", "", getCustomerLabel(order)),
    makeElement(
      "span",
      "",
      [
        normalize(order?.customerInfo?.phone),
        Number(order?.customerInfo?.partySize) > 0
          ? `${Number(order.customerInfo.partySize)} khách`
          : "",
      ]
        .filter(Boolean)
        .join(" · ") || "Chưa có thông tin liên hệ",
    ),
  );
  middle.append(customer);

  const footer = makeElement("div", `${SECTION_CLASS}__card-footer`);
  const payment = makeElement(
    "span",
    `${SECTION_CLASS}__payment`,
    paymentLabel(order?.payment?.status),
  );
  payment.dataset.tone = paymentTone(order?.payment?.status);
  footer.append(
    payment,
    makeElement(
      "strong",
      `${SECTION_CLASS}__amount`,
      formatMoney(order?.totals?.grandTotal),
    ),
  );

  card.append(top, middle, footer);
  return card;
};

const renderLoading = (section, tableCode) => {
  section.replaceChildren();
  const shell = makeElement("div", `${SECTION_CLASS}__shell`);
  const state = makeElement("div", `${SECTION_CLASS}__state is-loading`);
  state.append(
    makeElement("span", `${SECTION_CLASS}__spinner`, ""),
    makeElement("span", "", `Đang tải các đơn của bàn ${tableCode}...`),
  );
  shell.append(state);
  section.append(shell);
};

const renderError = (section, tableCode, message, retry) => {
  section.replaceChildren();
  const shell = makeElement("div", `${SECTION_CLASS}__shell`);
  const state = makeElement("div", `${SECTION_CLASS}__state is-error`);
  state.append(
    makeElement("strong", "", "Không thể tải danh sách đơn"),
    makeElement(
      "p",
      "",
      message || `Dữ liệu đơn của bàn ${tableCode} đang tạm thời không khả dụng.`,
    ),
  );
  const button = makeElement("button", `${SECTION_CLASS}__retry`, "Thử lại");
  button.type = "button";
  button.addEventListener("click", retry);
  state.append(button);
  shell.append(state);
  section.append(shell);
};

const renderOrders = (section, tableCode, orders) => {
  section.replaceChildren();
  const summary = summarizeTableOrders(orders);
  const shell = makeElement("div", `${SECTION_CLASS}__shell`);
  shell.append(buildHeader(tableCode, summary));

  if (!orders.length) {
    const empty = makeElement("div", `${SECTION_CLASS}__state is-empty`);
    empty.append(
      makeElement("strong", "", "Bàn chưa có đơn đang hoạt động"),
      makeElement(
        "p",
        "",
        "Các đơn đã hoàn tất hoặc đã hủy không được đưa vào danh sách vận hành này.",
      ),
    );
    shell.append(empty);
    section.append(shell);
    return;
  }

  const list = makeElement("div", `${SECTION_CLASS}__list`);
  list.setAttribute("role", "list");
  list.setAttribute("aria-label", `Các đơn đang hoạt động của bàn ${tableCode}`);
  orders.forEach((order, index) => list.append(buildOrderCard(order, index)));
  shell.append(list);
  section.append(shell);
};

const loadOrdersForModal = async (modal, { force = false } = {}) => {
  if (!modal?.isConnected) return;
  const restaurantId = getRestaurantId();
  const tableCode = getTableCode(modal);
  if (!restaurantId || !tableCode) return;

  const section = ensureSection(modal);
  if (!section) return;
  const identity = `${restaurantId}|${normalizeKey(tableCode)}`;
  if (!force && section.dataset.orderIdentity === identity) return;

  section.dataset.orderIdentity = identity;
  section.dataset.orderState = "loading";
  renderLoading(section, tableCode);

  try {
    const { data } = await apolloClient.query({
      query: TABLE_ORDERS_QUERY,
      variables: { restaurantId, limit: 200 },
      fetchPolicy: "network-only",
    });
    if (!section.isConnected || section.dataset.orderIdentity !== identity) return;

    const allOrders = (data?.ordersByRestaurantNow?.edges || [])
      .map((edge) => edge?.node)
      .filter(Boolean);
    const orders = filterActiveTableOrders(allOrders, tableCode);
    section.dataset.orderState = orders.length ? "ready" : "empty";
    renderOrders(section, tableCode, orders);
  } catch (error) {
    if (!section.isConnected || section.dataset.orderIdentity !== identity) return;
    section.dataset.orderState = "error";
    renderError(section, tableCode, error?.message, () => {
      section.dataset.orderIdentity = "";
      void loadOrdersForModal(modal, { force: true });
    });
  }
};

const findModals = (root) => {
  if (!root?.querySelectorAll) return [];
  const own = root.matches?.(".talite-modal") ? [root] : [];
  return [...own, ...root.querySelectorAll(".talite-modal")];
};

export const installTableDetailOrderSummary = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window[INSTALL_KEY]) return;
  window[INSTALL_KEY] = true;

  const enhance = (root = document.body) => {
    findModals(root).forEach((modal) => {
      void loadOrdersForModal(modal);
    });
  };

  enhance();
  const observer = new MutationObserver((mutations) => {
    const pending = new Set();
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        findModals(node).forEach((modal) => pending.add(modal));
        const parentModal = node.closest?.(".talite-modal");
        if (parentModal) pending.add(parentModal);
      });
    });
    pending.forEach((modal) => void loadOrdersForModal(modal));
  });

  observer.observe(document.body, { childList: true, subtree: true });
  window.__cohanTableDetailOrderSummaryObserver = observer;
};
