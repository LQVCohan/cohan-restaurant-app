import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import {
  MAX_RESTAURANT_GALLERY_IMAGES,
  MAX_RESTAURANT_MEDIA_BYTES,
  clearRestaurantMedia,
  getRestaurantMediaUsageBytes,
  prepareRestaurantMediaFile,
  readRestaurantMedia,
  saveRestaurantMedia,
  subscribeRestaurantMedia,
} from "@/utils/restaurantMediaStorage";
import "./RestaurantMediaExperienceLauncher.scss";

const readManagerRestaurantId = () =>
  typeof window === "undefined"
    ? ""
    : window.localStorage.getItem("manager.selectedRestaurantId") || "";

const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getRouteContext = (pathname) => {
  const manager =
    pathname === "/manager/restaurants/categories" ||
    pathname === "/admin/restaurants/categories";
  const customerMatch = pathname.match(/^\/(?:preview\/)?restaurant\/([^/]+)$/);
  return {
    mode: manager ? "manager" : customerMatch ? "customer" : null,
    routeRestaurantId: customerMatch?.[1] || "",
  };
};

function PanoramaCanvas({ asset }) {
  const containerRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startOffset: 50 });
  const [offset, setOffset] = useState(50);

  useEffect(() => setOffset(50), [asset?.id]);

  if (!asset?.dataUrl) return null;

  const stopDrag = (event) => {
    dragRef.current.active = false;
    containerRef.current?.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div
      ref={containerRef}
      className="restaurant-media-panorama"
      tabIndex={0}
      role="img"
      aria-label="Ảnh panorama 360 độ của nhà hàng. Kéo ngang hoặc dùng phím mũi tên để quan sát."
      onPointerDown={(event) => {
        dragRef.current = { active: true, startX: event.clientX, startOffset: offset };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragRef.current.active) return;
        const width = event.currentTarget.offsetWidth || 1;
        const next = dragRef.current.startOffset + ((event.clientX - dragRef.current.startX) / width) * 100;
        setOffset(((next % 100) + 100) % 100);
      }}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onPointerLeave={(event) => dragRef.current.active && stopDrag(event)}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        setOffset((current) => ((current + (event.key === "ArrowLeft" ? -4 : 4)) % 100 + 100) % 100);
      }}
    >
      <div
        className="restaurant-media-panorama__image"
        style={{ backgroundImage: `url(${asset.dataUrl})`, backgroundPositionX: `${offset}%` }}
      />
      <span className="restaurant-media-panorama__hint">Kéo để xoay • dùng ← →</span>
    </div>
  );
}

