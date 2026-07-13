import { gql } from "@apollo/client";
import { apolloClient } from "../apollo/client";
import { getToken } from "../lib/authStorage";
import { toApiAssetUrl } from "../lib/apiBaseUrl";

const RESTAURANT_LOOKUP = gql`
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

const RESTAURANT_OFFERS = gql`
  query CustomerMenuRestaurantOffers($filter: CustomerComboFilterInput) {
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
      }
    }
  }
`;

const ADD_COMBO_TO_CART = gql`
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
const ROOT_SELECTOR = "[data-customer-menu-restaurant-combos]";
const DEFAULT_IMAGE = "/default-dishes.jpg";
const SETTLED_STATES = new Set([
  "loading",
  "ready",
  "empty",
  "error",
  "unresolved",
]);

let queued = false;
let requestSequence = 0;

const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

export const isBundleRestaurantOffer = (offer) =>
  offer?.sourceType === "COMBO";

export const filterRestaurantOffers = (offers = [], restaurantId) =>
  (offers || []).filter(
    (offer) =>
      ["COMBO", "PROMOTION"].includes(offer?.sourceType) &&
      (!restaurantId ||
        !offer?.restaurantId ||
        String(offer.restaurantId) === String(restaurantId)),
  );

export const summarizeRestaurantOffers = (offers = []) => ({
  comboCount: offers.filter(isBundleRestaurantOffer).length,
  promotionCount: offers.filter((offer) => offer?.sourceType === "PROMOTION")
    .length,
  total: offers.length,
});

const restaurantNameFromPage = () =>
  document
    .querySelector(`${PAGE_SELECTOR} .restaurant-title-block h2`)
    ?.textContent?.trim() || "Nhà hàng";

const restaurantIdFromPage = (container) => {
  const explicitId = new URLSearchParams(window.location.search).get(
    "restaurantId",
  );
  if (explicitId) return explicitId;

  for (const link of container.querySelectorAll(
    '.menu-grid .item-card[href*="restaurantId="]',
  )) {
    try {
      const restaurantId = new URL(
        link.href,
        window.location.origin,
      ).searchParams.get("restaurantId");
      if (restaurantId) return restaurantId;
    } catch {
      // Continue to the restaurant-name lookup below.
    }
  }
  return null;
};

const resolveRestaurantId = async (restaurantName) => {
  const { data } = await apolloClient.query({
    query: RESTAURANT_LOOKUP,
    variables: { limit: 100 },
    fetchPolicy: "cache-first",
  });
  const wantedName = String(restaurantName).trim().toLocaleLowerCase("vi");
  const restaurant = (data?.publicRestaurants?.edges || [])
    .map((entry) => entry?.node)
    .find(
      (entry) =>
        String(entry?.name || "").trim().toLocaleLowerCase("vi") ===
        wantedName,
    );
  return restaurant?.id || null;
};

const ensureRoot = (container) => {
  const existing = container.querySelector(ROOT_SELECTOR);
  if (existing) return existing;
  const root = element("section", "customer-menu-combos");
  root.setAttribute("data-customer-menu-restaurant-combos", "");
  root.setAttribute("aria-live", "polite");
  container.append(root);
  return root;
};

const buildHeader = (restaurantName, summary, restaurantId) => {
  const header = element("div", "customer-menu-combos__header");
  const copy = element("div", "customer-menu-combos__header-copy");
  copy.append(
    element("span", "customer-menu-combos__eyebrow", "Combo & ưu đãi"),
    element("h3", "", `Combo và ưu đãi tại ${restaurantName}`),
    element(
      "p",
      "",
      "Combo trọn gói có thể thêm ngay vào giỏ; ưu đãi thanh toán sẽ tự áp dụng khi bạn chọn đủ món điều kiện.",
    ),
  );
  header.append(copy);

  if (summary) {
    const actions = element("div", "customer-menu-combos__header-actions");
    if (summary.comboCount) {
      actions.append(
        element(
          "span",
          "customer-menu-combos__count",
          `${summary.comboCount} combo`,
        ),
      );
    }
    if (summary.promotionCount) {
      actions.append(
        element(
          "span",
          "customer-menu-combos__count",
          `${summary.promotionCount} ưu đãi`,
        ),
      );
    }
    const link = element(
      "a",
      "customer-menu-combos__all-link",
      "Xem tất cả",
    );
    link.href = restaurantId
      ? `/combos?restaurantId=${encodeURIComponent(restaurantId)}`
      : "/combos";
    actions.append(link);
    header.append(actions);
  }
  return header;
};

