import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";

const GET_INDEXES = gql`
  query GetRestaurantCategoryIndexes($timeSlot: TimeSlot) {
    restaurantCategoryIndexes(timeSlot: $timeSlot) {
      id
      restaurantId
      timeSlot
      categoryIds
      distinctCategoryCount
      orderCount
      reservationCount
      tableParticipationCount
      updatedAt
    }
  }
`;

const REFRESH_INDEXES = gql`
  mutation RefreshRestaurantCategoryIndexes($timeSlot: TimeSlot!) {
    refreshRestaurantCategoryIndexes(timeSlot: $timeSlot)
  }
`;

const UpdateLabel = ({ role = "admin" }) => {
  const [timeSlot, setTimeSlot] = useState("lunch");
  const { data, loading, refetch } = useQuery(GET_INDEXES, {
    variables: { timeSlot },
    fetchPolicy: "network-only",
  });
  const [refreshIndexes, { loading: refreshing }] = useMutation(REFRESH_INDEXES);

  const rows = useMemo(() => data?.restaurantCategoryIndexes || [], [data]);

  const onRefresh = async () => {
    await refreshIndexes({ variables: { timeSlot } });
    await refetch();
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Quản lý category nhà hàng ({role})</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
          <option value="breakfast">breakfast</option>
          <option value="lunch">lunch</option>
          <option value="dinner">dinner</option>
          <option value="late_night">late_night</option>
        </select>
        <button onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Đang cập nhật..." : "Cập nhật category index"}
        </button>
      </div>
      {loading ? (
        <p>Đang tải...</p>
      ) : (
        <table border="1" cellPadding="8" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>Restaurant</th>
              <th>TimeSlot</th>
              <th>Số category</th>
              <th>Orders</th>
              <th>Reservations</th>
              <th>Table joins</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.restaurantId}</td>
                <td>{r.timeSlot}</td>
                <td>{r.distinctCategoryCount}</td>
                <td>{r.orderCount || 0}</td>
                <td>{r.reservationCount || 0}</td>
                <td>{r.tableParticipationCount || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export const AdminRestaurantCategoryManagementPage = () => <UpdateLabel role="admin" />;
export const ManagerRestaurantCategoryManagementPage = () => <UpdateLabel role="manager" />;

export default AdminRestaurantCategoryManagementPage;
