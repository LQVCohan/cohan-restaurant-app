import { useMemo, useState } from "react";

const sampleVouchers = [
  {
    id: 1,
    name: "Voucher Tết Sum Vầy",
    code: "TET2025",
    category: "food",
    discountType: "percent",
    discountValue: 20,
    minOrderValue: 300000,
    maxDiscount: 80000,
    startDate: "2025-01-20T00:00",
    endDate: "2025-02-10T23:59",
    publishAt: "2025-01-10T09:00",
    status: "scheduled",
    usageLimit: 2000,
    usageCount: 120,
    conditions: [
      "Áp dụng cho món chính",
      "Không áp dụng cùng ưu đãi khác",
    ],
    description: "Ưu đãi Tết dành cho đơn ăn tại nhà hàng.",
  },
  {
    id: 2,
    name: "Voucher Đặt Bàn Cuối Tuần",
    code: "TABLEWEEK",
    category: "table",
    discountType: "fixed",
    discountValue: 50000,
    minOrderValue: 500000,
    maxDiscount: null,
    startDate: "2024-12-15T00:00",
    endDate: "2025-01-31T23:59",
    publishAt: "2024-12-10T08:00",
    status: "active",
    usageLimit: 500,
    usageCount: 78,
    conditions: ["Áp dụng cho đặt bàn trước 24h"],
    description: "Giảm ngay 50.000đ cho các bàn đặt trước cuối tuần.",
  },
  {
    id: 3,
    name: "Voucher Freeship",
    code: "SHIPFREE",
    category: "shipping",
    discountType: "fixed",
    discountValue: 30000,
    minOrderValue: 200000,
    maxDiscount: null,
    startDate: "2024-11-01T00:00",
    endDate: "2024-12-31T23:59",
    publishAt: "2024-10-25T09:00",
    status: "expired",
    usageLimit: 1000,
    usageCount: 1000,
    conditions: ["Áp dụng cho đơn giao hàng nội thành"],
    description: "Miễn phí vận chuyển cho đơn đủ điều kiện.",
  },
  {
    id: 4,
    name: "Voucher Đặt Món Online",
    code: "ORDER15",
    category: "order",
    discountType: "percent",
    discountValue: 15,
    minOrderValue: 250000,
    maxDiscount: 60000,
    startDate: "2024-12-01T00:00",
    endDate: "2025-02-01T23:59",
    publishAt: "2024-11-28T09:00",
    status: "active",
    usageLimit: 1200,
    usageCount: 240,
    conditions: ["Áp dụng cho đơn đặt món online"],
    description: "Ưu đãi dành riêng cho khách đặt món online.",
  },
];

const samplePackages = [
  {
    id: 1,
    name: "Gói Voucher Khách Mới",
    code: "NEWBIE-PACK",
    description:
      "Gồm 3 voucher (ăn tại quán, đặt món online và freeship) dành cho khách mới.",
    voucherIds: [1, 3, 4],
    startDate: "2025-01-01T00:00",
    endDate: "2025-03-31T23:59",
    publishAt: "2024-12-20T09:00",
    status: "scheduled",
  },
];

const getNextId = (items) =>
  items.length ? Math.max(...items.map((item) => item.id)) + 1 : 1;

const resolveStatus = (item) => {
  if (item.status === "draft") return "draft";
  const now = new Date();
  const publishAt = item.publishAt ? new Date(item.publishAt) : null;
  const endDate = item.endDate ? new Date(item.endDate) : null;
  const startDate = item.startDate ? new Date(item.startDate) : null;

  if (publishAt && publishAt > now) return "scheduled";
  if (endDate && endDate < now) return "expired";
  if (startDate && startDate > now) return "scheduled";
  return "active";
};

