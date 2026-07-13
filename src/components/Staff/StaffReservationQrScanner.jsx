import React, { useCallback, useEffect, useRef, useState } from "react";
import { gql } from "@apollo/client";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clipboard,
  Flashlight,
  PauseCircle,
  QrCode,
  RotateCcw,
  X,
} from "lucide-react";

import { apolloClient } from "@/apollo/client";
import { getReservationActionErrorMessage } from "@/utils/commerceActionErrorMessages";
import { getGraphQLErrorCode } from "@/utils/graphqlErrorUtils";
import { parseTableAccessQr } from "@/utils/tableQrAccess";
import "@/components/Customer/TableQrScanner/TableQrScannerPage.scss";

const DETECTION_INTERVAL_MS = 420;
const DUPLICATE_DETECTION_WINDOW_MS = 2200;

const CHECK_IN_RESERVATION = gql`
  mutation StaffReservationQrCheckIn($input: CheckInReservationInput!) {
    checkInReservation(input: $input) {
      id
      orderCode
      tableId
      tableCode
      tableName
      customerName
      partySize
      timeTo
      status
    }
  }
`;

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
        tableId: payload.tableId || null,
      };
    }
  } catch {
    // A signed table QR is handled separately.
  }
  return null;
};

const getErrorExtensions = (error) => {
  const graphError =
    error?.graphQLErrors?.[0] ||
    error?.errors?.[0] ||
    error?.networkError?.result?.errors?.[0] ||
    error;
  return graphError?.extensions || {};
};

const formatReservationTime = (value) => {
  if (!value) return "chưa xác định";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "chưa xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getCameraErrorMessage = (error) => {
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
    return "Chưa được cấp quyền camera. Hãy cấp quyền trong trình duyệt hoặc dán nội dung QR bên dưới.";
  }
  if (error?.name === "NotFoundError") {
    return "Không tìm thấy camera trên thiết bị. Bạn vẫn có thể dán nội dung QR bên dưới.";
  }
  if (error?.name === "NotReadableError") {
    return "Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng camera rồi thử lại.";
  }
  return "Không thể mở camera lúc này. Hãy thử lại hoặc dùng cách nhập mã thủ công.";
};

