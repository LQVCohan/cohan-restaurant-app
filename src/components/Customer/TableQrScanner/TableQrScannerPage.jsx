import React, { useCallback, useEffect, useRef, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  ChevronDown,
  Clipboard,
  Link as LinkIcon,
  Moon,
  PauseCircle,
  ScanLine,
  ShieldCheck,
  Sun,
} from "lucide-react";

import useIsMobile from "@/hooks/useIsMobile";
import { parseTableAccessQr } from "@/utils/tableQrAccess";
import { getReservationActionErrorMessage } from "@/utils/commerceActionErrorMessages";

import "./TableQrScannerPage.scss";

const DETECTION_INTERVAL_MS = 420;
const DUPLICATE_DETECTION_WINDOW_MS = 2200;

const CHECK_IN_RESERVATION = gql`
  mutation ScanReservationCheckIn($input: CheckInReservationInput!) {
    checkInReservation(input: $input) {
      id
      orderCode
      tableId
      tableCode
      tableName
      status
    }
  }
`;

const getCameraErrorMessage = (error) => {
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
    return "Bạn chưa cho phép dùng camera. Hãy cấp quyền trong trình duyệt hoặc dán nội dung QR bên dưới.";
  }

  if (error?.name === "NotFoundError") {
    return "Không tìm thấy camera trên thiết bị này. Bạn vẫn có thể dán nội dung QR bên dưới.";
  }

  if (error?.name === "NotReadableError") {
    return "Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng camera rồi thử lại.";
  }

  if (error?.name === "OverconstrainedError") {
    return "Camera không đáp ứng cấu hình quét. Hãy thử lại hoặc dán nội dung QR bên dưới.";
  }

  return "Không thể mở camera lúc này. Hãy thử lại hoặc dán nội dung QR bên dưới.";
};

const parseReservationCheckInQr = (rawValue) => {
  try {
    const payload = JSON.parse(String(rawValue || "").trim());
    if (
      payload?.type === "COHAN_RESERVATION_CHECK_IN" &&
      typeof payload?.reservationId === "string" &&
      payload.reservationId.trim()
    ) {
      return {
        reservationId: payload.reservationId.trim(),
        orderCode: payload.orderCode || null,
      };
    }
  } catch {
    // A normal table QR is a signed URL rather than JSON.
  }
  return null;
};

