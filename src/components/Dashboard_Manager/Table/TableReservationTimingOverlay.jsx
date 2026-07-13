import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";
import "./TableReservationTimingOverlay.scss";

const STORAGE_KEY = "manager.selectedRestaurantId";
const SCOPE_EVENT = "manager:scope-selection";

const TABLE_RESERVATION_TIMING = gql`
  query TableReservationTimingOverlay($restaurantId: ID!) {
    tables(restaurantId: $restaurantId) {
      id
      code
      status
      nextReservationAt
      reservationEarliestCheckInAt
      reservationCanCheckIn
      reservationGraceEndsAt
      reservationPhase
      reservationId
      reservationOrderCode
      reservationStatus
      reservationCustomerName
      reservationCustomerPhone
      reservationCustomerEmail
      reservationPartySize
      reservationDepositAmount
      reservationTableDepositAmount
      reservationMenuDepositAmount
      reservationDepositStatus
      reservationDepositAppliedAmount
    }
  }
`;

const CHECK_IN_RESERVATION = gql`
  mutation CheckInReservationFromTableCard($input: CheckInReservationInput!) {
    checkInReservation(input: $input) {
      id
      status
      tableId
      customerName
      customerPhone
      customerEmail
      partySize
      depositAmount
      depositStatus
      linkedMenuSubtotal
      updatedAt
    }
  }
`;

const timeLabel = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const moneyLabel = (value) =>
  `${Math.max(0, Number(value || 0)).toLocaleString("vi-VN")}đ`;

