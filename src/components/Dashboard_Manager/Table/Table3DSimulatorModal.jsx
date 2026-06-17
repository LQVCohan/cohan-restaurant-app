import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import useTable3DModels from "@/hooks/useTable3DModels";
import {
  TABLE_3D_TYPE_OPTIONS,
  canOpenModelViewerAr,
  getArUnavailableReason,
  formatDimensionsCm,
  getModelAssetBadges,
  getModelAssetSummary,
  TABLE_3D_PLACEHOLDER_THUMB,
} from "@/config/table3dCatalog";
import {
  deleteCustomTableModel,
  isCustomTableModel,
  loadCustomTableModels,
  mergeCatalogWithCustomModels,
  upsertCustomTableModel,
  doesCustomModelMatchTableType,
  getCustomModelCatalogTableType,
} from "@/config/table3dCustomModelStorage";
import "./Table3DSimulatorModal.scss";
import CustomTableModelBuilderModal from "./CustomTableModelBuilderModal";
import TableCameraPlacementPreviewModal from "./TableCameraPlacementPreviewModal";
import ArTablePlacementModal from "./ArTablePlacementModal";
import { buildVisualConfigFromModel } from "./tableVisualConfigHelpers";

const MODEL_VIEWER_SRC =
  "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";

const DEFAULT_ORBIT = { theta: 0, phi: 75, radius: 2.6 };
const ALL_TABLE_TYPES = "all";

