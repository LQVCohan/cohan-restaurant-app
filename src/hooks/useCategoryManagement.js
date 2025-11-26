// src/hooks/useCategoryManagement.js
import { useQuery, gql } from "@apollo/client";

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

export const useCategoryManagement = ({
  restaurantId,
  timeSlot,
  limit = 6,
}) => {
  const isGlobal = !restaurantId; // 👈 trang Home sẽ rơi vào đây

  const query = isGlobal ? TOP_GLOBAL_CATEGORIES : TOP_CATEGORIES_BY_RESTAURANT;

  const variables = isGlobal
    ? { timeSlot, limit }
    : { restaurantId, timeSlot, limit };

  const skip = isGlobal
    ? false // global thì không cần restaurantId
    : !restaurantId || !timeSlot;

  const { data, loading, error, refetch } = useQuery(query, {
    variables,
    skip,
  });

  const raw =
    (isGlobal
      ? data?.topGlobalCategoriesByMenuItemCount
      : data?.topCategoriesByMenuItemCount) || [];

  return {
    categories: raw,
    loading: skip ? false : loading,
    error,
    refetch,
    isGlobal,
  };
};
