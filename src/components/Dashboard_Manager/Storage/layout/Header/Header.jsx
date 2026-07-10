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
  Settings2,
  ChevronDown,
  Loader2,
  Coins,
  Info,
  PackageOpen,
  BookOpen,
  ClipboardList,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import {
  hasAnyPermission,
  NO_PERMISSION_MESSAGE,
} from "@/utils/frontendPermissionAccess";
import WarehouseManagementDialog from "../../components/warehouses/WarehouseManagementDialog";
import "./Header.scss";

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
  storageActions = null,
}) => {
  const { user } = useContext(AuthContext);
  const canWriteInventory = hasAnyPermission(user, ["inventory.write", "stock.write"]);
  const disabledWriteTitle = canWriteInventory ? undefined : NO_PERMISSION_MESSAGE;
  const [rateInput, setRateInput] = React.useState(String(manualRate || 26000));
  const [warehouseManagerOpen, setWarehouseManagerOpen] = React.useState(false);

  React.useEffect(() => {
    setRateInput(String(manualRate || 26000));
  }, [manualRate, currentRestaurantId]);

  React.useEffect(() => {
    setWarehouseManagerOpen(false);
  }, [currentRestaurantId]);

  const activeTabCopy = getActiveTabCopy(activeTab);
  const ActiveTabIcon = activeTabCopy.Icon;
  const activeActions = storageActions;
  const actionDisabled = Boolean(activeActions?.busy);

  const handleImportData = () => {
    if (!canWriteInventory) return;
    activeActions?.import?.();
  };
  const handleExportData = (format = "xlsx") => {
    if (!activeActions) return;
    if (format === "csv") activeActions.exportCsv?.();
    else activeActions.exportXlsx?.();
  };
  const handleGenerateReport = () => activeActions?.report?.();
  const handleExportSample = () => activeActions?.template?.();

  const changeRestaurant = (event) => {
    onRestaurantChange?.(event.target.value || "");
  };

  const changeWarehouse = (event) => {
    onWarehouseChange?.(event.target.value || null);
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
              Theo dõi tồn, nhập xuất, kiểm kê và chuyển hàng giữa các kho trong cùng nhà hàng.
            </p>
          </div>
        </div>

        {activeActions ? (
          <div className="actions-wrapper" aria-label={`Thao tác dữ liệu ${activeTabCopy.label}`}>
            <button
              type="button"
              className="sm-btn ghost"
              onClick={handleExportSample}
              title={`Tải file mẫu ${activeTabCopy.label}`}
              disabled={actionDisabled || !activeActions.template}
              aria-busy={activeActions?.busy ? "true" : "false"}
            >
              <FileSpreadsheet size={17} />
              <span className="hide-on-mobile">Mẫu nhập</span>
            </button>

            <div className="divider-vertical" aria-hidden="true" />

            <button
              type="button"
              className="sm-btn secondary"
              onClick={handleImportData}
              disabled={actionDisabled || !canWriteInventory || !activeActions.import}
              title={disabledWriteTitle || `Nhập ${activeTabCopy.label} từ file Excel hoặc CSV`}
            >
              <Upload size={17} /> <span className="hide-on-mobile">Nhập file</span>
            </button>

            <div className="sm-action-group" role="group" aria-label={`Xuất danh sách ${activeTabCopy.label}`}>
              <button
                type="button"
                className="sm-btn secondary"
                onClick={() => handleExportData("xlsx")}
                disabled={actionDisabled || !activeActions.exportXlsx}
                title={`Xuất ${activeTabCopy.label} ra file Excel`}
              >
                <Download size={17} /> <span>Excel</span>
              </button>
              <button
                type="button"
                className="sm-btn secondary compact"
                onClick={() => handleExportData("csv")}
                disabled={actionDisabled || !activeActions.exportCsv}
                title={`Xuất ${activeTabCopy.label} ra file CSV`}
              >
                CSV
              </button>
            </div>

            <button
              type="button"
              className="sm-btn primary"
              onClick={handleGenerateReport}
              disabled={actionDisabled || !activeActions.report}
              title={`Lập báo cáo ${activeTabCopy.label}`}
            >
              <FileText size={17} /> <span>Báo cáo</span>
            </button>
          </div>
        ) : (
          <div className="sm-workspace-strip" aria-live="polite">
            <span className="sm-workspace-strip__icon" aria-hidden="true">
              <ActiveTabIcon size={15} />
            </span>
            <span className="sm-workspace-strip__copy">
              <strong>{activeTabCopy.label}</strong>
              <span>{activeTabCopy.helper}</span>
            </span>
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
              {restaurantList.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
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
          <div className="warehouse-filter-row">
            <div className="custom-select-wrapper">
              <select
                id="warehouse-select"
                value={selectedWarehouseId || ""}
                onChange={changeWarehouse}
                disabled={isWarehouseDisabled}
                title="Chọn kho áp dụng cho tồn, nhập xuất và kiểm kê"
              >
                <option value="">
                  {!currentRestaurantId
                    ? "Chọn nhà hàng trước"
                    : warehousesLoading
                      ? "Đang tải..."
                      : warehouses.length
                        ? "— Chọn kho —"
                        : "Chưa có kho"}
                </option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}{warehouse.code ? ` · ${warehouse.code}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="arrow-icon" size={16} />
            </div>
            <button
              type="button"
              className="sm-btn secondary warehouse-filter-row__manage"
              onClick={() => setWarehouseManagerOpen(true)}
              disabled={!currentRestaurantId || warehousesLoading}
              aria-label={`Quản lý ${warehouses.length} kho hiện tại`}
            >
              <Settings2 size={17} /> Quản lý ({warehouses.length})
            </button>
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
              onChange={(event) => onCurrencyChange?.(event.target.value)}
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
              onChange={(event) => setRateInput(event.target.value)}
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

      <WarehouseManagementDialog
        open={warehouseManagerOpen}
        onClose={() => setWarehouseManagerOpen(false)}
        restaurantId={currentRestaurantId}
        warehouses={warehouses}
        selectedWarehouseId={selectedWarehouseId}
        onSelectWarehouse={onWarehouseChange}
      />
    </div>
  );
};

function getActiveTabCopy(activeTab) {
  switch (activeTab) {
    case "ingredients":
      return { label: "Nguyên liệu", helper: "Nhập file, xuất file và lập báo cáo nguyên liệu.", Icon: Package };
    case "supplies":
      return { label: "Vật tư", helper: "Nhập file, xuất file và lập báo cáo vật tư.", Icon: PackageOpen };
    case "recipes":
      return { label: "Công thức", helper: "Nhập file, xuất file và lập báo cáo công thức.", Icon: BookOpen };
    case "inventory":
      return { label: "Kiểm kê", helper: "Ưu tiên tồn kho, định mức và biến động.", Icon: ClipboardList };
    default:
      return { label: "Kho hàng", helper: "Chọn kho để giới hạn dữ liệu vận hành.", Icon: Info };
  }
}

export default Header;
