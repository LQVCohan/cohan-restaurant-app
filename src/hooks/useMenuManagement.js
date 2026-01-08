// src/hooks/useMenuManagement.js
import { gql, useLazyQuery, useMutation, useQuery } from "@apollo/client";
import { useCallback, useEffect, useMemo, useState } from "react";

/* ======================= GraphQL Fragments ======================= */

const FRAG_MENU = gql`
  fragment MenuFields on Menu {
    id
    restaurantId
    timeSlot
    name
    description
    coverImage
    isActive
    createdAt
    updatedAt
    categoryMenu {
      id
      name
      description
      isActive
    }
  }
`;

const FRAG_MENU_ITEM = gql`
  fragment MenuItemFields on MenuItem {
    id
    restaurantId
    menuId
    categoryId
    code
    name
    description
    sortOrder
    labels

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

    printStationId
    thumbImage
    mediaAssetIds

    status
    avgPrepTimeMin
    point
    notes
    createdAt
    updatedAt
  }
`;

/* ======================= GraphQL Queries ======================= */

const Q_MENUS = gql`
  query Menus($restaurantId: ID!) {
    menus(restaurantId: $restaurantId) {
      ...MenuFields
    }
  }
  ${FRAG_MENU}
`;

const Q_MENU_ITEMS = gql`
  query MenuItems(
    $restaurantId: ID!
    $timeSlot: TimeSlot
    $categoryId: ID
    $search: String
    $limit: Int = 50
  ) {
    menuItems(
      restaurantId: $restaurantId
      timeSlot: $timeSlot
      categoryId: $categoryId
      search: $search
      limit: $limit
    ) {
      ...MenuItemFields
    }
  }
  ${FRAG_MENU_ITEM}
`;

const Q_MENU_ITEMS_CONNECTION = gql`
  query MenuItemsConnection(
    $limit: Int = 20
    $cursor: ID
    $filter: MenuItemFilter!
  ) {
    menuItemsConnection(limit: $limit, cursor: $cursor, filter: $filter) {
      edges {
        cursor
        node {
          ...MenuItemFields
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
  ${FRAG_MENU_ITEM}
`;

const Q_TOP_ITEMS = gql`
  query TopMenuItems($limit: Int = 8, $restaurantId: ID, $categoryId: ID) {
    topMenuItems(
      limit: $limit
      restaurantId: $restaurantId
      categoryId: $categoryId
    ) {
      ...MenuItemFields
    }
  }
  ${FRAG_MENU_ITEM}
`;

/* ======================= GraphQL Mutations ======================= */

const M_ENSURE_MENU = gql`
  mutation EnsureMenu($input: EnsureMenuInput!) {
    ensureMenu(input: $input) {
      ...MenuFields
    }
  }
  ${FRAG_MENU}
`;

const M_CREATE_ITEM = gql`
  mutation CreateMenuItem($input: CreateMenuItemInput!) {
    createMenuItem(input: $input) {
      ...MenuItemFields
    }
  }
  ${FRAG_MENU_ITEM}
`;

const M_UPDATE_ITEM = gql`
  mutation UpdateMenuItem($input: UpdateMenuItemInput!) {
    updateMenuItem(input: $input) {
      ...MenuItemFields
    }
  }
  ${FRAG_MENU_ITEM}
`;

const M_DELETE_ITEM = gql`
  mutation DeleteMenuItem($id: ID!) {
    deleteMenuItem(id: $id)
  }
`;

const M_TOGGLE_STATUS = gql`
  mutation ToggleMenuItemStatus($id: ID!, $status: String!) {
    toggleMenuItemStatus(id: $id, status: $status) {
      id
      status
    }
  }
`;

const M_UPDATE_BASIC = gql`
  mutation UpdateMenuItemBasic($input: UpdateMenuItemBasicInput!) {
    updateMenuItemBasic(input: $input) {
      ...MenuItemFields
    }
  }
  ${FRAG_MENU_ITEM}
`;

const M_BULK_PRICE = gql`
  mutation BulkUpdateMenuItemPrices($input: BulkPriceUpdateInput!) {
    bulkUpdateMenuItemPrices(input: $input) {
      updatedCount
      items {
        ...MenuItemFields
      }
    }
  }
  ${FRAG_MENU_ITEM}
`;

/* ======================= Helpers ======================= */

const TIME_SLOT_OPTIONS = [
  { value: "breakfast", label: "Sáng" },
  { value: "lunch", label: "Trưa" },
  { value: "dinner", label: "Tối" },
  { value: "late_night", label: "Đêm" },
];

