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
const GLTF_MODEL_PATTERN = /\.(glb|gltf)(?:[?#].*)?$/i;
const AR_DEBUG_ENABLED = import.meta.env.VITE_AR_DEBUG === "true";
const AR_DEMO_ALLOW_SAVE_OUTSIDE_GEOFENCE =
  import.meta.env.DEV && import.meta.env.VITE_AR_DEMO_ALLOW_SAVE_OUTSIDE_GEOFENCE === "true";

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

const normalizeStoredArPoint = (point) => (
  point
    ? {
        x: Number(Number(point.x || 0).toFixed(3)),
        y: Number(Number(point.y || 0).toFixed(3)),
        z: Number(Number(point.z || 0).toFixed(3)),
      }
    : null
);

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
  const [arModelStatus, setArModelStatus] = useState("");
  const [arModelError, setArModelError] = useState("");
  const [arModelScale, setArModelScale] = useState(1);
  const [arModelRotation, setArModelRotation] = useState(0);
  const [modelPinned, setModelPinned] = useState(false);
  const [pinnedHitPoint, setPinnedHitPoint] = useState(null);
  const [arPreflight, setArPreflight] = useState([]);
  const [arPreflightLoading, setArPreflightLoading] = useState(false);
  const [arPreflightError, setArPreflightError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [placementStep, setPlacementStep] = useState("preflight");

  const canvasRef = useRef(null);
  const xrSessionRef = useRef(null);
  const xrHitTestSourceRef = useRef(null);
  const xrRefSpaceRef = useRef(null);
  const xrViewerSpaceRef = useRef(null);
  const xrGlRef = useRef(null);
  const latestHitPointRef = useRef(null);
  const latestHitMatrixRef = useRef(null);
  const pinnedHitMatrixRef = useRef(null);
  const lastHitUpdateAtRef = useRef(0);
  const arThreeRef = useRef(null);
  const arModelScaleRef = useRef(1);
  const arModelRotationRef = useRef(0);

  useEffect(() => {
    arModelScaleRef.current = Number(arModelScale) || 1;
  }, [arModelScale]);

  useEffect(() => {
    arModelRotationRef.current = Number(arModelRotation) || 0;
  }, [arModelRotation]);


  const runArPreflight = useCallback(async () => {
    const checks = [];
    const pushCheck = (key, label, ok, level, message = "") => {
      checks.push({ key, label, ok: Boolean(ok), level: ok ? "ok" : level, message });
    };

    setArPreflightLoading(true);
    setArPreflightError("");
    try {
      const secureContext = typeof window !== "undefined" && window.isSecureContext;
      pushCheck("secureContext", "HTTPS / secure context", secureContext, "error", "Cần HTTPS hoặc localhost để mở WebXR AR.");

      const hasNavigatorXr = supportsWebXrAr();
      pushCheck("navigatorXr", "navigator.xr khả dụng", hasNavigatorXr, "error", "Trình duyệt chưa hỗ trợ navigator.xr.");

      let immersiveArSupported = false;
      if (hasNavigatorXr) {
        immersiveArSupported = await navigator.xr.isSessionSupported("immersive-ar").catch(() => false);
      }
      pushCheck("immersiveAr", "immersive-ar được hỗ trợ", immersiveArSupported, "error", "Thiết bị/trình duyệt chưa hỗ trợ WebXR immersive-ar.");
      setWebXrSupported(immersiveArSupported);

      const hasXrWebGlLayer = typeof XRWebGLLayer !== "undefined";
      pushCheck("xrWebGlLayer", "XRWebGLLayer tồn tại", hasXrWebGlLayer, "error", "Thiếu XRWebGLLayer để render AR.");

      let webGlOk = false;
      if (typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl", { xrCompatible: true, alpha: true, antialias: true });
        webGlOk = Boolean(gl);
        gl?.getExtension?.("WEBGL_lose_context")?.loseContext?.();
      }
      pushCheck("webgl", "WebGL xrCompatible tạo được", webGlOk, "error", "Không tạo được WebGL context tương thích XR.");

      const hasGeolocation = typeof navigator !== "undefined" && Boolean(navigator.geolocation);
      pushCheck("geolocation", "Geolocation API khả dụng", hasGeolocation, "warning", "Không có Geolocation; manual vẫn nhập được nhưng lưu AR cần geofence hợp lệ.");

      const hasModelUrl = Boolean(selectedModel?.modelUrl);
      pushCheck("modelUrl", "Model URL đã chọn", hasModelUrl, "error", "Hãy chọn mẫu có modelUrl.");
      const isGltf = hasModelUrl && GLTF_MODEL_PATTERN.test(selectedModel.modelUrl);
      pushCheck("modelFormat", "Model là GLB/GLTF", isGltf, "error", "modelUrl cần kết thúc bằng .glb hoặc .gltf.");

      const restaurantLocation = getRestaurantLocation(restaurant);
      const lat = Number(restaurantLocation?.lat);
      const lng = Number(restaurantLocation?.lng);
      const restaurantLocationOk = Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      pushCheck("restaurantLocation", "Tọa độ nhà hàng hợp lệ", restaurantLocationOk, "error", "Thiếu lat/lng hợp lệ của nhà hàng để kiểm tra geofence.");

      setArPreflight(checks);
    } catch (error) {
      console.error(error);
      setArPreflightError("Không thể kiểm tra thiết bị AR. Vui lòng thử lại hoặc dùng manual calibration.");
      setArPreflight(checks);
    } finally {
      setArPreflightLoading(false);
      setCheckingXr(false);
    }
  }, [restaurant, selectedModel?.modelUrl]);

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
    latestHitMatrixRef.current = null;
    if (arThreeRef.current) {
      arThreeRef.current.renderer?.setAnimationLoop?.(null);
      arThreeRef.current.renderer?.dispose?.();
      arThreeRef.current = null;
    }
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
    setPlacementStep("preflight");
    setSaveError("");
    runArPreflight();
  }, [open, runArPreflight, stopRealArSession]);

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

  const effectiveGeofenceState = useMemo(() => {
    if (AR_DEMO_ALLOW_SAVE_OUTSIDE_GEOFENCE && geofenceState?.canSaveArPosition === false) {
      return {
        ...geofenceState,
        canSaveArPosition: true,
        demoOverride: true,
        warning: "Đang bật chế độ demo: cho phép lưu vị trí AR dù chưa xác minh đúng khu vực nhà hàng.",
        originalReason: geofenceState.reason,
      };
    }
    return geofenceState;
  }, [geofenceState]);

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
    canPersistArTablePosition({ geofenceState: effectiveGeofenceState, transform, floorPosition: position });


  const getValidationMessages = () => {
    const messages = [];
    if (!toPoint(floorAnchorA)) messages.push("Thiếu floor anchor A.");
    if (!toPoint(floorAnchorB)) messages.push("Thiếu floor anchor B.");
    if (!toPoint(arAnchorA, "z")) messages.push("Thiếu AR anchor A.");
    if (!toPoint(arAnchorB, "z")) messages.push("Thiếu AR anchor B.");
    const arA = toPoint(arAnchorA, "z");
    const arB = toPoint(arAnchorB, "z");
    const floorA = toPoint(floorAnchorA);
    const floorB = toPoint(floorAnchorB);
    if (arA && arB && Math.hypot(arB.x - arA.x, arB.z - arA.z) < 0.1) messages.push("Hai điểm AR quá gần nhau.");
    if (floorA && floorB && Math.hypot(floorB.x - floorA.x, floorB.y - floorA.y) < 1) messages.push("Hai điểm sơ đồ quá gần nhau.");
    if (!transform) messages.push("Chưa tính được transform.");
    if (!toPoint(arTablePoint, "z")) messages.push("Chưa ghim vị trí bàn.");
    if (geofenceState?.canSaveArPosition === false && !effectiveGeofenceState?.demoOverride) messages.push("Đang ngoài geofence, không thể lưu trừ khi demo override bật.");
    return messages;
  };

  const validationMessages = getValidationMessages();
  const preflightWebXrBlocked = arPreflight.some((item) => item.level === "error" && ["secureContext", "navigatorXr", "immersiveAr", "xrWebGlLayer", "webgl"].includes(item.key));

  const updatePoint = (setter, key, value) => {
    setter((prev) => ({ ...prev, [key]: value }));
  };

  const pinCurrentArPoint = useCallback(() => {
    const point = latestHitPointRef.current || latestHitPoint;
    const matrix = latestHitMatrixRef.current;
    if (!point || !matrix) {
      setRealArError("Chưa có điểm hit-test để ghim. Hãy quét mặt sàn thêm vài giây.");
      return;
    }

    const storedPoint = normalizeStoredArPoint(point);
    pinnedHitMatrixRef.current = Array.from(matrix);
    setPinnedHitPoint(storedPoint);
    setModelPinned(true);
    setArTablePoint(pointToInputState(storedPoint));
    setRealArError("");
    setRealArStatus("Đã ghim model tại điểm AR hiện tại. Có thể xoay/scale và bấm Chọn vị trí này khi dữ liệu hợp lệ.");
  }, [latestHitPoint]);

  const clearPinnedArPoint = useCallback(() => {
    pinnedHitMatrixRef.current = null;
    setPinnedHitPoint(null);
    setModelPinned(false);
    setRealArStatus("Đã bỏ ghim. Model sẽ tiếp tục bám theo điểm hit-test mới nhất.");
  }, []);

  const fillArPoint = (target) => {
    const point = pinnedHitPoint || latestHitPointRef.current || latestHitPoint;
    if (!point) return;
    const nextValue = pointToInputState(point);
    if (target === "anchorA") setArAnchorA(nextValue);
    if (target === "anchorB") setArAnchorB(nextValue);
    if (target === "table") {
      setArTablePoint(nextValue);
      if (!modelPinned && latestHitMatrixRef.current) {
        pinCurrentArPoint();
      }
    }
  };

  const setupArModelRenderer = useCallback(async ({ canvas, gl, session }) => {
    if (!selectedModel?.modelUrl || !GLTF_MODEL_PATTERN.test(selectedModel.modelUrl)) {
      setArModelStatus("Chưa có model .glb/.gltf để hiển thị trong AR.");
      setArModelError("");
      return null;
    }

    try {
      const [THREE, { GLTFLoader }] = await Promise.all([
        import(/* @vite-ignore */ "three"),
        import(/* @vite-ignore */ "three/examples/jsm/loaders/GLTFLoader.js"),
      ]);
      const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
      renderer.autoClear = false;
      renderer.xr.enabled = true;
      await renderer.xr.setSession(session);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera();
      const reticle = new THREE.Group();
      reticle.matrixAutoUpdate = false;
      reticle.visible = false;
      scene.add(reticle);

      const light = new THREE.HemisphereLight(0xffffff, 0x777777, 1.2);
      scene.add(light);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(1, 3, 2);
      scene.add(directionalLight);

      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(selectedModel.modelUrl);
      const model = gltf.scene;
      model.visible = false;
      scene.add(model);

      arThreeRef.current = { THREE, renderer, scene, camera, reticle, model };
      setArModelStatus("Đã tải model AR. Model sẽ bám theo điểm hit-test mới nhất cho đến khi được ghim.");
      setArModelError("");
      return arThreeRef.current;
    } catch (error) {
      console.error(error);
      setArModelStatus("");
      setArModelError(
        "Không tải/render được model AR. Vẫn giữ hit-test point và tọa độ manual; cần cài three hoặc kiểm tra URL model.",
      );
      return null;
    }
  }, [selectedModel?.modelUrl]);

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
        setRealArStatus("Đã kết thúc phiên AR. Điểm đã ghim hoặc điểm hit-test gần nhất vẫn có thể dùng để lưu.");
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
      await setupArModelRenderer({ canvas, gl, session });

      const onFrame = (_time, frame) => {
        const activeSession = frame.session;
        const activeGl = xrGlRef.current;
        const activeRefSpace = xrRefSpaceRef.current;
        const activeHitTestSource = xrHitTestSourceRef.current;

        activeSession.requestAnimationFrame(onFrame);

        if (!activeGl || !activeRefSpace || !activeHitTestSource) return;
        const threeContext = arThreeRef.current;
        const baseLayer = activeSession.renderState.baseLayer;
        if (baseLayer?.framebuffer && !threeContext) {
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
        latestHitMatrixRef.current = Array.from(matrix);

        if (threeContext?.model) {
          const renderMatrix = pinnedHitMatrixRef.current || matrix;
          threeContext.model.visible = true;
          threeContext.model.matrixAutoUpdate = false;
          threeContext.model.matrix.fromArray(renderMatrix);
          const scale = arModelScaleRef.current;
          const rotationY = (arModelRotationRef.current * Math.PI) / 180;
          const adjustment = new threeContext.THREE.Matrix4()
            .makeRotationY(rotationY)
            .scale(new threeContext.THREE.Vector3(scale, scale, scale));
          threeContext.model.matrix.multiply(adjustment);
          threeContext.renderer.render(threeContext.scene, threeContext.camera);
        }

        const now = Date.now();
        if (now - lastHitUpdateAtRef.current > 250) {
          lastHitUpdateAtRef.current = now;
          setLatestHitPoint(hitPoint);
          if (!pinnedHitMatrixRef.current) {
            setRealArStatus("Đã nhận điểm hit-test từ mặt phẳng thật. Có thể ghim vị trí hoặc dùng điểm hiện tại cho mốc/vị trí bàn.");
          }
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
    setSaveError("");
    try {
      const baseMetadata = buildArPlacementMetadata({
        arPoint: toPoint(arTablePoint, "z"),
        floorPosition: position,
        transform,
        geofenceState: effectiveGeofenceState,
        modelKey: selectedModel?.key || selectedModel?.modelKey,
      });

      await onSavePosition?.({
        position,
        visualConfigPatch: {
          ...baseMetadata,
          arPlacement: {
            ...(baseMetadata.arPlacement || {}),
            modelRender: {
              modelUrl: selectedModel?.modelUrl || null,
              scale: Number(arModelScale) || 1,
              rotationDegrees: Number(arModelRotation) || 0,
              pinned: modelPinned,
              pinnedArPoint: normalizeStoredArPoint(pinnedHitPoint),
            },
          },
        },
      });
      onClose?.();
    } catch (error) {
      console.error(error);
      setSaveError("Không thể lưu vị trí AR. Vui lòng kiểm tra kết nối hoặc thử lại.");
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
        disabled={!latestHitPoint && !pinnedHitPoint}
        onClick={() => fillArPoint(target)}
      >
        {target === "anchorA" ? "Dùng điểm hiện tại cho AR điểm A" : target === "anchorB" ? "Dùng điểm hiện tại cho AR điểm B" : "Dùng điểm hiện tại cho vị trí bàn"}
      </Button>
    </div>
  );

  return (
    <Modal isOpen={open} onClose={onClose} size="lg" className={`ar-placement-modal ${xrSessionActive ? "ar-placement-modal--xr-active" : ""}`}>
      <Modal.Header>Đặt vị trí bàn bằng AR</Modal.Header>
      <Modal.Body>
        <div className="ar-placement-modal__intro">
          <p>Bàn: <strong>{table?.code || table?.number || "Chưa chọn"}</strong></p>
          <p>Tầng: <strong>{floor?.name || currentFloorLayout?.name || "Tầng hiện tại"}</strong></p>
          <p>Mẫu 3D: <strong>{selectedModel?.label || selectedModel?.modelLabel || "Chưa chọn"}</strong></p>
        </div>

        <div className="ar-placement-modal__mode-labels" aria-label="Các chế độ AR và fallback">
          <article><strong>AR thật để lưu vị trí</strong><span>Dùng WebXR hit-test; lưu khi geofence + calibration hợp lệ.</span></article>
          <article><strong>AR native để xem mẫu</strong><span>Dùng model-viewer ở màn trước; chỉ xem mẫu, không lưu tọa độ.</span></article>
          <article><strong>Manual calibration</strong><span>Dùng khi WebXR không hỗ trợ; nhập mốc thủ công và vẫn giữ fallback hiện có.</span></article>
        </div>

        <div className="ar-placement-modal__steps">
          {[
            ["preflight", "1. Kiểm tra thiết bị"],
            ["floorAnchors", "2. Mốc sơ đồ tầng"],
            ["arAnchors", "3. Mốc AR"],
            ["placeTable", "4. Ghim vị trí bàn"],
            ["review", "5. Kiểm tra và lưu"],
          ].map(([key, label]) => (
            <button key={key} type="button" className={placementStep === key ? "active" : ""} onClick={() => setPlacementStep(key)}>{label}</button>
          ))}
        </div>

        <div className="ar-placement-modal__section ar-placement-modal__section--preflight">
          <div className="ar-placement-modal__section-title">
            <h4>Preflight AR Android</h4>
            <Button type="button" variant="secondary" size="sm" onClick={runArPreflight} disabled={arPreflightLoading}>
              {arPreflightLoading ? "Đang kiểm tra..." : "Kiểm tra lại thiết bị"}
            </Button>
          </div>
          {arPreflightError && <div className="ar-placement-modal__warning">{arPreflightError}</div>}
          <div className="ar-placement-modal__checklist">
            {arPreflight.map((item) => (
              <div key={item.key} className={`ar-placement-modal__check ar-placement-modal__check--${item.level}`}>
                <strong>{item.ok ? "OK" : item.level === "warning" ? "Cảnh báo" : "Lỗi"}</strong>
                <span>{item.label}</span>
                {item.message && !item.ok && <small>{item.message}</small>}
              </div>
            ))}
          </div>
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
        {(locationError || effectiveGeofenceState.warning) && (
          <div className="ar-placement-modal__warning">
            {effectiveGeofenceState.warning || locationError}
          </div>
        )}

        <div className="ar-placement-modal__section ar-placement-modal__section--real-ar">
          <div className="ar-placement-modal__section-title">
            <h4>AR thật bằng WebXR hit-test</h4>
            <span>{modelPinned ? "Đã ghim vị trí" : hitTestReady ? "Hit-test sẵn sàng" : "Progressive enhancement"}</span>
          </div>
          <p className="ar-placement-modal__hint">
            Mở camera AR để lấy điểm mặt sàn thật. Khi bàn ảo ở đúng vị trí, bấm Ghim vị trí bàn để giữ model cố định rồi lưu vào sơ đồ tầng.
          </p>
          <canvas ref={canvasRef} className="ar-placement-modal__xr-canvas" aria-hidden="true" />
          <div className="ar-placement-modal__real-ar-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={handleStartRealAr}
              disabled={xrSessionActive || checkingXr || !webXrSupported || preflightWebXrBlocked}
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
            <Button
              type="button"
              variant="primary"
              onClick={pinCurrentArPoint}
              disabled={!latestHitPoint}
            >
              Ghim vị trí bàn
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={clearPinnedArPoint}
              disabled={!modelPinned}
            >
              Bỏ ghim
            </Button>
            <span className="ar-placement-modal__latest-point">
              Điểm mới nhất: {formatArPoint(latestHitPoint)}
            </span>
          </div>
          {pinnedHitPoint && (
            <div className="ar-placement-modal__pinned-point">
              Điểm đã ghim: {formatArPoint(pinnedHitPoint)}
            </div>
          )}
          <div className="ar-placement-modal__model-controls">
            <label>
              Scale model
              <input
                type="number"
                min="0.05"
                step="0.05"
                value={arModelScale}
                onChange={(e) => setArModelScale(e.target.value)}
              />
            </label>
            <label>
              Xoay model (độ)
              <input
                type="number"
                step="5"
                value={arModelRotation}
                onChange={(e) => setArModelRotation(e.target.value)}
              />
            </label>
          </div>
          {arModelStatus && <div className="ar-placement-modal__status">{arModelStatus}</div>}
          {arModelError && <div className="ar-placement-modal__warning">{arModelError}</div>}
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
            Có thể dùng điểm đã ghim, điểm WebXR hit-test mới nhất hoặc nhập manual nếu thiết bị chưa hỗ trợ AR thật.
          </p>
          {renderArInputs("AR điểm A", arAnchorA, setArAnchorA, "anchorA")}
          {renderArInputs("AR điểm B", arAnchorB, setArAnchorB, "anchorB")}
          {renderArInputs("Vị trí bàn AR hiện tại", arTablePoint, setArTablePoint, "table")}
          <div className="ar-placement-modal__wizard-actions">
            <Button type="button" variant="secondary" onClick={() => setPlacementStep("review")}>Sang bước tiếp theo</Button>
          </div>
        </div>

        <div className="ar-placement-modal__section">
          <h4>3. Kết quả</h4>
          <p>Transform: {transform ? "Đã hiệu chỉnh" : "Chưa đủ dữ liệu hợp lệ"}</p>
          <p>Table.position: {position ? `x=${position.x}, y=${position.y}` : "Chưa tính được"}</p>
          {effectiveGeofenceState.distanceMeters != null && (
            <p>Khoảng cách đến nhà hàng: {Math.round(effectiveGeofenceState.distanceMeters)}m / bán kính {effectiveGeofenceState.radiusMeters}m</p>
          )}
          {validationMessages.length > 0 && (
            <ul className="ar-placement-modal__validation">
              {validationMessages.map((message) => <li key={message}>{message}</li>)}
            </ul>
          )}
          {saveError && <div className="ar-placement-modal__warning">{saveError}</div>}
        </div>

        {AR_DEBUG_ENABLED && (
          <div className="ar-placement-modal__debug">
            <h4>Debug AR demo</h4>
            <pre>{JSON.stringify({
              secureContext: typeof window !== "undefined" ? window.isSecureContext : false,
              webXrSupported,
              xrSessionActive,
              hitTestReady,
              latestHitPoint,
              pinnedHitPoint,
              modelPinned,
              modelUrl: selectedModel?.modelUrl || null,
              arModelScale,
              arModelRotation,
              geofenceReason: geofenceState?.reason || null,
              effectiveCanSave: effectiveGeofenceState?.canSaveArPosition || false,
              demoOverride: Boolean(effectiveGeofenceState?.demoOverride),
              transformValid: Boolean(transform),
              positionReady: Boolean(position),
              canSave,
            }, null, 2)}</pre>
          </div>
        )}

        {xrSessionActive && (
          <div className="ar-placement-modal__xr-overlay" aria-label="Điều khiển AR fullscreen">
            <div className="ar-placement-modal__xr-overlay-points">
              <span>Điểm mới nhất: {formatArPoint(latestHitPoint)}</span>
              <span>Điểm đã ghim: {formatArPoint(pinnedHitPoint)}</span>
            </div>
            <div className="ar-placement-modal__xr-overlay-actions">
              <Button type="button" variant="primary" onClick={pinCurrentArPoint} disabled={!latestHitPoint}>Ghim vị trí bàn</Button>
              <Button type="button" variant="secondary" onClick={clearPinnedArPoint} disabled={!modelPinned}>Bỏ ghim</Button>
              <Button type="button" variant="secondary" onClick={stopRealArSession}>Kết thúc AR</Button>
              <Button type="button" variant="secondary" onClick={() => setArModelScale((v) => Math.max(0.05, Number((Number(v || 1) - 0.05).toFixed(2))))}>Scale -</Button>
              <Button type="button" variant="secondary" onClick={() => setArModelScale((v) => Number((Number(v || 1) + 0.05).toFixed(2)))}>Scale +</Button>
              <Button type="button" variant="secondary" onClick={() => setArModelRotation((v) => Number(v || 0) - 5)}>Xoay trái</Button>
              <Button type="button" variant="secondary" onClick={() => setArModelRotation((v) => Number(v || 0) + 5)}>Xoay phải</Button>
            </div>
          </div>
        )}
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
