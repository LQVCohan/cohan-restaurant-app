import { useState, useEffect } from "react";
import { useIngredients } from "./useIngredients";
import { useSupplies } from "./useSupplies";
import { useAllocation } from "./useAllocation";

export const useInventoryReports = () => {
  const { ingredients } = useIngredients();
  const { supplies } = useSupplies();
  const { allocations } = useAllocation();

  // Stock Status Report
  const getStockStatusReport = () => {
    const allItems = [
      ...ingredients.map((item) => ({ ...item, type: "ingredient" })),
      ...supplies.map((item) => ({ ...item, type: "supply" })),
    ];

    const outOfStock = allItems.filter((item) => item.currentStock === 0);
    const lowStock = allItems.filter(
      (item) => item.currentStock > 0 && item.currentStock <= item.minStock
    );
    const inStock = allItems.filter(
      (item) => item.currentStock > item.minStock
    );

    return {
      total: allItems.length,
      outOfStock: outOfStock.length,
      lowStock: lowStock.length,
      inStock: inStock.length,
      outOfStockItems: outOfStock,
      lowStockItems: lowStock,
      inStockItems: inStock,
    };
  };

  // Value Report
  const getValueReport = () => {
    const ingredientValue = ingredients.reduce(
      (total, item) => total + item.currentStock * item.costPrice,
      0
    );

    const supplyValue = supplies.reduce(
      (total, item) => total + item.currentStock * item.costPrice,
      0
    );

    const totalValue = ingredientValue + supplyValue;

    return {
      totalValue,
      ingredientValue,
      supplyValue,
      ingredientPercentage:
        totalValue > 0 ? (ingredientValue / totalValue) * 100 : 0,
      supplyPercentage: totalValue > 0 ? (supplyValue / totalValue) * 100 : 0,
    };
  };

  // Usage Report (from allocations)
  const getUsageReport = (days = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentAllocations = allocations.filter(
      (allocation) => new Date(allocation.createdAt) >= cutoffDate
    );

    // Group by ingredient
    const ingredientUsage = {};
    recentAllocations.forEach((allocation) => {
      allocation.ingredients.forEach((ing) => {
        if (!ingredientUsage[ing.ingredientId]) {
          ingredientUsage[ing.ingredientId] = {
            ingredientName: ing.ingredientName,
            totalUsed: 0,
            totalCost: 0,
            usageCount: 0,
          };
        }
        ingredientUsage[ing.ingredientId].totalUsed += ing.allocatedAmount;
        ingredientUsage[ing.ingredientId].totalCost +=
          ing.allocatedAmount * ing.costPrice;
        ingredientUsage[ing.ingredientId].usageCount += 1;
      });
    });

    const sortedUsage = Object.values(ingredientUsage).sort(
      (a, b) => b.totalCost - a.totalCost
    );

    return {
      period: days,
      totalAllocations: recentAllocations.length,
      totalCost: recentAllocations.reduce((sum, a) => sum + a.totalCost, 0),
      ingredientUsage: sortedUsage,
      topIngredients: sortedUsage.slice(0, 10),
    };
  };

  // Category Report
  const getCategoryReport = () => {
    const ingredientsByCategory = {};
    const suppliesByCategory = {};

    ingredients.forEach((item) => {
      if (!ingredientsByCategory[item.category]) {
        ingredientsByCategory[item.category] = {
          count: 0,
          value: 0,
          items: [],
        };
      }
      ingredientsByCategory[item.category].count += 1;
      ingredientsByCategory[item.category].value +=
        item.currentStock * item.costPrice;
      ingredientsByCategory[item.category].items.push(item);
    });

    supplies.forEach((item) => {
      if (!suppliesByCategory[item.category]) {
        suppliesByCategory[item.category] = {
          count: 0,
          value: 0,
          items: [],
        };
      }
      suppliesByCategory[item.category].count += 1;
      suppliesByCategory[item.category].value +=
        item.currentStock * item.costPrice;
      suppliesByCategory[item.category].items.push(item);
    });

    return {
      ingredients: ingredientsByCategory,
      supplies: suppliesByCategory,
    };
  };

  // Trend Analysis
  const getTrendAnalysis = () => {
    // This would typically use historical data
    // For now, we'll provide current snapshot analysis
    const stockStatus = getStockStatusReport();
    const valueReport = getValueReport();
    const usageReport = getUsageReport(7); // Last 7 days

    return {
      stockHealth: {
        score: ((stockStatus.inStock / stockStatus.total) * 100).toFixed(1),
        status:
          stockStatus.outOfStock === 0
            ? "excellent"
            : stockStatus.outOfStock < 3
            ? "good"
            : "needs_attention",
      },
      inventoryTurnover: {
        weeklyUsage: usageReport.totalCost,
        inventoryValue: valueReport.totalValue,
        turnoverRate:
          valueReport.totalValue > 0
            ? ((usageReport.totalCost / valueReport.totalValue) * 52).toFixed(2)
            : 0,
      },
      alerts: [
        ...(stockStatus.outOfStock > 0
          ? [`${stockStatus.outOfStock} mặt hàng đã hết`]
          : []),
        ...(stockStatus.lowStock > 0
          ? [`${stockStatus.lowStock} mặt hàng sắp hết`]
          : []),
        ...(usageReport.totalAllocations === 0
          ? ["Không có hoạt động phân bổ gần đây"]
          : []),
      ],
    };
  };

  return {
    getStockStatusReport,
    getValueReport,
    getUsageReport,
    getCategoryReport,
    getTrendAnalysis,
  };
};
