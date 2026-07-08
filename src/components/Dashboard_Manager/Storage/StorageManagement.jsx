// src/components/Dashboard_Manager/Storage/StorageManagement.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext,
} from "react";
import { useQuery, useMutation } from "@apollo/client";
import useManagerRestaurantSelection from "../../../hooks/useManagerRestaurantSelection";
import { AuthContext } from "@/context/AuthContext";

// Components
import Header from "./layout/Header/Header";
import Tabs from "./layout/Tabs/Tabs";
import IngredientList from "./components/ingredients/IngredientList";
import SupplyList from "./components/supplies/SupplyList";
import RecipeList from "./components/recipes/RecipeList";
import WarehouseStatus from "./components/WarehouseStatus/WarehouseStatus";
import QuickStockModal from "./components/ingredients/QuickStockModal";
import InventoryAuditTab from "./components/inventory/InventoryAuditTab";

// Hooks & Icons
import { useRecipes } from "@/hooks/useRecipes";
import { useNotification } from "@/hooks/useNotification";
import { getInventoryActionErrorMessage } from "@/utils/inventorySupplySupplierPrintErrorMessages";
import { useRestaurantCurrency } from "@/hooks/useRestaurantCurrency";
import { hasAnyPermission } from "@/utils/frontendPermissionAccess";
import {
  Carrot,
  Package,
  BookOpen,
  ClipboardList,
  AlertCircle,
  Boxes,
  Warehouse as WarehouseIcon,
} from "lucide-react";

// Styles
import "./StorageManagement.scss";

// GraphQL
import {
  INGREDIENTS_QUERY,
  WAREHOUSES_QUERY,
  CREATE_WAREHOUSE,
  STOCK_ITEMS_QUERY,
  STOCK_MOVEMENTS_QUERY,
  ADJUST_STOCK,
} from "./graphql/inventory.gql";

