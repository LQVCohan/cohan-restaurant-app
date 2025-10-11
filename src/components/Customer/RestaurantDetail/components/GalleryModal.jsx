import React, { useEffect, useState } from "react";

export default function GalleryModal({ images = [], index = 0, onClose }) {
  const items = images.length
    ? images
    : [
        "/images/gallery1.jpg",
        "/images/gallery2.jpg",
        "/images/gallery3.jpg",
        "/images/gallery4.jpg",
      ];
  const [i, setI] = useState(index);

  const prev = () => setI((i - 1 + items.length) % items.length);
  const next = () => setI((i + 1) % items.length);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, items.length]);

  return (
    <div
      className="modal"
      onClick={(e) => e.target.classList.contains("modal") && onClose?.()}
    >
      <div
        className="modal-content"
        style={{ maxWidth: "90vw", maxHeight: "90vh" }}
      >
        <div className="modal-header">
          <h2>📸 Hình Ảnh Nhà Hàng</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body" style={{ textAlign: "center" }}>
          <img
            src={items[i]}
            alt={`gallery-${i + 1}`}
            style={{ maxWidth: "100%", maxHeight: "60vh", borderRadius: 12 }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: ".75rem",
            }}
          >
            <button className="btn btn-secondary" onClick={prev}>
              ← Trước
            </button>
            <span style={{ color: "#64748b" }}>
              {i + 1} / {items.length}
            </span>
            <button className="btn btn-secondary" onClick={next}>
              Tiếp →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
