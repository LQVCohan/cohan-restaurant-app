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

// Components
import Header from "./layout/Header/Header";
import Tabs from "./layout/Tabs/Tabs";
import IngredientList from "./components/ingredients/IngredientList";
import SupplyList from "./components/supplies/SupplyList";
import RecipeList from "./components/recipes/RecipeList";
import WarehouseStatus from "./components/WarehouseStatus/WarehouseStatus"; // Import Component Status

// Hooks & Icons
import { useRecipes } from "@/hooks/useRecipes";
import {
  Carrot,
  Package,
  BookOpen,
  PieChart,
  ClipboardList,
  AlertCircle,
} from "lucide-react";

// Styles
import "./StorageManagement.scss";

// GraphQL
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
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(undefined);
  const [ingredientSearch, setIngredientSearch] = useState("");

  // --- MOCK DATA CHO WAREHOUSE STATUS ---
  // (Bạn có thể thay thế bằng dữ liệu thật từ API stockItems sau này)
  const mockInventory = [
    { id: 1, name: "Bột mì đa dụng", quantity: 2, minStock: 10, unit: "kg" },
    { id: 2, name: "Trứng gà", quantity: 5, minStock: 50, unit: "quả" }, // Sắp hết
    { id: 3, name: "Sữa tươi", quantity: 20, minStock: 5, unit: "lít" },
    { id: 4, name: "Đường kính", quantity: 0, minStock: 5, unit: "kg" }, // Hết hàng
  ];

  const lowStockItems = useMemo(() => {
    return mockInventory
      .filter((item) => item.quantity <= item.minStock)
      .map((item) => ({
        id: item.id,
        name: item.name,
        currentStock: item.quantity,
        unit: item.unit,
      }));
  }, []);

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
    if (selectedWarehouseId === undefined && warehouses.length) {
      setSelectedWarehouseId(warehouses[0].id);
    }
  }, [warehouses, selectedWarehouseId]);

  const warehouseFilterId = selectedWarehouseId ? selectedWarehouseId : null;

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
      warehouseId: warehouseFilterId,
      limit: 200,
    },
    skip: !shouldFetchStock,
    fetchPolicy: "cache-and-network",
  });

  const stockItems = useMemo(() => stockData?.stockItems || [], [stockData]);

  const { refetch: refetchMovements } = useQuery(STOCK_MOVEMENTS_QUERY, {
    variables: {
      restaurantId: currentRestaurant,
      warehouseId: warehouseFilterId,
      limit: 100,
      sort: -1,
    },
    skip: !restaurantReady || activeTab !== "inventory",
    fetchPolicy: "cache-and-network",
  });

  // ==== 5) Recipes ====
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

  // Define Tabs
  const tabs = [
    {
      id: "ingredients",
      label: "Nguyên liệu",
      icon: <Carrot size={18} />,
      component: (
        <IngredientList
          restaurantId={currentRestaurant}
          warehouseId={warehouseFilterId}
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
      label: "Vật tư & Khác",
      icon: <Package size={18} />,
      component: (
        <SupplyList
          restaurantId={currentRestaurant}
          warehouseId={warehouseFilterId}
          warehouses={warehouses}
          warehousesLoading={whLoading}
          onReload={reloadIngredientsAndStock}
        />
      ),
    },
    {
      id: "recipes",
      label: "Công thức",
      icon: <BookOpen size={18} />,
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
      label: "Phân bổ",
      icon: <PieChart size={18} />,
      component: (
        <div className="sm-dev-placeholder">
          Tính năng phân bổ đang phát triển...
        </div>
      ),
    },
    {
      id: "inventory",
      label: "Kiểm kê",
      icon: <ClipboardList size={18} />,
      component: (
        <div className="sm-dev-placeholder">
          Tính năng kiểm kê đang phát triển...
        </div>
      ),
    },
  ];

  if (mgrError) {
    return (
      <div className="sm-error-state">
        <AlertCircle size={40} />
        <h3>Không thể tải dữ liệu</h3>
        <p>{mgrError.message}</p>
      </div>
    );
  }

  if (mgrLoading) {
    return (
      <div className="storage-management">
        <div className="sm-loading-state">
          <div className="spinner"></div>
          <p>Đang tải dữ liệu nhà hàng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="storage-management">
      <div className="sm-container">
        {/* --- Header Section --- */}
        <section className="sm-header-section">
          <Header
            restaurantList={managerRestaurants}
            currentRestaurantId={currentRestaurant}
            onRestaurantChange={(id) => {
              setCurrentRestaurant(id);
              setSelectedWarehouseId(undefined);
              setRecipeTimeSlot(null);
              setRecipeSearch(null);
              setRecipeCategoryId(null);
            }}
            warehouses={warehouses}
            selectedWarehouseId={warehouseFilterId}
            onWarehouseChange={setSelectedWarehouseId}
            restaurantsLoading={mgrLoading}
            warehousesLoading={whLoading}
          />
        </section>

        {/* --- Content Section --- */}
        <div className="sm-main-content">
          {/* TOOLBAR: Tabs (Left) - Status (Right) */}
          <div className="sm-toolbar-wrapper">
            <div className="toolbar-left">
              <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(t) => {
                  setActiveTab(t);
                  if (["inventory", "allocation", "ingredients"].includes(t)) {
                    refetchStock?.();
                    if (t === "inventory") refetchMovements?.();
                  }
                  if (t === "recipes") refreshRecipes?.();
                }}
              />
            </div>

            <div className="toolbar-right">
              <WarehouseStatus lowStockItems={lowStockItems} />
            </div>
          </div>

          {/* Tab Content */}
          <div className="sm-tab-content-wrapper">
            {tabs.find((tab) => tab.id === activeTab)?.component}
          </div>

          {whError && (
            <div className="sm-error-toast">
              <AlertCircle size={16} /> Lỗi tải kho: {whError.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorageManagement;