export const useVouchers = () => {
  const [vouchers, setVouchers] = useState(sampleVouchers);
  const [packages, setPackages] = useState(samplePackages);
  const [voucherFilters, setVoucherFilters] = useState({
    search: "",
    category: "all",
    status: "all",
  });
  const [packageFilters, setPackageFilters] = useState({
    search: "",
    status: "all",
  });

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      const matchesSearch =
        voucher.name.toLowerCase().includes(voucherFilters.search.toLowerCase()) ||
        voucher.code.toLowerCase().includes(voucherFilters.search.toLowerCase()) ||
        (voucher.description || "")
          .toLowerCase()
          .includes(voucherFilters.search.toLowerCase());

      const matchesCategory =
        voucherFilters.category === "all" ||
        voucher.category === voucherFilters.category;

      const status = resolveStatus(voucher);
      const matchesStatus =
        voucherFilters.status === "all" || status === voucherFilters.status;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [vouchers, voucherFilters]);

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchesSearch =
        pkg.name.toLowerCase().includes(packageFilters.search.toLowerCase()) ||
        pkg.code.toLowerCase().includes(packageFilters.search.toLowerCase()) ||
        (pkg.description || "")
          .toLowerCase()
          .includes(packageFilters.search.toLowerCase());

      const status = resolveStatus(pkg);
      const matchesStatus =
        packageFilters.status === "all" || status === packageFilters.status;

      return matchesSearch && matchesStatus;
    });
  }, [packages, packageFilters]);

  const addVoucher = (voucherData) => {
    const status = resolveStatus(voucherData);
    const newVoucher = {
      id: getNextId(vouchers),
      usageCount: 0,
      ...voucherData,
      status,
    };
    setVouchers((prev) => [...prev, newVoucher]);
  };

  const updateVoucher = (id, voucherData) => {
    setVouchers((prev) =>
      prev.map((voucher) =>
        voucher.id === id
          ? { ...voucher, ...voucherData, status: resolveStatus(voucherData) }
          : voucher
      )
    );
  };

  const deleteVoucher = (id) => {
    setVouchers((prev) => prev.filter((voucher) => voucher.id !== id));
  };

  const duplicateVoucher = (id) => {
    const voucher = vouchers.find((item) => item.id === id);
    if (voucher) {
      const newVoucher = {
        ...voucher,
        id: getNextId(vouchers),
        name: `${voucher.name} (Sao chép)`,
        code: `${voucher.code}_COPY`,
        status: "draft",
        usageCount: 0,
      };
      setVouchers((prev) => [...prev, newVoucher]);
    }
  };

  const updateVoucherFilters = (newFilters) => {
    setVoucherFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const addPackage = (packageData) => {
    const status = resolveStatus(packageData);
    const newPackage = {
      id: getNextId(packages),
      ...packageData,
      status,
    };
    setPackages((prev) => [...prev, newPackage]);
  };

  const updatePackage = (id, packageData) => {
    setPackages((prev) =>
      prev.map((pkg) =>
        pkg.id === id
          ? { ...pkg, ...packageData, status: resolveStatus(packageData) }
          : pkg
      )
    );
  };

  const deletePackage = (id) => {
    setPackages((prev) => prev.filter((pkg) => pkg.id !== id));
  };

  const duplicatePackage = (id) => {
    const pkg = packages.find((item) => item.id === id);
    if (pkg) {
      const newPackage = {
        ...pkg,
        id: getNextId(packages),
        name: `${pkg.name} (Sao chép)`,
        code: `${pkg.code}_COPY`,
        status: "draft",
      };
      setPackages((prev) => [...prev, newPackage]);
    }
  };

  const updatePackageFilters = (newFilters) => {
    setPackageFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return {
    vouchers: filteredVouchers,
    allVouchers: vouchers,
    voucherFilters,
    updateVoucherFilters,
    addVoucher,
    updateVoucher,
    deleteVoucher,
    duplicateVoucher,
    packages: filteredPackages,
    allPackages: packages,
    packageFilters,
    updatePackageFilters,
    addPackage,
    updatePackage,
    deletePackage,
    duplicatePackage,
    resolveStatus,
  };
};
