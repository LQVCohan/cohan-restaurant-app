import { useMemo, useState, useContext } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import {
  formatVietnamDateTimeLocal,
  toVietnamDateTimeISO,
} from "@/utils/vietnamDateTime";

const Q_COUPONS = gql`
  query Coupons($restaurantId: ID, $activeOnly: Boolean!, $limit: Int!, $offset: Int!) {
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

const Q_VOUCHER_PACKAGES = gql`
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

const M_CREATE_PACKAGE = gql`
  mutation CreateVoucherPackage($input: VoucherPackageInput!) {
    createVoucherPackage(input: $input) {
      id
      restaurantId
    }
  }
`;

const M_UPDATE_PACKAGE = gql`
  mutation UpdateVoucherPackage($id: ID!, $input: VoucherPackageInput!) {
    updateVoucherPackage(id: $id, input: $input) {
      id
      restaurantId
    }
  }
`;

const M_DELETE_PACKAGE = gql`
  mutation DeleteVoucherPackage($id: ID!) {
    deleteVoucherPackage(id: $id)
  }
`;

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

const normalizeVoucher = (item) => ({
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
  isActive: Boolean(item.isActive),
  restaurantId: item.restaurantId || "",
});

const normalizePackage = (pkg) => ({
  id: pkg.id,
  name: pkg.name,
  code: pkg.code,
  description: pkg.description || "",
  voucherIds: Array.isArray(pkg.voucherIds) ? pkg.voucherIds : [],
  startDate: formatVietnamDateTimeLocal(pkg.startAt),
  endDate: formatVietnamDateTimeLocal(pkg.endAt),
  publishAt: formatVietnamDateTimeLocal(pkg.publishAt),
  conditions: Array.isArray(pkg.conditions) ? pkg.conditions : [],
  isActive: Boolean(pkg.isActive),
  restaurantId: pkg.restaurantId || "",
});

const buildCouponInput = (voucherData, restaurantId) => ({
  name: voucherData.name,
  code: voucherData.code,
  category: voucherData.category,
  description: voucherData.description,
  discountType:
    voucherData.discountType === "fixed" ? "AMOUNT" : "PERCENT",
  discountValue: Number(voucherData.discountValue || 0),
  minOrderValue: Number(voucherData.minOrderValue || 0),
  maxDiscount: Number(voucherData.maxDiscount || 0),
  maxUsage: Number(voucherData.usageLimit || 0),
  constraints: { conditions: voucherData.conditions || [] },
  publishAt: voucherData.publishAt ? toVietnamDateTimeISO(voucherData.publishAt) : null,
  startAt: voucherData.startDate ? toVietnamDateTimeISO(voucherData.startDate) : null,
  endAt: voucherData.endDate ? toVietnamDateTimeISO(voucherData.endDate) : null,
  isActive: voucherData.status !== "draft",
  restaurantId,
});

const buildPackageInput = (packageData, restaurantId) => ({
  name: packageData.name,
  code: packageData.code,
  description: packageData.description,
  voucherIds: packageData.voucherIds || [],
  startAt: packageData.startDate ? toVietnamDateTimeISO(packageData.startDate) : null,
  endAt: packageData.endDate ? toVietnamDateTimeISO(packageData.endDate) : null,
  publishAt: packageData.publishAt ? toVietnamDateTimeISO(packageData.publishAt) : null,
  isActive: packageData.status !== "draft",
  conditions: packageData.conditions || [],
  restaurantId,
});

export const __testables = {
  buildCouponInput,
  buildPackageInput,
  normalizeVoucher,
  normalizePackage,
  resolveStatus,
};