const StorageManagement = () => {
  const { user } = useContext(AuthContext);
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState("ingredients");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(undefined);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [ingredientActions, setIngredientActions] = useState(null);
  const [supplyActions, setSupplyActions] = useState(null);
  const [recipeActions, setRecipeActions] = useState(null);

  const canWriteInventory = hasAnyPermission(user, [
    "inventory.write",
    "stock.write",
  ]);

  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
    hasRestaurants,
  } = useManagerRestaurantSelection();

  const currentRestaurant = selectedRestaurantId;
  const restaurantReady = Boolean(selectedRestaurantId);
  const {
    loading: currencyLoading,
    activeCurrency,
    setActiveCurrency,
    usdToVndRate,
    manualUsdToVndRate,
    persistSettings: persistCurrencySettings,
  } = useRestaurantCurrency(currentRestaurant);

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

  const warehouses = useMemo(() => whData?.warehouses || [], [whData]);

  useEffect(() => {
    if (!warehouses.length) {
      if (selectedWarehouseId !== undefined) setSelectedWarehouseId(undefined);
      return;
    }

    const selectedWarehouseExists = warehouses.some(
      (warehouse) => warehouse.id === selectedWarehouseId,
    );
    if (!selectedWarehouseExists) setSelectedWarehouseId(warehouses[0].id);
  }, [warehouses, selectedWarehouseId]);

  const warehouseFilterId = selectedWarehouseId || null;
  const needsWarehouseSetup = Boolean(
    restaurantReady && !whLoading && !whError && whData && warehouses.length === 0,
  );

  const shouldFetchStockForKpi = restaurantReady;
  const shouldFetchMovementsForAudit = restaurantReady && activeTab === "inventory";
  // ponytail: recipes are heavy; fetch them only when the recipe tab is visible.
  const recipeRestaurantId = activeTab === "recipes" ? currentRestaurant : null;

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
    skip: !shouldFetchStockForKpi,
    fetchPolicy: "cache-and-network",
  });

  const stockItems = useMemo(() => stockData?.stockItems || [], [stockData]);

  const {
    data: movementData,
    loading: movementLoading,
    error: movementError,
    refetch: refetchMovements,
  } = useQuery(STOCK_MOVEMENTS_QUERY, {
    variables: {
      restaurantId: currentRestaurant,
      warehouseId: warehouseFilterId,
      limit: 100,
      sort: -1,
    },
    skip: !shouldFetchMovementsForAudit,
    fetchPolicy: "cache-and-network",
  });

  const movements = useMemo(() => movementData?.stockMovements || [], [movementData]);

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
  } = useRecipes(recipeRestaurantId, recipeTimeSlot, {
    search: recipeSearch,
    categoryId: recipeCategoryId,
  });

  const recipeCategoryOptions = useMemo(() => {
    const map = new Map();

    (recipes || []).forEach((row) => {
      const id = String(row?.categoryId || "").trim();
      if (!id || map.has(id)) return;
      map.set(id, {
        value: id,
        label: `Danh mục ${id.slice(-6)}`,
      });
    });

    const selectedId = String(recipeCategoryId || "").trim();
    if (selectedId && !map.has(selectedId)) {
      map.set(selectedId, {
        value: selectedId,
        label: `Danh mục ${selectedId.slice(-6)}`,
      });
    }

    return Array.from(map.values());
  }, [recipes, recipeCategoryId]);

  const reloadIngredientsAndStock = useCallback(async () => {
    await Promise.all([refetchIngredients?.(), refetchStock?.()]);
  }, [refetchIngredients, refetchStock]);

  const lowStockItems = useMemo(() => {
    if (!restaurantReady) return [];
    if (!ingredients.length) return [];

    const availableByIngredient = new Map();
    stockItems.forEach((item) => {
      const ingId = item.ingredientId;
      const onHand = Number(item.onHand) || 0;
      const reserved = Number(item.reserved) || 0;
      const available = onHand - reserved;
      availableByIngredient.set(
        ingId,
        (availableByIngredient.get(ingId) || 0) + available,
      );
    });

    return ingredients
      .map((ing) => {
        const current = availableByIngredient.get(ing.id) || 0;
        const min = Number(ing.minStock) || 0;
        return {
          id: ing.id,
          name: ing.name,
          currentStock: current,
          minStock: min,
          unit: ing.baseUnit,
        };
      })
      .filter((it) => it.currentStock <= it.minStock);
  }, [ingredients, restaurantReady, stockItems]);

  const [createWarehouseMu, { loading: creatingWarehouse }] = useMutation(CREATE_WAREHOUSE);
  const [adjustStockMu] = useMutation(ADJUST_STOCK);
  const [poOpen, setPoOpen] = useState(false);
  const [poEntries, setPoEntries] = useState([]);

  const handleCreateFirstWarehouse = useCallback(async () => {
    if (!currentRestaurant || !canWriteInventory || creatingWarehouse) return;

    try {
      const { data } = await createWarehouseMu({
        variables: {
          input: {
            restaurantId: currentRestaurant,
            name: "Kho chính",
            code: "MAIN",
            isActive: true,
          },
        },
      });
      const refreshed = await refetchWarehouses?.();
      const createdWarehouse = data?.createWarehouse;
      const firstWarehouse = createdWarehouse || refreshed?.data?.warehouses?.[0];
      if (firstWarehouse?.id) setSelectedWarehouseId(firstWarehouse.id);
      showNotification("Đã tạo Kho chính cho nhà hàng.", "success");
    } catch (error) {
      showNotification(
        getInventoryActionErrorMessage(error, "Không thể tạo kho đầu tiên."),
        "error",
      );
    }
  }, [
    canWriteInventory,
    createWarehouseMu,
    creatingWarehouse,
    currentRestaurant,
    refetchWarehouses,
    showNotification,
  ]);

  const storageKpis = useMemo(() => {
    const outStockItems = lowStockItems.filter((item) => Number(item.currentStock) <= 0);
    return [
      {
        id: "total-ingredients",
        label: "Tổng nguyên liệu",
        value: ingredients.length,
        helper: "đang theo dõi trong nhà hàng",
        icon: <Carrot size={18} />,
        tone: "neutral",
      },
      {
        id: "low-stock",
        label: "Sắp hết",
        value: lowStockItems.length,
        helper: "dưới hoặc bằng ngưỡng cảnh báo",
        icon: <AlertCircle size={18} />,
        tone: lowStockItems.length ? "warning" : "good",
      },
      {
        id: "out-stock",
        label: "Hết hàng",
        value: outStockItems.length,
        helper: "cần kiểm kho hoặc nhập bổ sung",
        icon: <Boxes size={18} />,
        tone: outStockItems.length ? "danger" : "good",
      },
      {
        id: "warehouses",
        label: "Kho đang có",
        value: warehouses.length,
        helper: warehouses.length ? "kho khả dụng" : "chưa khởi tạo kho",
        icon: <WarehouseIcon size={18} />,
        tone: "neutral",
      },
    ];
  }, [ingredients.length, lowStockItems, warehouses.length]);

  const activeStorageActions = useMemo(() => {
    if (activeTab === "ingredients") return ingredientActions;
    if (activeTab === "supplies") return supplyActions;
    if (activeTab === "recipes") return recipeActions;
    return null;
  }, [activeTab, ingredientActions, recipeActions, supplyActions]);

  const tabs = [
    {
      id: "ingredients",
      label: "Nguyên liệu",
      icon: <Carrot size={18} />,
      component: (
        <IngredientList
          restaurantId={currentRestaurant}
          selectedWarehouseId={warehouseFilterId}
          activeCurrency={activeCurrency}
          usdToVndRate={usdToVndRate}
          onRegisterActions={setIngredientActions}
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
          onRegisterActions={setSupplyActions}
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
          activeCurrency={activeCurrency}
          usdToVndRate={usdToVndRate}
          recipes={recipes}
          loading={recipesLoading}
          error={recipesError}
          pageInfo={recipesPageInfo}
          total={recipesTotal}
          onTimeSlotChange={setRecipeTimeSlot}
          onSearchChange={setRecipeSearch}
          onCategoryChange={setRecipeCategoryId}
          categoryOptions={recipeCategoryOptions}
          loadMore={loadMoreRecipes}
          onAddRecipe={addRecipeHandler}
          onUpdateRecipe={updateRecipeHandler}
          onDeleteRecipe={deleteRecipeHandler}
          onRegisterActions={setRecipeActions}
          ingredients={ingredients}
        />
      ),
    },
    {
      id: "inventory",
      label: "Kiểm kê",
      icon: <ClipboardList size={18} />,
      component: (
        <InventoryAuditTab
          ingredients={ingredients}
          stockItems={stockItems}
          movements={movements}
          warehouses={warehouses}
          loading={stockLoading || movementLoading}
          error={stockError || movementError}
        />
      ),
    },
  ];

  if (restaurantsLoading) {
    return (
      <div className="storage-management">
        <div className="sm-loading-state">
          <div className="spinner"></div>
          <p>Đang tải dữ liệu nhà hàng...</p>
        </div>
      </div>
    );
  }

  if (!hasRestaurants) {
    return (
      <div className="storage-management">
        <div className="sm-error-state">
          <WarehouseIcon size={40} />
          <h3>Chưa có nhà hàng để quản lý kho</h3>
          <p>Vui lòng kiểm tra danh sách nhà hàng được gán cho tài khoản.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="storage-management">
      <div className="sm-container">
        <section className="sm-header-section">
          <Header
            restaurantList={restaurantOptions}
            currentRestaurantId={selectedRestaurantId}
            onRestaurantChange={(id) => {
              setSelectedRestaurantId(id);
              setSelectedWarehouseId(undefined);
              setRecipeTimeSlot(null);
              setRecipeSearch(null);
              setRecipeCategoryId(null);
            }}
            warehouses={warehouses}
            selectedWarehouseId={warehouseFilterId}
            onWarehouseChange={setSelectedWarehouseId}
            restaurantsLoading={restaurantsLoading}
            warehousesLoading={whLoading}
            activeCurrency={activeCurrency}
            onCurrencyChange={async (currency) => {
              setActiveCurrency(currency);
              await persistCurrencySettings({ defaultCurrency: currency });
            }}
            manualRate={manualUsdToVndRate}
            onManualRateSave={async (rate) => {
              if (!(Number(rate) > 0)) {
                showNotification("Tỷ giá phải lớn hơn 0.", "warning");
                return;
              }
              await persistCurrencySettings({
                defaultCurrency: activeCurrency,
                manualUsdToVndRate: Number(rate),
              });
              showNotification("Đã lưu tỷ giá thủ công.", "success");
            }}
            currencyLoading={currencyLoading}
            activeTab={activeTab}
            storageActions={activeStorageActions}
          />
        </section>

        <section className="sm-kpi-section" aria-label="Chỉ số vận hành kho">
          {storageKpis.map((item) => (
            <article className={`sm-kpi-card sm-kpi-card--${item.tone}`} key={item.id}>
              <div className="sm-kpi-card__icon">{item.icon}</div>
              <div>
                <p className="sm-kpi-card__label">{item.label}</p>
                <strong className="sm-kpi-card__value">
                  {Number(item.value || 0).toLocaleString("vi-VN")}
                </strong>
                <span className="sm-kpi-card__helper">{item.helper}</span>
              </div>
            </article>
          ))}
        </section>

        <section className="sm-main-content" aria-label="Nội dung quản lý kho">
          {needsWarehouseSetup ? (
            <div className="sm-warehouse-setup" aria-labelledby="warehouse-setup-title">
              <div className="sm-warehouse-setup__icon" aria-hidden="true">
                <WarehouseIcon size={30} />
              </div>
              <p className="sm-warehouse-setup__eyebrow">Khởi tạo vận hành kho</p>
              <h2 id="warehouse-setup-title">Nhà hàng chưa có kho</h2>
              <p className="sm-warehouse-setup__description">
                Tạo kho đầu tiên để nhập nguyên liệu, vật tư, theo dõi tồn và thực hiện kiểm kê cho nhà hàng này.
              </p>
              {canWriteInventory ? (
                <button
                  type="button"
                  className="sm-btn primary sm-warehouse-setup__action"
                  onClick={handleCreateFirstWarehouse}
                  disabled={creatingWarehouse}
                >
                  <WarehouseIcon size={17} />
                  {creatingWarehouse ? "Đang tạo kho..." : "Tạo Kho chính"}
                </button>
              ) : (
                <p className="sm-warehouse-setup__permission">
                  Tài khoản cần quyền quản lý kho để thực hiện bước khởi tạo này.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="sm-toolbar-wrapper">
                <div className="toolbar-left">
                  <Tabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={(t) => {
                      setActiveTab(t);
                      if (["inventory", "ingredients"].includes(t)) {
                        refetchStock?.();
                        if (t === "inventory") refetchMovements?.();
                      }
                      if (t === "recipes") refreshRecipes?.();
                    }}
                  />
                </div>

                <div className="toolbar-right">
                  <WarehouseStatus
                    lowStockItems={lowStockItems}
                    onCreatePO={() => {
                      if (!warehouseFilterId) {
                        showNotification("Vui lòng chọn kho cụ thể trước khi nhập kho.", "warning");
                        return;
                      }
                      setPoEntries(lowStockItems.map((it) => ({
                        id: it.id,
                        type: "ingredient",
                        name: it.name,
                        unit: it.unit,
                      })));
                      setPoOpen(true);
                    }}
                  />
                </div>
              </div>

              <div className="sm-tab-content-wrapper">
                {tabs.find((tab) => tab.id === activeTab)?.component}
              </div>
            </>
          )}

          {whError && (
            <div className="sm-error-toast">
              <AlertCircle size={16} /> Lỗi tải kho: {whError.message}
            </div>
          )}
        </section>
      </div>

      <QuickStockModal
        isOpen={poOpen}
        onClose={() => setPoOpen(false)}
        entries={poEntries}
        onSubmit={async (rows) => {
          if (!warehouseFilterId) throw new Error("Vui lòng chọn kho cụ thể để nhập kho.");
          if (!rows?.length) throw new Error("Danh sách nhập kho đang trống.");

          const results = await Promise.allSettled(rows.map((row) => adjustStockMu({
            variables: {
              restaurantId: currentRestaurant,
              warehouseId: warehouseFilterId,
              ingredientId: row.id,
              qty: row.qty,
              reason: buildReason(row),
            },
          })));

          const failed = results.filter((item) => item.status === "rejected");
          const successCount = results.length - failed.length;
          if (successCount === 0) {
            const firstError = failed[0]?.reason;
            throw new Error(getInventoryActionErrorMessage(firstError, `Nhập kho thất bại cho ${rows.length} nguyên liệu.`));
          }

          await reloadIngredientsAndStock();
          if (failed.length === 0) {
            setPoOpen(false);
            showNotification(`Nhập kho thành công ${rows.length} nguyên liệu.`, "success");
            return;
          }

          showNotification(`⚠️ Nhập kho thành công ${successCount}/${rows.length} nguyên liệu. Vui lòng kiểm tra các dòng lỗi.`, "warning");
        }}
      />
    </div>
  );
};

export default StorageManagement;

function buildReason(row) {
  const parts = [];
  if (row.supplier) parts.push(`Nguồn: ${row.supplier}`);
  if (row.datetime) parts.push(`Thời gian: ${row.datetime}`);
  if (row.note) parts.push(`Ghi chú: ${row.note}`);
  return parts.join(" | ") || "Nhập kho nhanh";
}
