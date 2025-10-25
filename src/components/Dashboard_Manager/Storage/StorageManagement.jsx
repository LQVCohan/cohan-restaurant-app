// src/components/Dashboard_Manager/Storage/StorageManagement.jsx
import React, { useState, useEffect, useContext } from "react";
import { useQuery } from "@apollo/client";
import { AuthContext } from "../../../context/AuthContext";
import Header from "./layout/Header/Header";
import Tabs from "./layout/Tabs/Tabs";
import IngredientList from "./components/ingredients/IngredientList";
import SupplyList from "./components/supplies/SupplyList";
import RecipeList from "./components/recipes/RecipeList";
import useRecipes from "@/hooks/useRecipes";
import "./StorageManagement.scss";

import {
  GET_MANAGER_RESTAURANTS,
  INGREDIENTS_QUERY,
  WAREHOUSES_QUERY,
  STOCK_ITEMS_QUERY,
  STOCK_MOVEMENTS_QUERY,
} from "./graphql/inventory.gql";

const StorageManagement = () => {
  const { user } = useContext(AuthContext);
  const managerId = user?.id;

  const [activeTab, setActiveTab] = useState("ingredients");
  const [currentRestaurant, setCurrentRestaurant] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(null);
  const [ingredientSearch, setIngredientSearch] = useState("");

  // ==== 1) Nhà hàng theo Manager ====
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

  const restaurantReady = Boolean(currentRestaurant);

  // ==== 2) Ingredients ====
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

  // ==== 3) Warehouses ====
  const {
    data: whData,
    loading: whLoading,
    error: whError,
  } = useQuery(WAREHOUSES_QUERY, {
    variables: { restaurantId: currentRestaurant },
    skip: !restaurantReady,
    fetchPolicy: "cache-and-network",
  });

  // ==== 4) StockItems/Movements (để dành tab sau) ====
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

  // ==== 5) Recipes (hook đã tối ưu: gộp menuItem + recipe, phân trang, CRUD) ====
  const [recipeTimeSlot, setRecipeTimeSlot] = useState(null); // 'breakfast'|'lunch'|'dinner'|'late-night'|null
  const [recipeSearch, setRecipeSearch] = useState(null); // search server-side
  const [recipeCategoryId, setRecipeCategoryId] = useState(null); // nếu có category cho Menu/Category

  const {
    recipes,
    loading: recipesLoading,
    error: recipesError,
    pageInfo: recipesPageInfo,
    total: recipesTotal,
    loadMore: loadMoreRecipes,
    refresh: refreshRecipes,
    addRecipe: addRecipeHandler,
    updateRecipe: updateRecipeHandler,
    deleteRecipe: deleteRecipeHandler,
  } = useRecipes(currentRestaurant, recipeTimeSlot, {
    search: recipeSearch,
    categoryId: recipeCategoryId,
  });

  // ==== Chuẩn bị dữ liệu ====
  const warehouses = whData?.warehouses || [];
  const ingredients = ingData?.ingredients || [];

  // ==== Loading / Error Nhà hàng ====
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
      component: (
        <SupplyList
          restaurantId={currentRestaurant}
          warehouseId={selectedWarehouseId}
          warehouses={warehouses}
          warehousesLoading={whLoading}
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
          recipes={recipes}
          loading={recipesLoading}
          error={recipesError}
          pageInfo={recipesPageInfo}
          total={recipesTotal}
          onTimeSlotChange={setRecipeTimeSlot}
          onSearchChange={setRecipeSearch}
          onCategoryChange={setRecipeCategoryId}
          loadMore={loadMoreRecipes}
          onAddRecipe={addRecipeHandler}
          onUpdateRecipe={updateRecipeHandler}
          onDeleteRecipe={deleteRecipeHandler}
          ingredients={ingredients}
        />
      ),
    },
    {
      id: "allocation",
      label: "🎯 Phân bổ nguyên liệu",
      component: <div>Allocation (dev)</div>,
    },
    {
      id: "inventory",
      label: "📊 Kiểm kê",
      component: <div>Inventory (dev)</div>,
    },
  ];

  return (
    <div className="storage-management">
      <div className="container">
        <Header
          restaurantList={managerRestaurants}
          currentRestaurantId={currentRestaurant}
          onRestaurantChange={(id) => {
            setCurrentRestaurant(id);
            setSelectedWarehouseId(null); // reset kho khi đổi nhà hàng
            // reset filter recipes:
            setRecipeTimeSlot(null);
            setRecipeSearch(null);
            setRecipeCategoryId(null);
          }}
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
              if (t === "inventory" || t === "allocation") {
                // Khi sang tab liên quan kho → refetch tồn & lịch sử
                refetchStock?.();
                refetchMovements?.();
              }
              if (t === "recipes") {
                // Chủ động refresh recipe khi quay lại tab
                refreshRecipes?.();
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
