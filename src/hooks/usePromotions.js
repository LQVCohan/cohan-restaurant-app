import { useEffect, useMemo, useState, useContext } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import {
  formatVietnamDateTimeLocal,
  toVietnamDateTimeISO,
} from "@/utils/vietnamDateTime";

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
      promotionType
      scope
      restaurantId
      categoryId
      itemId
      giftItemId
      discountType
      discountValue
      buyQuantity
      getQuantity
      comboItems {
        itemId
        quantity
      }
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

const Q_PROMOTION_FORM_DATA = gql`
  query PromotionFormData($restaurantId: ID!) {
    restaurant(id: $restaurantId) {
      id
      categories {
        id
        name
      }
    }
    menuItems(restaurantId: $restaurantId, limit: 500) {
      id
      name
      categoryId
    }
  }
`;

const M_CREATE_PROMOTION = gql`
  mutation CreatePromotion($input: PromotionInput!) {
    createPromotion(input: $input) {
      id
      restaurantId
    }
  }
`;

const M_UPDATE_PROMOTION = gql`
  mutation UpdatePromotion($id: ID!, $input: PromotionInput!) {
    updatePromotion(id: $id, input: $input) {
      id
      restaurantId
    }
  }
`;

const M_DELETE_PROMOTION = gql`
  mutation DeletePromotion($id: ID!) {
    deletePromotion(id: $id)
  }
`;

const normalizePromotionType = (value, discountType) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "FIXED") return "fixed";
  if (normalized === "BOGO") return "bogo";
  if (normalized === "COMBO") return "combo";
  if (normalized === "FREESHIP") return "freeship";
  if (String(discountType || "PERCENT").trim().toUpperCase() === "AMOUNT") {
    return "fixed";
  }
  return "percentage";
};

const resolvePromotionStatus = (row) => {
  if (!row?.isActive) return "draft";
  const now = Date.now();
  const startAt = row?.startAt ? new Date(row.startAt).getTime() : null;
  const endAt = row?.endAt ? new Date(row.endAt).getTime() : null;

  if (Number.isFinite(startAt) && startAt > now) return "scheduled";
  if (Number.isFinite(endAt) && endAt < now) return "expired";
  return "active";
};

const normalizePromotion = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code || "",
  type: normalizePromotionType(row.promotionType, row.discountType),
  scope: String(row.scope || "ORDER").toLowerCase(),
  restaurantId: row.restaurantId || "",
  categoryId: row.categoryId || "",
  itemId: row.itemId || "",
  giftItemId: row.giftItemId || "",
  discountType:
    String(row.discountType || "PERCENT").toUpperCase() === "AMOUNT"
      ? "fixed"
      : "percent",
  discountValue: Number(row.discountValue || 0),
  buyQuantity: Number(row.buyQuantity || 0),
  getQuantity: Number(row.getQuantity || 0),
  comboItems: Array.isArray(row.comboItems)
    ? row.comboItems.map((item) => ({
        itemId: item?.itemId || "",
        quantity: Number(item?.quantity || 1),
      }))
    : [],
  minOrderValue: Number(row.minOrderValue || 0),
  maxDiscount: Number(row.maxDiscount || 0),
  startDate: formatVietnamDateTimeLocal(row.startAt),
  endDate: formatVietnamDateTimeLocal(row.endAt),
  status: resolvePromotionStatus(row),
  level: Number(row.level || 1),
  usageLimit: Number(row.usageLimit || 0),
  usageCount: Number(row.usageCount || 0),
  targetAudience: row.targetAudience || "all",
  description: row.description || "",
  conditions: Array.isArray(row.conditions) ? row.conditions : [],
  stacking: Boolean(row.stacking),
});

const buildPromotionInput = (data, restaurantId) => {
  const targetRestaurantId = String(data?.restaurantId || restaurantId || "").trim();
  const type = String(data?.type || "percentage").trim().toLowerCase();
  const scope = String(
    type === "combo"
      ? "order"
      : data?.scope || (data?.itemId ? "item" : data?.categoryId ? "category" : "order"),
  )
    .trim()
    .toLowerCase();
  const discountType = String(data?.discountType || "")
    .trim()
    .toLowerCase();
  const comboItems = Array.isArray(data?.comboItems)
    ? data.comboItems
        .map((item) => ({
          itemId: String(item?.itemId || "").trim(),
          quantity: Number(item?.quantity || 0),
        }))
        .filter((item) => item.itemId && item.quantity >= 1)
    : [];

  return {
    name: String(data?.name || "").trim(),
    code: String(data?.code || "")
      .trim()
      .toUpperCase() || null,
    description: String(data?.description || "").trim(),
    promotionType:
      type === "fixed"
        ? "FIXED"
        : type === "bogo"
          ? "BOGO"
          : type === "combo"
            ? "COMBO"
            : type === "freeship"
              ? "FREESHIP"
              : "PERCENTAGE",
    scope:
      scope === "item" ? "ITEM" : scope === "category" ? "CATEGORY" : "ORDER",
    restaurantId: targetRestaurantId,
    categoryId: scope === "category" ? data?.categoryId || null : null,
    itemId: scope === "item" ? data?.itemId || null : null,
    giftItemId:
      type === "bogo" ? data?.giftItemId || data?.productId || null : null,
    discountType:
      type === "fixed" || (type === "combo" && discountType === "fixed")
        ? "AMOUNT"
        : "PERCENT",
    discountValue:
      type === "bogo" || type === "freeship"
        ? 0
        : Number(data?.discountValue || 0),
    buyQuantity: type === "bogo" ? Number(data?.buyQuantity || 1) : 0,
    getQuantity: type === "bogo" ? Number(data?.getQuantity || 1) : 0,
    ...(type === "combo" ? { comboItems } : {}),
    minOrderValue: Number(data?.minOrderValue || 0),
    maxDiscount: Number(data?.maxDiscount || 0),
    usageLimit: Number(data?.usageLimit || 0),
    targetAudience: data?.targetAudience || "all",
    conditions: Array.isArray(data?.conditions) ? data.conditions : [],
    level: Number(data?.level || 1),
    startAt: toVietnamDateTimeISO(data?.startDate),
    endAt: toVietnamDateTimeISO(data?.endDate),
    isActive: data?.status !== "draft",
    stacking: Boolean(data?.stacking),
  };
};