const Table3DSimulatorModal = ({
  open,
  onClose,
  onApply,
  currentFloorName,
  restaurantName,
  restaurantId,
  table,
  restaurant,
  floor,
  currentFloorLayout,
  onSaveArPosition,
}) => {
  const { models: catalogModels, modelsByType, loading, error, reload } = useTable3DModels();
  const [tableType, setTableType] = useState(ALL_TABLE_TYPES);
  const [selectedModelKey, setSelectedModelKey] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, z: 0 });
  const [orbit, setOrbit] = useState(DEFAULT_ORBIT);
  const [modelError, setModelError] = useState("");
  const viewerRef = useRef(null);
  const [showCustomBuilder, setShowCustomBuilder] = useState(false);
  const [cameraModel, setCameraModel] = useState(null);
  const [showArPlacement, setShowArPlacement] = useState(false);
  const [customModels, setCustomModels] = useState([]);
  const [isOpeningAr, setIsOpeningAr] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("all");
  const customModelScope = restaurantName || restaurantId || "default";

  useEffect(() => {
    if (customElements.get("model-viewer")) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = MODEL_VIEWER_SRC;
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  const models = useMemo(() => {
    if (tableType === ALL_TABLE_TYPES) return catalogModels || [];
    return (modelsByType[tableType] || []).filter(
      (model) => model.tableType === tableType,
    );
  }, [catalogModels, modelsByType, tableType]);

  const typedCustomModels = useMemo(() => {
    if (tableType === ALL_TABLE_TYPES) return customModels;
    return customModels.filter((model) =>
      doesCustomModelMatchTableType(model, tableType),
    );
  }, [customModels, tableType]);

  const allModels = useMemo(
    () => mergeCatalogWithCustomModels(models, typedCustomModels),
    [models, typedCustomModels],
  );

  const filteredModels = useMemo(() => {
    const normalizedSearch = catalogSearch.trim().toLowerCase();

    return allModels.filter((model) => {
      const searchableText = [
        model.label,
        model.tableType,
        model.source,
        model.sourceLabel,
        model.licenseLabel,
        ...(model.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);
      const hasModel = canOpenModelViewerAr(model);
      const matchesAssetFilter =
        assetFilter === "all" ||
        (assetFilter === "model" && hasModel) ||
        (assetFilter === "placeholder" && !hasModel);

      return matchesSearch && matchesAssetFilter;
    });
  }, [allModels, assetFilter, catalogSearch]);

  const selectedModel = useMemo(
    () =>
      allModels.find((item) => item.key === selectedModelKey) ||
      allModels[0] ||
      null,
    [allModels, selectedModelKey],
  );

  useEffect(() => {
    if (!open) return;
    setCustomModels(loadCustomTableModels(customModelScope));
  }, [open, customModelScope]);

  useEffect(() => {
    setSelectedModelKey(allModels[0]?.key || "");
    setOrbit(DEFAULT_ORBIT);
    setOffset({ x: 0, z: 0 });
    setScale(allModels[0]?.defaultScale || 1);
  }, [tableType, allModels]);

  useEffect(() => {
    if (!selectedModel) return;
    setScale(selectedModel.defaultScale || 1);
    setModelError("");
  }, [selectedModel]);

  const modelScale = `${scale} ${scale} ${scale}`;
  const cameraOrbit = `${orbit.theta}deg ${orbit.phi}deg ${orbit.radius}m`;
  const cameraTarget = `${offset.x}m 0m ${offset.z}m`;
  const canOpenAr = canOpenModelViewerAr(selectedModel);
  const arUnavailableReason = getArUnavailableReason(selectedModel);
  const selectedModelAssetSummary = getModelAssetSummary(selectedModel);
  const isSelectedModelHiddenByFilters = Boolean(
    selectedModel &&
      !filteredModels.some((model) => model.key === selectedModel.key),
  );

  const handleThumbnailError = (event) => {
    if (event.currentTarget.src === TABLE_3D_PLACEHOLDER_THUMB) return;
    event.currentTarget.src = TABLE_3D_PLACEHOLDER_THUMB;
  };

  const shiftModel = (x, z) => {
    setOffset((prev) => ({
      x: Number((prev.x + x).toFixed(2)),
      z: Number((prev.z + z).toFixed(2)),
    }));
  };

  const rotateModel = (delta) => {
    setOrbit((prev) => ({ ...prev, theta: prev.theta + delta }));
  };

  const zoomModel = (delta) => {
    setOrbit((prev) => ({
      ...prev,
      radius: Math.max(
        1.2,
        Math.min(5, Number((prev.radius + delta).toFixed(2))),
      ),
    }));
  };

  const resetView = () => {
    setOrbit(DEFAULT_ORBIT);
    setOffset({ x: 0, z: 0 });
    if (selectedModel?.defaultScale) setScale(selectedModel.defaultScale);
  };

  const handleModelItemKeyDown = (event, model) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    setSelectedModelKey(model.key);
  };

  const handleDeleteCustomModel = (event, model) => {
    event.stopPropagation();
    if (!window.confirm(`Xóa mẫu "${model.label}" khỏi thư viện tùy chỉnh?`))
      return;

    const saved = deleteCustomTableModel(model.key, customModelScope);
    setCustomModels(saved);
    if (selectedModel?.key === model.key) {
      const nextVisible = mergeCatalogWithCustomModels(
        models,
        tableType === ALL_TABLE_TYPES
          ? saved
          : saved.filter((item) => doesCustomModelMatchTableType(item, tableType)),
      );
      setSelectedModelKey(nextVisible[0]?.key || "");
    }
  };

  const handleOpenAr = async () => {
    const viewer = viewerRef.current;
    if (!canOpenModelViewerAr(selectedModel)) {
      setModelError(getArUnavailableReason(selectedModel));
      return;
    }

    if (!viewer || typeof viewer.activateAR !== "function") {
      setModelError(
        "Thiết bị/trình duyệt hiện tại chưa mở được AR. Bạn vẫn có thể dùng Xem thử bằng camera.",
      );
      return;
    }

    try {
      setIsOpeningAr(true);
      await viewer.activateAR();
    } catch {
      setModelError(
        "Thiết bị/trình duyệt hiện tại chưa mở được AR. Bạn vẫn có thể dùng Xem thử bằng camera.",
      );
    } finally {
      setIsOpeningAr(false);
    }
  };

  useEffect(() => {
    const node = viewerRef.current;
    if (!node || !selectedModel?.modelUrl) return undefined;
    const handleError = () =>
      setModelError("Không tải được model, hãy đổi mẫu khác.");
    node.addEventListener("error", handleError);
    return () => node.removeEventListener("error", handleError);
  }, [selectedModel?.key, selectedModel?.modelUrl]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="full"
      className="table-3d-modal"
    >
      <div className="table-3d-modal__header">
        <div>
          <h3>🪑 Mô phỏng 3D và xem thử bàn</h3>
          <p>
            {restaurantName || "Nhà hàng hiện tại"}
            {currentFloorName ? ` • Đang xem cho ${currentFloorName}` : ""}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Đóng
        </Button>
      </div>

      <div className="table-3d-modal__layout">
        <aside className="table-3d-modal__sidebar">
          <label>Phạm vi mẫu bàn</label>
          <select
            value={tableType}
            onChange={(e) => setTableType(e.target.value)}
          >
            <option value={ALL_TABLE_TYPES}>Tất cả mẫu bàn có trong hệ thống</option>
            {TABLE_3D_TYPE_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <div
            className="table-3d-modal__filters"
            aria-label="Bộ lọc catalog 3D"
          >
            <input
              type="search"
              value={catalogSearch}
              onChange={(event) => setCatalogSearch(event.target.value)}
              placeholder="Tìm theo tên hoặc tag..."
              aria-label="Tìm mẫu bàn 3D"
            />
            <select
              value={assetFilter}
              onChange={(event) => setAssetFilter(event.target.value)}
              aria-label="Lọc theo trạng thái model 3D"
            >
              <option value="all">Tất cả mẫu</option>
              <option value="model">Có model 3D thật</option>
              <option value="placeholder">Chỉ placeholder</option>
            </select>
          </div>

          <div className="table-3d-modal__models">
            {filteredModels.map((model) => {
              const dimensionsLabel = formatDimensionsCm(model.dimensionsCm);

              return (
                <div
                  key={model.key}
                  className={`model-item ${selectedModel?.key === model.key ? "active" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedModel?.key === model.key}
                  onClick={() => setSelectedModelKey(model.key)}
                  onKeyDown={(event) => handleModelItemKeyDown(event, model)}
                >
                  <img
                    src={model.thumbnailUrl || TABLE_3D_PLACEHOLDER_THUMB}
                    alt={model.label}
                    loading="lazy"
                    onError={handleThumbnailError}
                  />
                  <div>
                    <strong>{model.label}</strong>
                    <span>{model.capacity} ghế</span>
                    <div className="model-item__badges">
                      {getModelAssetBadges(model).map((badge) => (
                        <span
                          key={`${model.key}-${badge}`}
                          className="model-badge"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                    {dimensionsLabel && <span>{dimensionsLabel}</span>}
                    {model?.customModelSpec && (
                      <span>
                        {model.customModelSpec.widthCm} x{" "}
                        {model.customModelSpec.depthCm} x{" "}
                        {model.customModelSpec.heightCm} cm
                      </span>
                    )}
                    {(model.sourceLabel || model.licenseLabel) && (
                      <span>
                        {model.sourceLabel || model.source}{" "}
                        {model.licenseLabel ? `• ${model.licenseLabel}` : ""}
                      </span>
                    )}
                  </div>
                  {isCustomTableModel(model) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      onClick={(event) => handleDeleteCustomModel(event, model)}
                      aria-label={`Xóa mẫu tùy chỉnh ${model.label}`}
                      title={`Xóa mẫu tùy chỉnh ${model.label}`}
                    >
                      Xóa
                    </Button>
                  )}
                </div>
              );
            })}
            {!filteredModels.length && (
              <div className="model-empty">
                Không có mẫu phù hợp với bộ lọc hiện tại. Hãy đổi từ khóa, chọn
                bộ lọc khác hoặc tạo mẫu tùy chỉnh mới.
              </div>
            )}
          </div>

          <div className="table-3d-modal__meta">
            {isSelectedModelHiddenByFilters && (
              <p className="table-3d-modal__filter-note">
                Mẫu đang xem không khớp bộ lọc hiện tại.
              </p>
            )}
            <p>
              <b>Model 3D:</b>{" "}
              {selectedModelAssetSummary.has3DModel ? "Có" : "Chưa có"}
            </p>
            <p>
              <b>AR native:</b>{" "}
              {selectedModelAssetSummary.arReady
                ? "Có thể thử"
                : "Chưa khả dụng"}
            </p>
            <p>
              <b>Nguồn model:</b>{" "}
              {selectedModelAssetSummary.sourceUrl?.startsWith("http") ? (
                <a
                  href={selectedModelAssetSummary.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {selectedModelAssetSummary.source}
                </a>
              ) : (
                selectedModelAssetSummary.source
              )}
            </p>
            <p>
              <b>License:</b> {selectedModelAssetSummary.license}
            </p>
            {selectedModelAssetSummary.dimensions && (
              <p>
                <b>Kích thước:</b> {selectedModelAssetSummary.dimensions}
              </p>
            )}
            <p>
              <b>Model key:</b> {selectedModelAssetSummary.modelKey}
            </p>
          </div>
          {error && <div className="table-3d-modal__warning">{error}</div>}
          <Button variant="secondary" size="sm" onClick={reload}>
            Tải lại catalog online
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowCustomBuilder(true)}
          >
            ✨ Tạo mẫu bàn tùy chỉnh
          </Button>
        </aside>

        <section className="table-3d-modal__viewer-wrap">
          <div className="viewer-overlay">
            <span>{selectedModel?.label || "Mẫu 3D"}</span>
            {loading && <span>Đang tải catalog...</span>}
            <span>
              Xem thử chỉ dùng để đánh giá mẫu bàn có hợp không gian, không lưu tọa độ vào sơ đồ bàn.
            </span>
          </div>

          {selectedModel?.modelUrl && !modelError ? (
            <model-viewer
              ref={viewerRef}
              src={selectedModel.modelUrl}
              camera-controls
              ar
              ar-modes="webxr scene-viewer quick-look"
              ar-scale="fixed"
              touch-action="pan-y"
              camera-orbit={cameraOrbit}
              camera-target={cameraTarget}
              model-scale={modelScale}
              shadow-intensity="1"
              environment-image="neutral"
              ar-status="not-presenting"
              className="table-3d-viewer"
            />
          ) : (
            <div className="viewer-placeholder">
              {selectedModel
                ? "Mẫu này chỉ có thông số mô phỏng. Hãy dùng Xem thử bằng camera hoặc chọn mẫu có model 3D để mở AR."
                : "Chọn mẫu để bắt đầu mô phỏng."}
            </div>
          )}

          {modelError && (
            <div className="table-3d-modal__warning">{modelError}</div>
          )}

          <div className="table-3d-modal__controls">
            <Button size="sm" variant="secondary" onClick={() => rotateModel(-15)}>
              ↺ Rotate
            </Button>
            <Button size="sm" variant="secondary" onClick={() => rotateModel(15)}>
              ↻ Rotate
            </Button>
            <Button size="sm" variant="secondary" onClick={() => zoomModel(-0.2)}>
              ＋ Zoom
            </Button>
            <Button size="sm" variant="secondary" onClick={() => zoomModel(0.2)}>
              － Zoom
            </Button>
            <Button size="sm" variant="secondary" onClick={resetView}>
              Reset
            </Button>
          </div>

          <div className="table-3d-modal__controls">
            <Button size="sm" variant="secondary" onClick={() => shiftModel(-0.1, 0)}>
              ← Di chuyển
            </Button>
            <Button size="sm" variant="secondary" onClick={() => shiftModel(0.1, 0)}>
              → Di chuyển
            </Button>
            <Button size="sm" variant="secondary" onClick={() => shiftModel(0, -0.1)}>
              ↑ Di chuyển
            </Button>
            <Button size="sm" variant="secondary" onClick={() => shiftModel(0, 0.1)}>
              ↓ Di chuyển
            </Button>
            <label className="scale-range">
              Scale {scale.toFixed(2)}
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="table-3d-modal__guide">
            <p>• Xem 3D: xoay/zoom mẫu bàn trong màn hình.</p>
            <p>• Xem thử bằng camera: overlay thủ công để ước lượng mẫu bàn có hợp không gian thực tế hay không.</p>
            <p>• Mở AR: dùng AR native trên thiết bị/trình duyệt hỗ trợ.</p>
            <p>• Chức năng camera hiện không lấy tọa độ không gian thật và không liên kết với sơ đồ bàn.</p>
          </div>

          <div className="table-3d-modal__footer">
            <Button
              variant="secondary"
              onClick={() => selectedModel && setCameraModel(selectedModel)}
              disabled={!selectedModel}
              title={selectedModel ? "" : "Vui lòng chọn mẫu bàn trước"}
            >
              📷 Xem thử trong không gian
            </Button>
            <div className="table-3d-modal__ar-hint">
              {canOpenAr ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleOpenAr}
                  disabled={isOpeningAr}
                  aria-label="Mở AR native trên thiết bị hỗ trợ"
                  title="Mở AR native bằng trình xem hệ thống trên thiết bị hỗ trợ"
                >
                  {isOpeningAr ? "Đang mở AR..." : "Mở AR trên thiết bị hỗ trợ"}
                </Button>
              ) : (
                selectedModel && <span>{arUnavailableReason}</span>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setShowArPlacement(true)}
                disabled={!selectedModel?.modelUrl}
                title={selectedModel?.modelUrl ? "Hiệu chỉnh và lưu vị trí bàn vào sơ đồ" : "Mẫu bàn chưa có modelUrl"}
              >
                Đặt vị trí bằng AR
              </Button>
              <span>
                AR phụ thuộc thiết bị/trình duyệt. Nếu không hỗ trợ, hãy dùng
                Xem thử trong không gian hoặc nhập tọa độ manual.
              </span>
            </div>
            <Button
              variant="primary"
              onClick={() =>
                selectedModel &&
                onApply(selectedModel, {
                  visualConfig: buildVisualConfigFromModel(selectedModel, null),
                })
              }
              disabled={!selectedModel}
            >
              Áp dụng mẫu vào form thêm bàn
            </Button>
          </div>
        </section>
      </div>
      <CustomTableModelBuilderModal
        open={showCustomBuilder}
        onClose={() => setShowCustomBuilder(false)}
        onApply={(customItem) => {
          const saved = upsertCustomTableModel(customItem, customModelScope);
          setCustomModels(saved);
          setTableType(getCustomModelCatalogTableType(customItem));
          setSelectedModelKey(customItem.key);
          setShowCustomBuilder(false);
        }}
      />
      <TableCameraPlacementPreviewModal
        open={!!cameraModel}
        modelItem={cameraModel}
        onClose={() => setCameraModel(null)}
      />
      <ArTablePlacementModal
        open={showArPlacement}
        onClose={() => setShowArPlacement(false)}
        table={table}
        restaurant={restaurant}
        floor={floor}
        selectedModel={selectedModel}
        currentFloorLayout={currentFloorLayout}
        onSavePosition={onSaveArPosition}
      />
    </Modal>
  );
};

export default Table3DSimulatorModal;
