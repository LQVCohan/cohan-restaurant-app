// src/components/Dashboard_Manager/Storage/StorageManagement.jsx
import React, { useState, useEffect, useContext, useMemo } from "react";
import { useQuery } from "@apollo/client";
import { AuthContext } from "../../../context/AuthContext";
import Header from "./layout/Header/Header";
import Tabs from "./layout/Tabs/Tabs";
import IngredientList from "./components/ingredients/IngredientList";
import SupplyList from "./components/supplies/SupplyList";
import RecipeList from "./components/recipes/RecipeList";

import "./StorageManagement.scss";

import {
  GET_MANAGER_RESTAURANTS,
  INGREDIENTS_QUERY,
  WAREHOUSES_QUERY,
  STOCK_ITEMS_QUERY,
  STOCK_MOVEMENTS_QUERY,
  MENU_ITEMS_FOR_RECIPE,
} from "./graphql/inventory.gql";

const StorageManagement = () => {
  const { user } = useContext(AuthContext);
  const managerId = user?.id;

  const [activeTab, setActiveTab] = useState("ingredients");
  const [currentRestaurant, setCurrentRestaurant] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null);
  const [ingredientSearch, setIngredientSearch] = useState("");

  /** 1) Nhà hàng theo Manager */
  const {
    data: mgrData,
    loading: mgrLoading,
    error: mgrError,
  } = useQuery(GET_MANAGER_RESTAURANTS, {
    variables: { managerId, limit: 50 },
    skip: !managerId,
  });

  const managerRestaurants =
    mgrData?.restaurantsByManager?.edges?.map((e) => e.node) || [];

  useEffect(() => {
    if (managerRestaurants.length) {
      setCurrentRestaurant((prev) => prev || managerRestaurants[0].id);
    }
  }, [managerRestaurants]);

  /** 2) Dữ liệu Inventory phụ thuộc currentRestaurant */
  const restaurantReady = Boolean(currentRestaurant);

  // Ingredients
  const {
    data: ingData,
    loading: ingLoading,
    error: ingError,
    refetch: refetchIngredients,
  } = useQuery(INGREDIENTS_QUERY, {
    variables: {
      restaurantId: currentRestaurant,
      search: ingredientSearch || null,
      limit: 200,
    },
    skip: !restaurantReady,
    fetchPolicy: "cache-and-network",
  });

  // Warehouses
  const {
    data: whData,
    loading: whLoading,
    error: whError,
    refetch: refetchWarehouses,
  } = useQuery(WAREHOUSES_QUERY, {
    variables: { restaurantId: currentRestaurant },
    skip: !restaurantReady,
    fetchPolicy: "cache-and-network",
  });

  // Stock (phục vụ tab Inventory/Allocation sau này)
  const {
    data: stockData,
    loading: stockLoading,
    error: stockError,
    refetch: refetchStock,
  } = useQuery(STOCK_ITEMS_QUERY, {
    variables: {
      restaurantId: currentRestaurant,
      warehouseId: selectedWarehouseId || null,
      limit: 200,
    },
    skip:
      !restaurantReady ||
      (activeTab !== "inventory" && activeTab !== "allocation"),
    fetchPolicy: "cache-and-network",
  });

  // Movements (nếu cần hiển thị lịch sử/Xem cảnh báo)
  const {
    data: movData,
    loading: movLoading,
    error: movError,
    refetch: refetchMovements,
  } = useQuery(STOCK_MOVEMENTS_QUERY, {
    variables: {
      restaurantId: currentRestaurant,
      warehouseId: selectedWarehouseId || null,
      limit: 100,
      sort: -1,
    },
    skip: !restaurantReady || activeTab !== "inventory",
    fetchPolicy: "cache-and-network",
  });

  // Menu items cho RecipeList (để chọn món liên kết công thức)
  const {
    data: menuItemsData,
    loading: menuLoading,
    error: menuError,
  } = useQuery(MENU_ITEMS_FOR_RECIPE, {
    variables: { restaurantId: currentRestaurant, timeSlot: null, limit: 200 },
    skip: !restaurantReady || activeTab !== "recipes",
    fetchPolicy: "cache-and-network",
  });

  const warehouses = whData?.warehouses || [];
  const ingredients = ingData?.ingredients || [];
  const stockItems = stockData?.stockItems || [];
  const movements = movData?.stockMovements || [];
  const menuItems = menuItemsData?.menuItems || [];

  /** Loading / Error gọn nhẹ */
  if (mgrError) {
    return (
      <div style={{ color: "#b91c1c" }}>
        Lỗi tải danh sách nhà hàng: {mgrError.message}
      </div>
    );
  }
  if (mgrLoading) {
    return (
      <div className="storage-management">
        <div className="container">Đang tải nhà hàng…</div>
      </div>
    );
  }

  const tabs = [
    {
      id: "ingredients",
      label: "🥬 Nguyên liệu",
      component: (
        <IngredientList
          restaurantId={currentRestaurant}
          data={ingredients}
          loading={ingLoading}
          error={ingError}
          onReload={refetchIngredients}
          onSearch={setIngredientSearch}
        />
      ),
    },
    {
      id: "supplies",
      label: "🧴 Vật phẩm khác",
      // Gợi ý: nếu “vật phẩm” cũng là Ingredient (category = 'supply'/'tool'), bạn có thể lọc ngay tại SupplyList
      component: (
        <SupplyList
          restaurantId={currentRestaurant}
          warehouseId={selectedWarehouseId} // ✅ thêm
          warehouses={warehouses} // ✅ để dùng cho chuyển kho
          warehousesLoading={whLoading} // ✅ spinner trong modal/select
          onReload={refetchIngredients}
        />
      ),
    },
    {
      id: "recipes",
      label: "📋 Công thức",
      component: (
        <RecipeList
          restaurantId={currentRestaurant}
          ingredients={ingredients}
          menuItems={menuItems}
          loading={menuLoading || ingLoading}
          error={menuError}
        />
      ),
    },
    {
      id: "allocation",
      label: "🎯 Phân bổ nguyên liệu",
      component: (
        <div>
          {/* Gợi ý: truyền warehouses + stockItems để phân bổ theo kho/line sản xuất */}
          Allocation (dev)
        </div>
      ),
    },
    {
      id: "inventory",
      label: "📊 Kiểm kê",
      component: (
        <div>
          {/* Bạn có thể dùng stockItems + movements để hiển thị kiểm kê theo kho */}
          Inventory (dev)
        </div>
      ),
    },
  ];

  return (
    <div className="storage-management">
      <div className="container">
        <Header
          restaurantList={managerRestaurants}
          currentRestaurantId={currentRestaurant}
          onRestaurantChange={setCurrentRestaurant}
          warehouses={warehouses}
          selectedWarehouseId={selectedWarehouseId}
          onWarehouseChange={setSelectedWarehouseId}
          restaurantsLoading={mgrLoading}
          warehousesLoading={whLoading}
        />

        <div className="main-content">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(t) => {
              setActiveTab(t);
              // khi đổi tab Inventory/Allocation thì refetch kho
              if (t === "inventory" || t === "allocation") {
                refetchStock?.();
                refetchMovements?.();
              }
            }}
          />

          <div className="tab-content">
            {tabs.find((tab) => tab.id === activeTab)?.component}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageManagement;