export const useVouchers = (selectedRestaurantId = "") => {
  const { restaurants } = useContext(AuthContext);
  const defaultRestaurantId = restaurants?.[0]?.id || "";
  const activeRestaurantId = selectedRestaurantId || defaultRestaurantId || null;

  const [voucherFilters, setVoucherFilters] = useState({
    search: "",
    category: "all",
    status: "all",
  });
  const [packageFilters, setPackageFilters] = useState({
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

  const { data: packageData, refetch: refetchPackages } = useQuery(
    Q_VOUCHER_PACKAGES,
    {
      variables: { restaurantId: activeRestaurantId || undefined },
      skip: !activeRestaurantId,
      fetchPolicy: "network-only",
    },
  );

  const [createCoupon] = useMutation(M_CREATE_COUPON);
  const [updateCoupon] = useMutation(M_UPDATE_COUPON);
  const [deleteCoupon] = useMutation(M_DELETE_COUPON);
  const [createPackageMu] = useMutation(M_CREATE_PACKAGE);
  const [updatePackageMu] = useMutation(M_UPDATE_PACKAGE);
  const [deletePackageMu] = useMutation(M_DELETE_PACKAGE);

  const allVouchers = useMemo(
    () => (couponData?.coupons || []).map(normalizeVoucher),
    [couponData?.coupons],
  );
  const allPackages = useMemo(
    () => (packageData?.voucherPackages || []).map(normalizePackage),
    [packageData?.voucherPackages],
  );

  const vouchers = useMemo(
    () =>
      allVouchers.filter((voucher) => {
        const q = voucherFilters.search.toLowerCase();
        const matchesSearch =
          voucher.name.toLowerCase().includes(q) ||
          voucher.code.toLowerCase().includes(q) ||
          (voucher.description || "").toLowerCase().includes(q);
        const matchesCategory =
          voucherFilters.category === "all" ||
          voucher.category === voucherFilters.category;
        const status = resolveStatus(voucher);
        const matchesStatus =
          voucherFilters.status === "all" || status === voucherFilters.status;
        return matchesSearch && matchesCategory && matchesStatus;
      }),
    [allVouchers, voucherFilters],
  );

  const packages = useMemo(
    () =>
      allPackages.filter((pkg) => {
        const q = packageFilters.search.toLowerCase();
        const matchesSearch =
          pkg.name.toLowerCase().includes(q) ||
          pkg.code.toLowerCase().includes(q) ||
          (pkg.description || "").toLowerCase().includes(q);
        const status = resolveStatus(pkg);
        const matchesStatus =
          packageFilters.status === "all" || status === packageFilters.status;
        return matchesSearch && matchesStatus;
      }),
    [allPackages, packageFilters],
  );

  const addVoucher = async (voucherData) => {
    if (!activeRestaurantId) return null;
    const result = await createCoupon({
      variables: {
        input: buildCouponInput(voucherData, activeRestaurantId),
      },
    });
    await refetchCoupons();
    return result?.data?.createCoupon?.restaurantId || activeRestaurantId;
  };

  const updateVoucher = async (id, voucherData) => {
    if (!activeRestaurantId) return null;
    const result = await updateCoupon({
      variables: {
        id,
        input: buildCouponInput(voucherData, activeRestaurantId),
      },
    });
    await refetchCoupons();
    return result?.data?.updateCoupon?.restaurantId || activeRestaurantId;
  };

  const duplicateVoucher = async (id) => {
    const voucher = allVouchers.find((item) => item.id === id);
    if (!voucher) return;
    await addVoucher({
      ...voucher,
      code: `${voucher.code}_COPY`,
      name: `${voucher.name} (Sao chép)`,
      status: "draft",
    });
  };

  const addPackage = async (packageData) => {
    if (!activeRestaurantId) return null;
    const result = await createPackageMu({
      variables: {
        input: buildPackageInput(packageData, activeRestaurantId),
      },
    });
    await refetchPackages();
    return result?.data?.createVoucherPackage?.restaurantId || activeRestaurantId;
  };

  const updatePackage = async (id, packageData) => {
    if (!activeRestaurantId) return null;
    const result = await updatePackageMu({
      variables: {
        id,
        input: buildPackageInput(packageData, activeRestaurantId),
      },
    });
    await refetchPackages();
    return result?.data?.updateVoucherPackage?.restaurantId || activeRestaurantId;
  };

  return {
    vouchers,
    allVouchers,
    voucherFilters,
    updateVoucherFilters: (newFilters) =>
      setVoucherFilters((prev) => ({ ...prev, ...newFilters })),
    addVoucher,
    updateVoucher,
    deleteVoucher: async (id) => {
      await deleteCoupon({ variables: { id } });
      await refetchCoupons();
    },
    duplicateVoucher,
    packages,
    allPackages,
    packageFilters,
    updatePackageFilters: (newFilters) =>
      setPackageFilters((prev) => ({ ...prev, ...newFilters })),
    addPackage,
    updatePackage,
    deletePackage: async (id) => {
      await deletePackageMu({ variables: { id } });
      await refetchPackages();
    },
    duplicatePackage: async (id) => {
      const pkg = allPackages.find((item) => item.id === id);
      if (!pkg) return;
      await addPackage({
        ...pkg,
        code: `${pkg.code}_COPY`,
        name: `${pkg.name} (Sao chép)`,
        status: "draft",
      });
    },
    resolveStatus,
  };
};
