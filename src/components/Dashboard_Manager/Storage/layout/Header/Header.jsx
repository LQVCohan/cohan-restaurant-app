// src/components/Dashboard_Manager/Storage/layout/Header/Header.jsx
import React, { useContext } from "react";
import {
  Package,
  Upload,
  Download,
  FileText,
  FileSpreadsheet,
  Store,
  Warehouse,
  ChevronDown,
  Loader2,
  Coins,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import {
  hasAnyPermission,
  NO_PERMISSION_MESSAGE,
} from "@/utils/frontendPermissionAccess";
import "./Header.scss";

/**
 * Props:
 * - restaurantList: [{id, name, ...}]
 * - currentRestaurantId: string
 * - onRestaurantChange: fn(id)
 * - restaurantsLoading: boolean
 * - warehouses: [{id, name}]
 * - selectedWarehouseId: string|null
 * - onWarehouseChange: fn(id|null)
 * - warehousesLoading: boolean
 */
const Header = ({
  restaurantList = [],
  currentRestaurantId = "",
  onRestaurantChange,
  restaurantsLoading = false,
  warehouses = [],
  selectedWarehouseId = null,
  onWarehouseChange,
  warehousesLoading = false,
  activeCurrency = "VND",
  onCurrencyChange,
  manualRate = 26000,
  onManualRateSave,
  currencyLoading = false,
  activeTab = "ingredients",
  ingredientActions = null,
}) => {
  const { user } = useContext(AuthContext);
  const canWriteInventory = hasAnyPermission(user, ["inventory.write", "stock.write"]);
  const disabledWriteTitle = canWriteInventory ? undefined : NO_PERMISSION_MESSAGE;
  const [rateInput, setRateInput] = React.useState(String(manualRate || 26000));

  React.useEffect(() => {
    setRateInput(String(manualRate || 26000));
  }, [manualRate, currentRestaurantId]);

  const isIngredientTab = activeTab === "ingredients";
  const actionDisabled = Boolean(ingredientActions?.busy);
  const activeTabCopy = getActiveTabCopy(activeTab);

  const handleImportData = () => {
    if (!canWriteInventory) return;
    ingredientActions?.import?.();
  };
  const handleExportData = (format = "xlsx") => {
    if (!ingredientActions) return;
    if (format === "csv") ingredientActions.exportCsv?.();
    else ingredientActions.exportXlsx?.();
  };
  const handleGenerateReport = () => ingredientActions?.report?.();
  const handleExportSample = () => ingredientActions?.template?.();

  const changeRestaurant = (e) => {
    const id = e.target.value || "";
    onRestaurantChange?.(id);
    onWarehouseChange?.(null);
  };

  const changeWarehouse = (e) => {
    const id = e.target.value || null;
    onWarehouseChange?.(id);
  };

  const isRestaurantDisabled = restaurantsLoading || !restaurantList.length;
  const isWarehouseDisabled =
    warehousesLoading || !currentRestaurantId || !warehouses.length;

  return (
    <div className="sm-header-card">
      <div className="sm-header-top">
        <div className="title-wrapper">
          <div className="icon-box" aria-hidden="true">
            <Package size={22} />
          </div>
          <div>
            <p className="page-eyebrow">Vận hành kho</p>
            <h1 className="page-title">Quản lý kho</h1>
            <p className="page-subtitle">
              Chọn phạm vi dữ liệu, xử lý nhập/xuất và theo dõi tồn kho trong một màn hình.
            </p>
          </div>
        </div>

        {isIngredientTab ? (
          <div className="actions-wrapper" aria-label="Thao tác dữ liệu nguyên liệu">
            <button
              type="button"
              className="sm-btn ghost"
              onClick={handleExportSample}
              title="Tải file mẫu Excel để nhập nguyên liệu"
              disabled={actionDisabled}
              aria-busy={ingredientActions?.busy ? "true" : "false"}
            >
              <FileSpreadsheet size={17} />
              <span className="hide-on-mobile">Mẫu nhập</span>
            </button>

            <div className="divider-vertical" aria-hidden="true" />

            <button
              type="button"
              className="sm-btn secondary"
              onClick={handleImportData}
              disabled={actionDisabled || !canWriteInventory}
              title={disabledWriteTitle || "Nhập dữ liệu từ Excel hoặc CSV"}
            >
              <Upload size={17} /> <span className="hide-on-mobile">Nhập file</span>
            </button>

            <div className="sm-action-group" role="group" aria-label="Xuất danh sách nguyên liệu">
              <button
                type="button"
                className="sm-btn secondary"
                onClick={() => handleExportData("xlsx")}
                disabled={actionDisabled}
                title="Xuất danh sách nguyên liệu dạng XLSX"
              >
                <Download size={17} /> <span>XLSX</span>
              </button>
              <button
                type="button"
                className="sm-btn secondary compact"
                onClick={() => handleExportData("csv")}
                disabled={actionDisabled}
                title="Xuất danh sách nguyên liệu dạng CSV"
              >
                CSV
              </button>
            </div>

            <button
              type="button"
              className="sm-btn primary"
              onClick={handleGenerateReport}
              disabled={actionDisabled}
              title="Lập báo cáo nguyên liệu theo khoảng thời gian"
            >
              <FileText size={17} /> <span>Báo cáo</span>
            </button>
          </div>
        ) : (
          <div className="sm-context-note" aria-live="polite">
            <span>{activeTabCopy.label}</span>
            <strong>{activeTabCopy.helper}</strong>
          </div>
        )}
      </div>

      {!canWriteInventory ? (
        <div className="sm-permission-note" title={NO_PERMISSION_MESSAGE}>
          {NO_PERMISSION_MESSAGE}
        </div>
      ) : null}

      <div className="sm-header-filters" aria-label="Bộ lọc phạm vi dữ liệu kho">
        <div className="filter-group">
          <label htmlFor="restaurant-select">
            <Store size={15} /> Nhà hàng
            {restaurantsLoading && <Loader2 size={14} className="spin" />}
          </label>
          <div className="custom-select-wrapper">
            <select
              id="restaurant-select"
              value={currentRestaurantId || ""}
              onChange={changeRestaurant}
              disabled={isRestaurantDisabled}
              title="Quyết định toàn bộ dữ liệu hiển thị bên dưới"
            >
              <option value="">
                {restaurantsLoading ? "Đang tải..." : "— Chọn nhà hàng —"}
              </option>
              {restaurantList.map((res) => (
                <option key={res.id} value={res.id}>
                  {res.name}
                </option>
              ))}
            </select>
            <ChevronDown className="arrow-icon" size={16} />
          </div>
        </div>

        <div className="filter-group">
          <label htmlFor="warehouse-select">
            <Warehouse size={15} /> Kho hàng
            {warehousesLoading && <Loader2 size={14} className="spin" />}
          </label>
          <div className="custom-select-wrapper">
            <select
              id="warehouse-select"
              value={selectedWarehouseId || ""}
              onChange={changeWarehouse}
              disabled={isWarehouseDisabled}
              title="Chọn kho cụ thể trước khi nhập tồn kho"
            >
              <option value="">
                {!currentRestaurantId
                  ? "Chọn nhà hàng trước"
                  : warehousesLoading
                  ? "Đang tải..."
                  : "— Tất cả kho —"}
              </option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <ChevronDown className="arrow-icon" size={16} />
          </div>
        </div>

        <div className="filter-group filter-group--compact">
          <label htmlFor="currency-select">
            <Coins size={15} /> Tiền tệ
            {currencyLoading && <Loader2 size={14} className="spin" />}
          </label>
          <div className="custom-select-wrapper">
            <select
              id="currency-select"
              value={activeCurrency}
              onChange={(e) => onCurrencyChange?.(e.target.value)}
              disabled={!currentRestaurantId || currencyLoading}
              title="Áp dụng cho giá vốn và báo cáo"
            >
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </select>
            <ChevronDown className="arrow-icon" size={16} />
          </div>
        </div>

        <div className="filter-group filter-group--rate">
          <label htmlFor="manual-rate-input">Tỷ giá USD→VND</label>
          <div className="inline-rate">
            <input
              id="manual-rate-input"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              disabled={!currentRestaurantId || currencyLoading}
              title="Chỉ lưu khi cần ghi đè tỷ giá mặc định"
            />
            <button
              className="sm-btn secondary"
              type="button"
              onClick={() => onManualRateSave?.(Number(rateInput))}
              disabled={!currentRestaurantId || currencyLoading}
            >
              Lưu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function getActiveTabCopy(activeTab) {
  switch (activeTab) {
    case "supplies":
      return {
        label: "Đang xem vật tư",
        helper: "Thao tác thêm, nhập, xuất vật tư nằm trong khung bên dưới.",
      };
    case "recipes":
      return {
        label: "Đang xem công thức",
        helper: "Bộ lọc nhà hàng và tiền tệ vẫn áp dụng cho giá vốn món ăn.",
      };
    case "inventory":
      return {
        label: "Đang kiểm kê",
        helper: "Bảng bên dưới ưu tiên số tồn, định mức và lịch sử biến động.",
      };
    default:
      return {
        label: "Đang xem kho",
        helper: "Chọn nhà hàng và kho để giới hạn dữ liệu hiển thị.",
      };
  }
}

export default Header;
