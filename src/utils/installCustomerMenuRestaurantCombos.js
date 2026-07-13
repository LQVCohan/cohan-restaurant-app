import { gql } from "@apollo/client";
import { apolloClient } from "../apollo/client";
import { getToken } from "../lib/authStorage";
import { toApiAssetUrl } from "../lib/apiBaseUrl";

const CUSTOMER_MENU_RESTAURANT_LOOKUP = gql`
  query CustomerMenuRestaurantComboLookup($limit: Int) {
    publicRestaurants(limit: $limit) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;

const CUSTOMER_MENU_RESTAURANT_COMBOS = gql`
  query CustomerMenuRestaurantCombos($filter: CustomerComboFilterInput) {
    customerCombos(filter: $filter) {
      id
      sourceType
      restaurantId
      restaurantName
      name
      description
      imageUrl
      originalPrice
      comboPrice
      discountAmount
      discountPercent
      badge
      isAvailable
      minPeople
      maxPeople
      items {
        menuItemId
        name
        qty
        imageUrl
        price
      }
    }
  }
`;

const ADD_CUSTOMER_MENU_COMBO_TO_CART = gql`
  mutation AddCustomerMenuComboToCart($comboId: ID!, $quantity: Int = 1) {
    addComboToCart(comboId: $comboId, quantity: $quantity) {
      id
      totalQuantity
      totalAmount
    }
  }
`;

const PAGE_SELECTOR = ".restaurant-app .menu-detail-view";
const CONTAINER_SELECTOR = `${PAGE_SELECTOR} .menu-detail-container`;
const ROOT_ATTRIBUTE = "data-customer-menu-restaurant-combos";
const DEFAULT_IMAGE = "/default-dishes.jpg";
const READY_STATES = new Set(["loading", "ready", "empty", "unresolved"]);

let observer = null;
let syncQueued = false;
let requestSequence = 0;

const formatMoney = (value) =>
  `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

const getRestaurantName = () =>
  document
    .querySelector(`${PAGE_SELECTOR} .restaurant-title-block h2`)
    ?.textContent?.trim() || "Nhà hàng";

const getRestaurantIdFromVisibleMenu = (container) => {
  const urlRestaurantId = new URLSearchParams(window.location.search).get(
    "restaurantId",
  );
  if (urlRestaurantId) return urlRestaurantId;

  const links = container.querySelectorAll(
    '.menu-grid .item-card[href*="restaurantId="]',
  );
  for (const link of links) {
    try {
      const restaurantId = new URL(link.href, window.location.origin).searchParams.get(
        "restaurantId",
      );
      if (restaurantId) return restaurantId;
    } catch {
      // Ignore malformed links and continue with the restaurant-name fallback.
    }
  }

  return null;
};

const resolveRestaurantIdByName = async (restaurantName) => {
  const { data } = await apolloClient.query({
    query: CUSTOMER_MENU_RESTAURANT_LOOKUP,
    variables: { limit: 100 },
    fetchPolicy: "cache-first",
  });

  const normalizedName = String(restaurantName || "")
    .trim()
    .toLocaleLowerCase("vi");
  const restaurants = (data?.publicRestaurants?.edges || [])
    .map((edge) => edge?.node)
    .filter(Boolean);
  const exactMatch = restaurants.find(
    (restaurant) =>
      String(restaurant?.name || "")
        .trim()
        .toLocaleLowerCase("vi") === normalizedName,
  );

  return exactMatch?.id || null;
};

const ensureRoot = (container) => {
  let root = container.querySelector(`[${ROOT_ATTRIBUTE}]`);
  if (root) return root;

  root = document.createElement("section");
  root.setAttribute(ROOT_ATTRIBUTE, "");
  root.className = "customer-menu-combos";
  root.setAttribute("aria-live", "polite");
  container.append(root);
  return root;
};

const renderLoading = (root, restaurantName) => {
  root.replaceChildren();
  const header = createElement("div", "customer-menu-combos__header");
  const copy = createElement("div", "customer-menu-combos__header-copy");
  copy.append(
    createElement("span", "customer-menu-combos__eyebrow", "Combo nhà hàng"),
    createElement("h3", "", `Combo tại ${restaurantName}`),
    createElement(
      "p",
      "",
      "Đang kiểm tra các combo đang bán và mức giá tiết kiệm...",
    ),
  );
  header.append(copy);

  const loading = createElement("div", "customer-menu-combos__loading");
  loading.setAttribute("role", "status");
  loading.append(
    createElement("span", "customer-menu-combos__spinner"),
    createElement("span", "", "Đang tải combo của nhà hàng"),
  );
  root.append(header, loading);
};

