import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const RESTAURANT_ROUTE_RE = /^\/(manager|admin)(?:\/|$)/;
const DEFAULT_CENTER = { lat: 10.7769, lng: 106.7009 };

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

let activeCard = null;

const normalizeLabel = (value = "") =>
  value.replace(/\*/g, "").replace(/\s+/g, " ").trim();

const findCoordinateField = (root, labelText) => {
  const label = Array.from(root.querySelectorAll(".ant-form-item-label label")).find(
    (node) => normalizeLabel(node.textContent) === labelText,
  );
  const item = label?.closest(".ant-form-item") || null;
  return {
    item,
    input: item?.querySelector('input[type="number"], input') || null,
    column: item?.closest(".ant-col") || null,
  };
};

export const readRestaurantCoordinatePair = (latInput, lngInput) => {
  const latText = String(latInput?.value ?? "").trim();
  const lngText = String(lngInput?.value ?? "").trim();
  if (!latText || !lngText) return null;

  const lat = Number(latText);
  const lng = Number(lngText);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
};

const setControlledInputValue = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const getMapContext = () => {
  if (!RESTAURANT_ROUTE_RE.test(window.location.pathname)) return null;

  const root = document.querySelector(".restaurant-management-container");
  if (!root) return null;

  const latitude = findCoordinateField(root, "Vĩ độ");
  const longitude = findCoordinateField(root, "Kinh độ");
  if (!latitude.input || !longitude.input) return null;

  const row = latitude.column?.closest(".ant-row") || null;
  if (!row || row !== longitude.column?.closest(".ant-row")) return null;

  return { root, row, latitude, longitude };
};

const updateCoordinateSummary = (card, pair) => {
  const lat = card.querySelector("[data-map-lat]");
  const lng = card.querySelector("[data-map-lng]");
  lat.textContent = pair ? pair.lat.toFixed(6) : "Chưa đặt";
  lng.textContent = pair ? pair.lng.toFixed(6) : "Chưa đặt";
};

const syncMapFromInputs = (card, context, { recenter = false } = {}) => {
  const state = card.__restaurantMapState;
  if (!state) return;

  const pair = readRestaurantCoordinatePair(
    context.latitude.input,
    context.longitude.input,
  );
  const pairKey = pair ? `${pair.lat}:${pair.lng}` : "";
  const changed = pairKey !== state.pairKey;
  updateCoordinateSummary(card, pair);

  if (!pair) {
    if (state.marker) {
      state.map.removeLayer(state.marker);
      state.marker = null;
    }
    state.pairKey = "";
    return;
  }

  if (!state.marker) {
    state.marker = L.marker([pair.lat, pair.lng], { draggable: true }).addTo(
      state.map,
    );
    state.marker.on("dragend", (event) => {
      const next = event.target.getLatLng();
      applyMapCoordinates(card, next.lat, next.lng);
    });
  } else if (changed) {
    state.marker.setLatLng([pair.lat, pair.lng]);
  }

  if (recenter && changed) {
    state.map.setView([pair.lat, pair.lng], state.map.getZoom());
  }
  state.pairKey = pairKey;
};

const applyMapCoordinates = (card, lat, lng) => {
  const state = card.__restaurantMapState;
  if (!state || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const context = getMapContext();
  if (!context) return;

  const next = {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
  setControlledInputValue(context.latitude.input, next.lat.toFixed(6));
  setControlledInputValue(context.longitude.input, next.lng.toFixed(6));
  syncMapFromInputs(card, context);
};

const createMapCard = (context) => {
  const card = document.createElement("section");
  card.className = "restaurant-location-map-card";
  card.setAttribute("aria-label", "Chọn vị trí nhà hàng trên bản đồ");
  card.innerHTML = `
    <div class="restaurant-location-map-card__header">
      <div>
        <strong>Vị trí trên bản đồ</strong>
        <span>Nhấp vào bản đồ hoặc kéo ghim để cập nhật tọa độ.</span>
      </div>
      <div class="restaurant-location-map-card__coordinates" aria-label="Tọa độ đang chọn">
        <span>Vĩ độ <b data-map-lat>Chưa đặt</b></span>
        <span>Kinh độ <b data-map-lng>Chưa đặt</b></span>
      </div>
    </div>
    <div class="restaurant-location-map-card__canvas" role="region" aria-label="Bản đồ vị trí nhà hàng"></div>
  `;
  context.row.insertAdjacentElement("afterend", card);

  const pair = readRestaurantCoordinatePair(
    context.latitude.input,
    context.longitude.input,
  );
  const center = pair || DEFAULT_CENTER;
  const canvas = card.querySelector(".restaurant-location-map-card__canvas");
  const map = L.map(canvas, {
    scrollWheelZoom: false,
    zoomControl: true,
  }).setView([center.lat, center.lng], pair ? 16 : 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  card.__restaurantMapState = { map, marker: null, pairKey: "" };
  map.on("click", (event) => {
    applyMapCoordinates(card, event.latlng.lat, event.latlng.lng);
  });

  const sync = () => syncMapFromInputs(card, getMapContext() || context);
  context.latitude.input.addEventListener("input", sync);
  context.longitude.input.addEventListener("input", sync);
  syncMapFromInputs(card, context);
  requestAnimationFrame(() => map.invalidateSize());
  return card;
};

export const enhanceRestaurantInfoMap = () => {
  const context = getMapContext();
  if (!context) return false;

  context.latitude.column?.classList.add("restaurant-coordinate-field");
  context.longitude.column?.classList.add("restaurant-coordinate-field");
  context.row.classList.add("restaurant-address-grid");

  let card = context.row.nextElementSibling;
  if (!card?.classList.contains("restaurant-location-map-card")) {
    if (activeCard && !activeCard.isConnected) {
      activeCard.__restaurantMapState?.map?.remove();
    }
    card = createMapCard(context);
  }

  activeCard = card;
  syncMapFromInputs(card, context, { recenter: true });
  requestAnimationFrame(() => card.__restaurantMapState?.map?.invalidateSize());
  return true;
};

export const installRestaurantInfoMapEnhancement = () => {
  if (
    typeof window === "undefined" ||
    window.__restaurantInfoMapEnhancementInstalled
  ) {
    return;
  }
  window.__restaurantInfoMapEnhancementInstalled = true;

  let scheduled = false;
  const scheduleEnhance = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      enhanceRestaurantInfoMap();
    });
  };

  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest('button, [role="tab"]');
    if (!trigger) return;
    const text = normalizeLabel(trigger.textContent);
    if (text.includes("Địa chỉ & giờ hoạt động")) {
      scheduleEnhance();
      window.setTimeout(scheduleEnhance, 100);
    }
    if (text.includes("Lấy vị trí hiện tại")) {
      [100, 500, 1500, 3500, 9000].forEach((delay) => {
        window.setTimeout(scheduleEnhance, delay);
      });
    }
  });

  window.addEventListener("hashchange", scheduleEnhance);
  window.addEventListener("popstate", scheduleEnhance);
  queueMicrotask(scheduleEnhance);
};
