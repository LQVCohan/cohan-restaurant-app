import React, { useState } from "react";
import HeaderCard from "./components/HeaderCard/HeaderCard";
import StatsCard from "./components/StatsCard/StatsCard";
import ActionsCard from "./components/ActionsCard/ActionsCard";
import PromotionsGrid from "./components/PromotionsGrid/PromotionsGrid";
import PromotionModal from "./components/PromotionModal/PromotionModal";
import { usePromotions } from "../../../hooks/usePromotions";
import "./PromotionManagement.scss";

const PromotionManagement = () => {
  const {
    promotions,
    allPromotions,
    filters,
    addPromotion,
    updatePromotion,
    deletePromotion,
    duplicatePromotion,
    updateFilters,
  } = usePromotions();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState(null);

  const handleOpenModal = (promotion = null) => {
    setEditingPromotion(promotion);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPromotion(null);
  };

  const handleSavePromotion = (promotionData) => {
    if (editingPromotion) {
      updatePromotion(editingPromotion.id, promotionData);
    } else {
      addPromotion(promotionData);
    }
    handleCloseModal();
  };

  const handleDeletePromotion = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa khuyến mãi này?")) {
      deletePromotion(id);
    }
  };

  const handleDuplicatePromotion = (id) => {
    duplicatePromotion(id);
  };

  const handleExport = () => {
    alert("Xuất báo cáo khuyến mãi thành công! (Tính năng demo)");
  };

  // Tính toán stats
  const stats = {
    total: allPromotions.length,
    active: allPromotions.filter((p) => p.status === "active").length,
    totalUsage: allPromotions.reduce((sum, p) => sum + p.usageCount, 0),
    totalSavings: 2400000,
    usageRate: 89,
    hotPromotions: 12,
  };

  return (
    <div className="promotion-management">
      <HeaderCard
        stats={stats}
        selectedRestaurant={filters.restaurant}
        onRestaurantChange={(restaurant) => updateFilters({ restaurant })}
      />

      <StatsCard stats={stats} />

      <ActionsCard
        filters={filters}
        onFiltersChange={updateFilters}
        onCreatePromotion={() => handleOpenModal()}
        onExport={handleExport}
      />

      <PromotionsGrid
        promotions={promotions}
        onEdit={handleOpenModal}
        onDelete={handleDeletePromotion}
        onDuplicate={handleDuplicatePromotion}
      />

      {isModalOpen && (
        <PromotionModal
          promotion={editingPromotion}
          onSave={handleSavePromotion}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default PromotionManagement;