export const __testables = {
  buildPromotionInput,
  normalizePromotion,
  resolvePromotionStatus,
};

export const usePromotions = () => {
  const { restaurants } = useContext(AuthContext);
  const restaurantOptions = useMemo(
    () =>
      Array.isArray(restaurants)
        ? restaurants.filter((restaurant) => restaurant?.id)
        : [],
    [restaurants],
  );
  const defaultRestaurantId = restaurantOptions[0]?.id || "";
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    restaurant: "",
  });

  useEffect(() => {
    if (!restaurantOptions.length) return;

    const hasSelectedRestaurant = restaurantOptions.some(
      (restaurant) => String(restaurant.id) === String(filters.restaurant || ""),
    );

    if (!filters.restaurant || !hasSelectedRestaurant) {
      setFilters((prev) => ({
        ...prev,
        restaurant: String(restaurantOptions[0].id),
      }));
    }
  }, [restaurantOptions, filters.restaurant]);

  const selectedRestaurantId = filters.restaurant || defaultRestaurantId;

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

  const { data: formData } = useQuery(Q_PROMOTION_FORM_DATA, {
    variables: { restaurantId: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "cache-and-network",
  });

  const [createPromotion] = useMutation(M_CREATE_PROMOTION);
  const [updatePromotionMu] = useMutation(M_UPDATE_PROMOTION);
  const [deletePromotionMu] = useMutation(M_DELETE_PROMOTION);

  const menuItems = useMemo(
    () =>
      (formData?.menuItems || []).map((item) => ({
        id: item.id,
        name: item.name || `Món ${item.id}`,
        categoryId: item.categoryId || "",
      })),
    [formData?.menuItems],
  );

  const categories = useMemo(() => {
    const merged = new Map();

    (formData?.restaurant?.categories || []).forEach((category) => {
      if (!category?.id) return;
      merged.set(String(category.id), {
        id: category.id,
        name: category.name || `Danh mục ${category.id}`,
      });
    });

    menuItems.forEach((item) => {
      if (!item.categoryId || merged.has(String(item.categoryId))) return;
      merged.set(String(item.categoryId), {
        id: item.categoryId,
        name: `Danh mục ${String(item.categoryId).slice(-4)}`,
      });
    });

    return Array.from(merged.values());
  }, [formData?.restaurant?.categories, menuItems]);

  const allPromotions = useMemo(
    () => (data?.promotionsByRestaurant || []).map(normalizePromotion),
    [data?.promotionsByRestaurant],
  );

  const promotions = useMemo(
    () =>
      allPromotions.filter((promotion) => {
        const q = filters.search.toLowerCase();
        const matchesSearch =
          promotion.name.toLowerCase().includes(q) ||
          promotion.code.toLowerCase().includes(q) ||
          (promotion.description || "").toLowerCase().includes(q);
        const matchesStatus =
          filters.status === "all" || promotion.status === filters.status;
        return matchesSearch && matchesStatus;
      }),
    [allPromotions, filters],
  );

  const addPromotion = async (promotionData) => {
    const targetRestaurantId = String(
      promotionData?.restaurantId || selectedRestaurantId || "",
    );
    if (!targetRestaurantId) return null;

    await createPromotion({
      variables: {
        input: buildPromotionInput(promotionData, targetRestaurantId),
      },
    });

    if (String(selectedRestaurantId) === targetRestaurantId) {
      await refetch({
        restaurantId: targetRestaurantId,
        activeOnly: false,
        limit: 500,
        offset: 0,
      });
    }

    return targetRestaurantId;
  };

  const updatePromotion = async (id, promotionData) => {
    const targetRestaurantId = String(
      promotionData?.restaurantId || selectedRestaurantId || "",
    );
    if (!targetRestaurantId) return null;

    await updatePromotionMu({
      variables: {
        id,
        input: buildPromotionInput(promotionData, targetRestaurantId),
      },
    });

    if (String(selectedRestaurantId) === targetRestaurantId) {
      await refetch({
        restaurantId: targetRestaurantId,
        activeOnly: false,
        limit: 500,
        offset: 0,
      });
    }

    return targetRestaurantId;
  };

  const deletePromotion = async (id) => {
    await deletePromotionMu({ variables: { id } });
    await refetch();
  };

  const duplicatePromotion = async (id) => {
    const promotion = allPromotions.find((item) => item.id === id);
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
    restaurants: restaurantOptions,
    selectedRestaurantId,
    filters,
    categories,
    menuItems,
    addPromotion,
    updatePromotion,
    deletePromotion,
    duplicatePromotion,
    updateFilters,
    loading,
    error,
  };
};
