import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { gql, useQuery } from "@apollo/client";
import { Check, MapPin, RefreshCw, Store } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildFoodDetailPath } from "../../../utils/customerFoodNavigation";
import "./FoodDetailRestaurantSelectorMount.scss";

const CUSTOMER_MENU_ITEM_LOCATIONS = gql`
  query CustomerMenuItemLocationsForFoodDetail($menuItemId: ID!) {
    customerMenuItemLocations(menuItemId: $menuItemId) {
      menuItemId
      restaurantId
      inventoryStatus
      maxAvailable
      stockWarnings
      isAvailable
      menuItem {
        id
        restaurantId
        defaultServingKey
      }
      restaurant {
        id
        name
        canOrder
        openingStatus
        openingStatusReason
        address {
          line1
          line2
          ward
          district
          city
        }
      }
    }
  }
`;

const getFoodIdFromPath = (pathname) => {
  const match = String(pathname || "").match(/^\/food\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

const formatAddress = (address) =>
  [address?.line1, address?.ward, address?.district, address?.city]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

const hasTrackedStock = (location) => Number(location?.maxAvailable || 0) > 0;

export const getPreferredRestaurantLocation = (
  locations = [],
  currentMenuItemId,
) => {
  const list = Array.isArray(locations) ? locations.filter(Boolean) : [];
  const current = list.find(
    (location) =>
      String(location?.menuItemId || location?.menuItem?.id) ===
      String(currentMenuItemId || ""),
  );

  if (current?.restaurant?.canOrder && current?.isAvailable) return current;

  return (
    list.find(
      (location) =>
        location?.restaurant?.canOrder &&
        location?.isAvailable &&
        hasTrackedStock(location),
    ) ||
    list.find(
      (location) => location?.restaurant?.canOrder && location?.isAvailable,
    ) ||
    list.find((location) => location?.isAvailable && hasTrackedStock(location)) ||
    current ||
    list[0] ||
    null
  );
};

const getStockLabel = (location) => {
  const maxAvailable = Math.max(0, Number(location?.maxAvailable || 0));
  if (maxAvailable > 0) {
    return `Còn ${maxAvailable.toLocaleString("vi-VN")} suất`;
  }
  if (location?.inventoryStatus === "NOT_TRACKED") {
    return "Chưa theo dõi tồn kho";
  }
  if (location?.inventoryStatus === "ERROR") {
    return "Đang kiểm tra tồn kho";
  }
  return "Tạm hết món";
};

export default function FoodDetailRestaurantSelectorMount() {
  const location = useLocation();
  const navigate = useNavigate();
  const foodId = getFoodIdFromPath(location.pathname);
  const [portalHost, setPortalHost] = useState(null);

  const { data, loading, error, refetch } = useQuery(
    CUSTOMER_MENU_ITEM_LOCATIONS,
    {
      variables: { menuItemId: foodId },
      skip: !foodId,
      fetchPolicy: "cache-and-network",
    },
  );

  const locations = useMemo(
    () => data?.customerMenuItemLocations || [],
    [data?.customerMenuItemLocations],
  );

  useEffect(() => {
    if (!foodId || typeof document === "undefined") {
      setPortalHost(null);
      return undefined;
    }

    let host = null;
    const attachHost = () => {
      const anchor = document.querySelector(
        ".food-detail-v2__order-card .food-detail-v2__restaurant-meta",
      );
      if (!anchor) return false;

      host = document.createElement("div");
      host.className = "food-detail-v2__restaurant-locations-host";
      anchor.insertAdjacentElement("afterend", host);
      setPortalHost(host);
      return true;
    };

    if (attachHost()) {
      return () => host?.remove();
    }

    const observer = new MutationObserver(() => {
      if (attachHost()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      host?.remove();
    };
  }, [foodId]);

  useEffect(() => {
    if (!foodId || !locations.length) return;
    if (location.state?.restaurantSelectionMode === "manual") return;

    const preferred = getPreferredRestaurantLocation(locations, foodId);
    const preferredMenuItemId = preferred?.menuItemId || preferred?.menuItem?.id;
    if (!preferredMenuItemId || String(preferredMenuItemId) === String(foodId)) {
      return;
    }

    navigate(
      buildFoodDetailPath(preferredMenuItemId, {
        restaurantId: preferred.restaurantId,
      }),
      {
        replace: true,
        state: {
          restaurantId: preferred.restaurantId,
          selectedVariantKey: preferred.menuItem?.defaultServingKey || undefined,
          restaurantSelectionMode: "auto",
        },
      },
    );
  }, [foodId, location.state?.restaurantSelectionMode, locations, navigate]);

  const handleSelect = (option) => {
    const nextMenuItemId = option?.menuItemId || option?.menuItem?.id;
    if (!nextMenuItemId || String(nextMenuItemId) === String(foodId)) return;

    navigate(
      buildFoodDetailPath(nextMenuItemId, {
        restaurantId: option.restaurantId,
      }),
      {
        state: {
          restaurantId: option.restaurantId,
          selectedVariantKey: option.menuItem?.defaultServingKey || undefined,
          restaurantSelectionMode: "manual",
        },
      },
    );
  };

  if (!foodId || !portalHost) return null;

  return createPortal(
    <section
      className="food-location-selector"
      aria-labelledby="food-location-selector-title"
    >
      <div className="food-location-selector__heading">
        <div>
          <span>Chọn nơi phục vụ</span>
          <strong id="food-location-selector-title">
            Nhà hàng có món này
          </strong>
        </div>
        {!loading && !error ? (
          <small>{locations.length} nhà hàng</small>
        ) : null}
      </div>

      {loading && !locations.length ? (
        <div className="food-location-selector__state" aria-live="polite">
          Đang kiểm tra các nhà hàng…
        </div>
      ) : null}

      {error ? (
        <div className="food-location-selector__state is-error" role="alert">
          <span>Chưa tải được danh sách nhà hàng.</span>
          <button type="button" onClick={() => refetch?.()}>
            <RefreshCw size={14} /> Thử lại
          </button>
        </div>
      ) : null}

      {!loading && !error && locations.length ? (
        <div className="food-location-selector__list" role="list">
          {locations.map((option) => {
            const optionMenuItemId =
              option?.menuItemId || option?.menuItem?.id;
            const selected = String(optionMenuItemId) === String(foodId);
            const canOrder = Boolean(
              option?.restaurant?.canOrder && option?.isAvailable,
            );
            const address = formatAddress(option?.restaurant?.address);

            return (
              <button
                key={`${option.restaurantId}:${optionMenuItemId}`}
                type="button"
                role="listitem"
                className={`food-location-selector__option ${
                  selected ? "is-selected" : ""
                } ${canOrder ? "is-orderable" : ""}`.trim()}
                aria-pressed={selected}
                onClick={() => handleSelect(option)}
              >
                <span className="food-location-selector__icon" aria-hidden="true">
                  <Store size={17} />
                </span>
                <span className="food-location-selector__content">
                  <strong>{option?.restaurant?.name || "Nhà hàng"}</strong>
                  <small>
                    <MapPin size={12} aria-hidden="true" />
                    {address || "Địa chỉ đang cập nhật"}
                  </small>
                  <span>
                    {option?.restaurant?.canOrder
                      ? "Đang nhận đơn"
                      : "Chưa nhận đơn"}
                  </span>
                </span>
                <span
                  className={`food-location-selector__stock ${
                    canOrder ? "is-available" : ""
                  }`}
                >
                  {selected ? <Check size={13} aria-hidden="true" /> : null}
                  {getStockLabel(option)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>,
    portalHost,
  );
}
