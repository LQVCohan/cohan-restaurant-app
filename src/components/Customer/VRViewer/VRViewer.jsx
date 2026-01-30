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

  const backgroundStyle = useMemo(() => {
    if (!imageUrl) return {};
    return {
      backgroundImage: `url(${imageUrl})`,
      backgroundPositionX: `${offset}%`,
    };
  }, [imageUrl, offset]);

  return (
    <div className="vr-viewer">
      <header className="vr-viewer__header">
        <button className="vr-viewer__back" onClick={() => navigate(-1)}>
          ← Quay lại
        </button>
        <div className="vr-viewer__title">VR 360° - Bàn {tableId}</div>
      </header>

      {!imageUrl ? (
        <div className="vr-viewer__empty">
          <h3>Chưa có ảnh 360° cho bàn này</h3>
          <p>
            Vào mục <b>Quản lý bàn</b> → mở <b>Hành động bàn</b> và tải ảnh
            360° lên để xem tại đây.
          </p>
          <p className="vr-viewer__hint">
            Ảnh được lưu trong <b>Local Storage</b> của trình duyệt hiện tại, nên
            chỉ xem được trên đúng máy đã upload.
          </p>
        </div>
      ) : (
        <div className="vr-viewer__canvas" ref={containerRef}>
          <div className="vr-viewer__panorama" style={backgroundStyle} />
          <div className="vr-viewer__overlay">
            <div className="vr-viewer__badge">
              Kéo để xoay ngang (panorama)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VRViewer;