function MediaModal({ mode, restaurantId, media, onChange, onClose }) {
  const galleryInputRef = useRef(null);
  const panoramaInputRef = useRef(null);
  const [tab, setTab] = useState(media.panorama ? "panorama" : "gallery");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const usageBytes = getRestaurantMediaUsageBytes(media);
  const usagePercent = Math.min(100, Math.round((usageBytes / MAX_RESTAURANT_MEDIA_BYTES) * 100));

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [busy, onClose]);

  const persist = (nextMedia, successMessage) => {
    try {
      const saved = saveRestaurantMedia(restaurantId, nextMedia);
      onChange(saved);
      setNotice({ tone: "success", text: successMessage });
      return true;
    } catch (error) {
      setNotice({ tone: "error", text: error.message || "Không thể lưu hình ảnh." });
      return false;
    }
  };

  const uploadGallery = async (files) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    const availableSlots = MAX_RESTAURANT_GALLERY_IMAGES - media.gallery.length;
    if (availableSlots <= 0) {
      setNotice({ tone: "error", text: `Chỉ lưu tối đa ${MAX_RESTAURANT_GALLERY_IMAGES} ảnh không gian.` });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const assets = [];
      for (const file of selected.slice(0, availableSlots)) {
        assets.push(await prepareRestaurantMediaFile(file));
      }
      persist(
        { ...media, gallery: [...media.gallery, ...assets] },
        `Đã thêm ${assets.length} ảnh không gian vào trình duyệt này.`,
      );
      setTab("gallery");
    } catch (error) {
      setNotice({ tone: "error", text: error.message || "Không thể xử lý ảnh." });
    } finally {
      setBusy(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const uploadPanorama = async (file) => {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    try {
      const panorama = await prepareRestaurantMediaFile(file, { panorama: true });
      if (persist({ ...media, panorama }, "Đã lưu ảnh 360° vào trình duyệt này.")) {
        setTab("panorama");
      }
    } catch (error) {
      setNotice({ tone: "error", text: error.message || "Không thể xử lý ảnh 360°." });
    } finally {
      setBusy(false);
      if (panoramaInputRef.current) panoramaInputRef.current.value = "";
    }
  };

  const removeGalleryImage = (assetId) => {
    persist(
      { ...media, gallery: media.gallery.filter((asset) => asset.id !== assetId) },
      "Đã xóa ảnh khỏi bộ sưu tập.",
    );
  };

  const removePanorama = () => {
    persist({ ...media, panorama: null }, "Đã xóa ảnh 360°.");
    setTab("gallery");
  };

  const hasGallery = media.gallery.length > 0;
  const hasPanorama = Boolean(media.panorama);

  return createPortal(
    <div className="restaurant-media-modal__backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="restaurant-media-modal" role="dialog" aria-modal="true" aria-labelledby="restaurant-media-title">
        <header className="restaurant-media-modal__header">
          <div>
            <span className="restaurant-media-modal__eyebrow">
              {mode === "manager" ? "TRUNG TÂM HÌNH ẢNH" : "KHÁM PHÁ KHÔNG GIAN"}
            </span>
            <h2 id="restaurant-media-title">
              {mode === "manager" ? "Ảnh nhà hàng & toàn cảnh 360°" : "Không gian nhà hàng"}
            </h2>
            <p>
              {mode === "manager"
                ? "Ảnh được nén và lưu miễn phí trong Local Storage của thiết bị hiện tại."
                : "Hình ảnh được cung cấp trên thiết bị đang sử dụng."}
            </p>
          </div>
          <button type="button" className="restaurant-media-modal__close" onClick={onClose} disabled={busy} aria-label="Đóng">
            ×
          </button>
        </header>

        <nav className="restaurant-media-tabs" aria-label="Loại hình ảnh">
          <button type="button" className={tab === "gallery" ? "is-active" : ""} onClick={() => setTab("gallery")}>
            Bộ sưu tập <span>{media.gallery.length}</span>
          </button>
          <button type="button" className={tab === "panorama" ? "is-active" : ""} onClick={() => setTab("panorama")}>
            Toàn cảnh 360° <span>{hasPanorama ? 1 : 0}</span>
          </button>
        </nav>

        {notice && <div className={`restaurant-media-notice is-${notice.tone}`} role="status">{notice.text}</div>}

        <div className="restaurant-media-modal__body">
          {tab === "gallery" && (
            <div className="restaurant-media-panel">
              {hasGallery ? (
                <div className="restaurant-media-gallery">
                  {media.gallery.map((asset, index) => (
                    <article className="restaurant-media-gallery__item" key={asset.id}>
                      <img src={asset.dataUrl} alt={`Không gian nhà hàng ${index + 1}`} />
                      <div className="restaurant-media-gallery__caption">
                        <span>{asset.name}</span>
                        {mode === "manager" && (
                          <button type="button" onClick={() => removeGalleryImage(asset.id)} disabled={busy}>Xóa</button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="restaurant-media-empty">
                  <strong>Chưa có ảnh không gian</strong>
                  <span>{mode === "manager" ? "Tải ảnh phòng ăn, khu VIP, sân vườn hoặc quầy bar." : "Nhà hàng chưa thêm bộ sưu tập trên thiết bị này."}</span>
                </div>
              )}

              {mode === "manager" && (
                <div className="restaurant-media-upload-card">
                  <input ref={galleryInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => uploadGallery(event.target.files)} />
                  <div>
                    <strong>Thêm ảnh không gian</strong>
                    <span>Tối đa {MAX_RESTAURANT_GALLERY_IMAGES} ảnh; hệ thống tự nén để tiết kiệm bộ nhớ.</span>
                  </div>
                  <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={busy || media.gallery.length >= MAX_RESTAURANT_GALLERY_IMAGES}>
                    {busy ? "Đang xử lý..." : "Chọn ảnh"}
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "panorama" && (
            <div className="restaurant-media-panel">
              {hasPanorama ? (
                <>
                  <PanoramaCanvas asset={media.panorama} />
                  <div className="restaurant-media-file-meta">
                    <div><strong>{media.panorama.name}</strong><span>{media.panorama.width} × {media.panorama.height}</span></div>
                    {mode === "manager" && <button type="button" onClick={removePanorama} disabled={busy}>Xóa ảnh 360°</button>}
                  </div>
                </>
              ) : (
                <div className="restaurant-media-empty restaurant-media-empty--panorama">
                  <strong>Chưa có ảnh toàn cảnh 360°</strong>
                  <span>{mode === "manager" ? "Nên dùng ảnh equirectangular tỷ lệ 2:1, ví dụ 4096 × 2048." : "Nhà hàng chưa thêm ảnh 360° trên thiết bị này."}</span>
                </div>
              )}

              {mode === "manager" && (
                <div className="restaurant-media-upload-card">
                  <input ref={panoramaInputRef} type="file" accept="image/*" hidden onChange={(event) => uploadPanorama(event.target.files?.[0])} />
                  <div>
                    <strong>{hasPanorama ? "Thay ảnh 360°" : "Tải ảnh 360°"}</strong>
                    <span>Ảnh sẽ được nén và giữ tỷ lệ gần 2:1 trước khi lưu.</span>
                  </div>
                  <button type="button" onClick={() => panoramaInputRef.current?.click()} disabled={busy}>
                    {busy ? "Đang xử lý..." : hasPanorama ? "Chọn ảnh khác" : "Chọn ảnh 360°"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {mode === "manager" && (
          <footer className="restaurant-media-modal__footer">
            <div className="restaurant-media-storage">
              <div><span>Dung lượng Local Storage</span><strong>{formatBytes(usageBytes)} / 8 MB</strong></div>
              <div className="restaurant-media-storage__track"><span style={{ width: `${usagePercent}%` }} /></div>
              <small>Chỉ hiển thị trên đúng trình duyệt/thiết bị đã tải ảnh. Không cần S3 và không phát sinh phí lưu trữ.</small>
            </div>
            {(hasGallery || hasPanorama) && (
              <button type="button" className="restaurant-media-danger" onClick={() => {
                if (!window.confirm("Xóa toàn bộ ảnh không gian và ảnh 360° của nhà hàng trên thiết bị này?")) return;
                clearRestaurantMedia(restaurantId);
                onChange(readRestaurantMedia(restaurantId));
                setNotice({ tone: "success", text: "Đã xóa toàn bộ hình ảnh cục bộ." });
                setTab("gallery");
              }} disabled={busy}>
                Xóa toàn bộ
              </button>
            )}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}

export default function RestaurantMediaExperienceLauncher() {
  const location = useLocation();
  const routeContext = useMemo(() => getRouteContext(location.pathname), [location.pathname]);
  const [managerRestaurantId, setManagerRestaurantId] = useState(readManagerRestaurantId);
  const restaurantId = routeContext.mode === "manager" ? managerRestaurantId : routeContext.routeRestaurantId;
  const [media, setMedia] = useState(() => readRestaurantMedia(restaurantId));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (routeContext.mode !== "manager") return undefined;
    const sync = () => setManagerRestaurantId(readManagerRestaurantId());
    const onScopeSelection = (event) => {
      if (event?.detail?.key === "manager.selectedRestaurantId") sync();
    };
    window.addEventListener("manager:scope-selection", onScopeSelection);
    window.addEventListener("storage", sync);
    sync();
    return () => {
      window.removeEventListener("manager:scope-selection", onScopeSelection);
      window.removeEventListener("storage", sync);
    };
  }, [routeContext.mode]);

  useEffect(() => {
    setMedia(readRestaurantMedia(restaurantId));
    setOpen(false);
    if (!restaurantId) return undefined;
    return subscribeRestaurantMedia(restaurantId, setMedia);
  }, [restaurantId]);

  if (!routeContext.mode) return null;

  const hasMedia = Boolean(media.panorama || media.gallery.length);
  if (routeContext.mode === "customer" && !hasMedia) return null;

  return (
    <>
      <button
        type="button"
        className={`restaurant-media-launcher is-${routeContext.mode}`}
        onClick={() => restaurantId && setOpen(true)}
        disabled={!restaurantId}
        title={!restaurantId ? "Hãy chọn chi nhánh trước" : undefined}
      >
        <span className="restaurant-media-launcher__icon" aria-hidden="true">360°</span>
        <span>
          <strong>{routeContext.mode === "manager" ? "Ảnh & không gian 360°" : "Khám phá không gian"}</strong>
          <small>
            {routeContext.mode === "manager"
              ? restaurantId ? `${media.gallery.length} ảnh • ${media.panorama ? "đã có 360°" : "chưa có 360°"}` : "Chọn chi nhánh để quản lý"
              : `${media.gallery.length} ảnh${media.panorama ? " • có 360°" : ""}`}
          </small>
        </span>
      </button>

      {open && restaurantId && (
        <MediaModal
          mode={routeContext.mode}
          restaurantId={restaurantId}
          media={media}
          onChange={setMedia}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
