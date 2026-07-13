import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import * as THREE from "three";
import { loadTableVrImage } from "@/utils/vrStorage";
import { getTableVrViewerNavigation } from "@/utils/tableVrNavigation";
import "./VRViewer.scss";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function SphericalPanorama({ imageUrl }) {
  const mountRef = useRef(null);
  const controllerRef = useRef(null);
  const [viewerState, setViewerState] = useState("loading");
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !imageUrl) return undefined;

    let disposed = false;
    let renderer;
    let texture;
    let resizeObserver;
    let pointerActive = false;
    let pointerId = null;
    let lon = 0;
    let lat = 0;
    let fov = 72;
    const pointerStart = { x: 0, y: 0, lon: 0, lat: 0 };

    setViewerState("loading");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(fov, 1, 1, 1100);
    const target = new THREE.Vector3();
    const geometry = new THREE.SphereGeometry(500, 64, 40);
    geometry.scale(-1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const render = () => {
      if (!renderer || disposed) return;
      lat = clamp(lat, -85, 85);
      fov = clamp(fov, 35, 90);

      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      target.set(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta),
      );
      camera.lookAt(target);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    const resize = () => {
      if (!renderer || disposed) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      render();
    };

    const rotateBy = (deltaLon, deltaLat = 0) => {
      lon += deltaLon;
      lat += deltaLat;
      render();
    };

    const zoomBy = (deltaFov) => {
      fov = clamp(fov + deltaFov, 35, 90);
      render();
    };

    const resetView = () => {
      lon = 0;
      lat = 0;
      fov = 72;
      render();
    };

    controllerRef.current = { rotateBy, zoomBy, resetView };

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.className = "vr-viewer__webgl-canvas";
      renderer.domElement.setAttribute("aria-hidden", "true");
      mount.appendChild(renderer.domElement);
    } catch (error) {
      console.error("Không thể khởi tạo trình xem panorama WebGL.", error);
      setViewerState("error");
      controllerRef.current = null;
      geometry.dispose();
      material.dispose();
      return undefined;
    }

    const handlePointerDown = (event) => {
      pointerActive = true;
      pointerId = event.pointerId;
      pointerStart.x = event.clientX;
      pointerStart.y = event.clientY;
      pointerStart.lon = lon;
      pointerStart.lat = lat;
      renderer.domElement.setPointerCapture?.(event.pointerId);
      setIsDragging(true);
    };

    const handlePointerMove = (event) => {
      if (!pointerActive || event.pointerId !== pointerId) return;
      lon = pointerStart.lon + (pointerStart.x - event.clientX) * 0.12;
      lat = pointerStart.lat + (pointerStart.y - event.clientY) * 0.12;
      render();
    };

    const finishPointer = (event) => {
      if (!pointerActive || (event?.pointerId != null && event.pointerId !== pointerId)) {
        return;
      }
      pointerActive = false;
      if (pointerId != null) {
        renderer.domElement.releasePointerCapture?.(pointerId);
      }
      pointerId = null;
      setIsDragging(false);
    };

    const handleWheel = (event) => {
      event.preventDefault();
      zoomBy(event.deltaY * 0.035);
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", finishPointer);
    renderer.domElement.addEventListener("pointercancel", finishPointer);
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    new THREE.TextureLoader().load(
      imageUrl,
      (loadedTexture) => {
        if (disposed) {
          loadedTexture.dispose();
          return;
        }
        texture = loadedTexture;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(
          8,
          renderer.capabilities.getMaxAnisotropy?.() || 1,
        );
        material.map = texture;
        material.needsUpdate = true;
        setViewerState("ready");
        render();
      },
      undefined,
      (error) => {
        console.error("Không thể đọc ảnh panorama 360°.", error);
        if (!disposed) setViewerState("error");
      },
    );

    return () => {
      disposed = true;
      controllerRef.current = null;
      setIsDragging(false);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", finishPointer);
      renderer.domElement.removeEventListener("pointercancel", finishPointer);
      renderer.domElement.removeEventListener("wheel", handleWheel);
      texture?.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    };
  }, [imageUrl]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === mountRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleKeyDown = (event) => {
    const controller = controllerRef.current;
    if (!controller) return;

    const actions = {
      ArrowLeft: () => controller.rotateBy(-5),
      ArrowRight: () => controller.rotateBy(5),
      ArrowUp: () => controller.rotateBy(0, 4),
      ArrowDown: () => controller.rotateBy(0, -4),
      "+": () => controller.zoomBy(-5),
      "=": () => controller.zoomBy(-5),
      "-": () => controller.zoomBy(5),
      "0": () => controller.resetView(),
    };

    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  const toggleFullscreen = async () => {
    const mount = mountRef.current;
    if (!mount) return;
    try {
      if (document.fullscreenElement === mount) {
        await document.exitFullscreen?.();
      } else {
        await mount.requestFullscreen?.();
      }
    } catch (error) {
      console.warn("Không thể thay đổi chế độ toàn màn hình.", error);
    }
  };

  return (
    <section
      ref={mountRef}
      className={`vr-viewer__canvas${isDragging ? " is-dragging" : ""}`}
      tabIndex={0}
      role="application"
      aria-label="Không gian 360 độ của bàn. Kéo để nhìn xung quanh, cuộn để thu phóng, hoặc dùng các phím mũi tên."
      onKeyDown={handleKeyDown}
    >
      {viewerState === "loading" && (
        <div className="vr-viewer__status" role="status">
          <span className="vr-viewer__spinner" aria-hidden="true" />
          Đang dựng không gian 360°…
        </div>
      )}

      {viewerState === "error" && (
        <div className="vr-viewer__status is-error" role="alert">
          Trình duyệt không thể dựng ảnh 360°. Hãy bật tăng tốc phần cứng hoặc thử Chrome/Edge mới nhất.
        </div>
      )}

      <div className="vr-viewer__overlay">
        <div className="vr-viewer__badge">
          Kéo mọi hướng để quan sát • cuộn để thu phóng
        </div>
        <div className="vr-viewer__controls" aria-label="Điều khiển ảnh 360 độ">
          <button
            type="button"
            onClick={() => controllerRef.current?.zoomBy(-5)}
            aria-label="Phóng to"
            title="Phóng to"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => controllerRef.current?.zoomBy(5)}
            aria-label="Thu nhỏ"
            title="Thu nhỏ"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => controllerRef.current?.resetView()}
            aria-label="Đặt lại góc nhìn"
            title="Đặt lại góc nhìn"
          >
            ⟳
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
            title={isFullscreen ? "Thoát toàn màn hình" : "Xem toàn màn hình"}
          >
            {isFullscreen ? "↙" : "⛶"}
          </button>
        </div>
      </div>
    </section>
  );
}

