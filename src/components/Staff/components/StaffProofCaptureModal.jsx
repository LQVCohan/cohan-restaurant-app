import React, { useEffect, useMemo, useRef, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { Camera, Upload, X, RotateCcw, Trash2 } from "lucide-react";
import { useAvatarUploadLocal } from "@/hooks/useAvatarUploadLocal";
import { prepareOrderProofImage } from "@/utils/orderProofImage";
import { normalizeProofImages } from "@/utils/orderProofRules";
import "./StaffProofCaptureModal.scss";

const MAX_PROOF_IMAGES = 5;

const UPLOAD_ORDER_ITEM_PROOF = gql`
  mutation StaffUploadOrderItemProof($input: UploadOrderItemProofInput!) {
    uploadOrderItemProof(input: $input) {
      order {
        id
        orderCode
        currentStatus
        items {
          _id
          proofImages
        }
      }
    }
  }
`;

export default function StaffProofCaptureModal({
  open,
  item,
  onClose,
  onSave,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  const [cameraSupported, setCameraSupported] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingProof, setSavingProof] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [proofImages, setProofImages] = useState([]);

  const { upload } = useAvatarUploadLocal();
  const [uploadOrderItemProof] = useMutation(UPLOAD_ORDER_ITEM_PROOF);

  const title = useMemo(() => item?.name || "Món ăn", [item?.name]);
  const isPersistedOrderItem = Boolean(
    item?.persisted && item?.orderId && (item?.orderItemId || item?.id),
  );

  const stopStream = () => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) return undefined;

    setProofImages(normalizeProofImages(item?.proofImages));
    setCameraError("");
    setUploadProgress(0);
    setSavingProof(false);

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
      setCameraError("Trình duyệt không hỗ trợ camera, vui lòng dùng fallback.");
      return undefined;
    }

    setCameraSupported(true);
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play?.().catch(() => {});
        }
      })
      .catch(() => {
        setCameraError(
          "Không thể mở camera (có thể do bị từ chối quyền). Dùng fallback để chụp ảnh.",
        );
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, item?.id]);

  const uploadProofFile = async (file) => {
    if (proofImages.length >= MAX_PROOF_IMAGES) {
      alert(`Mỗi món chỉ lưu tối đa ${MAX_PROOF_IMAGES} ảnh minh chứng.`);
      return;
    }

    setUploading(true);
    try {
      const evidenceFile = await prepareOrderProofImage(file);
      const url = await upload(evidenceFile, (p) => setUploadProgress(p));
      setProofImages((prev) => normalizeProofImages([...prev, url]));
    } catch (error) {
      alert(error?.message || "Upload ảnh thất bại");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCaptureFrame = async () => {
    if (!videoRef.current || !canvasRef.current || uploading || savingProof) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      alert("Camera chưa sẵn sàng, vui lòng thử lại.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `staff-proof-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      await uploadProofFile(file);
    }, "image/jpeg", 0.92);
  };

  const handleFallbackInput = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadProofFile(file);
    event.target.value = "";
  };

  const handleSave = async () => {
    const cleaned = normalizeProofImages(proofImages);
    if (!cleaned.length) {
      alert("Vui lòng chụp hoặc tải lên ít nhất một ảnh minh chứng.");
      return;
    }

    setSavingProof(true);
    try {
      if (isPersistedOrderItem) {
        await uploadOrderItemProof({
          variables: {
            input: {
              restaurantId: item.restaurantId || undefined,
              orderId: item.orderId,
              orderItemId: item.orderItemId || item.id,
              proofImages: cleaned,
              note: "Staff updated order item proof images.",
            },
          },
        });
      }
      onSave(cleaned);
    } catch (error) {
      alert(error?.message || "Không thể lưu ảnh minh chứng vào đơn.");
    } finally {
      setSavingProof(false);
    }
  };

  if (!open) return null;

  return (
    <div className="staff-proof-overlay" onClick={onClose}>
      <div className="staff-proof-modal" onClick={(e) => e.stopPropagation()}>
        <header className="staff-proof-header">
          <div>
            <h3>📷 Ảnh minh chứng</h3>
            <p>{title}</p>
          </div>
          <button type="button" className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="staff-proof-camera">
          {cameraSupported && !cameraError ? (
            <video ref={videoRef} autoPlay muted playsInline />
          ) : (
            <div className="camera-fallback-text">{cameraError}</div>
          )}
          <canvas ref={canvasRef} hidden />
        </div>

        {uploading && (
          <div className="uploading-state">Đang tải ảnh... {uploadProgress}%</div>
        )}
        {savingProof && (
          <div className="uploading-state">Đang lưu ảnh minh chứng vào đơn...</div>
        )}

        <div className="staff-proof-actions">
          <button type="button" onClick={handleCaptureFrame} disabled={uploading || savingProof}>
            <Camera size={16} /> Chụp ảnh
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              uploading || savingProof || proofImages.length >= MAX_PROOF_IMAGES
            }
          >
            <Upload size={16} /> Fallback camera/file
          </button>
          <button
            type="button"
            onClick={() => {
              stopStream();
              setCameraError("");
            }}
            disabled={savingProof}
          >
            <RotateCcw size={16} /> Tắt camera
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*"
            capture="environment"
            onChange={handleFallbackInput}
          />
        </div>

        <div className="staff-proof-gallery">
          {proofImages.length === 0 ? (
            <p>Chưa có ảnh minh chứng.</p>
          ) : (
            proofImages.map((src, idx) => (
              <div key={`${src}_${idx}`} className="proof-thumb-item">
                <img src={src} alt={`proof-${idx}`} />
                <button
                  type="button"
                  disabled={savingProof}
                  onClick={() =>
                    setProofImages((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <footer className="staff-proof-footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={savingProof}>
            Huỷ
          </button>
          <button
            type="button"
            className="btn-save"
            onClick={handleSave}
            disabled={uploading || savingProof}
          >
            {savingProof ? "Đang lưu..." : `Lưu ảnh (${proofImages.length})`}
          </button>
        </footer>
      </div>
    </div>
  );
}