const countdownLabel = (value, now) => {
  const end = value ? new Date(value).getTime() : 0;
  const remaining = Math.max(0, end - now);
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const getRestaurantId = (restaurant) =>
  String(restaurant?.id ?? restaurant?._id ?? restaurant?.restaurantId ?? "");

const buildDepositDetail = (table) => {
  const total = Math.max(0, Number(table.reservationDepositAmount || 0));
  if (!(total > 0)) return "";
  const paid = String(table.reservationDepositStatus || "").toLowerCase() === "paid";
  return `${paid ? "Đã cọc" : "Cọc cần thu"} ${moneyLabel(total)}`;
};

const buildNotice = (table, now) => {
  const customer = table.reservationCustomerName || "Khách đặt bàn";
  const party = table.reservationPartySize
    ? `${table.reservationPartySize} khách`
    : "Chưa rõ số khách";
  const contact = table.reservationCustomerPhone || table.reservationCustomerEmail || "";
  const deposit = buildDepositDetail(table);
  const at = timeLabel(table.nextReservationAt);
  const details = [at, customer, party, contact, deposit].filter(Boolean).join(" · ");

  if (table.reservationPhase === "waiting") {
    return {
      tone: "waiting",
      title: `Đang chờ khách · còn ${countdownLabel(table.reservationGraceEndsAt, now)}`,
      detail: details,
    };
  }
  if (table.reservationPhase === "expired") {
    return {
      tone: "expired",
      title: "Đã quá 15 phút chờ khách",
      detail: details,
    };
  }
  return {
    tone: "upcoming",
    title: `Có khách đặt lúc ${at}`,
    detail: [customer, party, contact, deposit].filter(Boolean).join(" · "),
  };
};

const reservationErrorMessage = (error) => {
  const first = error?.graphQLErrors?.[0];
  const code = String(first?.extensions?.code || "");
  if (code === "RESERVATION_CHECK_IN_TOO_EARLY") {
    return `Chưa đến giờ nhận khách. Có thể nhận từ ${timeLabel(
      first?.extensions?.earliestCheckInAt,
    )}.`;
  }
  if (code === "TABLE_SESSION_CONFLICT") {
    return "Bàn đang có một phiên phục vụ khác. Vui lòng kiểm tra tại POS.";
  }
  return first?.message || error?.message || "Không thể nhận khách đặt bàn.";
};

export default function TableReservationTimingOverlay() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const fallbackRestaurantId = useMemo(
    () => getRestaurantId(restaurants[0]),
    [restaurants],
  );
  const [restaurantId, setRestaurantId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(STORAGE_KEY) || "",
  );
  const [now, setNow] = useState(Date.now());
  const [arrivalChoice, setArrivalChoice] = useState(null);
  const [blockedMessage, setBlockedMessage] = useState("");

  useEffect(() => {
    if (!restaurantId && fallbackRestaurantId) {
      setRestaurantId(fallbackRestaurantId);
    }
  }, [fallbackRestaurantId, restaurantId]);

  useEffect(() => {
    const handleScope = (event) => {
      if (event?.detail?.key !== STORAGE_KEY) return;
      setRestaurantId(String(event.detail.value || fallbackRestaurantId || ""));
    };
    window.addEventListener(SCOPE_EVENT, handleScope);
    return () => window.removeEventListener(SCOPE_EVENT, handleScope);
  }, [fallbackRestaurantId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { data, refetch } = useQuery(TABLE_RESERVATION_TIMING, {
    variables: { restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
    pollInterval: 15000,
  });
  const [checkInReservation, { loading: checkingIn }] = useMutation(
    CHECK_IN_RESERVATION,
  );

  const tables = useMemo(
    () => (data?.tables || []).filter((table) => table.nextReservationAt),
    [data?.tables],
  );

  useEffect(() => {
    const root = document.querySelector(".tm-settings-page");
    if (!root) return undefined;
    root.querySelectorAll(".tm-reservation-notice").forEach((node) => node.remove());
    const cleanupListeners = [];

    const byCode = new Map(
      tables.map((table) => [String(table.code || "").trim().toLowerCase(), table]),
    );
    root.querySelectorAll(".tm-table-card:not(.tm-table-card--skeleton)").forEach((card) => {
      const code = card.querySelector(".table-no")?.textContent?.trim().toLowerCase();
      const table = byCode.get(code);
      if (!table) return;
      const notice = buildNotice(table, now);
      const node = document.createElement("div");
      node.className = `tm-reservation-notice tm-reservation-notice--${notice.tone}`;
      node.setAttribute("role", "status");
      const title = document.createElement("strong");
      title.textContent = notice.title;
      const detail = document.createElement("span");
      detail.textContent = notice.detail;
      node.append(title, detail);
      const actions = card.querySelector(".card-actions");
      if (actions) card.insertBefore(node, actions);
      else card.append(node);

      const receiveButton = Array.from(
        card.querySelectorAll(".card-actions button"),
      ).find((button) => button.textContent?.trim() === "Nhận khách");
      if (!receiveButton || !table.reservationId) return;

      const earliest = table.reservationEarliestCheckInAt
        ? new Date(table.reservationEarliestCheckInAt).getTime()
        : new Date(table.nextReservationAt).getTime() - 15 * 60_000;
      const canChooseArrival =
        table.reservationStatus === "confirmed" &&
        Number.isFinite(earliest) &&
        now >= earliest;

      if (!canChooseArrival) {
        receiveButton.disabled = true;
        receiveButton.title = `Chỉ được nhận khách đặt từ ${timeLabel(earliest)} (sớm tối đa 15 phút).`;
        return;
      }

      receiveButton.disabled = false;
      receiveButton.title = "Xác nhận khách đặt bàn đã tới";
      receiveButton.dataset.reservationArrival = "1";
      const handleReceive = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        setBlockedMessage("");
        setArrivalChoice(table);
      };
      receiveButton.addEventListener("click", handleReceive, true);
      cleanupListeners.push(() =>
        receiveButton.removeEventListener("click", handleReceive, true),
      );
    });

    return () => {
      cleanupListeners.forEach((cleanup) => cleanup());
      root.querySelectorAll(".tm-reservation-notice").forEach((node) => node.remove());
    };
  }, [now, tables]);

  const confirmBookedGuest = async () => {
    if (!arrivalChoice?.reservationId) return;
    try {
      await checkInReservation({
        variables: {
          input: {
            reservationId: arrivalChoice.reservationId,
            note: "Nhân viên xác nhận khách đặt bàn đã tới từ thẻ quản lý bàn.",
          },
        },
      });
      setArrivalChoice(null);
      setBlockedMessage("");
      await refetch();
      showNotification?.(
        `Đã nhận ${arrivalChoice.reservationCustomerName || "khách đặt bàn"} vào bàn ${arrivalChoice.code}.`,
        "success",
      );
      window.dispatchEvent(
        new CustomEvent("table-reservation:checked-in", {
          detail: {
            tableId: arrivalChoice.id,
            reservationId: arrivalChoice.reservationId,
          },
        }),
      );
    } catch (error) {
      showNotification?.(reservationErrorMessage(error), "error");
    }
  };

  const chooseWalkIn = () => {
    setBlockedMessage(
      `Không thể nhận khách mới vào bàn ${arrivalChoice?.code || "này"}. Bàn đang được giữ cho ${arrivalChoice?.reservationCustomerName || "khách đặt"} lúc ${timeLabel(arrivalChoice?.nextReservationAt)}.`,
    );
  };

  const modal = arrivalChoice && typeof document !== "undefined"
    ? createPortal(
        <div
          className="tm-arrival-choice__backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !checkingIn) {
              setArrivalChoice(null);
              setBlockedMessage("");
            }
          }}
        >
          <section
            className="tm-arrival-choice"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tm-arrival-choice-title"
          >
            <div className="tm-arrival-choice__eyebrow">NHẬN KHÁCH · BÀN {arrivalChoice.code}</div>
            <h2 id="tm-arrival-choice-title">Khách nào vừa tới?</h2>
            <p>
              Bàn có lịch gần nhất lúc <strong>{timeLabel(arrivalChoice.nextReservationAt)}</strong>
              {arrivalChoice.reservationCustomerName
                ? ` của ${arrivalChoice.reservationCustomerName}`
                : ""}.
            </p>
            <div className="tm-arrival-choice__reservation">
              <strong>{arrivalChoice.reservationCustomerName || "Khách đặt bàn"}</strong>
              <span>
                {arrivalChoice.reservationPartySize || "-"} khách
                {arrivalChoice.reservationCustomerPhone
                  ? ` · ${arrivalChoice.reservationCustomerPhone}`
                  : ""}
              </span>
              {Number(arrivalChoice.reservationDepositAmount || 0) > 0 && (
                <span>
                  Đã cọc {moneyLabel(arrivalChoice.reservationDepositAmount)}
                  {Number(arrivalChoice.reservationMenuDepositAmount || 0) > 0
                    ? ` · gồm cọc món ${moneyLabel(arrivalChoice.reservationMenuDepositAmount)}`
                    : ""}
                </span>
              )}
            </div>
            {blockedMessage && (
              <div className="tm-arrival-choice__blocked" role="alert">
                {blockedMessage}
              </div>
            )}
            <div className="tm-arrival-choice__options">
              <button
                type="button"
                className="tm-arrival-choice__booked"
                onClick={confirmBookedGuest}
                disabled={checkingIn}
              >
                <strong>{checkingIn ? "Đang nhận khách..." : "Khách đặt đã tới"}</strong>
                <span>Mở phiên bàn, ghi nhận khách đến và đồng bộ thông tin sang POS.</span>
              </button>
              <button
                type="button"
                className="tm-arrival-choice__walkin"
                onClick={chooseWalkIn}
                disabled={checkingIn}
              >
                <strong>Khách mới</strong>
                <span>Không được dùng bàn này vì đang sát giờ khách đặt.</span>
              </button>
            </div>
            <button
              type="button"
              className="tm-arrival-choice__cancel"
              onClick={() => {
                setArrivalChoice(null);
                setBlockedMessage("");
              }}
              disabled={checkingIn}
            >
              Đóng
            </button>
          </section>
        </div>,
        document.body,
      )
    : null;

  return modal;
}
