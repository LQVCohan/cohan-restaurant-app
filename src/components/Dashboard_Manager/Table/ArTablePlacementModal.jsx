import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import {
  buildArPlacementMetadata,
  buildArToFloorTransform,
  canPersistArTablePosition,
  getRestaurantGeofenceState,
  mapArPointToFloorPosition,
} from "@/utils/arTablePlacement";
import "./ArTablePlacementModal.scss";

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
  const pointCandidates = [
    restaurant?.address,
    restaurant?.location,
    restaurant?.coordinates,
    restaurant,
  ];

  for (const item of pointCandidates) {
    const lat = item?.lat ?? item?.latitude;
    const lng = item?.lng ?? item?.longitude;
    if (lat != null && lng != null) return { lat, lng };
  }

  const coordinateCandidates = [
    restaurant?.location?.coordinates,
    restaurant?.coordinates,
  ];

  for (const coordinates of coordinateCandidates) {
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      const [lng, lat] = coordinates;
      if (lat != null && lng != null) return { lat, lng };
    }
  }

  return null;
};

const supportsWebXrAr = () =>
  typeof navigator !== "undefined" &&
  Boolean(navigator.xr && typeof navigator.xr.isSessionSupported === "function");

const formatArPoint = (point) => {
  if (!point) return "Chưa có điểm AR";
  return `x=${point.x.toFixed(2)}m, y=${point.y.toFixed(2)}m, z=${point.z.toFixed(2)}m`;
};

