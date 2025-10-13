import React from "react";
import Card from "../../../../common/Card";
import Button from "../../../../common/Button";
import { useIngredients } from "../../../../../hooks/useIngredients";
import { useSupplies } from "../../../../../hooks/useSupplies";
import "./alerts.scss";

const AlertSystem = () => {
  const {
    ingredients,
    addStock: addIngredientStock,
    getStockStatus: getIngredientStatus,
  } = useIngredients();
  const {
    supplies,
    addStock: addSupplyStock,
    getStockStatus: getSupplyStatus,
  } = useSupplies();

  // Get out of stock items
  const outOfStockIngredients = ingredients.filter(
    (item) => item.currentStock === 0
  );
  const outOfStockSupplies = supplies.filter((item) => item.currentStock === 0);
  const outOfStockItems = [...outOfStockIngredients, ...outOfStockSupplies];

  // Get low stock items
  const lowStockIngredients = ingredients.filter(
    (item) => item.currentStock > 0 && item.currentStock <= item.minStock
  );
  const lowStockSupplies = supplies.filter(
    (item) => item.currentStock > 0 && item.currentStock <= item.minStock
  );
  const lowStockItems = [...lowStockIngredients, ...lowStockSupplies];

  const handleQuickRestock = (id, type) => {
    const item =
      type === "ingredient"
        ? ingredients.find((i) => i.id === id)
        : supplies.find((s) => s.id === id);

    if (!item) return;

    const amount = prompt(
      `Nhập số lượng ${item.unit} muốn thêm vào kho cho ${item.name}:`
    );
    if (amount && !isNaN(amount) && parseFloat(amount) > 0) {
      if (type === "ingredient") {
        addIngredientStock(id, parseFloat(amount));
      } else {
        addSupplyStock(id, parseFloat(amount));
      }
    }
  };

  if (outOfStockItems.length === 0 && lowStockItems.length === 0) {
    return (
      <Card className="alert-card alert-success">
        <div className="alert-header">
          <div className="alert-title">
            🎉 Tất cả nguyên liệu đều đủ số lượng!
          </div>
        </div>
        <p className="alert-message">
          Không có nguyên liệu nào cần chú ý. Kho hàng đang ở trạng thái tốt.
        </p>
      </Card>
    );
  }

  return (
    <div className="alert-system">
      {/* Out of Stock Alert */}
      {outOfStockItems.length > 0 && (
        <Card className="alert-card alert-danger">
          <div className="alert-header">
            <div className="alert-title">
              ❌ Hết hàng ({outOfStockItems.length} mặt hàng)
            </div>
          </div>
          <div className="alert-items">
            {outOfStockItems.map((item) => (
              <div
                key={`${ingredients.includes(item) ? "ingredient" : "supply"}-${
                  item.id
                }`}
                className="alert-item"
              >
                <div className="alert-item-info">
                  <div className="alert-item-name">{item.name}</div>
                  <div className="alert-item-details">
                    Tồn kho: 0 {item.unit} | Tối thiểu: {item.minStock}{" "}
                    {item.unit}
                  </div>
                </div>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() =>
                    handleQuickRestock(
                      item.id,
                      ingredients.includes(item) ? "ingredient" : "supply"
                    )
                  }
                >
                  📦 Nhập kho
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="alert-card alert-warning">
          <div className="alert-header">
            <div className="alert-title">
              ⚠️ Sắp hết hàng ({lowStockItems.length} mặt hàng)
            </div>
          </div>
          <div className="alert-items">
            {lowStockItems.map((item) => (
              <div
                key={`${ingredients.includes(item) ? "ingredient" : "supply"}-${
                  item.id
                }`}
                className="alert-item"
              >
                <div className="alert-item-info">
                  <div className="alert-item-name">{item.name}</div>
                  <div className="alert-item-details">
                    Tồn kho: {item.currentStock} {item.unit} | Tối thiểu:{" "}
                    {item.minStock} {item.unit}
                  </div>
                </div>
                <Button
                  variant="success"
                  size="sm"
                  onClick={() =>
                    handleQuickRestock(
                      item.id,
                      ingredients.includes(item) ? "ingredient" : "supply"
                    )
                  }
                >
                  📦 Nhập kho
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AlertSystem;