const VRViewer = () => {
  const { tableId } = useParams();
  const location = useLocation();
  const { search } = location;
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState(null);
  const { openedInNewTab, returnTo, imageUrl: sharedImageUrl } =
    getTableVrViewerNavigation(search);

  useEffect(() => {
    setImageUrl(sharedImageUrl || loadTableVrImage(tableId));
  }, [sharedImageUrl, tableId]);

  const navigateBack = () => {
    if (location.key !== "default" || window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(returnTo || "/", { replace: true });
  };

  const handleCloseViewer = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      }
    } catch (error) {
      console.warn("Không thể thoát toàn màn hình trước khi rời trang.", error);
    }

    if (!openedInNewTab) {
      navigateBack();
      return;
    }

    try {
      window.opener?.focus?.();
    } catch {
      // Trình duyệt có thể chặn quyền truy cập cửa sổ mở trang này.
    }

    window.close();
    window.setTimeout(() => {
      if (window.closed) return;
      navigate(returnTo || "/", { replace: true });
    }, 120);
  };

  return (
    <main className="vr-viewer" aria-labelledby="vr-viewer-title">
      <header className="vr-viewer__header">
        <button
          type="button"
          className="vr-viewer__back"
          onClick={handleCloseViewer}
          aria-label={
            openedInNewTab
              ? "Đóng trang xem không gian 360 độ"
              : "Quay lại trang trước"
          }
          title={openedInNewTab ? "Đóng tab hiện tại" : "Quay lại trang trước"}
        >
          {openedInNewTab ? "× Đóng" : "← Quay lại"}
        </button>
        <h1 className="vr-viewer__title" id="vr-viewer-title">
          Không gian 360° — Bàn {tableId}
        </h1>
      </header>

      {!imageUrl ? (
        <section className="vr-viewer__empty" role="status" aria-live="polite">
          <h2>Chưa có ảnh 360° cho bàn này</h2>
          <p>
            Vào mục <b>Quản lý bàn</b> → mở <b>Hành động bàn</b> và tải ảnh
            panorama 360° lên để xem tại đây.
          </p>
          <p className="vr-viewer__hint">
            Ảnh mới được lưu trên máy chủ cục bộ giống avatar. Ảnh cũ chỉ lưu
            trong <b>Local Storage</b> vẫn cần mở bằng đúng trình duyệt đã upload.
          </p>
        </section>
      ) : (
        <SphericalPanorama imageUrl={imageUrl} />
      )}
    </main>
  );
};

export default VRViewer;
