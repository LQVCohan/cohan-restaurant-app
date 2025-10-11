import React from "react";

export default function RestaurantGallery({ images = [], onOpen }) {
  const items = images.length
    ? images
    : [
        "/images/gallery1.jpg",
        "/images/gallery2.jpg",
        "/images/gallery3.jpg",
        "/images/gallery4.jpg",
      ];

  return (
    <div className="card">
      <h2>📸 Hình Ảnh Không Gian</h2>
      <div className="gallery">
        {items.map((src, i) => (
          <div key={i} className="gallery-item" onClick={() => onOpen?.(i)}>
            <img src={src} alt={`space-${i + 1}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