const coalesceNumber = (n, fallback = null) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
};

function computeItemPricing(item) {
  const variants = Array.isArray(item?.servingVariants)
    ? item.servingVariants.filter(Boolean)
    : [];

  const normalized = variants.map((v, idx) => {
    const key = v.key || `variant_${idx}`;
    return {
      key,
      name: v.name || "",
      mode: v.mode || "PORTION",
      sellUnit: v.sellUnit || "portion",
      price:
        v.price === null || v.price === undefined
          ? null
          : coalesceNumber(v.price, null),
      isDefault: !!v.isDefault,
    };
  });

  const defaultVariant =
    normalized.find((v) => v.isDefault) ||
    (normalized.length === 1 ? normalized[0] : null);

  const priceList = normalized
    .map((v) => v.price)
    .filter((p) => Number.isFinite(p) && p >= 0);

  const basePrice =
    Number.isFinite(item?.basePrice) && item.basePrice >= 0
      ? item.basePrice
      : null;

  const displayPrice = Number.isFinite(
    defaultVariant?.price ?? basePrice ?? priceList[0]
  )
    ? coalesceNumber(defaultVariant?.price ?? basePrice ?? priceList[0], null)
    : null;

  const hasRange = !defaultVariant && priceList.length > 0;
  const minPrice = priceList.length ? Math.min(...priceList) : null;
  const maxPrice = priceList.length ? Math.max(...priceList) : null;

  const priceRange =
    hasRange && minPrice !== null
      ? { min: minPrice, max: maxPrice ?? minPrice }
      : null;

  const unit =
    defaultVariant?.mode === "BY_WEIGHT"
      ? defaultVariant.sellUnit || "kg"
      : "portion";

  return {
    variants: normalized,
    defaultVariant,
    displayPrice,
    priceRange,
    unit,
  };
}

function computeItemPrice(item) {
  const price = computeItemPricing(item).displayPrice;
  return Number.isFinite(price) ? price : 0;
}

/* ======================= Hook ======================= */

