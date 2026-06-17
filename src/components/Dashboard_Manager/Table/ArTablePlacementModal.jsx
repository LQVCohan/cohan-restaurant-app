import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import {
  buildArPlacementMetadata,
  buildArToFloorTransform,
  canPersistArTablePosition,
  getRestaurantGeofenceState,
  mapArPointToFloorPosition,
} from "@/utils/arTablePlacement";

const emptyAnchor = { x: "", y: "" };
const emptyArPoint = { x: "", z: "" };

const toPoint = (point, zKey = "y") => {
  const x = Number(point?.x);
  const second = Number(point?.[zKey]);
  return Number.isFinite(x) && Number.isFinite(second)
    ? { x, [zKey]: second }
    : null;
};

const getRestaurantLocation = (restaurant) => {
  const candidates = [
    restaurant?.location,
    restaurant?.coordinates,
    restaurant?.addressLocation,
    restaurant,
  ];
  for (const item of candidates) {
    const lat = item?.lat ?? item?.latitude;
    const lng = item?.lng ?? item?.longitude;
    if (lat != null && lng != null) return { lat, lng };
  }
  return null;
};

const supportsWebXrAr = () =>
  typeof navigator !== "undefined" &&
  Boolean(navigator.xr && typeof navigator.xr.isSessionSupported === "function");

export default function ArTablePlacementModal({
  open,
  onClose,
  table,
  restaurant,
  floor,
  selectedModel,
  currentFloorLayout,
  onSavePosition,
}) {
  const [webXrSupported, setWebXrSupported] = useState(false);
  const [checkingXr, setCheckingXr] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState("");
  const [saving, setSaving] = useState(false);
  const [floorAnchorA, setFloorAnchorA] = useState(emptyAnchor);
  const [floorAnchorB, setFloorAnchorB] = useState(emptyAnchor);
  const [arAnchorA, setArAnchorA] = useState(emptyArPoint);
  const [arAnchorB, setArAnchorB] = useState(emptyArPoint);
  const [arTablePoint, setArTablePoint] = useState(emptyArPoint);

  useEffect(() => {
    if (!open) return;
    setCheckingXr(true);
    if (!supportsWebXrAr()) {
      setWebXrSupported(false);
      setCheckingXr(false);
      return;
    }
    navigator.xr
      .isSessionSupported("immersive-ar")
      .then(setWebXrSupported)
      .catch(() => setWebXrSupported(false))
      .finally(() => setCheckingXr(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!navigator.geolocation) {
      setLocationError("Trình duyệt chưa hỗ trợ lấy vị trí hiện tại.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError("");
      },
      () => setLocationError("Không thể lấy vị trí hiện tại. Vui lòng bật quyền định vị."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [open]);

  const geofenceState = useMemo(
    () =>
      getRestaurantGeofenceState({
        currentLocation: location,
        restaurantLocation: getRestaurantLocation(restaurant),
        radiusMeters: restaurant?.arGeofenceRadiusMeters || restaurant?.geofenceRadiusMeters,
      }),
    [location, restaurant],
  );

  const transform = useMemo(
    () =>
      buildArToFloorTransform({
        arAnchorA: toPoint(arAnchorA, "z"),
        arAnchorB: toPoint(arAnchorB, "z"),
        floorAnchorA: toPoint(floorAnchorA),
        floorAnchorB: toPoint(floorAnchorB),
      }),
    [arAnchorA, arAnchorB, floorAnchorA, floorAnchorB],
  );

  const position = useMemo(
    () => mapArPointToFloorPosition(toPoint(arTablePoint, "z"), transform),
    [arTablePoint, transform],
  );

  const canSave = canPersistArTablePosition({ geofenceState, transform, floorPosition: position });

  const updatePoint = (setter, key, value) => {
    setter((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSavePosition?.({
        position,
        visualConfigPatch: buildArPlacementMetadata({
          arPoint: toPoint(arTablePoint, "z"),
          floorPosition: position,
          transform,
          geofenceState,
          modelKey: selectedModel?.key || selectedModel?.modelKey,
        }),
      });
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const renderFloorInputs = (label, value, setter) => (
    <div className="ar-placement-modal__row">
      <strong>{label}</strong>
      <input placeholder="x trên sơ đồ" type="number" value={value.x} onChange={(e) => updatePoint(setter, "x", e.target.value)} />
      <input placeholder="y trên sơ đồ" type="number" value={value.y} onChange={(e) => updatePoint(setter, "y", e.target.value)} />
    </div>
  );

  const renderArInputs = (label, value, setter) => (
    <div className="ar-placement-modal__row">
      <strong>{label}</strong>
      <input placeholder="x AR (m)" type="number" step="0.01" value={value.x} onChange={(e) => updatePoint(setter, "x", e.target.value)} />
      <input placeholder="z AR (m)" type="number" step="0.01" value={value.z} onChange={(e) => updatePoint(setter, "z", e.target.value)} />
    </div>
  );

  return (
    <Modal isOpen={open} onClose={onClose} size="lg" className="ar-placement-modal">
      <Modal.Header>Đặt vị trí bàn bằng AR</Modal.Header>
      <Modal.Body>
        <div className="ar-placement-modal__intro">
          <p>Bàn: <strong>{table?.code || table?.number || "Chưa chọn"}</strong></p>
          <p>Tầng: <strong>{floor?.name || currentFloorLayout?.name || "Tầng hiện tại"}</strong></p>
          <p>Mẫu 3D: <strong>{selectedModel?.label || selectedModel?.modelLabel || "Chưa chọn"}</strong></p>
        </div>

        {!checkingXr && !webXrSupported && (
          <div className="ar-placement-modal__warning">
            Thiết bị/trình duyệt chưa hỗ trợ WebXR AR. Có thể nhập tọa độ mock/manual để hiệu chỉnh và lưu khi đang ở nhà hàng.
          </div>
        )}
        {(locationError || geofenceState.warning) && (
          <div className="ar-placement-modal__warning">
            {geofenceState.warning || locationError}
          </div>
        )}

        <div className="ar-placement-modal__section">
          <h4>1. Hiệu chỉnh 2 điểm trên sơ đồ tầng</h4>
          {renderFloorInputs("Điểm A - cửa vào/mốc 1", floorAnchorA, setFloorAnchorA)}
          {renderFloorInputs("Điểm B - quầy/marker/mốc 2", floorAnchorB, setFloorAnchorB)}
        </div>

        <div className="ar-placement-modal__section">
          <h4>2. Tọa độ AR tương ứng</h4>
          <p className="ar-placement-modal__hint">
            TODO: thay input manual bằng giá trị từ hit-test/session WebXR khi luồng AR hoàn chỉnh.
          </p>
          {renderArInputs("AR điểm A", arAnchorA, setArAnchorA)}
          {renderArInputs("AR điểm B", arAnchorB, setArAnchorB)}
          {renderArInputs("Vị trí bàn AR hiện tại", arTablePoint, setArTablePoint)}
        </div>

        <div className="ar-placement-modal__section">
          <h4>3. Kết quả</h4>
          <p>Transform: {transform ? "Đã hiệu chỉnh" : "Chưa đủ dữ liệu hợp lệ"}</p>
          <p>Table.position: {position ? `x=${position.x}, y=${position.y}` : "Chưa tính được"}</p>
          {geofenceState.distanceMeters != null && (
            <p>Khoảng cách đến nhà hàng: {Math.round(geofenceState.distanceMeters)}m / bán kính {geofenceState.radiusMeters}m</p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Hủy</Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave || saving}>
          {saving ? "Đang lưu..." : "Chọn vị trí này"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
