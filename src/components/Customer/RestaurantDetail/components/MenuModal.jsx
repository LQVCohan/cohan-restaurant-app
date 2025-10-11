import React from "react";

export default function MenuModal({ onClose }) {
  return (
    <div
      className="modal"
      onClick={(e) => e.target.classList.contains("modal") && onClose?.()}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2>📋 Menu Đầy Đủ</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div style={{ display: "grid", gap: "1rem" }}>
            <div className="card">
              <h3>🍜 Món Chính</h3>
              <ul>
                <li>Phở Bò Tái — 85,000đ</li>
                <li>Bún Bò Huế — 90,000đ</li>
                <li>Cơm Tấm Sườn Nướng — 75,000đ</li>
              </ul>
            </div>
            <div className="card">
              <h3>🥗 Khai Vị</h3>
              <ul>
                <li>Gỏi Cuốn — 45,000đ</li>
                <li>Bánh Mì Thịt Nướng — 35,000đ</li>
              </ul>
            </div>
            <div className="card">
              <h3>🥤 Đồ Uống</h3>
              <ul>
                <li>Cà Phê Sữa Đá — 25,000đ</li>
                <li>Trà Đá — Miễn phí</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
