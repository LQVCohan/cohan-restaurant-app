// src/hooks/useRestaurant.js
import { useState, useEffect, useMemo, useCallback } from "react";
import { gql, useMutation, useLazyQuery, useQuery } from "@apollo/client";

/* ========================= GraphQL Fragments ========================= */
const RESTAURANT_FIELDS = gql`
  fragment RestaurantFields on Restaurant {
    id
    name
    avatar
    coverImage
    spaceImages
    address {
      line1
      line2
      ward
      district
      city
      country
    }
    phone
    email
    featuredMenu
    amenities
    seatingCapacity
    priceRange
    openingHours
    closingHours
    description
    notesOnHours
    notesOnAmenities
    cuisineType
    status
    avgRating
    manager {
      id
      fullName
      email
    }
    # Nếu BE đã có resolver cho tables/categories, phần này sẽ hoạt động luôn
    tables {
      id
      code
      capacity
      status
    }
    categories {
      id
      name
      parentId
      order
    }
  }
`;

/* ============================ Queries ============================ */
const GET_RESTAURANT_FULL = gql`
  query GetRestaurantFull($id: ID!) {
    restaurant(id: $id) {
      ...RestaurantFields
    }
  }
  ${RESTAURANT_FIELDS}
`;

const GET_RESTAURANTS = gql`
  query Restaurants(
    $limit: Int = 20
    $cursor: ID
    $restaurantFilter: RestaurantFilter
  ) {
    restaurants(
      limit: $limit
      cursor: $cursor
      restaurantFilter: $restaurantFilter
    ) {
      edges {
        cursor
        node {
          ...RestaurantFields
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
  ${RESTAURANT_FIELDS}
`;

const GET_RESTAURANTS_TOP = gql`
  query RestaurantsTop($limit: Int = 6, $restaurantFilter: RestaurantFilter) {
    restaurantsTop(limit: $limit, restaurantFilter: $restaurantFilter) {
      ...RestaurantFields
    }
  }
  ${RESTAURANT_FIELDS}
`;

const GET_RESTAURANTS_BY_MANAGER = gql`
  query RestaurantsByManager(
    $managerId: ID!
    $limit: Int = 20
    $cursor: ID
    $restaurantFilter: RestaurantFilter
  ) {
    restaurantsByManager(
      managerId: $managerId
      limit: $limit
      cursor: $cursor
      restaurantFilter: $restaurantFilter
    ) {
      edges {
        cursor
        node {
          ...RestaurantFields
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
  ${RESTAURANT_FIELDS}
`;

const GET_REF_RESTAURANTS = gql`
  query RefRestaurants($userId: ID!) {
    refRestaurants(userId: $userId) {
      ...RestaurantFields
    }
  }
  ${RESTAURANT_FIELDS}
`;

/* ============================ Mutations ============================ */
const CREATE_RESTAURANT = gql`
  mutation CreateRestaurant($input: CreateRestaurantInput!) {
    createRestaurant(input: $input) {
      ...RestaurantFields
    }
  }
  ${RESTAURANT_FIELDS}
`;

const UPDATE_RESTAURANT = gql`
  mutation UpdateRestaurant($id: ID!, $input: UpdateRestaurantInput!) {
    updateRestaurant(id: $id, input: $input) {
      ...RestaurantFields
    }
  }
  ${RESTAURANT_FIELDS}
`;

const DELETE_RESTAURANT = gql`
  mutation DeleteRestaurant($id: ID!) {
    deleteRestaurant(id: $id)
  }
`;

const UPDATE_RESTAURANT_MANAGER = gql`
  mutation UpdateRestaurantManager($input: UpdateRestaurantManagerInput!) {
    updateRestaurantManager(input: $input) {
      ...RestaurantFields
    }
  }
  ${RESTAURANT_FIELDS}
`;

/* ============================ Hook ============================ */
/**
 * useRestaurant:
 * - Nếu truyền restaurantId: sẽ tự fetch nhà hàng đó (đầy đủ field).
 * - Cung cấp đầy đủ API: getRestaurantFull, list, top, byManager, ref, create, update, delete, updateManager
 */
