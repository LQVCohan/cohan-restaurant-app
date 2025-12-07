// src/hooks/useCategoryManagement.js
import { useQuery, useMutation, gql } from "@apollo/client";
import { useCallback } from "react";

/* ===========================================
   CATEGORY (theo timeSlot)
=========================================== */

const GET_CATEGORIES = gql`
  query GetCategories($restaurantId: ID!, $timeSlot: TimeSlot!) {
    categories(restaurantId: $restaurantId, timeSlot: $timeSlot) {
      id
      name
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

const TOP_CATEGORIES_BY_RESTAURANT = gql`
  query TopCategoriesByRestaurant(
    $restaurantId: ID!
    $timeSlot: TimeSlot!
    $limit: Int
  ) {
    topCategoriesByMenuItemCount(
      restaurantId: $restaurantId
      timeSlot: $timeSlot
      limit: $limit
    ) {
      id
      name
      menuItemCount
    }
  }
`;

const TOP_GLOBAL_CATEGORIES = gql`
  query TopGlobalCategories($timeSlot: TimeSlot, $limit: Int) {
    topGlobalCategoriesByMenuItemCount(timeSlot: $timeSlot, limit: $limit) {
      id
      name
      menuItemCount
    }
  }
`;

/* ===========================================
   CATEGORY MENU (không phụ thuộc timeSlot)
=========================================== */

const GET_CATEGORY_MENUS = gql`
  query GetCategoryMenus($restaurantId: ID!) {
    categoryMenus(restaurantId: $restaurantId) {
      id
      name
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
   HOOK CHÍNH
=========================================== */

export const useCategoryManagement = ({
  restaurantId,
  timeSlot,
  limit = 6,
}) => {
  const isGlobal = !restaurantId;

  /* -------------------------
        1) CATEGORY LIST
  ------------------------- */
  const {
    data: categoriesData,
    loading: categoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useQuery(GET_CATEGORIES, {
    variables: { restaurantId, timeSlot },
    skip: !restaurantId || !timeSlot,
    fetchPolicy: "cache-and-network",
  });

  const categories = categoriesData?.categories || [];

  /* -------------------------
        2) TOP CATEGORY LIST
  ------------------------- */
  const topQuery = isGlobal
    ? TOP_GLOBAL_CATEGORIES
    : TOP_CATEGORIES_BY_RESTAURANT;

  const topVariables = isGlobal
    ? { timeSlot, limit }
    : { restaurantId, timeSlot, limit };

  const skipTop = isGlobal ? false : !restaurantId || !timeSlot;

  const {
    data: topCatData,
    loading: topCatLoading,
    error: topCatError,
    refetch: refetchTopCategories,
  } = useQuery(topQuery, {
    variables: topVariables,
    skip: skipTop,
    fetchPolicy: "cache-and-network",
  });

  const topCategories =
    (isGlobal
      ? topCatData?.topGlobalCategoriesByMenuItemCount
      : topCatData?.topCategoriesByMenuItemCount) || [];

  /* -------------------------
        3) CATEGORY MUTATIONS
  ------------------------- */

  const [createCategoryMut] = useMutation(CREATE_CATEGORY);
  const [updateCategoryMut] = useMutation(UPDATE_CATEGORY);
  const [deleteCategoryMut] = useMutation(DELETE_CATEGORY);

  const createCategory = useCallback(
    async (input) => {
      const { data } = await createCategoryMut({
        variables: { input },
      });
      refetchCategories?.();
      refetchTopCategories?.();
      return data?.createCategory;
    },
    [createCategoryMut, refetchCategories, refetchTopCategories]
  );

  const updateCategory = useCallback(
    async (input) => {
      const { data } = await updateCategoryMut({
        variables: { input },
      });
      refetchCategories?.();
      refetchTopCategories?.();
      return data?.updateCategory;
    },
    [updateCategoryMut, refetchCategories, refetchTopCategories]
  );

  const deleteCategory = useCallback(
    async (id) => {
      await deleteCategoryMut({ variables: { id } });
      refetchCategories?.();
      refetchTopCategories?.();
      return true;
    },
    [deleteCategoryMut, refetchCategories, refetchTopCategories]
  );

  /* -------------------------
        4) CATEGORY MENU LIST
  ------------------------- */

  const {
    data: categoryMenuData,
    loading: categoryMenuLoading,
    error: categoryMenuError,
    refetch: refetchCategoryMenu,
  } = useQuery(GET_CATEGORY_MENUS, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const categoryMenus = categoryMenuData?.categoryMenus || [];

  /* -------------------------
        5) CATEGORY MENU MUTATIONS
  ------------------------- */

  const [createCategoryMenuMut] = useMutation(CREATE_CATEGORY_MENU);
  const [updateCategoryMenuMut] = useMutation(UPDATE_CATEGORY_MENU);
  const [deleteCategoryMenuMut] = useMutation(DELETE_CATEGORY_MENU);

  const createCategoryMenu = useCallback(
    async (input) => {
      const { data } = await createCategoryMenuMut({ variables: { input } });
      refetchCategoryMenu?.();
      return data?.createCategoryMenu;
    },
    [createCategoryMenuMut, refetchCategoryMenu]
  );

  const updateCategoryMenu = useCallback(
    async (input) => {
      const { data } = await updateCategoryMenuMut({ variables: { input } });
      refetchCategoryMenu?.();
      return data?.updateCategoryMenu;
    },
    [updateCategoryMenuMut, refetchCategoryMenu]
  );

  const deleteCategoryMenu = useCallback(
    async (id) => {
      await deleteCategoryMenuMut({ variables: { id } });
      refetchCategoryMenu?.();
      return true;
    },
    [deleteCategoryMenuMut, refetchCategoryMenu]
  );

  /* -------------------------
        6) COMBINED RETURN
  ------------------------- */

  return {
    // CATEGORY
    categories,
    topCategories,
    categoriesLoading,
    categoriesError,
    topCategoriesLoading: topCatLoading,
    topCategoriesError: topCatError,

    createCategory,
    updateCategory,
    deleteCategory,

    // CATEGORY MENU
    categoryMenus,
    categoryMenuLoading,
    categoryMenuError,

    createCategoryMenu,
    updateCategoryMenu,
    deleteCategoryMenu,

    // UTILITIES
    refetchAll: () => {
      refetchCategories?.();
      refetchTopCategories?.();
      refetchCategoryMenu?.();
    },

    isGlobal,
  };
};