const renderLoading = (root, restaurantName) => {
  const loading = element("div", "customer-menu-combos__loading");
  loading.setAttribute("role", "status");
  loading.append(
    element("span", "customer-menu-combos__spinner"),
    element("span", "", "Đang tải combo và ưu đãi của nhà hàng"),
  );
  root.replaceChildren(buildHeader(restaurantName), loading);
};

const renderState = (root, restaurantName, { title, message, tone, retry }) => {
  const state = element(
    "div",
    `customer-menu-combos__state customer-menu-combos__state--${tone}`,
  );
  state.append(element("strong", "", title), element("p", "", message));
  if (retry) {
    const button = element("button", "", "Thử tải lại");
    button.type = "button";
    button.addEventListener("click", () => {
      root.dataset.comboState = "";
      queueSync();
    });
    state.append(button);
  }
  root.replaceChildren(buildHeader(restaurantName), state);
};

const announce = (root, message, tone) => {
  root.querySelector(".customer-menu-combos__notice")?.remove();
  const notice = element(
    "div",
    `customer-menu-combos__notice customer-menu-combos__notice--${tone}`,
    message,
  );
  notice.setAttribute("role", "status");
  root.prepend(notice);
  window.setTimeout(() => notice.isConnected && notice.remove(), 4500);
};

