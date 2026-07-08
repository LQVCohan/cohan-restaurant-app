import React, { useEffect, useMemo, useState } from "react";
import "./PhotoGallery.scss";

const normalizePhoto = (photo, index) => {
  const url = typeof photo === "string" ? photo : photo?.url;
  if (!url) return null;
  return {
    url,
    caption: typeof photo === "object" ? photo?.caption || "" : "",
    alt: typeof photo === "object" ? photo?.alt || photo?.caption || "" : "",
    index,
  };
};

const PhotoGallery = ({ photos, restaurantName = "nhà hàng" }) => {
  const normalizedPhotos = useMemo(
    () => (Array.isArray(photos) ? photos : [])
      .map(normalizePhoto)
      .filter(Boolean),
    [photos],
  );
  const [currentIndex, setCurrentIndex] = useState(null);
  const [shareStatus, setShareStatus] = useState("");
  const selectedPhoto = currentIndex === null ? null : normalizedPhotos[currentIndex];

  const closeLightbox = () => setCurrentIndex(null);
  const openLightbox = (index) => {
    setShareStatus("");
    setCurrentIndex(index);
  };
  const nextPhoto = () => {
    if (!normalizedPhotos.length) return;
    setCurrentIndex((index) => ((index ?? 0) + 1) % normalizedPhotos.length);
  };
  const prevPhoto = () => {
    if (!normalizedPhotos.length) return;
    setCurrentIndex((index) => {
      const current = index ?? 0;
      return current === 0 ? normalizedPhotos.length - 1 : current - 1;
    });
  };

  useEffect(() => {
    if (!selectedPhoto) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowRight") nextPhoto();
      if (event.key === "ArrowLeft") prevPhoto();
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedPhoto, normalizedPhotos.length]);

  useEffect(() => {
    if (!shareStatus) return undefined;
    const timer = window.setTimeout(() => setShareStatus(""), 2500);
    return () => window.clearTimeout(timer);
  }, [shareStatus]);

  const sharePhoto = async () => {
    if (!selectedPhoto?.url) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Hình ảnh ${restaurantName}`,
          text: selectedPhoto.caption || `Xem hình ảnh của ${restaurantName}`,
          url: selectedPhoto.url,
        });
        setShareStatus("Đã mở tùy chọn chia sẻ.");
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(selectedPhoto.url);
        setShareStatus("Đã sao chép liên kết hình ảnh.");
      }
    } catch {
      // Ignore cancelled native share dialogs and clipboard permission failures.
    }
  };

  if (normalizedPhotos.length === 0) {
    return (
      <div className="photo-gallery tab-panel-shell">
        <div className="gallery-header">
          <p className="section-eyebrow">Hình ảnh</p>
          <h2 className="gallery-title">Thư viện ảnh</h2>
          <p className="gallery-subtitle">Khám phá không gian nhà hàng qua hình ảnh do nhà hàng cập nhật.</p>
        </div>
        <div className="gallery-empty empty-state-card empty-gallery-shell">
          <span className="empty-state-icon" aria-hidden="true">📸</span>
          <h3 className="empty-state-title">Chưa có hình ảnh</h3>
          <p className="empty-state-description">Nhà hàng chưa cập nhật thư viện ảnh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-gallery tab-panel-shell">
      <div className="gallery-header">
        <p className="section-eyebrow">Hình ảnh</p>
        <h2 className="gallery-title">Thư viện ảnh</h2>
        <p className="gallery-subtitle">
          Khám phá không gian và món ăn tại nhà hàng ({normalizedPhotos.length} ảnh)
        </p>
      </div>

      <div className="gallery-grid">
        {normalizedPhotos.map((photo, index) => (
          <button
            key={`${photo.url}-${index}`}
            type="button"
            className={`gallery-item ${index === 0 && normalizedPhotos.length > 3 ? "gallery-item--featured" : ""}`}
            onClick={() => openLightbox(index)}
            aria-label={`Mở ảnh ${index + 1} của ${restaurantName}`}
          >
            <img
              src={photo.url}
              alt={photo.alt || `Ảnh ${index + 1} của ${restaurantName}`}
              loading="lazy"
            />
            <div className="gallery-overlay" aria-hidden="true">
              <div className="gallery-overlay-content">
                <span className="gallery-icon">🔍</span>
                <span className="gallery-text">Xem chi tiết</span>
              </div>
            </div>
            {photo.caption && (
              <div className="gallery-caption"><span>{photo.caption}</span></div>
            )}
          </button>
        ))}
      </div>

      {selectedPhoto && (
        <div className="lightbox-overlay" onClick={closeLightbox} role="presentation">
          <div
            className="lightbox-container"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Ảnh ${currentIndex + 1} của ${restaurantName}`}
          >
            <button
              type="button"
              className="lightbox-close"
              onClick={closeLightbox}
              aria-label="Đóng thư viện ảnh"
            >
              ✕
            </button>

            {normalizedPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox-nav lightbox-nav--prev"
                  onClick={prevPhoto}
                  aria-label="Ảnh trước"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="lightbox-nav lightbox-nav--next"
                  onClick={nextPhoto}
                  aria-label="Ảnh tiếp theo"
                >
                  →
                </button>
              </>
            )}

            <div className="lightbox-content">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.alt || `Ảnh ${currentIndex + 1} của ${restaurantName}`}
                className="lightbox-image"
              />

              <div className="lightbox-info">
                <div className="lightbox-counter">
                  {currentIndex + 1} / {normalizedPhotos.length}
                </div>
                {selectedPhoto.caption && (
                  <div className="lightbox-caption">{selectedPhoto.caption}</div>
                )}
                <div className="lightbox-actions">
                  <button
                    type="button"
                    className="lightbox-action"
                    onClick={() => window.open(selectedPhoto.url, "_blank", "noopener,noreferrer")}
                  >
                    Mở ảnh gốc
                  </button>
                  <button type="button" className="lightbox-action" onClick={sharePhoto}>
                    Chia sẻ
                  </button>
                </div>
                <p className="gallery-share-status" role="status" aria-live="polite">
                  {shareStatus}
                </p>
              </div>
            </div>

            {normalizedPhotos.length > 1 && (
              <div className="lightbox-thumbnails" aria-label="Danh sách ảnh">
                {normalizedPhotos.map((photo, index) => (
                  <button
                    type="button"
                    key={`${photo.url}-thumbnail-${index}`}
                    className={`thumbnail ${index === currentIndex ? "thumbnail--active" : ""}`}
                    onClick={() => setCurrentIndex(index)}
                    aria-label={`Chọn ảnh ${index + 1}`}
                    aria-current={index === currentIndex ? "true" : undefined}
                  >
                    <img src={photo.url} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
