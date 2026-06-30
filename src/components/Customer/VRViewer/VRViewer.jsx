import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { loadTableVrImage } from "@/utils/vrStorage";
import "./VRViewer.scss";

const clampPercentage = (value) => {
  const next = value % 100;
  return next < 0 ? next + 100 : next;
};

const VRViewer = () => {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState(50);
  const dragState = useRef({
    startX: 0,
    startOffset: 50,
  });

  useEffect(() => {
    setImageUrl(loadTableVrImage(tableId));
  }, [tableId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !imageUrl) return undefined;

    const handlePointerDown = (event) => {
      setIsDragging(true);
      dragState.current = {
        startX: event.clientX,
        startOffset: offset,
      };
      container.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event) => {
      if (!isDragging) return;
      const width = container.offsetWidth || 1;
      const deltaX = event.clientX - dragState.current.startX;
      const deltaPercent = (deltaX / width) * 100;
      setOffset(clampPercentage(dragState.current.startOffset + deltaPercent));
    };

    const handlePointerUp = (event) => {
      setIsDragging(false);
      container.releasePointerCapture?.(event.pointerId);
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("pointerleave", handlePointerUp);

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointerleave", handlePointerUp);
    };
  }, [imageUrl, isDragging, offset]);

  const handleCanvasKeyDown = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setOffset((current) => clampPercentage(current + (event.key === "ArrowLeft" ? -4 : 4)));
  };

  const backgroundStyle = useMemo(() => {
    if (!imageUrl) return {};
    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundPositionX: `${offset}%`,
    };
  }, [imageUrl, offset]);

  return (
    <main className="vr-viewer" aria-labelledby="vr-viewer-title">
      <header className="vr-viewer__header">
        <button type="button" className="vr-viewer__back" onClick={() => navigate(-1)}>
          ← Quay lại
        </button>
        <h1 className="vr-viewer__title" id="vr-viewer-title">VR 360° - Bàn {tableId}</h1>
      </header>

      {!imageUrl ? (
        <section className="vr-viewer__empty" role="status" aria-live="polite">
          <h2>Chưa có ảnh 360° cho bàn này</h2>
          <p>
            Vào mục <b>Quản lý bàn</b> → mở <b>Hành động bàn</b> và tải ảnh
            360° lên để xem tại đây.
          </p>
          <p className="vr-viewer__hint">
            Ảnh được lưu trong <b>Local Storage</b> của trình duyệt hiện tại, nên
            chỉ xem được trên đúng máy đã upload.
          </p>
        </section>
      ) : (
        <section
          className={`vr-viewer__canvas ${isDragging ? "is-dragging" : ""}`}
          ref={containerRef}
          tabIndex={0}
          role="img"
          aria-label="Ảnh panorama 360 độ của bàn. Kéo chuột hoặc dùng phím mũi tên trái phải để xoay ngang."
          onKeyDown={handleCanvasKeyDown}
        >
          <div className="vr-viewer__panorama" style={backgroundStyle} aria-hidden="true" />
          <div className="vr-viewer__overlay" aria-hidden="true">
            <div className="vr-viewer__badge">
              Kéo hoặc dùng ← → để xoay ngang
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

export default VRViewer;
