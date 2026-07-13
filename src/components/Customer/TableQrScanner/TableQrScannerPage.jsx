import React, { useCallback, useEffect, useRef, useState } from "react";
import { gql, useMutation } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  Link as LinkIcon,
  PauseCircle,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

import { parseTableAccessQr } from "@/utils/tableQrAccess";
import { getReservationActionErrorMessage } from "@/utils/commerceActionErrorMessages";

import "./TableQrScannerPage.scss";

const DETECTION_INTERVAL_MS = 420;

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
  if (error?.name === "NotAllowedError") {
    return "Bạn chưa cho phép dùng camera. Hãy cấp quyền trong trình duyệt hoặc dán nội dung QR bên dưới.";
  }

  if (error?.name === "NotFoundError") {
    return "Không tìm thấy camera trên thiết bị này. Bạn vẫn có thể dán nội dung QR bên dưới.";
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
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const lastDetectionRef = useRef(0);
  const handlingPayloadRef = useRef(false);
  const [cameraState, setCameraState] = useState("idle");
  const [manualValue, setManualValue] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [checkInReservation] = useMutation(CHECK_IN_RESERVATION);

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

    setCameraState((current) =>
      current === "scanning" || current === "requesting" ? "idle" : current,
    );
  }, []);

  const openFromPayload = useCallback(
    async (payload) => {
      if (handlingPayloadRef.current) return false;

      const reservationPayload = parseReservationCheckInQr(payload);
      if (reservationPayload) {
        handlingPayloadRef.current = true;
        stopCamera();
        setFeedback({ type: "warning", message: "Đã nhận diện lịch đặt bàn. Đang xác nhận check-in…" });
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
          return false;
        } finally {
          handlingPayloadRef.current = false;
        }
      }

      const result = parseTableAccessQr(payload);
      if (!result.ok) {
        setFeedback({
          type: "error",
          message: "Mã QR không phải mã bàn hoặc mã check-in đặt bàn hợp lệ.",
        });
        return false;
      }

      stopCamera();
      setFeedback({ type: "success", message: "Đã nhận diện bàn. Đang mở thông tin…" });
      navigate(result.path);
      return true;
    },
    [checkInReservation, navigate, stopCamera],
  );

  const startCamera = useCallback(async () => {
    setFeedback(null);

    if (
      typeof window.BarcodeDetector !== "function" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraState("unsupported");
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
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
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
            if (rawValue && await openFromPayload(rawValue)) return;
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
      setFeedback({ type: "warning", message: getCameraErrorMessage(error) });
    }
  }, [openFromPayload, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    await openFromPayload(manualValue);
  };

  const isCameraRunning = cameraState === "scanning";
  const isCameraRequesting = cameraState === "requesting";

  return (
    <main className="table-qr-scanner" aria-labelledby="table-qr-scanner-title">
      <div className="table-qr-scanner__ambient" aria-hidden="true" />
      <div className="table-qr-scanner__container">
        <header className="table-qr-scanner__intro">
          <p className="table-qr-scanner__eyebrow">Quét mã COHAN</p>
          <h1 id="table-qr-scanner-title">Quét mã bàn hoặc check-in đặt bàn</h1>
          <p>
            Khách có thể quét mã trên bàn. Nhân viên có quyền đặt bàn có thể quét
            mã check-in trong lịch sử đặt bàn của khách.
          </p>
        </header>

        <div className="table-qr-scanner__workspace">
          <section className="table-qr-scanner__camera-card" aria-label="Khu vực quét mã QR">
            <div className={`table-qr-scanner__viewport${isCameraRunning ? " is-scanning" : ""}`}>
              <video
                ref={videoRef}
                className="table-qr-scanner__video"
                muted
                playsInline
                aria-label="Hình ảnh trực tiếp từ camera để quét mã QR"
              />

              {!isCameraRunning && (
                <div className="table-qr-scanner__camera-placeholder">
                  <span aria-hidden="true"><ScanLine /></span>
                  <strong>Sẵn sàng nhận diện mã COHAN</strong>
                  <p>Camera chỉ bật sau khi bạn cho phép.</p>
                </div>
              )}

              <div className="table-qr-scanner__frame" aria-hidden="true">
                <i /><i /><i /><i />
                {isCameraRunning && <span />}
              </div>

              <span className="table-qr-scanner__camera-state" role="status" aria-live="polite">
                {isCameraRequesting
                  ? "Đang xin quyền camera…"
                  : isCameraRunning
                    ? "Đang quét mã QR"
                    : "Camera đang tắt"}
              </span>
            </div>

            <div className="table-qr-scanner__camera-actions">
              {isCameraRunning ? (
                <button type="button" className="table-qr-scanner__secondary-button" onClick={stopCamera}>
                  <PauseCircle aria-hidden="true" />
                  Dừng camera
                </button>
              ) : (
                <button
                  type="button"
                  className="table-qr-scanner__primary-button"
                  onClick={startCamera}
                  disabled={isCameraRequesting}
                >
                  <Camera aria-hidden="true" />
                  {isCameraRequesting ? "Đang mở camera…" : "Mở camera quét QR"}
                </button>
              )}
            </div>
          </section>

          <aside className="table-qr-scanner__guide" aria-label="Hướng dẫn quét mã COHAN">
            <div className="table-qr-scanner__guide-icon" aria-hidden="true">
              <ShieldCheck />
            </div>
            <p className="table-qr-scanner__guide-kicker">Truy cập an toàn</p>
            <h2>Nhận đúng loại mã</h2>
            <p>
              COHAN phân biệt mã truy cập bàn và mã check-in đặt bàn. Việc check-in
              chỉ thành công với tài khoản nhân viên có quyền phù hợp.
            </p>
            <ol>
              <li><span>1</span> Đưa mã QR vào giữa khung.</li>
              <li><span>2</span> Giữ thiết bị cách mã khoảng 15–25&nbsp;cm.</li>
              <li><span>3</span> Chờ thông báo mở bàn hoặc check-in thành công.</li>
            </ol>
          </aside>
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

        <section className="table-qr-scanner__manual" aria-labelledby="table-qr-manual-title">
          <div className="table-qr-scanner__manual-copy">
            <LinkIcon aria-hidden="true" />
            <div>
              <h2 id="table-qr-manual-title">Không dùng được camera?</h2>
              <p>Dán đường dẫn mã bàn hoặc nội dung mã check-in để xử lý thủ công.</p>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} noValidate>
            <label htmlFor="table-qr-address">Nội dung mã QR</label>
            <div className="table-qr-scanner__input-row">
              <input
                id="table-qr-address"
                name="tableQrAddress"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="Dán đường dẫn bàn hoặc nội dung QR check-in"
                aria-describedby="table-qr-address-help"
              />
              <button type="submit">
                Xử lý mã
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
            <p id="table-qr-address-help">
              COHAN sẽ tự xác định loại mã và kiểm tra quyền trước khi thực hiện.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
