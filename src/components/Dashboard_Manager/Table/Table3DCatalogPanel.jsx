import React from "react";
import { AlertTriangle, ChevronDown, Info, Loader2, Search } from "lucide-react";
import Button from "@/components/common/Button";
import {
  TABLE_3D_PLACEHOLDER_THUMB,
  TABLE_3D_TYPE_OPTIONS,
  formatDimensionsCm,
  getModelAssetBadges,
} from "@/config/table3dCatalog";
import { isCustomTableModel } from "@/config/table3dCustomModelStorage";

const ALL_TABLE_TYPES = "all";

export default function Table3DCatalogPanel({
  tableType,
  onTableTypeChange,
  catalogSearch,
  onCatalogSearchChange,
  assetFilter,
  onAssetFilterChange,
  filteredModels,
  selectedModel,
  onSelectModel,
  onModelKeyDown,
  onThumbnailError,
  loading,
  error,
  onReload,
  onCreateCustomModel,
  pendingDeleteModelKey,
  onDeleteCustomModel,
  isSelectedModelHiddenByFilters,
  selectedModelAssetSummary,
}) {
  return (
    <aside className="table-3d-modal__sidebar">
      <div className="table-3d-catalog-heading">
        <div>
          <span>Thư viện mẫu</span>
          <strong>{filteredModels.length} mẫu</strong>
        </div>
        <Button variant="secondary" size="sm" onClick={onCreateCustomModel}>
          Tạo mẫu
        </Button>
      </div>

      <label htmlFor="table-3d-type">Phạm vi mẫu bàn</label>
      <select
        id="table-3d-type"
        value={tableType}
        onChange={(event) => onTableTypeChange(event.target.value)}
      >
        <option value={ALL_TABLE_TYPES}>Tất cả mẫu bàn</option>
        {TABLE_3D_TYPE_OPTIONS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>

      <div className="table-3d-modal__filters" aria-label="Bộ lọc catalog 3D">
        <label className="table-3d-search-field">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={catalogSearch}
            onChange={(event) => onCatalogSearchChange(event.target.value)}
            placeholder="Tìm tên hoặc tag"
            aria-label="Tìm mẫu bàn 3D"
          />
        </label>
        <select
          value={assetFilter}
          onChange={(event) => onAssetFilterChange(event.target.value)}
          aria-label="Lọc theo trạng thái model 3D"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="model">Có model 3D</option>
          <option value="placeholder">Chỉ mô phỏng</option>
        </select>
      </div>

      <div className="table-3d-modal__models">
        {loading && !filteredModels.length ? (
          <div className="table-3d-catalog-loading" role="status">
            <Loader2 size={18} className="spin" />
            <span>Đang tải thư viện mẫu...</span>
          </div>
        ) : null}

        {filteredModels.map((model) => {
          const dimensionsLabel = formatDimensionsCm(model.dimensionsCm);
          const isDeletePending = pendingDeleteModelKey === model.key;

          return (
            <div
              key={model.key}
              className={`model-item ${selectedModel?.key === model.key ? "active" : ""}`}
              role="button"
              tabIndex={0}
              aria-pressed={selectedModel?.key === model.key}
              onClick={() => onSelectModel(model.key)}
              onKeyDown={(event) => onModelKeyDown(event, model)}
            >
              <img
                src={model.thumbnailUrl || TABLE_3D_PLACEHOLDER_THUMB}
                alt={`Ảnh xem trước ${model.label}`}
                loading="lazy"
                onError={onThumbnailError}
              />
              <div>
                <strong>{model.label}</strong>
                <span>{model.capacity} ghế</span>
                <div className="model-item__badges">
                  {getModelAssetBadges(model).map((badge) => (
                    <span key={`${model.key}-${badge}`} className="model-badge">
                      {badge}
                    </span>
                  ))}
                </div>
                {dimensionsLabel && <span>{dimensionsLabel}</span>}
              </div>
              {isCustomTableModel(model) && (
                <Button
                  size="sm"
                  variant={isDeletePending ? "danger" : "secondary"}
                  type="button"
                  onClick={(event) => onDeleteCustomModel(event, model)}
                  title={isDeletePending ? "Nhấn lại để xác nhận xóa" : "Xóa mẫu tùy chỉnh"}
                >
                  {isDeletePending ? "Xác nhận" : "Xóa"}
                </Button>
              )}
            </div>
          );
        })}

        {!loading && !filteredModels.length && (
          <div className="model-empty">
            <Search size={20} aria-hidden="true" />
            <strong>Không tìm thấy mẫu phù hợp</strong>
            <span>Đổi từ khóa hoặc trạng thái model để xem thêm mẫu.</span>
          </div>
        )}
      </div>

      {isSelectedModelHiddenByFilters && (
        <p className="table-3d-modal__filter-note">
          Mẫu đang xem không nằm trong bộ lọc hiện tại.
        </p>
      )}

      <details className="table-3d-tech-details">
        <summary>
          <Info size={15} aria-hidden="true" />
          Thông tin kỹ thuật
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <div className="table-3d-modal__meta">
          <p><b>Model 3D:</b> {selectedModelAssetSummary.has3DModel ? "Có" : "Chưa có"}</p>
          <p><b>AR native:</b> {selectedModelAssetSummary.arReady ? "Có thể thử" : "Chưa khả dụng"}</p>
          <p>
            <b>Nguồn:</b>{" "}
            {selectedModelAssetSummary.sourceUrl?.startsWith("http") ? (
              <a href={selectedModelAssetSummary.sourceUrl} target="_blank" rel="noreferrer">
                {selectedModelAssetSummary.source}
              </a>
            ) : selectedModelAssetSummary.source}
          </p>
          <p><b>Giấy phép:</b> {selectedModelAssetSummary.license}</p>
          {selectedModelAssetSummary.dimensions && (
            <p><b>Kích thước:</b> {selectedModelAssetSummary.dimensions}</p>
          )}
          <p><b>Mã model:</b> {selectedModelAssetSummary.modelKey}</p>
          <Button variant="secondary" size="sm" onClick={onReload}>
            Tải lại thư viện online
          </Button>
        </div>
      </details>

      {error && (
        <div className="table-3d-modal__warning" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}
    </aside>
  );
}