export default function StaffReservationQrScanner() {
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [pendingEarlyArrival, setPendingEarlyArrival] = useState(null);
  const [checkedInReservation, setCheckedInReservation] = useState(null);

  const stopCamera = useCallback(() => {
    if (frameRef.current != null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setTorchSupported(false);
    setTorchEnabled(false);
    setCameraState((current) =>
      current === "scanning" || current === "requesting" ? "idle" : current,
    );
  }, []);

  const completeCheckIn = useCallback((checkedIn, fallbackPayload) => {
    navigator.vibrate?.(40);
    setCheckedInReservation(checkedIn || null);
    setPendingEarlyArrival(null);
    setManualValue("");
    setFeedback({
      type: "success",
      message: `Đã nhận khách ${
        checkedIn?.orderCode || fallbackPayload?.orderCode || "đặt bàn"
      }${
        checkedIn?.tableName || checkedIn?.tableCode
          ? ` tại ${checkedIn.tableName || checkedIn.tableCode}`
          : ""
      }.`,
    });
  }, []);

  const performReservationCheckIn = useCallback(
    async (reservationPayload, confirmEarlyArrival = false) => {
      if (!reservationPayload?.reservationId || handlingPayloadRef.current) {
        return false;
      }

      handlingPayloadRef.current = true;
      setIsProcessing(true);
      stopCamera();
      setFeedback({
        type: "warning",
        message: confirmEarlyArrival
          ? "Đang xác nhận nhận khách đến sớm…"
          : "Đã nhận diện lịch đặt bàn. Đang kiểm tra giờ đến và bàn…",
      });

      try {
        const { data } = await apolloClient.mutate({
          mutation: CHECK_IN_RESERVATION,
          variables: {
            input: {
              reservationId: reservationPayload.reservationId,
              confirmEarlyArrival,
              note: confirmEarlyArrival
                ? "Nhân viên đã cân nhắc và xác nhận nhận khách đến sớm bằng QR đặt bàn."
                : "Nhân viên check-in bằng mã QR đặt bàn.",
            },
          },
        });
        completeCheckIn(data?.checkInReservation, reservationPayload);
        return true;
      } catch (error) {
        const code = getGraphQLErrorCode(error);
        const extensions = getErrorExtensions(error);

        if (code === "RESERVATION_CHECK_IN_TOO_EARLY" && !confirmEarlyArrival) {
          setPendingEarlyArrival({
            reservationPayload,
            orderCode: extensions.orderCode || reservationPayload.orderCode,
            customerName: extensions.customerName || null,
            tableCode: extensions.tableCode || null,
            reservationTime: extensions.reservationTime || null,
            earliestCheckInAt: extensions.earliestCheckInAt || null,
            minutesBeforeReservation: Number(
              extensions.minutesBeforeReservation || 0,
            ),
          });
          setFeedback({
            type: "warning",
            message:
              "Khách đến sớm hơn thời gian nhận thông thường. Cần nhân viên cân nhắc và xác nhận trước khi mở bàn.",
          });
          return false;
        }

        setPendingEarlyArrival(null);
        setFeedback({
          type: "error",
          message: getReservationActionErrorMessage(
            error,
            confirmEarlyArrival
              ? "Không thể xác nhận nhận khách đến sớm. Hãy kiểm tra trạng thái bàn."
              : "Không thể check-in lịch đặt bàn. Hãy kiểm tra trạng thái đặt bàn và cơ sở làm việc.",
          ),
        });
        return false;
      } finally {
        handlingPayloadRef.current = false;
        setIsProcessing(false);
      }
    },
    [completeCheckIn, stopCamera],
  );

  const openFromPayload = useCallback(
    async (rawPayload) => {
      const normalizedPayload = String(rawPayload || "").trim();
      if (!normalizedPayload) {
        setFeedback({
          type: "error",
          message: "Hãy dán nội dung mã QR trước khi xử lý.",
        });
        manualInputRef.current?.focus();
        return false;
      }

      const reservationPayload = parseReservationCheckInQr(normalizedPayload);
      if (reservationPayload) {
        setCheckedInReservation(null);
        return performReservationCheckIn(reservationPayload, false);
      }

      const tableAccess = parseTableAccessQr(normalizedPayload);
      if (tableAccess.ok) {
        stopCamera();
        window.location.assign(tableAccess.path);
        return true;
      }

      setFeedback({
        type: "error",
        message: "Mã QR không phải mã đặt bàn hoặc mã bàn hợp lệ của COHAN.",
      });
      return false;
    },
    [performReservationCheckIn, stopCamera],
  );

  const startCamera = useCallback(async () => {
    setFeedback(null);
    setCheckedInReservation(null);
    setPendingEarlyArrival(null);
    lastPayloadRef.current = { value: "", detectedAt: 0 };

    if (
      typeof window.BarcodeDetector !== "function" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setCameraState("unsupported");
      setFeedback({
        type: "warning",
        message:
          "Trình duyệt chưa hỗ trợ quét trực tiếp. Hãy dùng camera hệ thống hoặc dán nội dung QR bên dưới.",
      });
      return;
    }

    setCameraState("requesting");
    try {
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
      if (!videoRef.current) throw new Error("Camera preview unavailable");
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
              const recentDuplicate =
                lastPayloadRef.current.value === rawValue &&
                detectedAt - lastPayloadRef.current.detectedAt <
                  DUPLICATE_DETECTION_WINDOW_MS;
              if (!recentDuplicate) {
                lastPayloadRef.current = { value: rawValue, detectedAt };
                if (await openFromPayload(rawValue)) return;
              }
            }
          } catch {
            // Keep scanning after transient detector errors.
          }
        }
        frameRef.current = window.requestAnimationFrame(detectFrame);
      };
      frameRef.current = window.requestAnimationFrame(detectFrame);
    } catch (error) {
      stopCamera();
      setCameraState("error");
      setFeedback({ type: "warning", message: getCameraErrorMessage(error) });
    }
  }, [openFromPayload, stopCamera]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || !torchSupported) return;
    const next = !torchEnabled;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchEnabled(next);
    } catch {
      setTorchSupported(false);
      setTorchEnabled(false);
    }
  }, [torchEnabled, torchSupported]);

  const resetScanner = useCallback(() => {
    setPendingEarlyArrival(null);
    setCheckedInReservation(null);
    setFeedback(null);
    setManualValue("");
    setCameraState("idle");
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  return (
    <main className="staff-reservation-scanner-overlay table-qr-scanner">
      <div className="table-qr-scanner__ambient" aria-hidden="true" />
      <div className="table-qr-scanner__container">
        <div className="staff-reservation-qr-returnbar">
          <a href="/staff/orders">
            <ArrowLeft size={18} aria-hidden="true" />
            Quay lại khu nhân viên
          </a>
          <span>Tiếp nhận khách đặt bàn</span>
        </div>

        <header className="table-qr-scanner__intro">
          <p className="table-qr-scanner__eyebrow">Tiếp nhận khách đặt bàn</p>
          <h1>Quét QR check-in của khách</h1>
          <p>
            Hệ thống kiểm tra lịch đặt, giờ đến và quyền vận hành. Khách đến
            quá sớm sẽ cần nhân viên xác nhận trước khi mở bàn.
          </p>
        </header>

        <section className="table-qr-scanner__camera-card">
          <div
            className={`table-qr-scanner__viewport${
              cameraState === "scanning" ? " is-scanning" : ""
            }`}
          >
            <video
              ref={videoRef}
              className="table-qr-scanner__video"
              muted
              playsInline
              autoPlay
              disablePictureInPicture
              aria-label="Camera quét mã QR đặt bàn"
            />
            <div className="table-qr-scanner__camera-topbar">
              <span>
                <QrCode aria-hidden="true" /> Camera sau
              </span>
              <small>Không lưu hình ảnh</small>
            </div>
            {cameraState !== "scanning" ? (
              <div className="table-qr-scanner__camera-placeholder">
                <span aria-hidden="true">
                  <QrCode />
                </span>
                <strong>Sẵn sàng quét QR đặt bàn</strong>
                <p>Camera chỉ bật sau khi nhân viên cho phép.</p>
              </div>
            ) : null}
            <div className="table-qr-scanner__frame" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              {cameraState === "scanning" ? <span /> : null}
            </div>
            <span className="table-qr-scanner__camera-state" role="status">
              {cameraState === "requesting"
                ? "Đang xin quyền camera…"
                : cameraState === "scanning"
                  ? "Đang tìm mã QR"
                  : cameraState === "unsupported"
                    ? "Dùng cách nhập mã"
                    : "Camera đang tắt"}
            </span>
          </div>

          <div className="table-qr-scanner__camera-actions">
            {cameraState === "scanning" ? (
              <button
                type="button"
                className="table-qr-scanner__secondary-button"
                onClick={stopCamera}
              >
                <PauseCircle aria-hidden="true" /> Dừng camera
              </button>
            ) : (
              <button
                type="button"
                className="table-qr-scanner__primary-button"
                onClick={startCamera}
                disabled={cameraState === "requesting" || isProcessing}
              >
                <Camera aria-hidden="true" />
                {cameraState === "requesting"
                  ? "Đang mở camera…"
                  : "Mở camera quét QR"}
              </button>
            )}
            {cameraState === "scanning" && torchSupported ? (
              <button
                type="button"
                className="table-qr-scanner__secondary-button"
                onClick={toggleTorch}
                aria-pressed={torchEnabled}
              >
                <Flashlight aria-hidden="true" />
                {torchEnabled ? "Tắt đèn" : "Bật đèn"}
              </button>
            ) : null}
          </div>
        </section>

        {feedback ? (
          <div
            className={`table-qr-scanner__feedback table-qr-scanner__feedback--${feedback.type}`}
            role={feedback.type === "error" ? "alert" : "status"}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 aria-hidden="true" />
            ) : feedback.type === "error" ? (
              <X aria-hidden="true" />
            ) : (
              <AlertTriangle aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        ) : null}

        {checkedInReservation ? (
          <div className="staff-reservation-qr-success-actions">
            <a className="is-primary" href="/staff/orders">
              Mở khu order
            </a>
            <button type="button" onClick={resetScanner}>
              <RotateCcw size={17} aria-hidden="true" /> Quét mã tiếp theo
            </button>
          </div>
        ) : null}

        <details className="table-qr-scanner__manual">
          <summary className="table-qr-scanner__manual-copy">
            <Clipboard aria-hidden="true" />
            <span>
              <strong>Không dùng được camera?</strong>
              <small>Dán nội dung mã QR để xử lý thủ công.</small>
            </span>
          </summary>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              openFromPayload(manualValue);
            }}
          >
            <label htmlFor="staff-reservation-qr-value">Nội dung mã QR</label>
            <textarea
              ref={manualInputRef}
              id="staff-reservation-qr-value"
              rows={3}
              value={manualValue}
              onChange={(event) => setManualValue(event.target.value)}
              placeholder="Dán nội dung QR check-in đặt bàn"
            />
            <button
              type="submit"
              className="table-qr-scanner__manual-submit"
              disabled={isProcessing}
            >
              {isProcessing ? "Đang xử lý…" : "Kiểm tra mã"}
            </button>
          </form>
        </details>
      </div>

      {pendingEarlyArrival ? (
        <div className="staff-early-arrival-modal" role="presentation">
          <section
            className="staff-early-arrival-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-early-arrival-title"
          >
            <div className="staff-early-arrival-modal__icon" aria-hidden="true">
              <AlertTriangle />
            </div>
            <p className="staff-early-arrival-modal__eyebrow">
              Cần nhân viên xác nhận
            </p>
            <h2 id="staff-early-arrival-title">Khách đến sớm</h2>
            <p className="staff-early-arrival-modal__message">
              Lịch đặt lúc{" "}
              <strong>
                {formatReservationTime(pendingEarlyArrival.reservationTime)}
              </strong>
              {pendingEarlyArrival.minutesBeforeReservation > 0
                ? `, khách đang đến sớm khoảng ${pendingEarlyArrival.minutesBeforeReservation} phút.`
                : "."}{" "}
              Hãy kiểm tra bàn đã sẵn sàng và cân nhắc trước khi nhận khách.
            </p>
            <dl className="staff-early-arrival-modal__details">
              <div>
                <dt>Mã đặt bàn</dt>
                <dd>{pendingEarlyArrival.orderCode || "—"}</dd>
              </div>
              <div>
                <dt>Khách hàng</dt>
                <dd>{pendingEarlyArrival.customerName || "Khách đặt bàn"}</dd>
              </div>
              <div>
                <dt>Bàn</dt>
                <dd>{pendingEarlyArrival.tableCode || "Đang kiểm tra"}</dd>
              </div>
              <div>
                <dt>Mốc nhận thông thường</dt>
                <dd>
                  {formatReservationTime(
                    pendingEarlyArrival.earliestCheckInAt,
                  )}
                </dd>
              </div>
            </dl>
            <div className="staff-early-arrival-modal__actions">
              <button
                type="button"
                onClick={() => {
                  setPendingEarlyArrival(null);
                  setFeedback({
                    type: "warning",
                    message:
                      "Chưa nhận khách. Có thể quét lại khi gần đến giờ hoặc sau khi bàn sẵn sàng.",
                  });
                }}
                disabled={isProcessing}
              >
                Chưa nhận khách
              </button>
              <button
                type="button"
                className="is-primary"
                onClick={() =>
                  performReservationCheckIn(
                    pendingEarlyArrival.reservationPayload,
                    true,
                  )
                }
                disabled={isProcessing}
              >
                {isProcessing
                  ? "Đang nhận khách…"
                  : "Xác nhận nhận khách"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