const renderMessage = ({ root, restaurantName, title, message, tone, retry }) => {
  root.replaceChildren();
  const header = createElement("div", "customer-menu-combos__header");
  const copy = createElement("div", "customer-menu-combos__header-copy");
  copy.append(
    createElement("span", "customer-menu-combos__eyebrow", "Combo nhà hàng"),
    createElement("h3", "", `Combo tại ${restaurantName}`),
    createElement("p", "", "Các gói món được lọc riêng theo nhà hàng đang xem."),
  );
  header.append(copy);

  const state = createElement(
    "div",
    `customer-menu-combos__state customer-menu-combos__state--${tone}`,
  );
  state.append(createElement("strong", "", title), createElement("p", "", message));
  if (retry) {
    const retryButton = createElement("button", "", "Thử tải lại");
    retryButton.type = "button";
    retryButton.addEventListener("click", () => {
      root.dataset.comboState = "";
      queueSync();
    });
    state.append(retryButton);
  }
  root.append(header, state);
};

const announce = (root, message, tone = "success") => {
  let status = root.querySelector(".customer-menu-combos__notice");
  if (!status) {
    status = createElement("div", "customer-menu-combos__notice");
    status.setAttribute("role", "status");
    root.prepend(status);
  }
  status.className = `customer-menu-combos__notice customer-menu-combos__notice--${tone}`;
  status.textContent = message;
  window.setTimeout(() => {
    if (status.isConnected) status.remove();
  }, 4500);
};

const addComboToCart = async ({ combo, button, root }) => {
  if (!getToken()) {
    window.location.assign("/login");
    return;
  }

  const previousLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Đang thêm...";

  try {
    await apolloClient.mutate({
      mutation: ADD_CUSTOMER_MENU_COMBO_TO_CART,
      variables: { comboId: combo.id, quantity: 1 },
    });
    await apolloClient.refetchQueries({
      include: ["MyActiveCustomerCartForContext"],
    });
    announce(root, `Đã thêm “${combo.name}” vào giỏ hàng.`, "success");
  } catch (error) {
    announce(
      root,
      error?.message || "Không thể thêm combo vào giỏ hàng. Vui lòng thử lại.",
      "error",
    );
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
};

const createComboCard = (combo, root) => {
  const card = createElement("article", "customer-menu-combo-card");
  card.setAttribute("aria-label", combo.name || "Combo nhà hàng");

  const media = createElement("div", "customer-menu-combo-card__media");
  const image = document.createElement("img");
  image.src = toApiAssetUrl(combo.imageUrl) || DEFAULT_IMAGE;
  image.alt = combo.name || "Combo nhà hàng";
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => {
    image.src = DEFAULT_IMAGE;
  });
  media.append(image);
  media.append(
    createElement(
      "span",
      "customer-menu-combo-card__badge",
      combo.badge || "Combo trọn gói",
    ),
  );
  if (Number(combo.discountPercent) > 0) {
    media.append(
      createElement(
        "span",
        "customer-menu-combo-card__discount",
        `-${Math.round(Number(combo.discountPercent))}%`,
      ),
    );
  }

  const body = createElement("div", "customer-menu-combo-card__body");
  const heading = createElement("div", "customer-menu-combo-card__heading");
  heading.append(
    createElement("h4", "", combo.name || "Combo nhà hàng"),
    createElement(
      "p",
      "",
      combo.description || "Gọi nhanh trọn bộ món với mức giá ưu đãi.",
    ),
  );

  const meta = createElement("div", "customer-menu-combo-card__meta");
  const itemCount = (combo.items || []).reduce(
    (total, item) => total + Math.max(1, Number(item?.qty || 1)),
    0,
  );
  meta.append(createElement("span", "", `${itemCount} món`));
  if (Number(combo.minPeople) > 0 || Number(combo.maxPeople) > 0) {
    const minPeople = Number(combo.minPeople || combo.maxPeople || 1);
    const maxPeople = Number(combo.maxPeople || combo.minPeople || minPeople);
    meta.append(
      createElement(
        "span",
        "",
        minPeople === maxPeople
          ? `${minPeople} người`
          : `${minPeople}–${maxPeople} người`,
      ),
    );
  }

  const items = createElement("ul", "customer-menu-combo-card__items");
  (combo.items || []).slice(0, 4).forEach((item) => {
    const listItem = createElement("li");
    listItem.append(
      createElement("span", "", `${Math.max(1, Number(item?.qty || 1))}×`),
      document.createTextNode(item?.name || "Món trong combo"),
    );
    items.append(listItem);
  });

  const footer = createElement("div", "customer-menu-combo-card__footer");
  const prices = createElement("div", "customer-menu-combo-card__prices");
  const comboPrice = Number(combo.comboPrice ?? combo.originalPrice ?? 0);
  const originalPrice = Number(combo.originalPrice || 0);
  prices.append(createElement("strong", "", formatMoney(comboPrice)));
  if (originalPrice > comboPrice) {
    prices.append(createElement("del", "", formatMoney(originalPrice)));
  }

  const addButton = createElement(
    "button",
    "customer-menu-combo-card__action",
    "Thêm combo",
  );
  addButton.type = "button";
  addButton.disabled = combo.isAvailable === false;
  addButton.addEventListener("click", () =>
    addComboToCart({ combo, button: addButton, root }),
  );
  footer.append(prices, addButton);

  body.append(heading, meta);
  if (items.childElementCount) body.append(items);
  body.append(footer);
  card.append(media, body);
  return card;
};

