import React, { useContext, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { AuthContext } from "@/context/AuthContext";
import { useNotification } from "@/hooks/useNotification";

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
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value || 0));

const getRestaurantId = (restaurant) => String(restaurant?.id || restaurant?.restaurantId || "");

export default function ReservationChangeReviewPage() {
  const { restaurants = [] } = useContext(AuthContext) || {};
  const { showNotification } = useNotification();
  const restaurantOptions = useMemo(() => restaurants || [], [restaurants]);
  const [restaurantId, setRestaurantId] = useState(() => getRestaurantId(restaurantOptions[0]));
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
    onError: (err) => showNotification?.(err?.message || "Không thể duyệt yêu cầu.", "error"),
  });
  const [rejectChange, { loading: rejecting }] = useMutation(REJECT_CHANGE, {
    onCompleted: () => {
      showNotification?.("Đã từ chối yêu cầu thay đổi đặt bàn.", "success");
      refetch?.();
    },
    onError: (err) => showNotification?.(err?.message || "Không thể từ chối yêu cầu.", "error"),
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
    const reason = noteById[reservation.id] || window.prompt("Nhập lý do từ chối yêu cầu này:") || "Nhà hàng không thể đáp ứng yêu cầu thay đổi.";
    rejectChange({ variables: { input: { reservationId: reservation.id, reason } } });
  };

  return (
    <main style={{ padding: 24, display: "grid", gap: 18 }}>
      <section style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, color: "#f97316", fontWeight: 800 }}>Reservation review</p>
          <h1 style={{ margin: "4px 0 0" }}>Yêu cầu đổi đặt bàn</h1>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            Khách chỉ gửi yêu cầu. Nhân viên hoặc quản lý duyệt thì giờ/bàn mới đổi chính thức.
          </p>
        </div>
        <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)} style={{ minWidth: 240, padding: 10, borderRadius: 12 }}>
          {restaurantOptions.map((restaurant) => {
            const id = getRestaurantId(restaurant);
            return <option key={id} value={id}>{restaurant.name || restaurant.restaurantName || id}</option>;
          })}
        </select>
      </section>

      {loading ? <p>Đang tải yêu cầu...</p> : null}
      {error ? <p style={{ color: "#dc2626" }}>{error.message}</p> : null}
      {!loading && !requests.length ? <p>Không có yêu cầu chờ duyệt.</p> : null}

      <section style={{ display: "grid", gap: 14 }}>
        {requests.map((reservation) => {
          const isTimeChange = String(reservation.changeRequestType).toLowerCase() === "time";
          return (
            <article key={reservation.id} style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 18, background: "#fff" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <strong>#{reservation.orderCode || reservation.id}</strong>
                  <p style={{ margin: "6px 0", color: "#64748b" }}>{reservation.customerName || "Khách hàng"} · {reservation.customerPhone || reservation.customerEmail || "--"}</p>
                  <p style={{ margin: 0 }}>Loại yêu cầu: <b>{isTimeChange ? "Đổi giờ" : "Đổi bàn"}</b></p>
                </div>
                <span style={{ height: 30, padding: "6px 10px", borderRadius: 999, background: "#fff7ed", color: "#c2410c", fontWeight: 800 }}>
                  Chờ duyệt
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 14 }}>
                <div><small>Giờ hiện tại</small><br /><b>{formatDateTime(reservation.timeTo)}</b></div>
                <div><small>Bàn hiện tại</small><br /><b>{reservation.tableId || "--"}</b></div>
                <div><small>Yêu cầu mới</small><br /><b>{isTimeChange ? formatDateTime(reservation.requestedTimeTo) : reservation.requestedTableId || "--"}</b></div>
                <div><small>Phí đổi</small><br /><b>{formatMoney(reservation.changeRequestFee)}</b></div>
              </div>

              <textarea
                value={noteById[reservation.id] || ""}
                onChange={(e) => setNoteById((prev) => ({ ...prev, [reservation.id]: e.target.value }))}
                placeholder="Ghi chú duyệt hoặc lý do từ chối..."
                rows={2}
                style={{ width: "100%", marginTop: 14, padding: 10, borderRadius: 12, border: "1px solid #e5e7eb" }}
              />

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
                <button disabled={busy} onClick={() => handleReject(reservation)} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#be123c" }}>
                  Từ chối
                </button>
                <button disabled={busy} onClick={() => handleApprove(reservation)} style={{ padding: "10px 14px", borderRadius: 12, border: 0, background: "#16a34a", color: "#fff" }}>
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