export default function TableQrScannerPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const manualInputRef = useRef(null);
  const lastDetectionRef = useRef(0);
  const lastPayloadRef = useRef({ value: "", detectedAt: 0 });
  const handlingPayloadRef = useRef(false);
  const [cameraState, setCameraState] = useState("idle");
  const [manualValue, setManualValue] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [guideOpen, setGuideOpen] = useState(!isMobile);
  const [manualOpen, setManualOpen] = useState(!isMobile);
  const [checkInReservation] = useMutation(CHECK_IN_RESERVATION);

  useEffect(() => {
    setGuideOpen(!isMobile);
    setManualOpen(!isMobile);
  }, [isMobile]);

  const stopCamera = useCallback(() => {
    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setTorchSupported(false);
    setTorchEnabled(false);
    setCameraState((current) =>
      current === "scanning" || current === "requesting" ? "idle" : current,
    );
  }, []);

  const openFromPayload = useCallback(
    async (payload) => {
      const normalizedPayload = String(payload || "").trim();
      if (!normalizedPayload) {
        setFeedback({
          type: "error",
          message: "Hãy dán đường dẫn hoặc nội dung mã QR trước khi xử lý.",
        });
        setManualOpen(true);
        manualInputRef.current?.focus();
        window.setTimeout(() => manualInputRef.current?.focus(), 0);
        return false;
      }

      if (handlingPayloadRef.current) return false;

      const reservationPayload = parseReservationCheckInQr(normalizedPayload);
      if (reservationPayload) {
        handlingPayloadRef.current = true;
        setIsProcessing(true);
        stopCamera();
        setFeedback({
          type: "warning",
          message: "Đã nhận diện lịch đặt bàn. Đang xác nhận check-in…",
        });
        try {
          const { data } = await checkInReservation({
            variables: {
              input: {
                reservationId: reservationPayload.reservationId,
                note: "Nhân viên check-in bằng mã QR đặt bàn.",
              },
            },
          });
          const checkedIn = data?.checkInReservation;
          navigator.vibrate?.(40);
          setFeedback({
            type: "success",
            message: `Đã check-in ${checkedIn?.orderCode || reservationPayload.orderCode || "lịch đặt bàn"}${checkedIn?.tableCode || checkedIn?.tableName ? ` tại ${checkedIn.tableName || checkedIn.tableCode}` : ""}.`,
          });
          setManualValue("");
          return true;
        } catch (error) {
          setFeedback({
            type: "error",
            message: getReservationActionErrorMessage(
              error,
              "Không thể check-in lịch đặt bàn. Hãy kiểm tra quyền nhân viên và trạng thái đặt bàn.",
            ),
          });
          setManualOpen(true);
          return false;
        } finally {
          handlingPayloadRef.current = false;
          setIsProcessing(false);
        }
      }

      const result = parseTableAccessQr(normalizedPayload);
      if (!result.ok) {
        setFeedback({
          type: "error",
          message: "Mã QR không phải mã bàn hoặc mã check-in đặt bàn hợp lệ.",
        });
        return false;
      }

      stopCamera();
      navigator.vibrate?.(40);
      setFeedback({
        type: "success",
        message: "Đã nhận diện bàn. Đang mở thông tin…",
      });
      navigate(result.path);
      return true;
    },
    [checkInReservation, navigate, stopCamera],
  );

  const startCamera = useCallback(async () => {
    setFeedback(null);
    lastPayloadRef.current = { value: "", detectedAt: 0 };

    if (
      typeof window.BarcodeDetector !== "function" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraState("unsupported");
      setManualOpen(true);
      setFeedback({
        type: "warning",
        message:
          "Trình duyệt này chưa hỗ trợ quét QR trực tiếp. Hãy dùng camera của điện thoại hoặc dán nội dung QR bên dưới.",
      });
      return;
    }

    setCameraState("requesting");

    try {
      const supportedFormats = await window.BarcodeDetector.getSupportedFormats?.();
      if (supportedFormats && !supportedFormats.includes("qr_code")) {
        throw Object.assign(new Error("QR format unavailable"), {
          name: "NotSupportedError",
        });
      }

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
          aspectRatio: { ideal: 1 },
        },
      });

      streamRef.current = stream;
      const videoTrack = stream.getVideoTracks?.()[0];
      const capabilities = videoTrack?.getCapabilities?.();
      setTorchSupported(Boolean(capabilities?.torch));
      setTorchEnabled(false);

      if (!videoRef.current) {
        throw new Error("Camera preview unavailable");
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraState("scanning");

      const detectFrame = async (timestamp) => {
        if (!streamRef.current || !videoRef.current) return;

        if (timestamp - lastDetectionRef.current >= DETECTION_INTERVAL_MS) {
          lastDetectionRef.current = timestamp;

          try {
            const codes = await detector.detect(videoRef.current);
            const rawValue = codes.find((code) => code?.rawValue)?.rawValue;
            if (rawValue) {
              const detectedAt = Date.now();
              const isRecentDuplicate =
                lastPayloadRef.current.value === rawValue &&
                detectedAt - lastPayloadRef.current.detectedAt <
                  DUPLICATE_DETECTION_WINDOW_MS;

              if (!isRecentDuplicate) {
                lastPayloadRef.current = { value: rawValue, detectedAt };
                if (await openFromPayload(rawValue)) return;
              }
            }
          } catch {
            // A transient detector failure should not stop the live camera preview.
          }
        }

        frameRef.current = window.requestAnimationFrame(detectFrame);
      };

      frameRef.current = window.requestAnimationFrame(detectFrame);
    } catch (error) {
      stopCamera();
      setCameraState(error?.name === "NotSupportedError" ? "unsupported" : "error");
      setManualOpen(true);
      setFeedback({ type: "warning", message: getCameraErrorMessage(error) });
    }
  }, [openFromPayload, stopCamera]);

  const toggleTorch = useCallback(async () => {
    const videoTrack = streamRef.current?.getVideoTracks?.()[0];
    if (!videoTrack || !torchSupported) return;

    const nextEnabled = !torchEnabled;
    try {
      await videoTrack.applyConstraints({
        advanced: [{ torch: nextEnabled }],
      });
      setTorchEnabled(nextEnabled);
    } catch {
      setTorchSupported(false);
      setTorchEnabled(false);
      setFeedback({
        type: "warning",
        message: "Thiết bị không thể bật đèn hỗ trợ. Hãy tăng ánh sáng xung quanh.",
      });
    }
  }, [torchEnabled, torchSupported]);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") stopCamera();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [stopCamera]);

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    await openFromPayload(manualValue);
  };

  const handlePasteFromClipboard = async () => {
    setManualOpen(true);
    try {
      if (!navigator.clipboard?.readText) {
        throw new Error("Clipboard API unavailable");
      }
      const clipboardValue = await navigator.clipboard.readText();
      if (!clipboardValue.trim()) {
        throw new Error("Clipboard is empty");
      }
      setManualValue(clipboardValue);
      setFeedback(null);
      window.setTimeout(() => manualInputRef.current?.focus(), 0);
    } catch {
      setFeedback({
        type: "warning",
        message: "Không đọc được bộ nhớ tạm. Hãy chạm giữ ô nhập và chọn Dán.",
      });
      window.setTimeout(() => manualInputRef.current?.focus(), 0);
    }
  };

  const isCameraRunning = cameraState === "scanning";
  const isCameraRequesting = cameraState === "requesting";

  return (
    <main
      className="table-qr-scanner"
      aria-labelledby="table-qr-scanner-title"
      aria-busy={isProcessing}
    >
      <div className="table-qr-scanner__ambient" aria-hidden="true" />
      <div className="table-qr-scanner__container">
        <header className="table-qr-scanner__intro">
          <p className="table-qr-scanner__eyebrow">Quét QR tại bàn</p>
          <h1 id="table-qr-scanner-title">Đưa mã QR vào khung</h1>
          <p>
            COHAN tự nhận diện mã bàn và mã check-in đặt bàn. Hình ảnh camera
            không được lưu lại.
          </p>
        </header>

        <div className="table-qr-scanner__workspace">
          <section
            className="table-qr-scanner__camera-card"
            aria-label="Khu vực quét mã QR"
          >
            <div
              className={`table-qr-scanner__viewport${isCameraRunning ? " is-scanning" : ""}`}
            >
              <video
                ref={videoRef}
                className="table-qr-scanner__video"
                muted
                playsInline
                autoPlay
                disablePictureInPicture
                aria-label="Hình ảnh trực tiếp từ camera để quét mã QR"
              />

              <div className="table-qr-scanner__camera-topbar">
                <span>
                  <ScanLine aria-hidden="true" /> Camera sau
                </span>
                <small>
                  {isCameraRunning ? "Tự động nhận diện" : "Không lưu hình ảnh"}
                </small>
              </div>

              {!isCameraRunning && (
                <div className="table-qr-scanner__camera-placeholder">
                  <span aria-hidden="true">
                    <ScanLine />
                  </span>
                  <strong>Sẵn sàng quét mã COHAN</strong>
                  <p>Camera chỉ bật sau khi bạn cho phép.</p>
                </div>
              )}

              <div className="table-qr-scanner__frame" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                {isCameraRunning && <span />}
              </div>

              <span
                className="table-qr-scanner__camera-state"
                role="status"
                aria-live="polite"
              >
                {isCameraRequesting
                  ? "Đang xin quyền camera…"
                  : isCameraRunning
                    ? "Đang tìm mã QR"
                    : cameraState === "unsupported"
                      ? "Cần dùng cách nhập mã"
                      : "Camera đang tắt"}
              </span>
            </div>

            <div
              className={`table-qr-scanner__camera-actions${
                isCameraRunning && torchSupported ? " has-torch" : ""
              }`}
            >
              {isCameraRunning ? (
                <button
                  type="button"
                  className="table-qr-scanner__secondary-button"
                  onClick={stopCamera}
                >
                  <PauseCircle aria-hidden="true" />
                  Dừng camera
                </button>
              ) : (
                <button
                  type="button"
                  className="table-qr-scanner__primary-button"
                  onClick={startCamera}
                  disabled={isCameraRequesting || isProcessing}
                >
                  <Camera aria-hidden="true" />
                  {isCameraRequesting ? "Đang mở camera…" : "Mở camera quét QR"}
                </button>
              )}

              {isCameraRunning && torchSupported && (
                <button
                  type="button"
                  className="table-qr-scanner__secondary-button table-qr-scanner__torch-button"
                  onClick={toggleTorch}
                  aria-pressed={torchEnabled}
                >
                  {torchEnabled ? (
                    <Moon aria-hidden="true" />
                  ) : (
                    <Sun aria-hidden="true" />
                  )}
                  {torchEnabled ? "Tắt đèn" : "Bật đèn"}
                </button>
              )}
            </div>
          </section>

          <details
            className="table-qr-scanner__guide"
            open={guideOpen}
            onToggle={(event) => setGuideOpen(event.currentTarget.open)}
          >
            <summary>
              <span className="table-qr-scanner__guide-icon" aria-hidden="true">
                <ShieldCheck />
              </span>
              <span>
                <small>Hướng dẫn nhanh</small>
                <strong>Quét đúng ngay lần đầu</strong>
              </span>
              <ChevronDown aria-hidden="true" />
            </summary>
            <div className="table-qr-scanner__guide-body">
              <p>
                COHAN phân biệt mã truy cập bàn và mã check-in đặt bàn. Check-in
                chỉ thành công với tài khoản nhân viên có quyền phù hợp.
              </p>
              <ol>
                <li>
                  <span>1</span> Đưa mã QR vào giữa khung.
                </li>
                <li>
                  <span>2</span> Giữ thiết bị cách mã khoảng 15–25&nbsp;cm.
                </li>
                <li>
                  <span>3</span> Giữ yên đến khi điện thoại rung nhẹ.
                </li>
              </ol>
            </div>
          </details>
        </div>

        {feedback && (
          <div
            className={`table-qr-scanner__feedback table-qr-scanner__feedback--${feedback.type}`}
            role={feedback.type === "error" ? "alert" : "status"}
            aria-live={feedback.type === "error" ? "assertive" : "polite"}
          >
            {feedback.message}
          </div>
        )}

        <details
          className="table-qr-scanner__manual"
          open={manualOpen}
          onToggle={(event) => setManualOpen(event.currentTarget.open)}
        >
          <summary className="table-qr-scanner__manual-copy">
            <LinkIcon aria-hidden="true" />
            <span>
              <strong id="table-qr-manual-title">Không dùng được camera?</strong>
              <small>Dán nội dung mã để xử lý thủ công.</small>
            </span>
            <ChevronDown aria-hidden="true" />
          </summary>

          <form onSubmit={handleManualSubmit} noValidate>
            <div className="table-qr-scanner__manual-label-row">
              <label htmlFor="table-qr-address">Nội dung mã QR</label>
              <button type="button" onClick={handlePasteFromClipboard}>
                <Clipboard aria-hidden="true" />
                Dán mã
              </button>
            </div>
            <textarea
              ref={manualInputRef}
              id="table-qr-address"
              name="tableQrAddress"
              rows={3}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={manualValue}
              onChange={(event) => {
                setManualValue(event.target.value);
                if (feedback?.type === "error") setFeedback(null);
              }}
              placeholder="Dán đường dẫn bàn hoặc nội dung QR check-in"
              aria-describedby="table-qr-address-help"
            />
            <button
              type="submit"
              className="table-qr-scanner__manual-submit"
              disabled={isProcessing}
            >
              {isProcessing ? "Đang xử lý…" : "Xử lý mã"}
              <ArrowRight aria-hidden="true" />
            </button>
            <p id="table-qr-address-help">
              COHAN tự xác định loại mã và kiểm tra quyền trước khi thực hiện.
            </p>
          </form>
        </details>
      </div>
    </main>
  );
}