export default function useMenuManagement({
  restaurantId,
  defaultTimeSlot = null,
  pageSize = 50,
  useConnection = false,
} = {}) {
  /* ---- Menus & timeSlot ---- */
  const {
    data: menusData,
    loading: menusLoading,
    error: menusError,
    refetch: refetchMenus,
  } = useQuery(Q_MENUS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const menus = useMemo(() => menusData?.menus || [], [menusData]);

  const [selectedTimeSlot, setSelectedTimeSlot] = useState(defaultTimeSlot);

  useEffect(() => {
    if (!menus.length) return;
    if (
      selectedTimeSlot &&
      menus.some((m) => m.timeSlot === selectedTimeSlot)
    ) {
      return;
    }
    const available = TIME_SLOT_OPTIONS.map((o) => o.value).filter((v) =>
      menus.some((m) => m.timeSlot === v)
    );
    if (defaultTimeSlot && available.includes(defaultTimeSlot)) {
      setSelectedTimeSlot(defaultTimeSlot);
    } else {
      setSelectedTimeSlot(available[0] || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menus, defaultTimeSlot]);

  /* ---- Filters ---- */
  const [categoryId, setCategoryId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [priceRange, setPriceRange] = useState({
    minPrice: null,
    maxPrice: null,
  });

  const itemsVariables = useMemo(
    () => ({
      restaurantId,
      timeSlot: selectedTimeSlot || null,
      categoryId: categoryId || null,
      search: search?.trim() || null,
      limit: pageSize,
    }),
    [restaurantId, selectedTimeSlot, categoryId, search, pageSize]
  );

  const filterForConnection = useMemo(
    () => ({
      restaurantId,
      timeSlot: selectedTimeSlot || null,
      categoryId: categoryId || null,
      search: search?.trim() || null,
      status: statusFilter || null,
      minPrice:
        priceRange.minPrice !== null && priceRange.minPrice !== ""
          ? Number(priceRange.minPrice)
          : null,
      maxPrice:
        priceRange.maxPrice !== null && priceRange.maxPrice !== ""
          ? Number(priceRange.maxPrice)
          : null,
    }),
    [
      restaurantId,
      selectedTimeSlot,
      categoryId,
      search,
      statusFilter,
      priceRange.minPrice,
      priceRange.maxPrice,
    ]
  );

  /* ---- Query items ---- */
  const {
    data: itemsData,
    loading: itemsLoading,
    error: itemsError,
    refetch: refetchItems,
    fetchMore,
  } = useQuery(useConnection ? Q_MENU_ITEMS_CONNECTION : Q_MENU_ITEMS, {
    variables: useConnection
      ? {
          limit: pageSize,
          cursor: null,
          filter: filterForConnection,
        }
      : itemsVariables,
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const items = useMemo(() => {
    if (useConnection) {
      const edges = itemsData?.menuItemsConnection?.edges || [];
      return edges.map((e) => e.node);
    }
    return itemsData?.menuItems || [];
  }, [itemsData, useConnection]);

  const pageInfo = useMemo(
    () =>
      useConnection
        ? itemsData?.menuItemsConnection?.pageInfo || {
            hasNextPage: false,
            endCursor: null,
          }
        : null,
    [itemsData, useConnection]
  );

  const categories = useMemo(() => {
    const set = new Set((items || []).map((i) => i.categoryId).filter(Boolean));
    return Array.from(set);
  }, [items]);

  const itemsWithPrice = useMemo(
    () =>
      (items || []).map((it) => {
        const pricing = computeItemPricing(it);
        return {
          ...it,
          _displayPrice: pricing.displayPrice,
          _priceRange: pricing.priceRange,
          _defaultVariant: pricing.defaultVariant,
          _normalizedVariants: pricing.variants,
          _displayUnit: pricing.unit,
        };
      }),
    [items]
  );

  /* ---- Mutations ---- */

  const [ensureMenuMut] = useMutation(M_ENSURE_MENU, {
    update(cache, { data }) {
      const created = data?.ensureMenu;
      if (!created) return;
      const qVars = { restaurantId };
      cache.updateQuery({ query: Q_MENUS, variables: qVars }, (prev) => {
        if (!prev?.menus) return prev;
        const exists = prev.menus.some((m) => m.id === created.id);
        return exists ? prev : { menus: [...prev.menus, created] };
      });
    },
  });

  const [createItemMut] = useMutation(M_CREATE_ITEM, {
    update(cache, { data }) {
      const created = data?.createMenuItem;
      if (!created) return;
      if (useConnection) {
        const qVars = {
          limit: pageSize,
          cursor: null,
          filter: filterForConnection,
        };
        cache.updateQuery(
          { query: Q_MENU_ITEMS_CONNECTION, variables: qVars },
          (prev) => {
            if (!prev?.menuItemsConnection) return prev;
            return {
              menuItemsConnection: {
                ...prev.menuItemsConnection,
                edges: [
                  { cursor: created.id, node: created },
                  ...prev.menuItemsConnection.edges,
                ],
              },
            };
          }
        );
      } else {
        cache.updateQuery(
          { query: Q_MENU_ITEMS, variables: itemsVariables },
          (prev) => {
            if (!prev?.menuItems) return prev;
            return { menuItems: [created, ...prev.menuItems] };
          }
        );
      }
    },
  });

  const [updateItemMut] = useMutation(M_UPDATE_ITEM, {
    optimisticResponse: ({ input }) => ({
      updateMenuItem: {
        __typename: "MenuItem",
        id: input.id,
        ...Object.fromEntries(
          Object.entries(input).filter(([k]) => k !== "id")
        ),
      },
    }),
  });

  const [deleteItemMut] = useMutation(M_DELETE_ITEM, {
    optimisticResponse: ({ id }) => ({ deleteMenuItem: true }),
    update(cache, { variables }) {
      const id = variables?.id;
      if (!id) return;
      if (useConnection) {
        const qVars = {
          limit: pageSize,
          cursor: null,
          filter: filterForConnection,
        };
        cache.updateQuery(
          { query: Q_MENU_ITEMS_CONNECTION, variables: qVars },
          (prev) => {
            if (!prev?.menuItemsConnection) return prev;
            const nextEdges = prev.menuItemsConnection.edges.filter(
              (e) => e.node.id !== id
            );
            return {
              menuItemsConnection: {
                ...prev.menuItemsConnection,
                edges: nextEdges,
              },
            };
          }
        );
      } else {
        cache.updateQuery(
          { query: Q_MENU_ITEMS, variables: itemsVariables },
          (prev) => {
            if (!prev?.menuItems) return prev;
            return { menuItems: prev.menuItems.filter((i) => i.id !== id) };
          }
        );
      }
      cache.evict({ id: cache.identify({ __typename: "MenuItem", id }) });
      cache.gc();
    },
  });

  const [toggleStatusMut] = useMutation(M_TOGGLE_STATUS, {
    optimisticResponse: ({ id, status }) => ({
      toggleMenuItemStatus: { __typename: "MenuItem", id, status },
    }),
    update(cache, { data }) {
      const res = data?.toggleMenuItemStatus;
      if (!res?.id) return;
      cache.modify({
        id: cache.identify({ __typename: "MenuItem", id: res.id }),
        fields: { status: () => res.status },
      });
    },
  });

  const [updateBasicMut] = useMutation(M_UPDATE_BASIC);
  const [bulkPriceMut] = useMutation(M_BULK_PRICE);

  const [
    loadTopItems,
    { data: topData, loading: topLoading, error: topError },
  ] = useLazyQuery(Q_TOP_ITEMS);

  /* ---- Public API ---- */

  const ensureMenu = useCallback(
    async ({
      timeSlot,
      name,
      description,
      coverImage,
      isActive,
      categoryMenuId,
    }) => {
      const { data } = await ensureMenuMut({
        variables: {
          input: {
            restaurantId,
            timeSlot,
            name,
            description,
            coverImage,
            isActive,
            categoryMenuId,
          },
        },
      });
      return data?.ensureMenu || null;
    },
    [ensureMenuMut, restaurantId]
  );

  const createMenuItem = useCallback(
    async (input) => {
      const payload = {
        ...input,
        restaurantId,
        timeSlot: input.timeSlot || selectedTimeSlot,
      };
      const { data } = await createItemMut({ variables: { input: payload } });
      return data?.createMenuItem || null;
    },
    [createItemMut, restaurantId, selectedTimeSlot]
  );

  const updateMenuItem = useCallback(
    async (input) => {
      const { data } = await updateItemMut({ variables: { input } });
      return data?.updateMenuItem || null;
    },
    [updateItemMut]
  );

  const deleteMenuItem = useCallback(
    async (id) => {
      const { data } = await deleteItemMut({ variables: { id } });
      return !!data?.deleteMenuItem;
    },
    [deleteItemMut]
  );

  const toggleMenuItemStatus = useCallback(
    async ({ id, status }) => {
      const { data } = await toggleStatusMut({ variables: { id, status } });
      return data?.toggleMenuItemStatus || null;
    },
    [toggleStatusMut]
  );

  const updateMenuItemBasic = useCallback(
    async ({
      restaurantId: rid,
      menuItemId,
      name,
      description,
      categoryId: cid,
    }) => {
      const { data } = await updateBasicMut({
        variables: {
          input: {
            restaurantId: rid ?? restaurantId,
            menuItemId,
            name,
            description,
            categoryId: cid,
          },
        },
      });
      return data?.updateMenuItemBasic || null;
    },
    [updateBasicMut, restaurantId]
  );

  const bulkUpdateMenuItemPrices = useCallback(
    async (input) => {
      const { data } = await bulkPriceMut({ variables: { input } });
      return data?.bulkUpdateMenuItemPrices || { updatedCount: 0, items: [] };
    },
    [bulkPriceMut]
  );

  const fetchMoreItems = useCallback(async () => {
    if (!useConnection) return null;
    if (!pageInfo?.hasNextPage) return null;
    return fetchMore({
      variables: {
        cursor: pageInfo.endCursor,
        limit: pageSize,
        filter: filterForConnection,
      },
      updateQuery: (prev, { fetchMoreResult }) => {
        if (!fetchMoreResult) return prev;
        return {
          menuItemsConnection: {
            ...fetchMoreResult.menuItemsConnection,
            edges: [
              ...prev.menuItemsConnection.edges,
              ...fetchMoreResult.menuItemsConnection.edges,
            ],
          },
        };
      },
    });
  }, [useConnection, pageInfo, fetchMore, pageSize, filterForConnection]);

  const findItemByName = useCallback(
    (name) =>
      (items || []).find(
        (i) => (i.name || "").toLowerCase() === (name || "").toLowerCase()
      ) || null,
    [items]
  );

  return {
    // data
    menus,
    items,
    itemsWithPrice,
    categories,
    timeSlotOptions: TIME_SLOT_OPTIONS,
    pageInfo,

    // selection/filter
    selectedTimeSlot,
    setSelectedTimeSlot,
    categoryId,
    setCategoryId,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    priceRange,
    setPriceRange,

    // loading & errors
    menusLoading,
    menusError,
    itemsLoading,
    itemsError,

    // queries utils
    refetchMenus,
    refetchItems,
    useConnection,
    fetchMoreItems,

    // helpers
    computeItemPrice,
    computeItemPricing,
    findItemByName,

    // mutations
    ensureMenu,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleMenuItemStatus,
    updateMenuItemBasic,
    bulkUpdateMenuItemPrices,

    // top items
    loadTopItems,
    topItems: topData?.topMenuItems || [],
    topLoading,
    topError,
  };
}
