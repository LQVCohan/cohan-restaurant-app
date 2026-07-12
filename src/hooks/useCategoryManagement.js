// src/hooks/useCategoryManagement.js
import { useQuery, useMutation, gql } from "@apollo/client";
import { useCallback, useMemo } from "react";
import { useNotification } from "../hooks/useNotification";

/* ===========================================
   CATEGORY (theo timeSlot)
=========================================== */

const GET_CATEGORIES = gql`
  query GetCategories(
    $restaurantId: ID!
    $timeSlot: TimeSlot!
    $menuId: ID
  ) {
    categories(
      restaurantId: $restaurantId
      timeSlot: $timeSlot
      menuId: $menuId
    ) {
      id
      name
      icon
      order
      isActive
      menuItemCount
      createdAt
      updatedAt
    }
  }
`;

const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      name
      icon
      order
      isActive
    }
  }
`;

const UPDATE_CATEGORY = gql`
  mutation UpdateCategory($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      id
      name
      icon
      order
      isActive
    }
  }
`;

const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

/* ===========================================
   TOP CATEGORIES
=========================================== */

const TOP_CATEGORIES_BY_RESTAURANT = gql`
  query TopCategoriesByRestaurant(
    $restaurantId: ID!
    $timeSlot: TimeSlot!
    $menuId: ID
    $limit: Int
  ) {
    topCategoriesByMenuItemCount(
      restaurantId: $restaurantId
      timeSlot: $timeSlot
      menuId: $menuId
      limit: $limit
    ) {
      id
      name
      icon
      menuItemCount
    }
  }
`;

const TOP_GLOBAL_CATEGORIES = gql`
  query TopGlobalCategories($timeSlot: TimeSlot, $limit: Int) {
    topGlobalCategoriesByMenuItemCount(timeSlot: $timeSlot, limit: $limit) {
      id
      name
      icon
      menuItemCount
    }
  }
`;

/* ===========================================
   CATEGORY MENU
=========================================== */

const GET_CATEGORY_MENUS = gql`
  query GetCategoryMenus($restaurantId: ID!) {
    categoryMenus(restaurantId: $restaurantId) {
      id
      name
      icon
      description
      coverImage
      isActive
      createdAt
      updatedAt
    }
  }
`;

const CREATE_CATEGORY_MENU = gql`
  mutation CreateCategoryMenu($input: CreateCategoryMenuInput!) {
    createCategoryMenu(input: $input) {
      id
      name
      icon
      description
      coverImage
      isActive
    }
  }
`;

const UPDATE_CATEGORY_MENU = gql`
  mutation UpdateCategoryMenu($input: UpdateCategoryMenuInput!) {
    updateCategoryMenu(input: $input) {
      id
      name
      icon
      description
      coverImage
      isActive
    }
  }
`;

const DELETE_CATEGORY_MENU = gql`
  mutation DeleteCategoryMenu($id: ID!) {
    deleteCategoryMenu(id: $id)
  }