const pointToInputState = (point) => ({
  x: point?.x != null ? String(Number(point.x).toFixed(3)) : "",
  z: point?.z != null ? String(Number(point.z).toFixed(3)) : "",
});

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
  const [xrSessionActive, setXrSessionActive] = useState(false);
  const [hitTestReady, setHitTestReady] = useState(false);
  const [latestHitPoint, setLatestHitPoint] = useState(null);
  const [realArStatus, setRealArStatus] = useState("");
  const [realArError, setRealArError] = useState("");

  const canvasRef = useRef(null);
  const xrSessionRef = useRef(null);
  const xrHitTestSourceRef = useRef(null);
  const xrRefSpaceRef = useRef(null);
  const xrViewerSpaceRef = useRef(null);
  const xrGlRef = useRef(null);
  const latestHitPointRef = useRef(null);
  const lastHitUpdateAtRef = useRef(0);

  const resetXrRefs = useCallback(() => {
    try {
      xrHitTestSourceRef.current?.cancel?.();
    } catch {
      // Ignore hit-test source cleanup errors from platform implementations.
    }
    xrSessionRef.current = null;
    xrHitTestSourceRef.current = null;
    xrRefSpaceRef.current = null;
    xrViewerSpaceRef.current = null;
    xrGlRef.current = null;
    setXrSessionActive(false);
    setHitTestReady(false);
  }, []);

  const stopRealArSession = useCallback(async () => {
    const session = xrSessionRef.current;
    if (!session) {
      resetXrRefs();
      return;
    }
    try {
      await session.end();
    } catch {
      resetXrRefs();
    }
  }, [resetXrRefs]);

  useEffect(() => {
    if (!open) {
      stopRealArSession();
      return;
    }

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
  }, [open, stopRealArSession]);

  useEffect(() => {
    if (!open) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
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

  useEffect(
    () => () => {
      stopRealArSession();
    },
    [stopRealArSession],
  );

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

  const hasSelectedTable = Boolean(table?.id);
  const canSave =
    hasSelectedTable &&
    canPersistArTablePosition({ geofenceState, transform, floorPosition: position });

  const updatePoint = (setter, key, value) => {
    setter((prev) => ({ ...prev, [key]: value }));
  };

  const fillArPoint = (target) => {
    const point = latestHitPointRef.current || latestHitPoint;
    if (!point) return;
    const nextValue = pointToInputState(point);
    if (target === "anchorA") setArAnchorA(nextValue);
    if (target === "anchorB") setArAnchorB(nextValue);
    if (target === "table") setArTablePoint(nextValue);
  };

  const handleStartRealAr = async () => {
    if (xrSessionActive) return;
    setRealArError("");
    setRealArStatus("Đang mở phiên AR thật...");

    if (!webXrSupported || !supportsWebXrAr()) {
      setRealArError("Thiết bị/trình duyệt hiện chưa hỗ trợ WebXR AR.");
      setRealArStatus("");
      return;
    }
    if (typeof XRWebGLLayer === "undefined") {
      setRealArError("Trình duyệt chưa hỗ trợ XRWebGLLayer để chạy AR trong web.");
      setRealArStatus("");
      return;
    }

    try {
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = Math.max(window.innerWidth || 1, 1);
      canvas.height = Math.max(window.innerHeight || 1, 1);
      const gl = canvas.getContext("webgl", {
        xrCompatible: true,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: false,
      });
      if (!gl) throw new Error("WEBGL_UNAVAILABLE");
      if (typeof gl.makeXRCompatible === "function") await gl.makeXRCompatible();

      const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["local-floor", "dom-overlay"],
        domOverlay: { root: document.body },
      });
      session.addEventListener("end", () => {
        resetXrRefs();
        setRealArStatus("Đã kết thúc phiên AR. Điểm hit-test gần nhất vẫn có thể dùng để điền tọa độ.");
      });

      session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
      const refSpace = await session
        .requestReferenceSpace("local-floor")
        .catch(() => session.requestReferenceSpace("local"));
      const viewerSpace = await session.requestReferenceSpace("viewer");
      if (typeof session.requestHitTestSource !== "function") {
        throw new Error("HIT_TEST_UNAVAILABLE");
      }
      const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

      xrSessionRef.current = session;
      xrGlRef.current = gl;
      xrRefSpaceRef.current = refSpace;
      xrViewerSpaceRef.current = viewerSpace;
      xrHitTestSourceRef.current = hitTestSource;
      setXrSessionActive(true);
      setHitTestReady(true);
      setRealArStatus("Đang quét mặt sàn. Di chuyển điện thoại chậm để hệ thống tìm điểm đặt bàn.");

      const onFrame = (_time, frame) => {
        const activeSession = frame.session;
        const activeGl = xrGlRef.current;
        const activeRefSpace = xrRefSpaceRef.current;
        const activeHitTestSource = xrHitTestSourceRef.current;

        activeSession.requestAnimationFrame(onFrame);

        if (!activeGl || !activeRefSpace || !activeHitTestSource) return;
        const baseLayer = activeSession.renderState.baseLayer;
        if (baseLayer?.framebuffer) {
          activeGl.bindFramebuffer(activeGl.FRAMEBUFFER, baseLayer.framebuffer);
          activeGl.clearColor(0, 0, 0, 0);
          activeGl.clear(activeGl.COLOR_BUFFER_BIT | activeGl.DEPTH_BUFFER_BIT);
        }

        const hitResults = frame.getHitTestResults(activeHitTestSource);
        if (!hitResults.length) return;
        const hitPose = hitResults[0].getPose(activeRefSpace);
        if (!hitPose?.transform?.matrix) return;

        const matrix = hitPose.transform.matrix;
        const hitPoint = {
          x: Number(Number(matrix[12] || 0).toFixed(3)),
          y: Number(Number(matrix[13] || 0).toFixed(3)),
          z: Number(Number(matrix[14] || 0).toFixed(3)),
        };
        latestHitPointRef.current = hitPoint;

        const now = Date.now();
        if (now - lastHitUpdateAtRef.current > 250) {
          lastHitUpdateAtRef.current = now;
          setLatestHitPoint(hitPoint);
          setRealArStatus("Đã nhận điểm hit-test từ mặt phẳng thật. Có thể dùng điểm hiện tại cho mốc hoặc vị trí bàn.");
        }
      };

      session.requestAnimationFrame(onFrame);
    } catch (error) {
      console.error(error);
      resetXrRefs();
      const message =
        error?.message === "WEBGL_UNAVAILABLE"
          ? "Không mở được WebGL để chạy AR. Hãy dùng trình duyệt/thiết bị khác hoặc nhập manual."
          : error?.message === "HIT_TEST_UNAVAILABLE"
            ? "Thiết bị chưa hỗ trợ WebXR hit-test. Có thể dùng tọa độ manual để hiệu chỉnh."
            : "Không thể mở phiên AR thật. Hãy kiểm tra HTTPS, quyền camera và thiết bị hỗ trợ WebXR.";
      setRealArError(message);
      setRealArStatus("");
    }
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
      <input
        placeholder="x trên sơ đồ"
        type="number"
        value={value.x}
        onChange={(e) => updatePoint(setter, "x", e.target.value)}
      />
      <input
        placeholder="y trên sơ đồ"
        type="number"
        value={value.y}
        onChange={(e) => updatePoint(setter, "y", e.target.value)}
      />
    </div>
  );

  const renderArInputs = (label, value, setter, target) => (
    <div className="ar-placement-modal__row ar-placement-modal__row--ar">
      <strong>{label}</strong>
      <input
        placeholder="x AR (m)"
        type="number"
        step="0.01"
        value={value.x}
        onChange={(e) => updatePoint(setter, "x", e.target.value)}
      />
      <input
        placeholder="z AR (m)"
        type="number"
        step="0.01"
        value={value.z}
        onChange={(e) => updatePoint(setter, "z", e.target.value)}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={!latestHitPoint}
        onClick={() => fillArPoint(target)}
      >
        Dùng điểm AR hiện tại
      </Button>
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

        {!hasSelectedTable && (
          <div className="ar-placement-modal__warning">
            Chưa chọn bàn để đặt vị trí.
          </div>
        )}
        {!checkingXr && !webXrSupported && (
          <div className="ar-placement-modal__warning">
            Thiết bị/trình duyệt chưa hỗ trợ WebXR AR. Có thể nhập tọa độ manual để hiệu chỉnh và lưu khi đang ở nhà hàng.
          </div>
        )}
        {(locationError || geofenceState.warning) && (
          <div className="ar-placement-modal__warning">
            {geofenceState.warning || locationError}
          </div>
        )}

        <div className="ar-placement-modal__section ar-placement-modal__section--real-ar">
          <div className="ar-placement-modal__section-title">
            <h4>AR thật bằng WebXR hit-test</h4>
            <span>{hitTestReady ? "Hit-test sẵn sàng" : "Progressive enhancement"}</span>
          </div>
          <p className="ar-placement-modal__hint">
            Mở camera AR để lấy điểm mặt sàn thật. Sau đó dùng điểm AR hiện tại cho mốc A, mốc B hoặc vị trí bàn. Nếu thiết bị không hỗ trợ, vẫn có thể nhập tọa độ manual bên dưới.
          </p>
          <canvas ref={canvasRef} className="ar-placement-modal__xr-canvas" aria-hidden="true" />
          <div className="ar-placement-modal__real-ar-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={handleStartRealAr}
              disabled={xrSessionActive || checkingXr || !webXrSupported}
            >
              {xrSessionActive ? "Đang chạy AR" : "Bắt đầu AR thật"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={stopRealArSession}
              disabled={!xrSessionActive}
            >
              Kết thúc AR
            </Button>
            <span className="ar-placement-modal__latest-point">
              Điểm mới nhất: {formatArPoint(latestHitPoint)}
            </span>
          </div>
          {realArStatus && <div className="ar-placement-modal__status">{realArStatus}</div>}
          {realArError && <div className="ar-placement-modal__warning">{realArError}</div>}
        </div>

        <div className="ar-placement-modal__section">
          <h4>1. Hiệu chỉnh 2 điểm trên sơ đồ tầng</h4>
          {renderFloorInputs("Điểm A - cửa vào/mốc 1", floorAnchorA, setFloorAnchorA)}
          {renderFloorInputs("Điểm B - quầy/marker/mốc 2", floorAnchorB, setFloorAnchorB)}
        </div>

        <div className="ar-placement-modal__section">
          <h4>2. Tọa độ AR tương ứng</h4>
          <p className="ar-placement-modal__hint">
            Có thể dùng điểm WebXR hit-test mới nhất hoặc nhập manual nếu thiết bị chưa hỗ trợ AR thật.
          </p>
          {renderArInputs("AR điểm A", arAnchorA, setArAnchorA, "anchorA")}
          {renderArInputs("AR điểm B", arAnchorB, setArAnchorB, "anchorB")}
          {renderArInputs("Vị trí bàn AR hiện tại", arTablePoint, setArTablePoint, "table")}
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
