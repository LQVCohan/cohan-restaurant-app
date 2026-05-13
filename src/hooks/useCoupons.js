import { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import {
  formatVietnamDateTimeLocal,
  toVietnamDateTimeISO,
} from "@/utils/vietnamDateTime";

const Q_COUPONS = gql`
  query Coupons(
    $restaurantId: ID
    $activeOnly: Boolean!
    $limit: Int!
    $offset: Int!
  ) {
    coupons(
      restaurantId: $restaurantId
      activeOnly: $activeOnly
      limit: $limit
      offset: $offset
    ) {
      id
      name
      code
      category
      description
      discountType
      discountValue
      minOrderValue
      maxDiscount
      maxUsage
      used
      publishAt
      startAt
      endAt
      isActive
      constraints
      restaurantId
    }
  }
`;

const Q_COUPON_PACKAGES = gql`
  query VoucherPackages($restaurantId: ID) {
    voucherPackages(restaurantId: $restaurantId) {
      id
      name
      code
      description
      voucherIds
      startAt
      endAt
      publishAt
      isActive
      conditions
      restaurantId
    }
  }
`;

const M_CREATE_COUPON = gql`
  mutation CreateCoupon($input: CouponInput!) {
    createCoupon(input: $input) {
      id
      restaurantId
    }
  }
`;

const M_UPDATE_COUPON = gql`
  mutation UpdateCoupon($id: ID!, $input: CouponInput!) {
    updateCoupon(id: $id, input: $input) {
      id
      restaurantId
    }
  }
`;

const M_DELETE_COUPON = gql`
  mutation DeleteCoupon($id: ID!) {
    deleteCoupon(id: $id)
  }
`;

const M_CREATE_COUPON_PACKAGE = gql`
  mutation CreateVoucherPackage($input: VoucherPackageInput!) {
    createVoucherPackage(input: $input) {
      id
      restaurantId
    }
  }
`;

const M_UPDATE_COUPON_PACKAGE = gql`
  mutation UpdateVoucherPackage($id: ID!, $input: VoucherPackageInput!) {
    updateVoucherPackage(id: $id, input: $input) {
      id
      restaurantId
    }
  }
`;

const M_DELETE_COUPON_PACKAGE = gql`
  mutation DeleteVoucherPackage($id: ID!) {
    deleteVoucherPackage(id: $id)
  }
`;

const toBoolean = (value, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveStatus = (item) => {
  if (item.status === "draft") return "draft";
  const now = new Date();
  const publishAt = item.publishAt ? new Date(item.publishAt) : null;
  const endDate = item.endDate ? new Date(item.endDate) : null;
  const startDate = item.startDate ? new Date(item.startDate) : null;

  if (item.isActive === false) return "draft";
  if (publishAt && publishAt > now) return "scheduled";
  if (endDate && endDate < now) return "expired";
  if (startDate && startDate > now) return "scheduled";
  return "active";
};

const normalizeCoupon = (item) => ({
  id: item.id,
  name: item.name || item.code,
  code: item.code || "",
  category: item.category || "order",
  discountType:
    String(item.discountType || "PERCENT").toLowerCase() === "amount"
      ? "fixed"
      : "percent",
  discountValue: Number(item.discountValue || 0),
  minOrderValue: Number(item.minOrderValue || 0),
  maxDiscount: Number(item.maxDiscount || 0),
  startDate: formatVietnamDateTimeLocal(item.startAt),
  endDate: formatVietnamDateTimeLocal(item.endAt),
  publishAt: formatVietnamDateTimeLocal(item.publishAt),
  usageLimit: Number(item.maxUsage || 0),
  usageCount: Number(item.used || 0),
  description: item.description || "",
  conditions: Array.isArray(item.constraints?.conditions)
    ? item.constraints.conditions
    : [],
  stackable: toBoolean(item.constraints?.stackable, false),
  combinableWithPromotions: toBoolean(
    item.constraints?.combinableWithPromotions,
    false,
  ),
  exclusive: toBoolean(item.constraints?.exclusive, false),
  priority: toNumber(item.constraints?.priority, 0),
  isActive: Boolean(item.isActive),
  restaurantId: item.restaurantId || "",
});

const normalizeCouponPackage = (couponPackage) => ({
  id: couponPackage.id,
  name: couponPackage.name,
  code: couponPackage.code,
  description: couponPackage.description || "",
  couponIds: Array.isArray(couponPackage.voucherIds)
    ? couponPackage.voucherIds
    : [],
  startDate: formatVietnamDateTimeLocal(couponPackage.startAt),
  endDate: formatVietnamDateTimeLocal(couponPackage.endAt),
  publishAt: formatVietnamDateTimeLocal(couponPackage.publishAt),
  conditions: Array.isArray(couponPackage.conditions)
    ? couponPackage.conditions
    : [],
  isActive: Boolean(couponPackage.isActive),
  restaurantId: couponPackage.restaurantId || "",
});

const buildCouponInput = (couponData, restaurantId) => ({
  name: couponData.name,
  code: couponData.code,
  category: couponData.category,
  description: couponData.description,
  discountType: couponData.discountType === "fixed" ? "AMOUNT" : "PERCENT",
  discountValue: Number(couponData.discountValue || 0),
  minOrderValue: Number(couponData.minOrderValue || 0),
  maxDiscount: Number(couponData.maxDiscount || 0),
  maxUsage: Number(couponData.usageLimit || 0),
  constraints: {
    conditions: couponData.conditions || [],
    stackable: Boolean(couponData.stackable),
    combinableWithPromotions: Boolean(couponData.combinableWithPromotions),
    exclusive: Boolean(couponData.exclusive),
    priority: Number(couponData.priority || 0),
  },
  publishAt: couponData.publishAt
    ? toVietnamDateTimeISO(couponData.publishAt)
    : null,
  startAt: couponData.startDate
    ? toVietnamDateTimeISO(couponData.startDate)
    : null,
  endAt: couponData.endDate ? toVietnamDateTimeISO(couponData.endDate) : null,
  isActive: couponData.status !== "draft",
  restaurantId,
});

const buildCouponPackageInput = (couponPackageData, restaurantId) => ({
  name: couponPackageData.name,
  code: couponPackageData.code,
  description: couponPackageData.description,
  voucherIds: couponPackageData.couponIds || [],
  startAt: couponPackageData.startDate
    ? toVietnamDateTimeISO(couponPackageData.startDate)
    : null,
  endAt: couponPackageData.endDate
    ? toVietnamDateTimeISO(couponPackageData.endDate)
    : null,
  publishAt: couponPackageData.publishAt
    ? toVietnamDateTimeISO(couponPackageData.publishAt)
    : null,
  isActive: couponPackageData.status !== "draft",
  conditions: couponPackageData.conditions || [],
  restaurantId,
});

export const __testables = {
  buildCouponInput,
  buildCouponPackageInput,
  normalizeCoupon,
  normalizeCouponPackage,
  resolveStatus,
};

export const useCoupons = (selectedRestaurantId = "") => {
  const { restaurants } = useContext(AuthContext);
  const defaultRestaurantId = restaurants?.[0]?.id || "";
  const activeRestaurantId =
    selectedRestaurantId || defaultRestaurantId || null;

  const [couponFilters, setCouponFilters] = useState({
    search: "",
    category: "all",
    status: "all",
  });
  const [couponPackageFilters, setCouponPackageFilters] = useState({
    search: "",
    status: "all",
  });

  const { data: couponData, refetch: refetchCoupons } = useQuery(Q_COUPONS, {
    variables: {
      restaurantId: activeRestaurantId || undefined,
      activeOnly: false,
      limit: 500,
      offset: 0,
    },
    skip: !activeRestaurantId,
    fetchPolicy: "network-only",
  });

  const { data: couponPackageData, refetch: refetchCouponPackages } = useQuery(
    Q_COUPON_PACKAGES,
    {
      variables: { restaurantId: activeRestaurantId || undefined },
      skip: !activeRestaurantId,
      fetchPolicy: "network-only",
    },
  );

  const [createCoupon] = useMutation(M_CREATE_COUPON);
  const [updateCouponMutation] = useMutation(M_UPDATE_COUPON);
  const [deleteCouponMutation] = useMutation(M_DELETE_COUPON);
  const [createCouponPackageMutation] = useMutation(M_CREATE_COUPON_PACKAGE);
  const [updateCouponPackageMutation] = useMutation(M_UPDATE_COUPON_PACKAGE);
  const [deleteCouponPackageMutation] = useMutation(M_DELETE_COUPON_PACKAGE);

  const allCoupons = useMemo(
    () => (couponData?.coupons || []).map(normalizeCoupon),
    [couponData?.coupons],
  );
  const allCouponPackages = useMemo(
    () =>
      (couponPackageData?.voucherPackages || []).map(normalizeCouponPackage),
    [couponPackageData?.voucherPackages],
  );

  const coupons = useMemo(
    () =>
      allCoupons.filter((coupon) => {
        const q = couponFilters.search.toLowerCase();
        const matchesSearch =
          coupon.name.toLowerCase().includes(q) ||
          coupon.code.toLowerCase().includes(q) ||
          (coupon.description || "").toLowerCase().includes(q);
        const matchesCategory =
          couponFilters.category === "all" ||
          coupon.category === couponFilters.category;
        const status = resolveStatus(coupon);
        const matchesStatus =
          couponFilters.status === "all" || status === couponFilters.status;
        return matchesSearch && matchesCategory && matchesStatus;
      }),
    [allCoupons, couponFilters],
  );

  const couponPackages = useMemo(
    () =>
      allCouponPackages.filter((couponPackage) => {
        const q = couponPackageFilters.search.toLowerCase();
        const matchesSearch =
          couponPackage.name.toLowerCase().includes(q) ||
          couponPackage.code.toLowerCase().includes(q) ||
          (couponPackage.description || "").toLowerCase().includes(q);
        const status = resolveStatus(couponPackage);
        const matchesStatus =
          couponPackageFilters.status === "all" ||
          status === couponPackageFilters.status;
        return matchesSearch && matchesStatus;
      }),
    [allCouponPackages, couponPackageFilters],
  );

  const addCoupon = async (couponDataInput) => {
    if (!activeRestaurantId) return null;
    const result = await createCoupon({
      variables: {
        input: buildCouponInput(couponDataInput, activeRestaurantId),
      },
    });
    await refetchCoupons();
    return result?.data?.createCoupon?.restaurantId || activeRestaurantId;
  };

  const updateCoupon = async (id, couponDataInput) => {
    if (!activeRestaurantId) return null;
    const result = await updateCouponMutation({
      variables: {
        id,
        input: buildCouponInput(couponDataInput, activeRestaurantId),
      },
    });
    await refetchCoupons();
    return result?.data?.updateCoupon?.restaurantId || activeRestaurantId;
  };

  const deleteCoupon = async (id) => {
    await deleteCouponMutation({ variables: { id } });
    await refetchCoupons();
  };

  const duplicateCoupon = async (id) => {
    const coupon = allCoupons.find((item) => item.id === id);
    if (!coupon) return;
    await addCoupon({
      ...coupon,
      code: `${coupon.code}_COPY`,
      name: `${coupon.name} (Sao chép)`,
      status: "draft",
    });
  };

  const addCouponPackage = async (couponPackageDataInput) => {
    if (!activeRestaurantId) return null;
    const result = await createCouponPackageMutation({
      variables: {
        input: buildCouponPackageInput(
          couponPackageDataInput,
          activeRestaurantId,
        ),
      },
    });
    await refetchCouponPackages();
    return (
      result?.data?.createVoucherPackage?.restaurantId || activeRestaurantId
    );
  };

  const updateCouponPackage = async (id, couponPackageDataInput) => {
    if (!activeRestaurantId) return null;
    const result = await updateCouponPackageMutation({
      variables: {
        id,
        input: buildCouponPackageInput(
          couponPackageDataInput,
          activeRestaurantId,
        ),
      },
    });
    await refetchCouponPackages();
    return (
      result?.data?.updateVoucherPackage?.restaurantId || activeRestaurantId
    );
  };

  const deleteCouponPackage = async (id) => {
    await deleteCouponPackageMutation({ variables: { id } });
    await refetchCouponPackages();
  };

  const duplicateCouponPackage = async (id) => {
    const couponPackage = allCouponPackages.find((item) => item.id === id);
    if (!couponPackage) return;
    await addCouponPackage({
      ...couponPackage,
      code: `${couponPackage.code}_COPY`,
      name: `${couponPackage.name} (Sao chép)`,
      status: "draft",
    });
  };

  return {
    coupons,
    allCoupons,
    couponFilters,
    updateCouponFilters: (newFilters) =>
      setCouponFilters((prev) => ({ ...prev, ...newFilters })),
    addCoupon,
    updateCoupon,
    deleteCoupon,
    duplicateCoupon,
    couponPackages,
    allCouponPackages,
    couponPackageFilters,
    updateCouponPackageFilters: (newFilters) =>
      setCouponPackageFilters((prev) => ({ ...prev, ...newFilters })),
    addCouponPackage,
    updateCouponPackage,
    deleteCouponPackage,
    duplicateCouponPackage,
    resolveStatus,
  };
};