const renderCombos = ({ root, restaurantId, restaurantName, combos }) => {
  root.replaceChildren();

  const header = createElement("div", "customer-menu-combos__header");
  const copy = createElement("div", "customer-menu-combos__header-copy");
  copy.append(
    createElement("span", "customer-menu-combos__eyebrow", "Combo nhà hàng"),
    createElement("h3", "", `Combo tại ${restaurantName}`),
    createElement(
      "p",
      "",
      "Xem các gói món đang bán tại đúng nhà hàng này và thêm nhanh vào giỏ.",
    ),
  );

  const actions = createElement("div", "customer-menu-combos__header-actions");
  actions.append(
    createElement(
      "span",
      "customer-menu-combos__count",
      `${combos.length} combo`,
    ),
  );
  const allCombosLink = createElement(
    "a",
    "customer-menu-combos__all-link",
    "Khám phá trang Combo",
  );
  allCombosLink.href = `/combos?restaurantId=${encodeURIComponent(restaurantId)}`;
  actions.append(allCombosLink);
  header.append(copy, actions);

  const grid = createElement("div", "customer-menu-combos__grid");
  combos.slice(0, 6).forEach((combo) => grid.append(createComboCard(combo, root)));
  root.append(header, grid);
};

const syncCustomerMenuCombos = async () => {
  syncQueued = false;
  if (!window.location.pathname.startsWith("/cus-menu")) return;

  const container = document.querySelector(CONTAINER_SELECTOR);
  if (!container) return;

  const restaurantName = getRestaurantName();
  const root = ensureRoot(container);
  const currentState = root.dataset.comboState || "";
  if (
    root.dataset.restaurantName === restaurantName &&
    READY_STATES.has(currentState)
  ) {
    return;
  }

  const requestId = String(++requestSequence);
  root.dataset.requestId = requestId;
  root.dataset.restaurantName = restaurantName;
  root.dataset.comboState = "loading";
  renderLoading(root, restaurantName);

  try {
    const restaurantId =
      getRestaurantIdFromVisibleMenu(container) ||
      (await resolveRestaurantIdByName(restaurantName));

    if (root.dataset.requestId !== requestId || !root.isConnected) return;
    if (!restaurantId) {
      root.dataset.comboState = "unresolved";
      renderMessage({
        root,
        restaurantName,
        title: "Chưa xác định được nhà hàng",
        message: "Vui lòng tải lại trang hoặc chọn lại nhà hàng để xem combo.",
        tone: "warning",
        retry: true,
      });
      return;
    }

    root.dataset.restaurantId = String(restaurantId);
    const { data } = await apolloClient.query({
      query: CUSTOMER_MENU_RESTAURANT_COMBOS,
      variables: {
        filter: {
          restaurantId: String(restaurantId),
          sourceType: "COMBO",
          onlyAvailable: true,
          limit: 12,
        },
      },
      fetchPolicy: "network-only",
    });

    if (root.dataset.requestId !== requestId || !root.isConnected) return;
    const combos = (data?.customerCombos || []).filter(
      (combo) =>
        combo?.sourceType === "COMBO" &&
        String(combo?.restaurantId || "") === String(restaurantId),
    );

    if (!combos.length) {
      root.dataset.comboState = "empty";
      renderMessage({
        root,
        restaurantName,
        title: "Nhà hàng chưa có combo khả dụng",
        message:
          "Các món lẻ vẫn hiển thị bình thường. Combo sẽ xuất hiện tại đây khi nhà hàng mở bán.",
        tone: "empty",
      });
      return;
    }

    root.dataset.comboState = "ready";
    renderCombos({ root, restaurantId, restaurantName, combos });
  } catch (error) {
    if (root.dataset.requestId !== requestId || !root.isConnected) return;
    root.dataset.comboState = "error";
    renderMessage({
      root,
      restaurantName,
      title: "Không thể tải combo",
      message:
        error?.message || "Kết nối đang gián đoạn. Vui lòng thử tải lại combo.",
      tone: "error",
      retry: true,
    });
  }
};

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  window.requestAnimationFrame(() => {
    void syncCustomerMenuCombos();
  });
}

export function installCustomerMenuRestaurantCombos() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__cohanCustomerMenuRestaurantCombosInstalled) return;
  window.__cohanCustomerMenuRestaurantCombosInstalled = true;

  const start = () => {
    observer = new MutationObserver(queueSync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", queueSync);
    queueSync();
  };

  if (document.body) start();
  else window.addEventListener("DOMContentLoaded", start, { once: true });
}
