// src/components/Dashboard_Manager/Storage/StorageManagement.jsx
import React, {
  useState,
  useEffect,
  useContext,
  useMemo,
  useCallback,
} from "react";
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
    fetchPolicy: "cache-and-network",
  });

  const managerRestaurants = useMemo(() => {
    return mgrData?.restaurantsByManager?.edges?.map((e) => e.node) || [];
  }, [mgrData]);

  useEffect(() => {
    // chỉ set default khi chưa có currentRestaurant
    if (!currentRestaurant && managerRestaurants.length) {
      setCurrentRestaurant(managerRestaurants[0].id);
    }
  }, [currentRestaurant, managerRestaurants]);

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

  const ingredients = useMemo(() => ingData?.ingredients || [], [ingData]);

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

  const warehouses = useMemo(() => whData?.warehouses || [], [whData]);
  useEffect(() => {
    if (!selectedWarehouseId && warehouses.length) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId]);
  // ==== 4) StockItems/Movements ====
  const shouldFetchStock =
    restaurantReady &&
    (activeTab === "ingredients" ||
      activeTab === "inventory" ||
      activeTab === "allocation");

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
    skip: !shouldFetchStock,
    fetchPolicy: "cache-and-network",
  });

  const stockItems = useMemo(() => stockData?.stockItems || [], [stockData]);

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

  // ==== 5) Recipes (hook) ====
  const [recipeTimeSlot, setRecipeTimeSlot] = useState(null);
  const [recipeSearch, setRecipeSearch] = useState(null);
  const [recipeCategoryId, setRecipeCategoryId] = useState(null);

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

  const reloadIngredientsAndStock = useCallback(async () => {
    await Promise.all([refetchIngredients?.(), refetchStock?.()]);
  }, [refetchIngredients, refetchStock]);

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
          warehouseId={selectedWarehouseId}
          data={ingredients}
          stockItems={stockItems}
          loading={ingLoading || stockLoading}
          error={ingError || stockError}
          onReload={reloadIngredientsAndStock}
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
          onReload={reloadIngredientsAndStock}
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
            setSelectedWarehouseId(null);
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

              if (
                t === "inventory" ||
                t === "allocation" ||
                t === "ingredients"
              ) {
                refetchStock?.();
                if (t === "inventory") refetchMovements?.();
              }

              if (t === "recipes") refreshRecipes?.();
            }}
          />

          <div className="tab-content">
            {tabs.find((tab) => tab.id === activeTab)?.component}
          </div>

          {whError ? (
            <div style={{ color: "#b91c1c", marginTop: 10 }}>
              Lỗi tải kho: {whError.message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StorageManagement;
