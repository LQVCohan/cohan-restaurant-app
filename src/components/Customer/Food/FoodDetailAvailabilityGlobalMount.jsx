import React, { useContext, useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { useLocation } from "react-router-dom";
import { AuthContext } from "../../../context/AuthContext";
import FoodAvailabilityWatchPanel from "./FoodAvailabilityWatchPanel";

const GET_TOP_MENU_ITEMS_FOR_AVAILABILITY = gql`
  query GetTopMenuItemsForAvailabilityPanel($limit: Int = 120) {
    topMenuItems(limit: $limit) {
      id
      restaurantId
      servingVariants {
        key
      }
    }
  }
`;

const MENU_ITEM_LIVE_STATE_FOR_AVAILABILITY = gql`
  query MenuItemLiveStateForAvailabilityPanel($input: MenuItemLiveStateInput!) {
    menuItemLiveState(input: $input) {
      itemType
      maxAvailableQty
      outOfStock
    }
  }
`;

function getFoodIdFromPath(pathname) {
  const match = String(pathname || "").match(/^\/food\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function FoodDetailAvailabilityGlobalMount() {
  const location = useLocation();
  const { user } = useContext(AuthContext) || {};
  const foodId = getFoodIdFromPath(location.pathname);

  const { data: menuData } = useQuery(GET_TOP_MENU_ITEMS_FOR_AVAILABILITY, {
    variables: { limit: 120 },
    skip: !foodId,
    fetchPolicy: "cache-and-network",
  });

  const food = useMemo(() => {
    const list = menuData?.topMenuItems || [];
    return list.find((item) => String(item.id) === String(foodId)) || null;
  }, [menuData, foodId]);

  const servingKey = useMemo(() => {
    const variants = Array.isArray(food?.servingVariants) ? food.servingVariants : [];
    return variants?.[0]?.key || "portion";
  }, [food?.servingVariants]);

  const { data: liveData, refetch } = useQuery(MENU_ITEM_LIVE_STATE_FOR_AVAILABILITY, {
    variables: {
      input: {
        itemType: "MENU_ITEM",
        restaurantId: food?.restaurantId,
        menuItemId: food?.id,
        servingVariantKey: servingKey,
        userId: user?.id,
      },
    },
    skip: !food?.restaurantId || !food?.id || !servingKey,
    fetchPolicy: "network-only",
    pollInterval: 10000,
  });

  if (!foodId || !food?.restaurantId || !food?.id) return null;

  const liveState = liveData?.menuItemLiveState;
  const isOutOfStock = Boolean(
    liveState && (liveState.outOfStock || Number(liveState.maxAvailableQty || 0) < 1),
  );

  return (
    <div className="fd-availability-global-mount">
      <FoodAvailabilityWatchPanel
        restaurantId={food.restaurantId}
        menuItemId={food.id}
        servingKey={servingKey}
        desiredQuantity={1}
        userId={user?.id}
        source="online"
        isVisible={isOutOfStock}
        isOutOfStock={isOutOfStock}
        onRegistered={() => refetch?.()}
      />
    </div>
  );
}
