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

const M_TOGGLE_PROMOTION = gql`
  mutation TogglePromotion($id: ID!, $isActive: Boolean!) {
    togglePromotion(id: $id, isActive: $isActive) {
      id
      restaurantId
      isActive
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

const getApolloErrorMessage = (error) => {
  if (!error) return "";
  const message = (
    error.graphQLErrors?.[0]?.message ||
    error.networkError?.message ||
    error.message ||
    "Không thể xử lý dữ liệu khuyến mãi."
  );
  if (
    /cannot return null|non-nullable|graphql|mutation|resolver/i.test(message)
  ) {
    return "Hệ thống chưa lưu được khuyến mãi. Kiểm tra dữ liệu bắt buộc rồi thử lại; nếu lỗi lặp lại, hãy liên hệ quản trị viên.";
  }
  return String(message)
    .replace(/\b(categoryId|itemId|restaurantId|promotion id)\b/gi, "thông tin áp dụng")
    .replace(/\blevel\b/gi, "độ ưu tiên");
};

const mountPromotionErrorBanner = ({ error, refetch, title }) => {
  if (typeof document === "undefined") return undefined;

  const bannerId = "promotion-query-error-banner";
  document.getElementById(bannerId)?.remove();
  if (!error) return undefined;

  const message = getApolloErrorMessage(error);
  const container = document.querySelector(".promotion-manager-page") || document.body;
  const banner = document.createElement("section");
  banner.id = bannerId;
  banner.setAttribute("role", "alert");
  banner.setAttribute("aria-live", "polite");
  banner.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "gap:12px",
    "margin:0 0 12px",
    "padding:12px 14px",
    "border:1px solid rgba(154,65,61,.2)",
    "border-radius:18px",
    "background:#faece8",
    "color:#9a413d",
    "box-shadow:0 14px 34px rgba(48,40,30,.08)",
    "font-family:Geist,Outfit,Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
  ].join(";");

  const text = document.createElement("div");
  text.style.cssText = "display:grid;gap:3px;min-width:0";
  const heading = document.createElement("strong");
  heading.textContent = title || "Không tải được dữ liệu khuyến mãi";
  heading.style.cssText = "font-size:.92rem;font-weight:820;color:#9a413d";
  const detail = document.createElement("span");
  detail.textContent = message;
  detail.style.cssText = "font-size:.82rem;line-height:1.45;color:#9a413d;word-break:break-word";
  text.append(heading, detail);

  const actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.textContent = refetch ? "Thử tải lại" : "Đóng";
  actionButton.style.cssText = [
    "min-height:36px",
    "border:1px solid rgba(154,65,61,.22)",
    "border-radius:12px",
    "background:#fffdf9",
    "color:#9a413d",
    "cursor:pointer",
    "font-weight:780",
    "padding:0 12px",
    "white-space:nowrap",
  ].join(";");
  const handleAction = () => {
    if (refetch) refetch();
    else banner.remove();
  };
  actionButton.addEventListener("click", handleAction);

  banner.append(text, actionButton);
  container.prepend(banner);

  return () => {
    actionButton.removeEventListener("click", handleAction);
    banner.remove();
  };
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
    code:
      String(data?.code || "")
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

const omitActivation = ({ isActive, ...input }) => input;

const isStatusOnlyPromotionUpdate = (currentPromotion, nextPromotion, restaurantId) => {
  if (!currentPromotion || !nextPromotion || !nextPromotion.status) return false;
  const currentInput = buildPromotionInput(currentPromotion, restaurantId);
  const nextInput = buildPromotionInput(nextPromotion, restaurantId);
  return (
    currentInput.isActive !== nextInput.isActive &&
    JSON.stringify(omitActivation(currentInput)) ===
      JSON.stringify(omitActivation(nextInput))
  );
};

const buildDuplicatePromotionCode = (code, promotions = []) => {
  const raw = String(code || "PROMO").trim().toUpperCase() || "PROMO";
  const root = raw.replace(/_COPY(?:_\d+)?$/, "");
  const usedCodes = new Set(
    (promotions || []).map((promotion) =>
      String(promotion?.code || "").trim().toUpperCase(),
    ),
  );

  let candidate = `${root}_COPY`;
  let index = 2;
  while (usedCodes.has(candidate)) {
    candidate = `${root}_COPY_${index}`;
    index += 1;
  }
  return candidate;
};

export const __testables = {
  buildDuplicatePromotionCode,
  buildPromotionInput,
  isStatusOnlyPromotionUpdate,
  normalizePromotion,
  resolvePromotionStatus,
};

export const usePromotions = ({
  restaurantId: restaurantIdOverride = "",
  activeOnly = false,
  showErrorBanner = true,
} = {}) => {
  const { restaurants } = useContext(AuthContext);
  const restaurantOptions = useMemo(
    () =>
      Array.isArray(restaurants)
        ? restaurants.filter((restaurant) => restaurant?.id)
        : [],
    [restaurants],
  );
  const defaultRestaurantId = restaurantOptions[0]?.id || "";
  const scopedRestaurantId = String(restaurantIdOverride || "").trim();
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    restaurant: "",
  });
  const [operationError, setOperationError] = useState(null);

  useEffect(() => {
    if (scopedRestaurantId || !restaurantOptions.length) return;

    const hasSelectedRestaurant = restaurantOptions.some(
      (restaurant) => String(restaurant.id) === String(filters.restaurant || ""),
    );

    if (!filters.restaurant || !hasSelectedRestaurant) {
      setFilters((prev) => ({
        ...prev,
        restaurant: String(restaurantOptions[0].id),
      }));
    }
  }, [restaurantOptions, filters.restaurant, scopedRestaurantId]);

  const selectedRestaurantId =
    scopedRestaurantId || filters.restaurant || defaultRestaurantId;

  const { data, loading, error, refetch } = useQuery(Q_PROMOTIONS, {
    variables: {
      restaurantId: selectedRestaurantId,
      activeOnly,
      limit: 500,
      offset: 0,
    },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });

  useEffect(
    () =>
      showErrorBanner
        ? mountPromotionErrorBanner({
            error: operationError || error,
            refetch: operationError ? null : refetch,
            title: operationError
              ? "Không thể xử lý khuyến mãi"
              : "Không tải được dữ liệu khuyến mãi",
          })
        : undefined,
    [error, operationError, refetch, showErrorBanner],
  );

  const { data: formData } = useQuery(Q_PROMOTION_FORM_DATA, {
    variables: { restaurantId: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "cache-and-network",
  });

  const [createPromotion] = useMutation(M_CREATE_PROMOTION);
  const [updatePromotionMu] = useMutation(M_UPDATE_PROMOTION);
  const [togglePromotionMu] = useMutation(M_TOGGLE_PROMOTION);
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
        const query = filters.search.toLowerCase();
        const matchesSearch =
          promotion.name.toLowerCase().includes(query) ||
          promotion.code.toLowerCase().includes(query) ||
          (promotion.description || "").toLowerCase().includes(query);
        const matchesStatus =
          filters.status === "all" || promotion.status === filters.status;
        return matchesSearch && matchesStatus;
      }),
    [allPromotions, filters],
  );

  const runOperation = async (operation) => {
    setOperationError(null);
    try {
      return await operation();
    } catch (caught) {
      setOperationError(caught);
      throw caught;
    }
  };

  const refetchRestaurant = async (restaurantId) => {
    if (String(selectedRestaurantId) !== String(restaurantId)) return;
    await refetch({
      restaurantId,
      activeOnly,
      limit: 500,
      offset: 0,
    });
  };

  const addPromotion = async (promotionData) => {
    const targetRestaurantId = String(
      promotionData?.restaurantId || selectedRestaurantId || "",
    );
    if (!targetRestaurantId) return null;

    const result = await runOperation(() =>
      createPromotion({
        variables: {
          input: buildPromotionInput(promotionData, targetRestaurantId),
        },
      }),
    );
    const authoritativeRestaurantId = String(
      result?.data?.createPromotion?.restaurantId || targetRestaurantId,
    );
    await refetchRestaurant(authoritativeRestaurantId);
    return authoritativeRestaurantId;
  };

  const togglePromotion = async (id, isActive) => {
    const result = await runOperation(() =>
      togglePromotionMu({ variables: { id, isActive: Boolean(isActive) } }),
    );
    const restaurantId = String(
      result?.data?.togglePromotion?.restaurantId || selectedRestaurantId || "",
    );
    await refetchRestaurant(restaurantId);
    return restaurantId;
  };

  const updatePromotion = async (id, promotionData) => {
    const currentPromotion = allPromotions.find(
      (promotion) => String(promotion.id) === String(id),
    );
    const currentRestaurantId = String(
      currentPromotion?.restaurantId || selectedRestaurantId || "",
    );
    if (!currentRestaurantId) return null;

    const requestedRestaurantId = String(
      promotionData?.restaurantId || currentRestaurantId,
    );
    if (requestedRestaurantId !== currentRestaurantId) {
      const moveError = new Error(
        "Không thể chuyển khuyến mãi sang nhà hàng khác. Hãy tạo bản sao tại nhà hàng cần dùng.",
      );
      setOperationError(moveError);
      throw moveError;
    }

    if (
      isStatusOnlyPromotionUpdate(
        currentPromotion,
        promotionData,
        currentRestaurantId,
      )
    ) {
      return togglePromotion(id, promotionData.status !== "draft");
    }

    const result = await runOperation(() =>
      updatePromotionMu({
        variables: {
          id,
          input: buildPromotionInput(promotionData, currentRestaurantId),
        },
      }),
    );
    const authoritativeRestaurantId = String(
      result?.data?.updatePromotion?.restaurantId || currentRestaurantId,
    );
    await refetchRestaurant(authoritativeRestaurantId);
    return authoritativeRestaurantId;
  };

  const deletePromotion = async (id) => {
    try {
      await runOperation(() => deletePromotionMu({ variables: { id } }));
      await refetch();
      return true;
    } catch {
      return false;
    }
  };

  const duplicatePromotion = async (id) => {
    const promotion = allPromotions.find(
      (item) => String(item.id) === String(id),
    );
    if (!promotion) return null;

    try {
      return await addPromotion({
        ...promotion,
        name: `${promotion.name} (Sao chép)`,
        code: buildDuplicatePromotionCode(promotion.code, allPromotions),
        status: "draft",
        usageCount: 0,
      });
    } catch {
      return null;
    }
  };

  const updateFilters = (newFilters) => {
    setOperationError(null);
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
    togglePromotion,
    deletePromotion,
    duplicatePromotion,
    updateFilters,
    loading,
    error: operationError || error,
    refetchPromotions: refetch,
  };
};