export const useRestaurant = (restaurantId) => {
  const [error, setError] = useState(null);

  // Auto fetch when restaurantId present (đầy đủ trường)
  const {
    data: autoData,
    loading: autoLoading,
    error: autoError,
    refetch: autoRefetch,
  } = useQuery(GET_RESTAURANT_FULL, {
    variables: { id: restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });
  useEffect(() => {
    if (autoError) {
      setError(autoError);
      console.log("error in hook: ", error);
    }
  }, [autoError, error]);

  useEffect(() => {
    if (restaurantId) {
      setError(null);
      autoRefetch && autoRefetch({ id: restaurantId });
    }
  }, [restaurantId, autoRefetch]);

  /* ------- On-demand queries ------- */
  const [
    runGetRestaurantFull,
    { data: fullData, loading: fullLoading, error: fullErr },
  ] = useLazyQuery(GET_RESTAURANT_FULL, {
    fetchPolicy: "cache-first",
  });

  const [
    runListRestaurants,
    { data: listData, loading: listLoading, error: listErr, fetchMore },
  ] = useLazyQuery(GET_RESTAURANTS, { fetchPolicy: "cache-and-network" });

  const [
    runTopRestaurants,
    { data: topData, loading: topLoading, error: topErr },
  ] = useLazyQuery(GET_RESTAURANTS_TOP, { fetchPolicy: "cache-first" });

  const [
    runRestaurantsByManager,
    {
      data: byManagerData,
      loading: byManagerLoading,
      error: byManagerErr,
      fetchMore: fetchMoreByManager,
    },
  ] = useLazyQuery(GET_RESTAURANTS_BY_MANAGER, {
    fetchPolicy: "cache-and-network",
  });

  const [
    runRefRestaurants,
    { data: refData, loading: refLoading, error: refErr },
  ] = useLazyQuery(GET_REF_RESTAURANTS, { fetchPolicy: "cache-first" });

  /* ------- Mutations ------- */
  const [mutCreate, { loading: creating }] = useMutation(CREATE_RESTAURANT);
  const [mutUpdate, { loading: updating }] = useMutation(UPDATE_RESTAURANT);
  const [mutDelete, { loading: deleting }] = useMutation(DELETE_RESTAURANT);
  const [mutUpdateManager, { loading: updatingManager }] = useMutation(
    UPDATE_RESTAURANT_MANAGER
  );

  /* ------- Adapters / helpers ------- */
  const normalizeRestaurant = useCallback((r) => {
    if (!r) return null;
    const imgThumbUrl = "/default-thumb-restaurant.jpg";
    const imgAvaUrl = "/default-avata-restaurant.jpg";
    return {
      ...r,
      imgThumbUrl,
      imgAvaUrl,
      photos: r.spaceImages || [],
      cuisine: r.cuisineType || "",
      district: r.address?.district || "",
      city: r.address?.city || "",
      rating: typeof r.avgRating === "number" ? r.avgRating : undefined,
      image: imgThumbUrl || imgAvaUrl || "",
      addressText: [
        r.address?.line1,
        r.address?.line2,
        r.address?.ward,
        r.address?.district,
        r.address?.city,
        r.address?.country,
      ]
        .filter(Boolean)
        .join(", "),
    };
  }, []);

  const restaurant = useMemo(
    () => normalizeRestaurant(autoData?.restaurant),
    [autoData, normalizeRestaurant]
  );

  /* ========== Public API ========== */

  // 1) Lấy toàn bộ thông tin 1 nhà hàng (full)
  const getRestaurantFull = async (id) => {
    const { data } = await runGetRestaurantFull({ variables: { id } });
    return normalizeRestaurant(data?.restaurant);
    // data?.restaurant đã có đầy đủ fields: tables, categories, manager, ...
  };

  // 2) Danh sách (connection)
  const listRestaurants = async ({
    limit = 20,
    cursor = null,
    restaurantFilter = {},
  } = {}) => {
    const { data } = await runListRestaurants({
      variables: { limit, cursor, restaurantFilter },
    });
    return data?.restaurants || null;
  };

  // 3) Tải thêm (connection)
  const loadMoreRestaurants = async () => {
    const pageInfo = listData?.restaurants?.pageInfo;
    if (!pageInfo?.hasNextPage) return null;
    const { data } = await fetchMore({
      variables: {
        cursor: pageInfo.endCursor,
      },
    });
    return data?.restaurants || null;
  };

  // 4) Top nhà hàng
  const listTopRestaurants = async ({
    limit = 6,
    restaurantFilter = {},
  } = {}) => {
    const { data } = await runTopRestaurants({
      variables: { limit, restaurantFilter },
    });
    return (data?.restaurantsTop || []).map(normalizeRestaurant);
  };

  // 5) Theo manager (connection)
  const listRestaurantsByManager = async ({
    managerId,
    limit = 20,
    cursor = null,
    restaurantFilter = {},
  }) => {
    const { data } = await runRestaurantsByManager({
      variables: { managerId, limit, cursor, restaurantFilter },
    });
    return data?.restaurantsByManager || null;
  };

  const loadMoreRestaurantsByManager = async () => {
    const pageInfo = byManagerData?.restaurantsByManager?.pageInfo;
    if (!pageInfo?.hasNextPage) return null;
    const { data } = await fetchMoreByManager({
      variables: {
        cursor: pageInfo.endCursor,
      },
    });
    return data?.restaurantsByManager || null;
  };

  // 6) refRestaurants theo user
  const listRefRestaurants = async (userId) => {
    const { data } = await runRefRestaurants({ variables: { userId } });
    return (data?.refRestaurants || []).map(normalizeRestaurant);
  };

  // 7) Create
  const createRestaurant = async (input) => {
    const { data } = await mutCreate({ variables: { input } });
    return normalizeRestaurant(data?.createRestaurant);
  };

  // 8) Update
  const updateRestaurant = async (id, input) => {
    const { data } = await mutUpdate({ variables: { id, input } });
    return normalizeRestaurant(data?.updateRestaurant);
  };

  // 9) Delete
  const deleteRestaurant = async (id) => {
    const { data } = await mutDelete({ variables: { id } });
    return !!data?.deleteRestaurant;
  };

  // 10) Update Manager (Admin only)
  const updateRestaurantManager = async (restaurantId, managerId) => {
    const { data } = await mutUpdateManager({
      variables: { input: { restaurantId, managerId } },
    });
    return normalizeRestaurant(data?.updateRestaurantManager);
  };

  // UX helpers như cũ
  const toggleFavorite = () => {
    if (!restaurant) return;
    const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
    const isFavorite = favorites.includes(restaurant.id);
    const updated = isFavorite
      ? favorites.filter((id) => id !== restaurant.id)
      : [...favorites, restaurant.id];
    localStorage.setItem("favorites", JSON.stringify(updated));
  };

  const shareRestaurant = async () => {
    if (!restaurant) return;
    const shareData = {
      title: restaurant.name,
      text: `Khám phá ${restaurant.name} - ${restaurant.cuisine}${
        restaurant.district ? ` tại ${restaurant.district}` : ""
      }`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Đã sao chép link vào clipboard!");
      }
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  const loading =
    autoLoading ||
    fullLoading ||
    listLoading ||
    topLoading ||
    byManagerLoading ||
    refLoading ||
    creating ||
    updating ||
    deleting ||
    updatingManager;

  return {
    // states
    restaurant,
    loading,
    error:
      error ||
      autoError?.message ||
      fullErr?.message ||
      listErr?.message ||
      topErr?.message ||
      byManagerErr?.message ||
      refErr?.message ||
      null,

    // single
    getRestaurantFull,

    // lists
    listRestaurants,
    loadMoreRestaurants,
    listTopRestaurants,
    listRestaurantsByManager,
    loadMoreRestaurantsByManager,
    listRefRestaurants,

    // mutations
    createRestaurant,
    updateRestaurant,
    deleteRestaurant,
    updateRestaurantManager,

    // helpers
    toggleFavorite,
    shareRestaurant,
    refetch: autoRefetch,
  };
};
