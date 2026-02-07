import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";

const ME_QUERY = gql`
  query Me {
    me {
      id
      roleName
    }
  }
`;

const GET_MANAGER_RESTAURANTS = gql`
  query ManagerRestaurants($managerId: ID!, $limit: Int = 100, $cursor: ID) {
    restaurantsByManager(
      managerId: $managerId
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        node {
          id
          name
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const GET_ALL_RESTAURANTS = gql`
  query AllRestaurants($limit: Int = 100, $cursor: ID) {
    restaurants(limit: $limit, cursor: $cursor) {
      edges {
        node {
          id
          name
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const GET_CATEGORIES = gql`
  query GetCategories($restaurantId: ID!, $timeSlot: TimeSlot!) {
    categories(restaurantId: $restaurantId, timeSlot: $timeSlot) {
      id
      name
      menuItemCount
    }
  }
`;

const GET_INDEXES = gql`
  query GetRestaurantCategoryIndexes($restaurantId: ID, $timeSlot: TimeSlot) {
    restaurantCategoryIndexes(restaurantId: $restaurantId, timeSlot: $timeSlot) {
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

const UPDATE_INDEX = gql`
  mutation UpdateRestaurantCategoryIndex($input: UpdateRestaurantCategoryIndexInput!) {
    updateRestaurantCategoryIndex(input: $input) {
      id
      restaurantId
      timeSlot
      categoryIds
      distinctCategoryCount
    }
  }
`;

const TIME_SLOTS = ["breakfast", "lunch", "dinner", "late_night"];

const GET_RESTAURANT_DETAIL = gql`
  query GetRestaurantDetail($id: ID!) {
    restaurant(id: $id) {
      id
      name
      phone
      email
      description
      openingHours
      closingHours
      cuisineType
      priceRange
      status
      address {
        line1
        district
        city
      }
    }
  }
`;

const UPDATE_RESTAURANT = gql`
  mutation UpdateRestaurantInfo($id: ID!, $input: UpdateRestaurantInput!) {
    updateRestaurant(id: $id, input: $input) {
      id
      name
      phone
      email
      description
      openingHours
      closingHours
      cuisineType
      priceRange
      status
    }
  }
`;


const RestaurantInfoManagement = ({ role = "manager" }) => {
  const [timeSlot, setTimeSlot] = useState("lunch");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    phone: "",
    email: "",
    description: "",
    openingHours: "",
    closingHours: "",
    cuisineType: "",
    priceRange: "",
    status: "active",
    line1: "",
    district: "",
    city: "",
  });

  const { data: meData } = useQuery(ME_QUERY, { fetchPolicy: "network-only" });
  const me = meData?.me;

  const { data: managerRestaurantsData, loading: managerRestaurantsLoading } =
    useQuery(GET_MANAGER_RESTAURANTS, {
      variables: { managerId: me?.id, limit: 100 },
      skip: !me?.id || (role !== "manager" && me?.roleName !== "manager"),
      fetchPolicy: "network-only",
    });

  const { data: allRestaurantsData, loading: allRestaurantsLoading } = useQuery(
    GET_ALL_RESTAURANTS,
    {
      variables: { limit: 100 },
      skip: role !== "admin" && me?.roleName !== "admin",
      fetchPolicy: "network-only",
    }
  );

  const restaurantOptions = useMemo(() => {
    if (role === "admin" || me?.roleName === "admin") {
      return (allRestaurantsData?.restaurants?.edges || []).map((e) => e.node);
    }

    return (managerRestaurantsData?.restaurantsByManager?.edges || []).map(
      (e) => e.node
    );
  }, [role, me, allRestaurantsData, managerRestaurantsData]);

  useEffect(() => {
    if (!selectedRestaurantId && restaurantOptions.length > 0) {
      setSelectedRestaurantId(restaurantOptions[0].id);
    }
  }, [restaurantOptions, selectedRestaurantId]);

  const { data: restaurantDetailData, loading: restaurantDetailLoading, refetch: refetchRestaurantDetail } = useQuery(
    GET_RESTAURANT_DETAIL,
    {
      variables: { id: selectedRestaurantId },
      skip: !selectedRestaurantId,
      fetchPolicy: "network-only",
    }
  );

  useEffect(() => {
    const r = restaurantDetailData?.restaurant;
    if (!r) return;
    setRestaurantForm({
      name: r.name || "",
      phone: r.phone || "",
      email: r.email || "",
      description: r.description || "",
      openingHours: r.openingHours || "",
      closingHours: r.closingHours || "",
      cuisineType: r.cuisineType || "",
      priceRange: r.priceRange || "",
      status: r.status || "active",
      line1: r.address?.line1 || "",
      district: r.address?.district || "",
      city: r.address?.city || "",
    });
  }, [restaurantDetailData]);

  const { data: indexData, loading: indexLoading, refetch: refetchIndexes } =
    useQuery(GET_INDEXES, {
      variables: {
        restaurantId: selectedRestaurantId || undefined,
        timeSlot,
      },
      skip: !timeSlot,
      fetchPolicy: "network-only",
    });

  const activeIndex = useMemo(() => {
    const rows = indexData?.restaurantCategoryIndexes || [];
    return rows.find(
      (row) => String(row.restaurantId) === String(selectedRestaurantId)
    );
  }, [indexData, selectedRestaurantId]);

  useEffect(() => {
    setSelectedCategoryIds((activeIndex?.categoryIds || []).map(String));
  }, [activeIndex?.id, activeIndex?.categoryIds]);

  const { data: categoryData, loading: categoryLoading } = useQuery(
    GET_CATEGORIES,
    {
      variables: { restaurantId: selectedRestaurantId, timeSlot },
      skip: !selectedRestaurantId || !timeSlot,
      fetchPolicy: "network-only",
    }
  );

  const categories = categoryData?.categories || [];

  const [refreshIndexes, { loading: refreshing }] = useMutation(REFRESH_INDEXES);
  const [updateIndex, { loading: saving }] = useMutation(UPDATE_INDEX);
  const [updateRestaurant, { loading: savingRestaurant }] = useMutation(UPDATE_RESTAURANT);

  const toggleCategory = (id) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onRefresh = async () => {
    await refreshIndexes({ variables: { timeSlot } });
    await refetchIndexes();
  };

  const onSave = async () => {
    if (!selectedRestaurantId) return;
    await updateIndex({
      variables: {
        input: {
          restaurantId: selectedRestaurantId,
          timeSlot,
          categoryIds: selectedCategoryIds,
        },
      },
    });
    await refetchIndexes();
  };


  const onSaveCategoryCount = async () => {
    if (!selectedRestaurantId) return;
    await updateIndex({
      variables: {
        input: {
          restaurantId: selectedRestaurantId,
          timeSlot,
          categoryIds: selectedCategoryIds,
        },
      },
    });
    await refetchIndexes();
  };

  const onSaveRestaurantInfo = async () => {
    if (!selectedRestaurantId) return;
    await updateRestaurant({
      variables: {
        id: selectedRestaurantId,
        input: {
          name: restaurantForm.name,
          phone: restaurantForm.phone || null,
          email: restaurantForm.email || null,
          description: restaurantForm.description || null,
          openingHours: restaurantForm.openingHours || null,
          closingHours: restaurantForm.closingHours || null,
          cuisineType: restaurantForm.cuisineType || null,
          priceRange: restaurantForm.priceRange || null,
          status: restaurantForm.status || "active",
          address: {
            line1: restaurantForm.line1 || null,
            district: restaurantForm.district || null,
            city: restaurantForm.city || null,
          },
        },
      },
    });
    await refetchRestaurantDetail();
  };

  const mapById = new Map(restaurantOptions.map((r) => [String(r.id), r.name]));

  return (
    <div style={{ padding: 20 }}>
      <h2>Quản lý category nhà hàng ({role})</h2>
      <p>
        Tự map danh sách nhà hàng theo tài khoản quản lý; có thể cập nhật số lượng
        category theo từng khung giờ.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label>Khung giờ</label>
          <select
            value={timeSlot}
            onChange={(e) => setTimeSlot(e.target.value)}
            style={{ width: "100%", marginTop: 4 }}
          >
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>Nhà hàng</label>
          <select
            value={selectedRestaurantId}
            onChange={(e) => setSelectedRestaurantId(e.target.value)}
            style={{ width: "100%", marginTop: 4 }}
            disabled={managerRestaurantsLoading || allRestaurantsLoading}
          >
            {restaurantOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Đang cập nhật..." : "Refresh index theo khung giờ"}
        </button>
        <button onClick={onSave} disabled={saving || !selectedRestaurantId}>
          {saving
            ? "Đang lưu..."
            : `Lưu category cho nhà hàng (${selectedCategoryIds.length} loại)`}
        </button>
        <button onClick={onSaveCategoryCount} disabled={saving || !selectedRestaurantId}>
          {saving ? "Đang cập nhật..." : "Cập nhật số lượng category của nhà hàng"}
        </button>
      </div>


      <div style={{ marginTop: 16 }}>
        <h3>Quản lý thông tin nhà hàng</h3>
        {restaurantDetailLoading ? (
          <p>Đang tải thông tin nhà hàng...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <input placeholder="Tên nhà hàng" value={restaurantForm.name} onChange={(e) => setRestaurantForm((p) => ({ ...p, name: e.target.value }))} />
            <input placeholder="Số điện thoại" value={restaurantForm.phone} onChange={(e) => setRestaurantForm((p) => ({ ...p, phone: e.target.value }))} />
            <input placeholder="Email" value={restaurantForm.email} onChange={(e) => setRestaurantForm((p) => ({ ...p, email: e.target.value }))} />
            <input placeholder="Loại ẩm thực" value={restaurantForm.cuisineType} onChange={(e) => setRestaurantForm((p) => ({ ...p, cuisineType: e.target.value }))} />
            <input placeholder="Giờ mở cửa" value={restaurantForm.openingHours} onChange={(e) => setRestaurantForm((p) => ({ ...p, openingHours: e.target.value }))} />
            <input placeholder="Giờ đóng cửa" value={restaurantForm.closingHours} onChange={(e) => setRestaurantForm((p) => ({ ...p, closingHours: e.target.value }))} />
            <input placeholder="Khoảng giá" value={restaurantForm.priceRange} onChange={(e) => setRestaurantForm((p) => ({ ...p, priceRange: e.target.value }))} />
            <select value={restaurantForm.status} onChange={(e) => setRestaurantForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
            <input placeholder="Địa chỉ" value={restaurantForm.line1} onChange={(e) => setRestaurantForm((p) => ({ ...p, line1: e.target.value }))} />
            <input placeholder="Quận/Huyện" value={restaurantForm.district} onChange={(e) => setRestaurantForm((p) => ({ ...p, district: e.target.value }))} />
            <input placeholder="Thành phố" value={restaurantForm.city} onChange={(e) => setRestaurantForm((p) => ({ ...p, city: e.target.value }))} />
            <textarea
              placeholder="Mô tả"
              value={restaurantForm.description}
              onChange={(e) => setRestaurantForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              style={{ gridColumn: "1 / span 2" }}
            />
            <button onClick={onSaveRestaurantInfo} disabled={savingRestaurant || !selectedRestaurantId} style={{ gridColumn: "1 / span 2" }}>
              {savingRestaurant ? "Đang cập nhật thông tin..." : "Lưu thông tin nhà hàng"}
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Danh sách category ({timeSlot})</h3>
        {categoryLoading ? (
          <p>Đang tải category...</p>
        ) : categories.length === 0 ? (
          <p>Chưa có category.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 8,
            }}
          >
            {categories.map((cat) => {
              const checked = selectedCategoryIds.includes(String(cat.id));
              return (
                <label
                  key={cat.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCategory(String(cat.id))}
                  />
                  <span>
                    {cat.name} ({cat.menuItemCount || 0} món)
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Tổng quan index đã lưu</h3>
        {indexLoading ? (
          <p>Đang tải...</p>
        ) : (
          <table border="1" cellPadding="8" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Nhà hàng</th>
                <th>TimeSlot</th>
                <th>Số category</th>
                <th>Orders</th>
                <th>Reservations</th>
                <th>Table joins</th>
              </tr>
            </thead>
            <tbody>
              {(indexData?.restaurantCategoryIndexes || []).map((r) => (
                <tr key={r.id}>
                  <td>{mapById.get(String(r.restaurantId)) || r.restaurantId}</td>
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
    </div>
  );
};

export const AdminRestaurantInfoManagement = () => (
  <RestaurantInfoManagement role="admin" />
);

export const ManagerRestaurantInfoManagement = () => (
  <RestaurantInfoManagement role="manager" />
);

export default RestaurantInfoManagement;
