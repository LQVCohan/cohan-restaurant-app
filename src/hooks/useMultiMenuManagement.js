import { gql, useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import useMenuManagement from "./useMenuManagement";

const MENU_ITEM_FIELDS = gql`
  fragment MultiMenuItemFields on MenuItem {
    id
    restaurantId
    menuId
    categoryId
    code
    name
    description
    sortOrder
    labels
    foodType
    meatTypes
    dietTags
    allergenTags
    tasteProfile {
      containsOnion
      containsCilantro
      sugar
      spice
    }
    basePrice
    defaultServingKey
    hasByWeightVariant
    servingVariants {
      key
      name
      mode
      sellQty
      sellUnit
      price
      isDefault
    }
    taxRate
    servingPortion
    servingUnit
    prepStation
    printStationId
    thumbImage
    mediaAssetIds
    status
    inventoryStatus
    maxAvailable
    stockWarnings
    stockShortages {
      ingredientId
      ingredientName
      available
      required
      missing
      unit
    }
    avgPrepTimeMin
    point
    rate
    orderCounter
    notes
    createdAt
    updatedAt
  }
`;

const EXACT_MENU_ITEMS = gql`
  query ExactMenuItemsConnection(
    $limit: Int = 50
    $cursor: ID
    $filter: MenuItemFilter!
  ) {
    menuItemsConnection(limit: $limit, cursor: $cursor, filter: $filter) {
      edges {
        cursor
        node {
          ...MultiMenuItemFields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
  ${MENU_ITEM_FIELDS}
`;

const ENSURE_EXACT_MENU = gql`
  mutation EnsureExactMenu($input: EnsureMenuInput!) {
    ensureMenu(input: $input) {
      id
      restaurantId
      timeSlot
      name
      description
      coverImage
      isActive
      itemCount
      revenue
      orderCount
      soldItemCount
      rating
      categoryMenu {
        id
        name
        description
        isActive
      }
      createdAt
      updatedAt
    }
  }
`;

const enrichPrice = (item) => {
  const variants = Array.isArray(item?.servingVariants)
    ? item.servingVariants.filter(Boolean)
    : [];
  const defaultVariant =
    variants.find((variant) => variant?.isDefault) ||
    (variants.length === 1 ? variants[0] : null);
  const prices = variants
    .map((variant) => Number(variant?.price))
    .filter((price) => Number.isFinite(price) && price >= 0);
  const basePrice = Number(item?.basePrice);
  const displayPrice = Number.isFinite(Number(defaultVariant?.price))
    ? Number(defaultVariant.price)
    : Number.isFinite(basePrice)
      ? basePrice
      : prices[0] ?? null;

  return {
    ...item,
    _displayPrice: displayPrice,
    _priceRange:
      !defaultVariant && prices.length
        ? { min: Math.min(...prices), max: Math.max(...prices) }
        : null,
    _defaultVariant: defaultVariant,
    _normalizedVariants: variants,
    _displayUnit:
      defaultVariant?.mode === "BY_WEIGHT"
        ? defaultVariant.sellUnit || "kg"
        : "portion",
  };
};

export default function useMultiMenuManagement(options = {}) {
  const base = useMenuManagement({ ...options, useConnection: false });
  const { restaurantId, pageSize = 50, sort = "default" } = options;
  const [selectedMenuId, setSelectedMenuId] = useState(null);
  const [ensureMenuMutation] = useMutation(ENSURE_EXACT_MENU);

  const selectedMenu = useMemo(
    () =>
      base.menus.find((menu) => String(menu.id) === String(selectedMenuId)) ||
      null,
    [base.menus, selectedMenuId],
  );

  useEffect(() => {
    if (!base.menus.length) {
      setSelectedMenuId(null);
      return;
    }
    if (
      selectedMenu &&
      selectedMenu.timeSlot === base.selectedTimeSlot
    ) {
      return;
    }
    const next =
      base.menus.find((menu) => menu.timeSlot === base.selectedTimeSlot) ||
      base.menus[0];
    setSelectedMenuId(next?.id || null);
    if (next?.timeSlot && next.timeSlot !== base.selectedTimeSlot) {
      base.setSelectedTimeSlot(next.timeSlot);
    }
  }, [base.menus, base.selectedTimeSlot, selectedMenu]);

  const filter = useMemo(
    () => ({
      restaurantId,
      menuId: selectedMenuId,
      timeSlot: selectedMenu?.timeSlot || base.selectedTimeSlot || null,
      categoryId: base.categoryId || null,
      search: base.search?.trim() || null,
      status: base.statusFilter || null,
      minPrice:
        base.priceRange.minPrice !== null && base.priceRange.minPrice !== ""
          ? Number(base.priceRange.minPrice)
          : null,
      maxPrice:
        base.priceRange.maxPrice !== null && base.priceRange.maxPrice !== ""
          ? Number(base.priceRange.maxPrice)
          : null,
      sort,
    }),
    [
      restaurantId,
      selectedMenuId,
      selectedMenu?.timeSlot,
      base.selectedTimeSlot,
      base.categoryId,
      base.search,
      base.statusFilter,
      base.priceRange.minPrice,
      base.priceRange.maxPrice,
      sort,
    ],
  );

  const {
    data,
    loading: itemsLoading,
    error: itemsError,
    refetch,
    fetchMore,
  } = useQuery(EXACT_MENU_ITEMS, {
    variables: { limit: pageSize, cursor: null, filter },
    skip: !restaurantId || !selectedMenuId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const items = useMemo(
    () =>
      (data?.menuItemsConnection?.edges || []).map((edge) => edge.node),
    [data],
  );
  const pageInfo = data?.menuItemsConnection?.pageInfo || {
    hasNextPage: false,
    endCursor: null,
  };
  const itemsWithPrice = useMemo(() => items.map(enrichPrice), [items]);

  const selectTimeSlot = useCallback(
    (timeSlot) => {
      base.setSelectedTimeSlot(timeSlot);
      const firstMenu = base.menus.find((menu) => menu.timeSlot === timeSlot);
      setSelectedMenuId(firstMenu?.id || null);
      base.setCategoryId(null);
    },
    [base],
  );

  const selectMenu = useCallback(
    (menuOrId) => {
      const id = typeof menuOrId === "object" ? menuOrId?.id : menuOrId;
      const menu = base.menus.find((entry) => String(entry.id) === String(id));
      setSelectedMenuId(menu?.id || null);
      if (menu?.timeSlot) base.setSelectedTimeSlot(menu.timeSlot);
      base.setCategoryId(null);
    },
    [base],
  );

  const ensureMenu = useCallback(
    async (input) => {
      const { data: result } = await ensureMenuMutation({
        variables: { input: { restaurantId, ...input } },
      });
      return result?.ensureMenu || null;
    },
    [ensureMenuMutation, restaurantId],
  );

  const refetchItems = useCallback(
    (overrides = {}) =>
      refetch({
        limit: pageSize,
        cursor: null,
        filter: { ...filter, ...(overrides.filter || {}) },
      }),
    [filter, pageSize, refetch],
  );

  const fetchMoreItems = useCallback(() => {
    if (!pageInfo.hasNextPage || !pageInfo.endCursor) return null;
    return fetchMore({
      variables: {
        limit: pageSize,
        cursor: pageInfo.endCursor,
        filter,
      },
      updateQuery: (previous, { fetchMoreResult }) => {
        if (!fetchMoreResult) return previous;
        return {
          menuItemsConnection: {
            ...fetchMoreResult.menuItemsConnection,
            edges: [
              ...previous.menuItemsConnection.edges,
              ...fetchMoreResult.menuItemsConnection.edges,
            ],
          },
        };
      },
    });
  }, [fetchMore, filter, pageInfo, pageSize]);

  const syncMenuItemInventoryStatuses = useCallback(
    (input = {}) =>
      base.syncMenuItemInventoryStatuses({
        menuId: selectedMenuId,
        timeSlot: selectedMenu?.timeSlot || base.selectedTimeSlot,
        ...input,
      }),
    [base, selectedMenuId, selectedMenu?.timeSlot],
  );

  return {
    ...base,
    selectedMenuId,
    selectedMenu,
    setSelectedMenuId,
    selectMenu,
    setSelectedTimeSlot: selectTimeSlot,
    items,
    itemsWithPrice,
    pageInfo,
    itemsLoading: !selectedMenuId ? false : itemsLoading,
    itemsError,
    refetchItems,
    fetchMoreItems,
    ensureMenu,
    syncMenuItemInventoryStatuses,
  };
}