`;

/* ===========================================
   MAIN HOOK
=========================================== */

export const useCategoryManagement = ({
  restaurantId,
  timeSlot,
  limit = 6,
  loadCategories = true,
  loadTopCategories = true,
  loadCategoryMenus = true,
}) => {
  const { showNotification } = useNotification();
  const isGlobal = !restaurantId;

  /* ---------------------------------------
      1) CATEGORY LIST
  ---------------------------------------- */

  const skipCategories = !restaurantId || !timeSlot || !loadCategories;

  const {
    data: catData,
    loading: catLoading,
    error: catError,
    refetch: refetchCategories,
  } = useQuery(GET_CATEGORIES, {
    skip: skipCategories,
    variables: { restaurantId, timeSlot },
    fetchPolicy: "cache-and-network",
  });

  const categories = useMemo(() => catData?.categories || [], [catData]);

  /* ---------------------------------------
      2) TOP CATEGORIES
  ---------------------------------------- */

  const topQuery = isGlobal
    ? TOP_GLOBAL_CATEGORIES
    : TOP_CATEGORIES_BY_RESTAURANT;

  const topVariables = isGlobal
    ? { timeSlot, limit }
    : { restaurantId, timeSlot, limit };

  const skipTop = !loadTopCategories || !timeSlot;

  const {
    data: topData,
    loading: topLoading,
    error: topError,
    refetch: refetchTopCategories,
  } = useQuery(topQuery, {
    skip: skipTop,
    variables: topVariables,
    fetchPolicy: "cache-and-network",
  });

  const topCategories = useMemo(() => {
    if (isGlobal) return topData?.topGlobalCategoriesByMenuItemCount || [];
    return topData?.topCategoriesByMenuItemCount || [];
  }, [topData, isGlobal]);

  /* ---------------------------------------
      3) CATEGORY MUTATIONS
  ---------------------------------------- */

  const [createCategoryMut] = useMutation(CREATE_CATEGORY);
  const [updateCategoryMut] = useMutation(UPDATE_CATEGORY);
  const [deleteCategoryMut] = useMutation(DELETE_CATEGORY);

  const createCategory = useCallback(
    async (input) => {
      try {
        const { data } = await createCategoryMut({ variables: { input } });

        showNotification("Tạo danh mục món thành công", "success");

        refetchCategories?.();
        refetchTopCategories?.();

        return data?.createCategory;
      } catch (err) {
        showNotification(err?.message || "Lỗi tạo danh mục món", "error");
        return null;
      }
    },
    [createCategoryMut, refetchCategories, refetchTopCategories, showNotification]
  );

  const updateCategory = useCallback(
    async (input) => {
      try {
        const { data } = await updateCategoryMut({ variables: { input } });

        showNotification("Cập nhật danh mục món thành công", "success");

        refetchCategories?.();
        refetchTopCategories?.();

        return data?.updateCategory;
      } catch (err) {
        showNotification(
          err?.message || "Lỗi cập nhật danh mục món",
          "error"
        );
        return null;
      }
    },
    [updateCategoryMut, refetchCategories, refetchTopCategories, showNotification]
  );

  const deleteCategory = useCallback(
    async (id) => {
      try {
        await deleteCategoryMut({ variables: { id } });

        showNotification("Đã xóa danh mục món", "success");

        refetchCategories?.();
        refetchTopCategories?.();

        return true;
      } catch (err) {
        showNotification(err?.message || "Lỗi xóa danh mục món", "error");
        return false;
      }
    },
    [deleteCategoryMut, refetchCategories, refetchTopCategories, showNotification]
  );

  /* ---------------------------------------
      4) CATEGORY MENUS
  ---------------------------------------- */

  const skipMenu = !restaurantId || !loadCategoryMenus;

  const {
    data: catMenuData,
    loading: catMenuLoading,
    error: catMenuError,
    refetch: refetchCategoryMenus,
  } = useQuery(GET_CATEGORY_MENUS, {
    skip: skipMenu,
    variables: { restaurantId },
    fetchPolicy: "cache-and-network",
  });

  const categoryMenus = useMemo(
    () => catMenuData?.categoryMenus || [],
    [catMenuData]
  );

  /* ---------------------------------------
      5) CATEGORY MENU MUTATIONS (Optimized)
  ---------------------------------------- */

  const [createCategoryMenuMut] = useMutation(CREATE_CATEGORY_MENU, {
    optimisticResponse: ({ input }) => ({
      createCategoryMenu: {
        __typename: "CategoryMenu",
        id: "optimistic-" + Math.random().toString(36).slice(2),
        name: input.name,
        icon: input.icon || "🍽️",
        description: input.description || null,
        coverImage: input.coverImage || null,
        isActive: true,
      },
    }),

    update(cache, { data }) {
      const newItem = data?.createCategoryMenu;
      if (!newItem) return;

      try {
        const existing = cache.readQuery({
          query: GET_CATEGORY_MENUS,
          variables: { restaurantId },
        });

        cache.writeQuery({
          query: GET_CATEGORY_MENUS,
          variables: { restaurantId },
          data: {
            categoryMenus: [newItem, ...(existing?.categoryMenus || [])],
          },
        });
      } catch {}
    },
  });

  const createCategoryMenu = useCallback(
    async (input) => {
      try {
        const { data } = await createCategoryMenuMut({
          variables: { input },
        });

        showNotification("Tạo nhóm thực đơn thành công", "success");

        refetchCategoryMenus?.();

        return data?.createCategoryMenu;
      } catch (err) {
        showNotification(err?.message || "Lỗi tạo nhóm thực đơn", "error");
        return null;
      }
    },
    [createCategoryMenuMut, refetchCategoryMenus, showNotification]
  );

  const [updateCategoryMenuMut] = useMutation(UPDATE_CATEGORY_MENU);

  const updateCategoryMenu = useCallback(
    async (input) => {
      try {
        const { data } = await updateCategoryMenuMut({
          variables: { input },
        });

        showNotification("Cập nhật nhóm thực đơn thành công", "success");

        refetchCategoryMenus?.();
        return data?.updateCategoryMenu;
      } catch (err) {
        showNotification(
          err?.message || "Lỗi cập nhật nhóm thực đơn",
          "error"
        );
        return null;
      }
    },
    [updateCategoryMenuMut, refetchCategoryMenus, showNotification]
  );

  const [deleteCategoryMenuMut] = useMutation(DELETE_CATEGORY_MENU);

  const deleteCategoryMenu = useCallback(
    async (id) => {
      try {
        await deleteCategoryMenuMut({ variables: { id } });

        showNotification("Đã xóa nhóm thực đơn", "success");

        refetchCategoryMenus?.();
        return true;
      } catch (err) {
        showNotification(err?.message || "Lỗi xóa nhóm thực đơn", "error");
        return false;
      }
    },
    [deleteCategoryMenuMut, refetchCategoryMenus, showNotification]
  );

  /* ---------------------------------------
      RETURN OBJECT
  ---------------------------------------- */

  return {
    // CATEGORY
    categories,
    categoriesLoading: !skipCategories && catLoading,
    categoriesError: !skipCategories && catError,

    // TOP CATEGORY
    topCategories,
    topCategoriesLoading: !skipTop && topLoading,
    topCategoriesError: !skipTop && topError,

    // CATEGORY MUTATIONS
    createCategory,
    updateCategory,
    deleteCategory,

    // CATEGORY MENUS
    categoryMenus,
    categoryMenuLoading: catMenuLoading,
    categoryMenuError: catMenuError,

    // CATEGORY MENU MUTATIONS
    createCategoryMenu,
    updateCategoryMenu,
    deleteCategoryMenu,

    // REFRESH ALL
    refetchAll: () => {
      refetchCategories?.();
      refetchTopCategories?.();
      refetchCategoryMenus?.();
    },

    isGlobal,
  };
};
