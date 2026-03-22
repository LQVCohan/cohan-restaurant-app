import { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";

const Q_PROMOTIONS = gql`
  query PromotionsByRestaurant($restaurantId: ID!, $activeOnly: Boolean!, $limit: Int!, $offset: Int!) {
    promotionsByRestaurant(
      restaurantId: $restaurantId
      activeOnly: $activeOnly
      limit: $limit
      offset: $offset
    ) {
      id
      name
      code
      description
      scope
      restaurantId
      categoryId
      itemId
      discountType
      discountValue
      minOrderValue
      maxDiscount
      usageLimit
      usageCount
      targetAudience
      conditions
      level
      startAt
      endAt
      isActive
      stacking
    }
  }
`;

const M_CREATE_PROMOTION = gql`
  mutation CreatePromotion($input: PromotionInput!) {
    createPromotion(input: $input) { id }
  }
`;
const M_UPDATE_PROMOTION = gql`
  mutation UpdatePromotion($id: ID!, $input: PromotionInput!) {
    updatePromotion(id: $id, input: $input) { id }
  }
`;
const M_DELETE_PROMOTION = gql`
  mutation DeletePromotion($id: ID!) {
    deletePromotion(id: $id)
  }
`;

const normalizePromotion = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code || "",
  type: String(row.discountType || "PERCENT").toLowerCase() === "amount" ? "fixed" : "percentage",
  discountValue: Number(row.discountValue || 0),
  minOrderValue: Number(row.minOrderValue || 0),
  maxDiscount: Number(row.maxDiscount || 0),
  startDate: row.startAt ? new Date(row.startAt).toISOString().slice(0, 16) : "",
  endDate: row.endAt ? new Date(row.endAt).toISOString().slice(0, 16) : "",
  status: row.isActive ? "active" : "draft",
  level: Number(row.level || 1),
  usageLimit: Number(row.usageLimit || 0),
  usageCount: Number(row.usageCount || 0),
  targetAudience: row.targetAudience || "all",
  restaurantId: row.restaurantId || "",
  description: row.description || "",
  conditions: Array.isArray(row.conditions) ? row.conditions : [],
  categoryId: row.categoryId || null,
  itemId: row.itemId || null,
  stacking: Boolean(row.stacking),
});

const mapToInput = (data, restaurantId) => ({
  name: data.name,
  code: data.code,
  description: data.description || "",
  scope: data.itemId ? "ITEM" : data.categoryId ? "CATEGORY" : "ORDER",
  restaurantId,
  categoryId: data.categoryId || null,
  itemId: data.itemId || null,
  discountType: data.type === "fixed" ? "AMOUNT" : "PERCENT",
  discountValue: Number(data.discountValue || 0),
  minOrderValue: Number(data.minOrderValue || 0),
  maxDiscount: Number(data.maxDiscount || 0),
  usageLimit: Number(data.usageLimit || 0),
  targetAudience: data.targetAudience || "all",
  conditions: Array.isArray(data.conditions) ? data.conditions : [],
  level: Number(data.level || 1),
  startAt: data.startDate || null,
  endAt: data.endDate || null,
  isActive: data.status === "active",
  stacking: Boolean(data.stacking),
});

export const usePromotions = () => {
  const { restaurants } = useContext(AuthContext);
  const defaultRestaurantId = restaurants?.[0]?.id || "";
  const [filters, setFilters] = useState({ search: "", status: "all", restaurant: "all" });

  const selectedRestaurantId = filters.restaurant !== "all" ? filters.restaurant : defaultRestaurantId;

  const { data, loading, error, refetch } = useQuery(Q_PROMOTIONS, {
    variables: {
      restaurantId: selectedRestaurantId,
      activeOnly: false,
      limit: 500,
      offset: 0,
    },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });

  const [createPromotion] = useMutation(M_CREATE_PROMOTION);
  const [updatePromotionMu] = useMutation(M_UPDATE_PROMOTION);
  const [deletePromotionMu] = useMutation(M_DELETE_PROMOTION);

  const allPromotions = useMemo(
    () => (data?.promotionsByRestaurant || []).map(normalizePromotion),
    [data]
  );

  const promotions = useMemo(() => {
    return allPromotions.filter((promotion) => {
      const q = filters.search.toLowerCase();
      const matchesSearch =
        promotion.name.toLowerCase().includes(q) ||
        promotion.code.toLowerCase().includes(q) ||
        (promotion.description || "").toLowerCase().includes(q);
      const matchesStatus = filters.status === "all" || promotion.status === filters.status;
      const matchesRestaurant =
        filters.restaurant === "all" || String(promotion.restaurantId) === String(filters.restaurant);
      return matchesSearch && matchesStatus && matchesRestaurant;
    });
  }, [allPromotions, filters]);

  const addPromotion = async (promotionData) => {
    if (!selectedRestaurantId) return;
    await createPromotion({ variables: { input: mapToInput(promotionData, selectedRestaurantId) } });
    await refetch();
  };

  const updatePromotion = async (id, promotionData) => {
    if (!selectedRestaurantId) return;
    await updatePromotionMu({ variables: { id, input: mapToInput(promotionData, selectedRestaurantId) } });
    await refetch();
  };

  const deletePromotion = async (id) => {
    await deletePromotionMu({ variables: { id } });
    await refetch();
  };

  const duplicatePromotion = async (id) => {
    const promotion = allPromotions.find((p) => p.id === id);
    if (!promotion) return;
    await addPromotion({
      ...promotion,
      name: `${promotion.name} (Sao chép)`,
      code: `${promotion.code || "PROMO"}_COPY`,
      status: "draft",
      usageCount: 0,
    });
  };

  const updateFilters = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return {
    promotions,
    allPromotions,
    filters,
    addPromotion,
    updatePromotion,
    deletePromotion,
    duplicatePromotion,
    updateFilters,
    loading,
    error,
  };
};
