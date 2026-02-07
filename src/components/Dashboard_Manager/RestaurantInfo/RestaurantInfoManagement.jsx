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
    }
  }
`;

const GET_CATEGORIES = gql`
  query GetCategories($restaurantId: ID!, $timeSlot: TimeSlot!) {
    categories(restaurantId: $restaurantId, timeSlot: $timeSlot) {
      id
      name
      order
      isActive
      menuItemCount
      createdAt
      updatedAt
    }
  }
`;

const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      name
    }
  }
`;

const UPDATE_CATEGORY = gql`
  mutation UpdateCategory($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      id
      name
      order
      isActive
    }
  }
`;

const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;

const TOP_CATEGORIES_BY_RESTAURANT = gql`
  query TopCategoriesByRestaurant(
    $restaurantId: ID!
    $timeSlot: TimeSlot!
    $limit: Int
  ) {
    topCategoriesByMenuItemCount(
      restaurantId: $restaurantId
      timeSlot: $timeSlot
      limit: $limit
    ) {
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

const TIME_SLOTS = ["breakfast", "lunch", "dinner", "late_night"];

const defaultCategoryForm = {
  id: "",
  name: "",
  order: 0,
  isActive: true,
};

const RestaurantInfoManagement = ({ role = "manager" }) => {
  const [timeSlot, setTimeSlot] = useState("lunch");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [notice, setNotice] = useState("");
  const [errorText, setErrorText] = useState("");
  const [categoryForm, setCategoryForm] = useState(defaultCategoryForm);

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

  const {
    data: restaurantDetailData,
    loading: restaurantDetailLoading,
    refetch: refetchRestaurantDetail,
  } = useQuery(GET_RESTAURANT_DETAIL, {
    variables: { id: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });

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

  const {
    data: categoryData,
    loading: categoryLoading,
    refetch: refetchCategories,
  } = useQuery(GET_CATEGORIES, {
    variables: { restaurantId: selectedRestaurantId, timeSlot },
    skip: !selectedRestaurantId || !timeSlot,
    fetchPolicy: "network-only",
  });

  const { data: topCategoryData, refetch: refetchTopCategories } = useQuery(
    TOP_CATEGORIES_BY_RESTAURANT,
    {
      variables: { restaurantId: selectedRestaurantId, timeSlot, limit: 6 },
      skip: !selectedRestaurantId || !timeSlot,
      fetchPolicy: "network-only",
    }
  );

  const categories = categoryData?.categories || [];
  const topCategories = topCategoryData?.topCategoriesByMenuItemCount || [];

  const [refreshIndexes, { loading: refreshing }] = useMutation(REFRESH_INDEXES);
  const [updateIndex, { loading: savingIndex }] = useMutation(UPDATE_INDEX);
  const [updateRestaurant, { loading: savingRestaurant }] =
    useMutation(UPDATE_RESTAURANT);
  const [createCategory, { loading: creatingCategory }] =
    useMutation(CREATE_CATEGORY);
  const [updateCategory, { loading: updatingCategory }] =
    useMutation(UPDATE_CATEGORY);
  const [deleteCategory, { loading: deletingCategory }] =
    useMutation(DELETE_CATEGORY);

  const categoryMutationLoading =
    creatingCategory || updatingCategory || deletingCategory;

  const resetMessages = () => {
    setNotice("");
    setErrorText("");
  };

  const toggleCategory = (id) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onRefresh = async () => {
    resetMessages();
    try {
      await refreshIndexes({ variables: { timeSlot } });
      await refetchIndexes();
      setNotice("Đã refresh index theo khung giờ.");
    } catch (error) {
      setErrorText(error.message || "Không thể refresh index.");
    }
  };

  const onSaveIndex = async () => {
    if (!selectedRestaurantId) return;
    resetMessages();
    try {
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
      setNotice("Đã lưu category vào index nhà hàng.");
    } catch (error) {
      setErrorText(error.message || "Không thể lưu index category.");
    }
  };

  const onSaveRestaurantInfo = async () => {
    if (!selectedRestaurantId) return;
    resetMessages();
    try {
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
      setNotice("Đã lưu thông tin nhà hàng.");
    } catch (error) {
      setErrorText(error.message || "Không thể cập nhật thông tin nhà hàng.");
    }
  };

  const onSubmitCategory = async (e) => {
    e.preventDefault();
    if (!selectedRestaurantId || !categoryForm.name.trim()) return;

    resetMessages();
    try {
      if (categoryForm.id) {
        await updateCategory({
          variables: {
            input: {
              id: categoryForm.id,
              name: categoryForm.name.trim(),
              order: Number(categoryForm.order) || 0,
              isActive: Boolean(categoryForm.isActive),
            },
          },
        });
        setNotice("Đã cập nhật category.");
      } else {
        await createCategory({
          variables: {
            input: {
              restaurantId: selectedRestaurantId,
              timeSlot,
              name: categoryForm.name.trim(),
              order: Number(categoryForm.order) || 0,
            },
          },
        });
        setNotice("Đã tạo category mới.");
      }

      setCategoryForm(defaultCategoryForm);
      await Promise.all([refetchCategories(), refetchTopCategories(), refetchIndexes()]);
    } catch (error) {
      setErrorText(error.message || "Không thể lưu category.");
    }
  };

  const onEditCategory = (cat) => {
    setCategoryForm({
      id: cat.id,
      name: cat.name || "",
      order: cat.order || 0,
      isActive: Boolean(cat.isActive),
    });
    resetMessages();
  };

  const onDeleteCategory = async (id) => {
    if (!window.confirm("Bạn chắc chắn muốn xoá category này?")) return;

    resetMessages();
    try {
      await deleteCategory({ variables: { id } });
      await Promise.all([refetchCategories(), refetchTopCategories(), refetchIndexes()]);
      setSelectedCategoryIds((prev) => prev.filter((x) => String(x) !== String(id)));
      setNotice("Đã xoá category.");
    } catch (error) {
      setErrorText(error.message || "Không thể xoá category.");
    }
  };

  const mapById = new Map(restaurantOptions.map((r) => [String(r.id), r.name]));

  return (
    <div style={{ padding: 20 }}>
      <h2>Quản lý thông tin nhà hàng ({role})</h2>
      <p>Quản lý hồ sơ nhà hàng, category theo time slot và category index.</p>

      {notice ? <p style={{ color: "#0f7a35" }}>{notice}</p> : null}
      {errorText ? <p style={{ color: "#c23030" }}>{errorText}</p> : null}

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
        <button onClick={onSaveIndex} disabled={savingIndex || !selectedRestaurantId}>
          {savingIndex
            ? "Đang lưu..."
            : `Lưu index category (${selectedCategoryIds.length} loại)`}
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Quản lý thông tin nhà hàng</h3>
        {restaurantDetailLoading ? (
          <p>Đang tải thông tin nhà hàng...</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            <input
              placeholder="Tên nhà hàng"
              value={restaurantForm.name}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, name: e.target.value }))
              }
            />
            <input
              placeholder="Số điện thoại"
              value={restaurantForm.phone}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, phone: e.target.value }))
              }
            />
            <input
              placeholder="Email"
              value={restaurantForm.email}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, email: e.target.value }))
              }
            />
            <input
              placeholder="Loại ẩm thực"
              value={restaurantForm.cuisineType}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, cuisineType: e.target.value }))
              }
            />
            <input
              placeholder="Giờ mở cửa"
              value={restaurantForm.openingHours}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, openingHours: e.target.value }))
              }
            />
            <input
              placeholder="Giờ đóng cửa"
              value={restaurantForm.closingHours}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, closingHours: e.target.value }))
              }
            />
            <input
              placeholder="Khoảng giá"
              value={restaurantForm.priceRange}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, priceRange: e.target.value }))
              }
            />
            <select
              value={restaurantForm.status}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, status: e.target.value }))
              }
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
            <input
              placeholder="Địa chỉ"
              value={restaurantForm.line1}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, line1: e.target.value }))
              }
            />
            <input
              placeholder="Quận/Huyện"
              value={restaurantForm.district}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, district: e.target.value }))
              }
            />
            <input
              placeholder="Thành phố"
              value={restaurantForm.city}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, city: e.target.value }))
              }
            />
            <textarea
              placeholder="Mô tả"
              value={restaurantForm.description}
              onChange={(e) =>
                setRestaurantForm((p) => ({ ...p, description: e.target.value }))
              }
              rows={3}
              style={{ gridColumn: "1 / span 2" }}
            />
            <button
              onClick={onSaveRestaurantInfo}
              disabled={savingRestaurant || !selectedRestaurantId}
              style={{ gridColumn: "1 / span 2" }}
            >
              {savingRestaurant
                ? "Đang cập nhật thông tin..."
                : "Lưu thông tin nhà hàng"}
            </button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Quản lý category ({timeSlot})</h3>
        <form onSubmit={onSubmitCategory} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Tên category"
            value={categoryForm.name}
            onChange={(e) =>
              setCategoryForm((p) => ({ ...p, name: e.target.value }))
            }
          />
          <input
            type="number"
            placeholder="Order"
            value={categoryForm.order}
            onChange={(e) =>
              setCategoryForm((p) => ({ ...p, order: Number(e.target.value) }))
            }
            style={{ width: 120 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={Boolean(categoryForm.isActive)}
              onChange={(e) =>
                setCategoryForm((p) => ({ ...p, isActive: e.target.checked }))
              }
              disabled={!categoryForm.id}
            />
            Active
          </label>
          <button type="submit" disabled={categoryMutationLoading || !selectedRestaurantId}>
            {categoryForm.id ? "Cập nhật category" : "Thêm category"}
          </button>
          {categoryForm.id ? (
            <button type="button" onClick={() => setCategoryForm(defaultCategoryForm)}>
              Huỷ sửa
            </button>
          ) : null}
        </form>

        {categoryLoading ? (
          <p>Đang tải category...</p>
        ) : categories.length === 0 ? (
          <p>Chưa có category.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 8,
              marginTop: 10,
            }}
          >
            {categories.map((cat) => {
              const checked = selectedCategoryIds.includes(String(cat.id));
              return (
                <div
                  key={cat.id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(String(cat.id))}
                    />
                    <span>
                      {cat.name} ({cat.menuItemCount || 0} món)
                    </span>
                  </label>
                  <small>
                    Order: {cat.order || 0} - Trạng thái: {cat.isActive ? "active" : "inactive"}
                  </small>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => onEditCategory(cat)}>
                      Sửa
                    </button>
                    <button type="button" onClick={() => onDeleteCategory(cat.id)}>
                      Xoá
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Top category theo số món ({timeSlot})</h3>
        {topCategories.length === 0 ? (
          <p>Chưa có dữ liệu top category.</p>
        ) : (
          <ol>
            {topCategories.map((cat) => (
              <li key={cat.id}>
                {cat.name} - {cat.menuItemCount || 0} món
              </li>
            ))}
          </ol>
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
              {(indexData?.restaurantCategoryIndexes || []).map((row) => (
                <tr key={row.id}>
                  <td>{mapById.get(String(row.restaurantId)) || row.restaurantId}</td>
                  <td>{row.timeSlot}</td>
                  <td>{row.distinctCategoryCount}</td>
                  <td>{row.orderCount || 0}</td>
                  <td>{row.reservationCount || 0}</td>
                  <td>{row.tableParticipationCount || 0}</td>
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
