import { useState, useMemo } from "react";

const samplePromotions = [
  {
    id: 1,
    name: "Chào Mừng Khách Mới",
    code: "WELCOME20",
    type: "percentage",
    discountValue: 20,
    minOrderValue: 200000,
    maxDiscount: 50000,
    startDate: "2024-12-01T00:00",
    endDate: "2024-12-31T23:59",
    status: "active",
    usageLimit: 1000,
    usageCount: 234,
    targetAudience: "new",
    restaurantId: "hcm-center",
    description: "Giảm 20% cho đơn hàng đầu tiên của khách hàng mới",
    conditions: [
      "Chỉ áp dụng cho khách hàng mới",
      "Đơn hàng tối thiểu 200.000đ",
      "Giảm tối đa 50.000đ",
    ],
  },
  // ... thêm các promotion khác
];

export const usePromotions = () => {
  const [promotions, setPromotions] = useState(samplePromotions);
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    restaurant: "all",
  });

  const filteredPromotions = useMemo(() => {
    return promotions.filter((promotion) => {
      const matchesSearch =
        promotion.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        promotion.code.toLowerCase().includes(filters.search.toLowerCase()) ||
        promotion.description
          .toLowerCase()
          .includes(filters.search.toLowerCase());

      const matchesStatus =
        filters.status === "all" || promotion.status === filters.status;
      const matchesRestaurant =
        filters.restaurant === "all" ||
        promotion.restaurantId === filters.restaurant;

      return matchesSearch && matchesStatus && matchesRestaurant;
    });
  }, [promotions, filters]);

  const addPromotion = (promotionData) => {
    const newPromotion = {
      id: Math.max(...promotions.map((p) => p.id)) + 1,
      ...promotionData,
      usageCount: 0,
    };
    setPromotions((prev) => [...prev, newPromotion]);
  };

  const updatePromotion = (id, promotionData) => {
    setPromotions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...promotionData } : p))
    );
  };

  const deletePromotion = (id) => {
    setPromotions((prev) => prev.filter((p) => p.id !== id));
  };

  const duplicatePromotion = (id) => {
    const promotion = promotions.find((p) => p.id === id);
    if (promotion) {
      const newPromotion = {
        ...promotion,
        id: Math.max(...promotions.map((p) => p.id)) + 1,
        name: promotion.name + " (Sao chép)",
        code: promotion.code + "_COPY",
        status: "draft",
        usageCount: 0,
      };
      setPromotions((prev) => [...prev, newPromotion]);
    }
  };

  const updateFilters = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  return {
    promotions: filteredPromotions,
    allPromotions: promotions,
    filters,
    addPromotion,
    updatePromotion,
    deletePromotion,
    duplicatePromotion,
    updateFilters,
  };
};
