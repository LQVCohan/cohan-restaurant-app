import React, { useState } from "react";
import "./PhotoGallery.scss";

const PhotoGallery = ({ photos }) => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openLightbox = (photo, index) => {
    setSelectedPhoto(photo);
    setCurrentIndex(index);
  };

  const closeLightbox = () => {
    setSelectedPhoto(null);
  };

  const nextPhoto = () => {
    const nextIndex = (currentIndex + 1) % photos.length;
    setCurrentIndex(nextIndex);
    setSelectedPhoto(photos[nextIndex]);
  };

  const prevPhoto = () => {
    const prevIndex = currentIndex === 0 ? photos.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIndex);
    setSelectedPhoto(photos[prevIndex]);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") nextPhoto();
    if (e.key === "ArrowLeft") prevPhoto();
  };

  React.useEffect(() => {
    if (selectedPhoto) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [selectedPhoto, currentIndex]);

  if (!photos || photos.length === 0) {
    return (
      <div className="photo-gallery">
        <div className="gallery-empty">
          <span className="empty-icon">📸</span>
          <h3>Chưa có hình ảnh</h3>
          <p>Nhà hàng chưa cập nhật thư viện ảnh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-gallery">
      <div className="gallery-header">
        <h2 className="gallery-title">📸 Thư viện ảnh</h2>
        <p className="gallery-subtitle">
          Khám phá không gian và món ăn tại nhà hàng ({photos.length} ảnh)
        </p>
      </div>

      <div className="gallery-grid">
        {photos.map((photo, index) => (
          <div
            key={index}
            className={`gallery-item ${
              index === 0 ? "gallery-item--featured" : ""
            }`}
            onClick={() => openLightbox(photo, index)}
          >
            <img
              src={photo.url || photo}
              alt={photo.caption || `Ảnh ${index + 1}`}
            />
            <div className="gallery-overlay">
              <div className="gallery-overlay-content">
                <span className="gallery-icon">🔍</span>
                <span className="gallery-text">Xem chi tiết</span>
              </div>
            </div>
            {photo.caption && (
              <div className="gallery-caption">
                <span>{photo.caption}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* View All Button */}
      {photos.length > 12 && (
        <div className="gallery-actions">
          <button className="btn btn--secondary">
            📸 Xem tất cả {photos.length} ảnh
          </button>
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <div
            className="lightbox-container"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="lightbox-close" onClick={closeLightbox}>
              ✕
            </button>

            <button
              className="lightbox-nav lightbox-nav--prev"
              onClick={prevPhoto}
            >
              ←
            </button>

            <button
              className="lightbox-nav lightbox-nav--next"
              onClick={nextPhoto}
            >
              →
            </button>

            <div className="lightbox-content">
              <img
                src={selectedPhoto.url || selectedPhoto}
                alt={selectedPhoto.caption || `Ảnh ${currentIndex + 1}`}
                className="lightbox-image"
              />

              <div className="lightbox-info">
                <div className="lightbox-counter">
                  {currentIndex + 1} / {photos.length}
                </div>

                {selectedPhoto.caption && (
                  <div className="lightbox-caption">
                    {selectedPhoto.caption}
                  </div>
                )}

                <div className="lightbox-actions">
                  <button
                    className="lightbox-action"
                    onClick={() =>
                      window.open(selectedPhoto.url || selectedPhoto, "_blank")
                    }
                  >
                    📥 Tải xuống
                  </button>
                  <button className="lightbox-action">📤 Chia sẻ</button>
                </div>
              </div>
            </div>

            {/* Thumbnail Navigation */}
            <div className="lightbox-thumbnails">
              {photos.map((photo, index) => (
                <button
                  key={index}
                  className={`thumbnail ${
                    index === currentIndex ? "thumbnail--active" : ""
                  }`}
                  onClick={() => {
                    setCurrentIndex(index);
                    setSelectedPhoto(photos[index]);
                  }}
                >
                  <img
                    src={photo.url || photo}
                    alt={`Thumbnail ${index + 1}`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
