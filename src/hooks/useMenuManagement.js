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
  }
`;

const FRAG_MENU_ITEM = gql`
  fragment MenuItemFields on MenuItem {
    id
    restaurantId
    menuId
    categoryId
    name
    description
    basePrice
    preparationMethods {
      name
      price
      isDefault
    }
    thumbImage
    mediaAssetIds
    modifierGroupIds
    status
    avgPrepTimeMin
    recipe
    notes
    point
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

/* ======================= Helpers (UI & Price) ======================= */

const TIME_SLOT_OPTIONS = [
  { value: "breakfast", label: "Sáng" },
  { value: "lunch", label: "Trưa" },
  { value: "dinner", label: "Tối" },
  { value: "late_night", label: "Đêm" },
];

function coalesceNumber(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

/** Lấy preparation default (nếu có) */
function getDefaultPreparation(item) {
  const list = Array.isArray(item?.preparationMethods)
    ? item.preparationMethods
    : [];
  if (!list.length) return null;
  return list.find((p) => p?.isDefault) || list[0];
}

/** Tính giá để hiển thị (ưu tiên basePrice nếu > 0; nếu không thì lấy giá của prep default) */
function computeItemPrice(item) {
  const base = coalesceNumber(item?.basePrice, 0);
  if (base > 0) return base;
  const prep = getDefaultPreparation(item);
  return coalesceNumber(prep?.price, 0);
}

/* ======================= Hook ======================= */
/**
 * useMenuManagement
 * @param {object} opts
 * @param {string} opts.restaurantId
 * @param {string|null} [opts.defaultTimeSlot]  - vd 'lunch'; nếu không truyền, tự pick từ menus
 * @param {number} [opts.pageSize=50]          - số item trả về mỗi query (list)
 * @param {boolean} [opts.useConnection=false] - nếu true, dùng cursor pagination
 */
export default function useMenuManagement({
  restaurantId,
  defaultTimeSlot = null,
  pageSize = 50,
  useConnection = false,
} = {}) {
  /* ----------- Menus & chọn timeslot ----------- */
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

  // Auto chọn timeslot: ưu tiên default, nếu không có thì theo thứ tự Sáng -> Trưa -> Tối -> Đêm (nếu menu tồn tại)
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

  /* ----------- Filter state cho items ----------- */
  const [categoryId, setCategoryId] = useState(null);
  const [search, setSearch] = useState("");

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

  /* ----------- Query Items (list hoặc connection) ----------- */
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
          filter: {
            restaurantId,
            timeSlot: selectedTimeSlot || null,
            categoryId: categoryId || null,
            search: search?.trim() || null,
          },
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

  // categories động từ items
  const categories = useMemo(() => {
    const set = new Set((items || []).map((i) => i.categoryId).filter(Boolean));
    return Array.from(set); // nếu cần tên category, thay bằng join với collection Category
  }, [items]);

  // Helpers giá hiển thị
  const itemsWithPrice = useMemo(
    () =>
      (items || []).map((it) => ({
        ...it,
        _displayPrice: computeItemPrice(it),
        _defaultPreparation: getDefaultPreparation(it),
      })),
    [items]
  );

  /* ----------- Mutations ----------- */

  const [ensureMenuMut] = useMutation(M_ENSURE_MENU, {
    // Khi đảm bảo menu theo timeslot, thêm vào cache danh sách menus
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
      // ghép vào list hiện tại nếu khớp filter
      if (useConnection) {
        const qVars = {
          limit: pageSize,
          cursor: null,
          filter: {
            restaurantId,
            timeSlot: selectedTimeSlot || null,
            categoryId: categoryId || null,
            search: search?.trim() || null,
          },
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
    // Apollo tự merge dựa vào id; có thể bơ qua update
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
          filter: {
            restaurantId,
            timeSlot: selectedTimeSlot || null,
            categoryId: categoryId || null,
            search: search?.trim() || null,
          },
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
      // Evict cache record
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

  const [updateBasicMut] = useMutation(M_UPDATE_BASIC, {
    // thường không cần update, Apollo merge theo id
  });

  const [bulkPriceMut] = useMutation(M_BULK_PRICE);

  // Lazy query top items (tuỳ nhu cầu dùng)
  const [
    loadTopItems,
    { data: topData, loading: topLoading, error: topError },
  ] = useLazyQuery(Q_TOP_ITEMS);

  /* ----------- Public API ----------- */

  const ensureMenu = useCallback(
    async ({ timeSlot, name, description, coverImage }) => {
      const { data } = await ensureMenuMut({
        variables: {
          input: { restaurantId, timeSlot, name, description, coverImage },
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
        timeSlot: input.timeSlot || selectedTimeSlot, // server sẽ ensure menu cho timeslot nếu thiếu
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
      // Bạn có thể merge data.bulkUpdateMenuItemPrices.items vào cache nếu muốn “live”
      return data?.bulkUpdateMenuItemPrices || { updatedCount: 0, items: [] };
    },
    [bulkPriceMut]
  );

  const fetchMoreItems = useCallback(async () => {
    if (!useConnection) return null;
    const pageInfo = itemsData?.menuItemsConnection?.pageInfo;
    if (!pageInfo?.hasNextPage) return null;
    return fetchMore({
      variables: {
        cursor: pageInfo.endCursor,
        limit: pageSize,
        filter: {
          restaurantId,
          timeSlot: selectedTimeSlot || null,
          categoryId: categoryId || null,
          search: search?.trim() || null,
        },
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
  }, [
    useConnection,
    itemsData,
    fetchMore,
    pageSize,
    restaurantId,
    selectedTimeSlot,
    categoryId,
    search,
  ]);

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

    // selection/filter
    selectedTimeSlot,
    setSelectedTimeSlot,
    categoryId,
    setCategoryId,
    search,
    setSearch,

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

    // price/helpers
    computeItemPrice,
    getDefaultPreparation,
    findItemByName,

    // mutations
    ensureMenu,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleMenuItemStatus,
    updateMenuItemBasic,
    bulkUpdateMenuItemPrices,

    // top items (lazy)
    loadTopItems,
    topItems: topData?.topMenuItems || [],
    topLoading,
    topError,
  };
}
