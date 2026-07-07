import { beforeEach, describe, expect, it, vi } from "vitest";

const leafletState = vi.hoisted(() => {
  const mapHandlers = {};
  const markerHandlers = {};
  const map = {
    setView: vi.fn(),
    getZoom: vi.fn(() => 16),
    on: vi.fn((name, handler) => {
      mapHandlers[name] = handler;
      return map;
    }),
    invalidateSize: vi.fn(),
    removeLayer: vi.fn(),
    remove: vi.fn(),
  };
  map.setView.mockImplementation(() => map);

  const marker = {
    addTo: vi.fn(() => marker),
    on: vi.fn((name, handler) => {
      markerHandlers[name] = handler;
      return marker;
    }),
    setLatLng: vi.fn(),
  };
  const markerIcon = { kind: "restaurant-location-marker" };

  return {
    map,
    marker,
    markerIcon,
    mapHandlers,
    markerHandlers,
    mapFactory: vi.fn(() => map),
    markerFactory: vi.fn(() => marker),
    divIconFactory: vi.fn(() => markerIcon),
    tileAddTo: vi.fn(),
  };
});

vi.mock("leaflet", () => ({
  default: {
    divIcon: leafletState.divIconFactory,
    map: leafletState.mapFactory,
    marker: leafletState.markerFactory,
    tileLayer: vi.fn(() => ({ addTo: leafletState.tileAddTo })),
  },
}));

import {
  enhanceRestaurantInfoMap,
  readRestaurantCoordinatePair,
} from "./installRestaurantInfoMapEnhancement";

const renderCoordinateFields = () => {
  document.body.innerHTML = `
    <div class="restaurant-management-container">
      <div class="ant-card-body">
        <div class="ant-row" data-address-row>
          <div class="ant-col">
            <div class="ant-form-item">
              <div class="ant-form-item-label"><label>Vĩ độ</label></div>
              <input type="number" value="10.895109" />
            </div>
          </div>
          <div class="ant-col">
            <div class="ant-form-item">
              <div class="ant-form-item-label"><label>Kinh độ</label></div>
              <input type="number" value="106.833394" />
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

describe("restaurant information location map enhancement", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/manager#restaurant-info-management");
    window.requestAnimationFrame = (callback) => {
      callback();
      return 1;
    };
    Object.keys(leafletState.mapHandlers).forEach(
      (key) => delete leafletState.mapHandlers[key],
    );
    Object.keys(leafletState.markerHandlers).forEach(
      (key) => delete leafletState.markerHandlers[key],
    );
    vi.clearAllMocks();
    renderCoordinateFields();
  });

  it("renders the stored point with the custom marker and writes map clicks back to controlled inputs", () => {
    expect(enhanceRestaurantInfoMap()).toBe(true);

    const card = document.querySelector(".restaurant-location-map-card");
    const [latInput, lngInput] = document.querySelectorAll('input[type="number"]');

    expect(card).not.toBeNull();
    expect(leafletState.mapFactory).toHaveBeenCalledTimes(1);
    expect(leafletState.markerFactory).toHaveBeenCalledWith(
      [10.895109, 106.833394],
      { draggable: true, icon: leafletState.markerIcon },
    );

    leafletState.mapHandlers.click({
      latlng: { lat: 10.9012344, lng: 106.8123456 },
    });

    expect(latInput.value).toBe("10.901234");
    expect(lngInput.value).toBe("106.812346");
    expect(card.querySelector("[data-map-lat]")).toHaveTextContent("10.901234");
    expect(card.querySelector("[data-map-lng]")).toHaveTextContent("106.812346");
  });

  it("rejects an incomplete or out-of-range coordinate pair", () => {
    const [latInput, lngInput] = document.querySelectorAll('input[type="number"]');
    lngInput.value = "";
    expect(readRestaurantCoordinatePair(latInput, lngInput)).toBeNull();

    lngInput.value = "190";
    expect(readRestaurantCoordinatePair(latInput, lngInput)).toBeNull();
  });
});