const addCombo = async (root, combo, button) => {
  if (!getToken()) {
    window.location.assign("/login");
    return;
  }

  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Đang thêm...";
  try {
    await apolloClient.mutate({
      mutation: ADD_COMBO_TO_CART,
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
    button.textContent = label;
  }
};

const choosePromotionItems = (root, promotion) => {
  document
    .querySelector(`${CONTAINER_SELECTOR} .menu-results-context`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
  announce(
    root,
    `Hãy chọn đủ các món trong “${promotion.name}”; ưu đãi sẽ được kiểm tra ở bước thanh toán.`,
    "success",
  );
};

const offerCard = (root, offer) => {
  const bundle = isBundleRestaurantOffer(offer);
  const card = element(
    "article",
    `customer-menu-combo-card customer-menu-combo-card--${
      bundle ? "bundle" : "promotion"
    }`,
  );
  const media = element("div", "customer-menu-combo-card__media");
  const image = document.createElement("img");
  image.src = toApiAssetUrl(offer.imageUrl) || DEFAULT_IMAGE;
  image.alt = offer.name || (bundle ? "Combo nhà hàng" : "Ưu đãi nhà hàng");
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => {
    if (!image.src.endsWith(DEFAULT_IMAGE)) image.src = DEFAULT_IMAGE;
  });
  media.append(
    image,
    element(
      "span",
      "customer-menu-combo-card__badge",
      offer.badge || (bundle ? "Combo trọn gói" : "Ưu đãi thanh toán"),
    ),
  );
  if (Number(offer.discountPercent) > 0) {
    media.append(
      element(
        "span",
        "customer-menu-combo-card__discount",
        `-${Math.round(Number(offer.discountPercent))}%`,
      ),
    );
  }

  const body = element("div", "customer-menu-combo-card__body");
  const heading = element("div", "customer-menu-combo-card__heading");
  heading.append(
    element("h4", "", offer.name || (bundle ? "Combo nhà hàng" : "Ưu đãi")),
    element(
      "p",
      "",
      offer.description ||
        (bundle
          ? "Gọi nhanh trọn bộ món với mức giá ưu đãi."
          : "Ưu đãi được áp dụng khi giỏ hàng đủ các món và điều kiện thanh toán."),
    ),
  );

  const meta = element("div", "customer-menu-combo-card__meta");
  meta.append(
    element(
      "span",
      "",
      bundle ? "Combo thêm vào giỏ" : "Ưu đãi khi thanh toán",
    ),
  );
  const itemCount = (offer.items || []).reduce(
    (sum, item) => sum + Math.max(1, Number(item?.qty || 1)),
    0,
  );
  meta.append(element("span", "", `${itemCount} món`));
  const minPeople = Number(offer.minPeople || 0);
  const maxPeople = Number(offer.maxPeople || 0);
  if (minPeople || maxPeople) {
    const minimum = minPeople || maxPeople;
    const maximum = maxPeople || minPeople;
    meta.append(
      element(
        "span",
        "",
        minimum === maximum ? `${minimum} người` : `${minimum}–${maximum} người`,
      ),
    );
  }

  const items = element("ul", "customer-menu-combo-card__items");
  (offer.items || []).slice(0, 4).forEach((item) => {
    const row = element("li");
    row.append(
      element("span", "", `${Math.max(1, Number(item?.qty || 1))}×`),
      document.createTextNode(item?.name || "Món trong chương trình"),
    );
    items.append(row);
  });

  const footer = element("div", "customer-menu-combo-card__footer");
  const prices = element("div", "customer-menu-combo-card__prices");
  const offerPrice = Number(offer.comboPrice ?? offer.originalPrice ?? 0);
  const originalPrice = Number(offer.originalPrice || 0);
  prices.append(element("strong", "", money(offerPrice)));
  if (originalPrice > offerPrice) {
    prices.append(element("del", "", money(originalPrice)));
  }

  const button = element(
    "button",
    "customer-menu-combo-card__action",
    bundle ? "Thêm combo" : "Chọn món",
  );
  button.type = "button";
  button.disabled = offer.isAvailable === false;
  button.addEventListener("click", () =>
    bundle ? addCombo(root, offer, button) : choosePromotionItems(root, offer),
  );
  footer.append(prices, button);

  body.append(heading, meta);
  if (items.childElementCount) body.append(items);
  body.append(footer);
  card.append(media, body);
  return card;
};

const renderOffers = (root, restaurantName, restaurantId, offers) => {
  const summary = summarizeRestaurantOffers(offers);
  const grid = element("div", "customer-menu-combos__grid");
  offers.slice(0, 6).forEach((offer) => grid.append(offerCard(root, offer)));
  root.replaceChildren(
    buildHeader(restaurantName, summary, restaurantId),
    grid,
  );
};

const sync = async () => {
  queued = false;
  if (!window.location.pathname.startsWith("/cus-menu")) return;

  const container = document.querySelector(CONTAINER_SELECTOR);
  if (!container) return;
  const restaurantName = restaurantNameFromPage();
  const root = ensureRoot(container);
  if (
    root.dataset.restaurantName === restaurantName &&
    SETTLED_STATES.has(root.dataset.comboState)
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
      restaurantIdFromPage(container) ||
      (await resolveRestaurantId(restaurantName));
    if (!root.isConnected || root.dataset.requestId !== requestId) return;

    if (!restaurantId) {
      root.dataset.comboState = "unresolved";
      renderState(root, restaurantName, {
        title: "Chưa xác định được nhà hàng",
        message:
          "Vui lòng tải lại trang hoặc chọn lại nhà hàng để xem combo và ưu đãi.",
        tone: "warning",
        retry: true,
      });
      return;
    }

    root.dataset.restaurantId = String(restaurantId);
    const { data } = await apolloClient.query({
      query: RESTAURANT_OFFERS,
      variables: {
        filter: {
          restaurantId: String(restaurantId),
          onlyAvailable: true,
          limit: 12,
        },
      },
      fetchPolicy: "network-only",
    });
    if (!root.isConnected || root.dataset.requestId !== requestId) return;

    const offers = filterRestaurantOffers(
      data?.customerCombos || [],
      restaurantId,
    );
    if (!offers.length) {
      root.dataset.comboState = "empty";
      renderState(root, restaurantName, {
        title: "Nhà hàng chưa có combo hoặc ưu đãi khả dụng",
        message:
          "Các món lẻ vẫn hiển thị bình thường. Chương trình mới sẽ xuất hiện tại đây khi nhà hàng mở bán.",
        tone: "empty",
      });
      return;
    }

    root.dataset.comboState = "ready";
    renderOffers(root, restaurantName, restaurantId, offers);
  } catch (error) {
    if (!root.isConnected || root.dataset.requestId !== requestId) return;
    root.dataset.comboState = "error";
    renderState(root, restaurantName, {
      title: "Không thể tải combo và ưu đãi",
      message: error?.message || "Kết nối đang gián đoạn. Vui lòng thử lại.",
      tone: "error",
      retry: true,
    });
  }
};

function queueSync() {
  if (queued) return;
  queued = true;
  window.requestAnimationFrame(() => void sync());
}

export function installCustomerMenuRestaurantCombos() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__cohanCustomerMenuRestaurantCombosInstalled) return;
  window.__cohanCustomerMenuRestaurantCombosInstalled = true;

  const start = () => {
    const menuObserver = new MutationObserver(queueSync);
    menuObserver.observe(document.body, { childList: true, subtree: true });
    window.__cohanCustomerMenuRestaurantCombosObserver = menuObserver;
    window.addEventListener("popstate", queueSync);
    queueSync();
  };

  if (document.body) start();
  else window.addEventListener("DOMContentLoaded", start, { once: true });
}
