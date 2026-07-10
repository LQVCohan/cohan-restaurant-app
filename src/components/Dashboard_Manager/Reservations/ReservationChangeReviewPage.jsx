import React, { useContext, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";
import "./ReservationChangeReviewPage.scss";

const PENDING_RESERVATION_CHANGES = gql`
  query PendingReservationChanges($restaurantId: ID!, $limit: Int = 50) {
    pendingReservationChanges(restaurantId: $restaurantId, limit: $limit) {
      id
      orderCode
      restaurantId
      restaurantName
      tableId
      timeTo
      durationMinutes
      partySize
      customerName
      customerPhone
      customerEmail
      status
      changeRequestType
      changeRequestStatus
      changeRequestFee
      requestedTimeTo
      requestedDurationMinutes
      requestedTableId
      note
      createdAt
      updatedAt
    }
  }
`;

const APPROVE_CHANGE = gql`
  mutation ApproveReservationChange($input: ApproveReservationChangeInput!) {
    approveReservationChange(input: $input) {
      id
      status
      changeRequestStatus
      timeTo
      tableId
      updatedAt
    }
  }
`;

const REJECT_CHANGE = gql`
  mutation RejectReservationChange($input: RejectReservationChangeInput!) {
    rejectReservationChange(input: $input) {
      id
      status
      changeRequestStatus
      updatedAt
    }
  }
`;

const formatDateTime = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("vi-VN");
};

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const getRestaurantId = (restaurant) =>
  String(restaurant?.id || restaurant?.restaurantId || "");

export default function ReservationChangeReviewPage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const restaurantOptions = useMemo(() => restaurants || [], [restaurants]);
  const [restaurantId, setRestaurantId] = useState(() =>
    getRestaurantId(restaurantOptions[0]),
  );
  const [noteById, setNoteById] = useState({});

  React.useEffect(() => {
    if (!restaurantId && restaurantOptions.length) {
      setRestaurantId(getRestaurantId(restaurantOptions[0]));
    }
  }, [restaurantId, restaurantOptions]);

  const { data, loading, error, refetch } = useQuery(PENDING_RESERVATION_CHANGES, {
    variables: { restaurantId, limit: 50 },
    skip: !restaurantId,
    fetchPolicy: "network-only",
  });

  const [approveChange, { loading: approving }] = useMutation(APPROVE_CHANGE, {
    onCompleted: () => {
      showNotification?.("Đã duyệt yêu cầu thay đổi đặt bàn.", "success");
      refetch?.();
    },
    onError: (mutationError) =>
      showNotification?.(
        mutationError?.message || "Không thể duyệt yêu cầu.",
        "error",
      ),
  });
  const [rejectChange, { loading: rejecting }] = useMutation(REJECT_CHANGE, {
    onCompleted: () => {
      showNotification?.("Đã từ chối yêu cầu thay đổi đặt bàn.", "success");
      refetch?.();
    },
    onError: (mutationError) =>
      showNotification?.(
        mutationError?.message || "Không thể từ chối yêu cầu.",
        "error",
      ),
  });

  const requests = data?.pendingReservationChanges || [];
  const busy = approving || rejecting;

  const handleApprove = (reservation) => {
    approveChange({
      variables: {
        input: {
          reservationId: reservation.id,
          note: noteById[reservation.id] || "Duyệt yêu cầu thay đổi đặt bàn.",
        },
      },
    });
  };

  const handleReject = (reservation) => {
    const reason =
      noteById[reservation.id] ||
      window.prompt("Nhập lý do từ chối yêu cầu này:") ||
      "Nhà hàng không thể đáp ứng yêu cầu thay đổi.";
    rejectChange({ variables: { input: { reservationId: reservation.id, reason } } });
  };

  return (
    <main
      className="reservation-change-review staff-page"
      aria-labelledby="reservation-change-review-title"
    >
      <section className="reservation-change-review__toolbar">
        <div>
          <span className="reservation-change-review__eyebrow">Duyệt thay đổi</span>
          <h1 id="reservation-change-review-title">Yêu cầu đổi đặt bàn</h1>
          <p>
            Giờ hoặc bàn chỉ được cập nhật sau khi nhân viên duyệt yêu cầu của khách.
          </p>
        </div>

        <label className="reservation-change-review__restaurant">
          <span>Nhà hàng</span>
          <select
            value={restaurantId}
            onChange={(event) => setRestaurantId(event.target.value)}
          >
            {restaurantOptions.map((restaurant) => {
              const id = getRestaurantId(restaurant);
              return (
                <option key={id} value={id}>
                  {restaurant.name || restaurant.restaurantName || id}
                </option>
              );
            })}
          </select>
        </label>
      </section>

      {loading ? (
        <div className="reservation-change-review__state" role="status">
          Đang tải yêu cầu...
        </div>
      ) : null}
      {error ? (
        <div className="reservation-change-review__state is-error" role="alert">
          {error.message}
        </div>
      ) : null}
      {!loading && !error && !requests.length ? (
        <div className="reservation-change-review__state" role="status">
          <strong>Không có yêu cầu chờ duyệt</strong>
          <span>Yêu cầu mới của khách sẽ xuất hiện tại đây.</span>
        </div>
      ) : null}

      <section className="reservation-change-review__list" aria-live="polite">
        {requests.map((reservation) => {
          const isTimeChange =
            String(reservation.changeRequestType).toLowerCase() === "time";
          const customerContact =
            reservation.customerPhone || reservation.customerEmail || "--";

          return (
            <article className="reservation-change-card" key={reservation.id}>
              <header className="reservation-change-card__header">
                <div>
                  <strong>#{reservation.orderCode || reservation.id}</strong>
                  <p>
                    {reservation.customerName || "Khách hàng"} · {customerContact}
                  </p>
                  <span>
                    Loại yêu cầu: <b>{isTimeChange ? "Đổi giờ" : "Đổi bàn"}</b>
                  </span>
                </div>
                <span className="reservation-change-card__status">Chờ duyệt</span>
              </header>

              <dl className="reservation-change-card__details">
                <div>
                  <dt>Giờ hiện tại</dt>
                  <dd>{formatDateTime(reservation.timeTo)}</dd>
                </div>
                <div>
                  <dt>Bàn hiện tại</dt>
                  <dd>{reservation.tableId || "--"}</dd>
                </div>
                <div>
                  <dt>Yêu cầu mới</dt>
                  <dd>
                    {isTimeChange
                      ? formatDateTime(reservation.requestedTimeTo)
                      : reservation.requestedTableId || "--"}
                  </dd>
                </div>
                <div>
                  <dt>Phí đổi</dt>
                  <dd>{formatMoney(reservation.changeRequestFee)}</dd>
                </div>
              </dl>

              <label className="reservation-change-card__note">
                <span>Ghi chú xử lý</span>
                <textarea
                  value={noteById[reservation.id] || ""}
                  onChange={(event) =>
                    setNoteById((previous) => ({
                      ...previous,
                      [reservation.id]: event.target.value,
                    }))
                  }
                  placeholder="Ghi chú duyệt hoặc lý do từ chối..."
                  rows={2}
                />
              </label>

              <div className="reservation-change-card__actions">
                <button
                  type="button"
                  className="is-reject"
                  disabled={busy}
                  onClick={() => handleReject(reservation)}
                >
                  Từ chối
                </button>
                <button
                  type="button"
                  className="is-approve"
                  disabled={busy}
                  onClick={() => handleApprove(reservation)}
                >
                  Duyệt thay đổi
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
