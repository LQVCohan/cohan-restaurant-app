import React from "react";
import { AlertTriangle, ChevronDown, Info, Loader2, Search } from "lucide-react";
import Button from "@/components/common/Button";
import {
  TABLE_3D_PLACEHOLDER_THUMB,
  TABLE_3D_TYPE_OPTIONS,
  getModelAssetBadges,
} from "@/config/table3dCatalog";
import { isCustomTableModel } from "@/config/table3dCustomModelStorage";

const ALL_TABLE_TYPES = "all";
const TABLE_TYPE_LABELS = {
  "round-table": "Bàn tròn",
  "rect-2-seat": "Bàn chữ nhật 2 chỗ",
  "rect-4-seat": "Bàn chữ nhật 4 chỗ",
  "vip-table": "Bàn VIP",
  "booth-sofa": "Bàn booth / sofa",
  "bar-table": "Bàn bar",
  "outdoor-table": "Bàn ngoài trời",
};
const MODEL_BADGE_LABELS = {
  Custom: "Tùy chỉnh",
  Upload: "Tải lên",
  Online: "Trực tuyến",
  Placeholder: "Bản minh họa",
};
const BADGE_PRIORITY = ["3D", "AR", "Custom", "Online", "Upload", "Placeholder"];

const getCompactBadges = (model) => {
  const badges = getModelAssetBadges(model);
  return badges
    .filter((badge) => BADGE_PRIORITY.includes(badge))
    .sort((left, right) => BADGE_PRIORITY.indexOf(left) - BADGE_PRIORITY.indexOf(right))
    .slice(0, 2);
};

const getFriendlyCatalogError = (error) => {
  const message = typeof error === "string" ? error : error?.message || "";
  if (/catalog|online|network|fetch/i.test(message)) {
    return "Không tải được thư viện trực tuyến. Hệ thống đang dùng dữ liệu dự phòng.";
  }
  return message || "Không tải được thư viện mẫu bàn.";
};

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
          <span>Thư viện mẫu bàn</span>
          <strong>{filteredModels.length} mẫu phù hợp</strong>
        </div>
        <Button variant="secondary" size="sm" onClick={onCreateCustomModel}>
          Tạo mẫu mới
        </Button>
      </div>

      <label htmlFor="table-3d-type">Loại bàn</label>
      <select
        id="table-3d-type"
        value={tableType}
        onChange={(event) => onTableTypeChange(event.target.value)}
      >
        <option value={ALL_TABLE_TYPES}>Tất cả loại bàn</option>
        {TABLE_3D_TYPE_OPTIONS.map((item) => (
          <option key={item.value} value={item.value}>
            {TABLE_TYPE_LABELS[item.value] || item.label}
          </option>
        ))}
      </select>

      <div className="table-3d-modal__filters" aria-label="Bộ lọc mẫu bàn 3D">
        <label className="table-3d-search-field">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={catalogSearch}
            onChange={(event) => onCatalogSearchChange(event.target.value)}
            placeholder="Tìm theo tên hoặc từ khóa"
            aria-label="Tìm mẫu bàn 3D"
          />
        </label>
        <select
          value={assetFilter}
          onChange={(event) => onAssetFilterChange(event.target.value)}
          aria-label="Lọc theo dữ liệu mô hình 3D"
        >
          <option value="all">Tất cả mẫu</option>
          <option value="model">Có mô hình 3D</option>
          <option value="placeholder">Chưa có mô hình 3D</option>
        </select>
      </div>

      <div className="table-3d-modal__models">
        {loading && !filteredModels.length ? (
          <div className="table-3d-catalog-loading" role="status">
            <Loader2 size={18} className="spin" />
            <span>Đang tải thư viện mẫu bàn...</span>
          </div>
        ) : null}

        {filteredModels.map((model) => {
          const compactBadges = getCompactBadges(model);
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
                alt={`Ảnh xem trước của ${model.label}`}
                loading="lazy"
                onError={onThumbnailError}
              />
              <div className="model-item__content">
                <strong>{model.label}</strong>
                <span>Sức chứa: {model.capacity} ghế</span>
                <div className="model-item__badges">
                  {compactBadges.map((badge) => (
                    <span key={`${model.key}-${badge}`} className="model-badge">
                      {MODEL_BADGE_LABELS[badge] || badge}
                    </span>
                  ))}
                </div>
              </div>
              {isCustomTableModel(model) && (
                <Button
                  size="sm"
                  variant={isDeletePending ? "danger" : "secondary"}
                  type="button"
                  onClick={(event) => onDeleteCustomModel(event, model)}
                  title={
                    isDeletePending
                      ? "Bấm lần nữa để xóa mẫu này"
                      : "Xóa mẫu bàn tùy chỉnh"
                  }
                >
                  {isDeletePending ? "Xác nhận xóa" : "Xóa"}
                </Button>
              )}
            </div>
          );
        })}

        {!loading && !filteredModels.length && (
          <div className="model-empty">
            <Search size={20} aria-hidden="true" />
            <strong>Không tìm thấy mẫu bàn phù hợp</strong>
            <span>Hãy thử đổi từ khóa, loại bàn hoặc trạng thái mô hình.</span>
          </div>
        )}
      </div>

      {isSelectedModelHiddenByFilters && (
        <p className="table-3d-modal__filter-note">
          Mẫu đang chọn đã bị ẩn bởi bộ lọc hiện tại.
        </p>
      )}

      <details className="table-3d-tech-details">
        <summary>
          <Info size={15} aria-hidden="true" />
          Thông tin mô hình
          <ChevronDown size={15} aria-hidden="true" />
        </summary>
        <div className="table-3d-modal__meta">
          <p>
            <b>Mô hình 3D:</b>{" "}
            {selectedModelAssetSummary.has3DModel ? "Đã có" : "Chưa có"}
          </p>
          <p>
            <b>Xem bằng AR:</b>{" "}
            {selectedModelAssetSummary.arReady ? "Có thể sử dụng" : "Chưa khả dụng"}
          </p>
          <p>
            <b>Nguồn mô hình:</b>{" "}
            {selectedModelAssetSummary.sourceUrl?.startsWith("http") ? (
              <a href={selectedModelAssetSummary.sourceUrl} target="_blank" rel="noreferrer">
                {selectedModelAssetSummary.source}
              </a>
            ) : (
              selectedModelAssetSummary.source
            )}
          </p>
          <p><b>Giấy phép sử dụng:</b> {selectedModelAssetSummary.license}</p>
          {selectedModelAssetSummary.dimensions && (
            <p><b>Kích thước:</b> {selectedModelAssetSummary.dimensions}</p>
          )}
          <p><b>Mã mô hình:</b> {selectedModelAssetSummary.modelKey}</p>
          <Button variant="secondary" size="sm" onClick={onReload}>
            Tải lại thư viện trực tuyến
          </Button>
        </div>
      </details>

      {error && (
        <div className="table-3d-modal__warning table-3d-modal__warning--catalog" role="alert">
          <AlertTriangle size={16} />
          <span>{getFriendlyCatalogError(error)}</span>
          <Button variant="secondary" size="sm" onClick={onReload}>
            Tải lại
          </Button>
        </div>
      )}
    </aside>
  );
}
