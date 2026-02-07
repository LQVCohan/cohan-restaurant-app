import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  Store,
  Clock,
  Save,
  RefreshCw,
  Utensils,
  MapPin,
  Info,
  CheckCircle2,
  ListFilter,
  TrendingUp,
  Users,
  CalendarCheck,
  Loader2,
  Building,
  DollarSign,
} from "lucide-react";

// Import SCSS Styling
import "./RestaurantInfoManagement.scss";

// --- GRAPHQL (Giữ nguyên như cũ) ---
const ME_QUERY = gql`
  query Me {
    me {
      id
      roleName
    }
  }
`;
// ... (Các query khác giữ nguyên: GET_MANAGER_RESTAURANTS, GET_ALL_RESTAURANTS, v.v...)
// Vui lòng giữ lại toàn bộ phần query/mutation constants từ code cũ
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
      menuItemCount
    }
  }
`;
const GET_INDEXES = gql`
  query GetRestaurantCategoryIndexes($restaurantId: ID, $timeSlot: TimeSlot) {
    restaurantCategoryIndexes(
      restaurantId: $restaurantId
      timeSlot: $timeSlot
    ) {
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
  mutation UpdateRestaurantCategoryIndex(
    $input: UpdateRestaurantCategoryIndexInput!
  ) {
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

const TIME_SLOTS = [
  { value: "breakfast", label: "Bữa Sáng", icon: <Clock size={16} /> },
  { value: "lunch", label: "Bữa Trưa", icon: <Utensils size={16} /> },
  { value: "dinner", label: "Bữa Tối", icon: <Store size={16} /> },
  { value: "late_night", label: "Đêm Muộn", icon: <Clock size={16} /> },
];

// --- HELPER COMPONENTS ---

const StatCard = ({ icon, label, value, colorType }) => (
  <div className="stat-card">
    <div className={`icon-box ${colorType}`}>
      {React.cloneElement(icon, { size: 20 })}
    </div>
    <div className="stat-info">
      <p className="label">{label}</p>
      <p className="value">{value}</p>
    </div>
  </div>
);

const RestaurantInfoManagement = ({ role = "manager" }) => {
  const [timeSlot, setTimeSlot] = useState("lunch");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);

  // --- FORM STATE ---
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

  // --- DATA FETCHING (Logic giữ nguyên) ---
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
    },
  );

  const restaurantOptions = useMemo(() => {
    if (role === "admin" || me?.roleName === "admin") {
      return (allRestaurantsData?.restaurants?.edges || []).map((e) => e.node);
    }
    return (managerRestaurantsData?.restaurantsByManager?.edges || []).map(
      (e) => e.node,
    );
  }, [role, me, allRestaurantsData, managerRestaurantsData]);

  useEffect(() => {
    if (!selectedRestaurantId && restaurantOptions.length > 0) {
      setSelectedRestaurantId(restaurantOptions[0].id);
    }
  }, [restaurantOptions, selectedRestaurantId]);

  const {
    data: restaurantDetailData,
    loading: detailLoading,
    refetch: refetchDetail,
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

  const { data: indexData, refetch: refetchIndexes } = useQuery(GET_INDEXES, {
    variables: { restaurantId: selectedRestaurantId || undefined, timeSlot },
    skip: !timeSlot,
    fetchPolicy: "network-only",
  });

  const activeIndex = useMemo(() => {
    const rows = indexData?.restaurantCategoryIndexes || [];
    return rows.find(
      (row) => String(row.restaurantId) === String(selectedRestaurantId),
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
    },
  );

  const categories = categoryData?.categories || [];

  const [refreshIndexes, { loading: refreshing }] =
    useMutation(REFRESH_INDEXES);
  const [updateIndex, { loading: savingIndex }] = useMutation(UPDATE_INDEX);
  const [updateRestaurant, { loading: savingRestaurant }] =
    useMutation(UPDATE_RESTAURANT);

  // --- HANDLERS ---
  const toggleCategory = (id) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const onRefresh = async () => {
    await refreshIndexes({ variables: { timeSlot } });
    await refetchIndexes();
  };

  const onSaveIndex = async () => {
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
          ...restaurantForm,
          address: {
            line1: restaurantForm.line1,
            district: restaurantForm.district,
            city: restaurantForm.city,
          },
        },
      },
    });
    await refetchDetail();
  };

  // --- RENDER ---
  return (
    <div className="restaurant-management-page">
      <div className="container">
        {/* HEADER */}
        <header className="page-header">
          <div className="header-title">
            <h1>
              <Store /> Quản lý Nhà hàng
            </h1>
            <div className="role-badge">
              Phân quyền: <span>{role}</span>
            </div>
          </div>

          <div className="restaurant-selector">
            <div className="select-wrapper">
              <Building size={16} />
              <select
                value={selectedRestaurantId}
                onChange={(e) => setSelectedRestaurantId(e.target.value)}
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
        </header>

        {/* MAIN CONTENT GRID */}
        <div className="main-grid">
          {/* LEFT COLUMN */}
          <div className="left-column">
            {/* TABS */}
            <div className="timeslot-tabs">
              {TIME_SLOTS.map((slot) => (
                <button
                  key={slot.value}
                  onClick={() => setTimeSlot(slot.value)}
                  className={`tab-btn ${timeSlot === slot.value ? "active" : ""}`}
                >
                  {slot.icon} {slot.label}
                </button>
              ))}
            </div>

            {/* STATS */}
            <div className="stats-grid">
              <StatCard
                icon={<ListFilter />}
                label="Category"
                value={activeIndex?.distinctCategoryCount || 0}
                colorType="blue"
              />
              <StatCard
                icon={<TrendingUp />}
                label="Orders"
                value={activeIndex?.orderCount || 0}
                colorType="green"
              />
              <StatCard
                icon={<CalendarCheck />}
                label="Bookings"
                value={activeIndex?.reservationCount || 0}
                colorType="orange"
              />
              <StatCard
                icon={<Users />}
                label="Tables"
                value={activeIndex?.tableParticipationCount || 0}
                colorType="purple"
              />
            </div>

            {/* CATEGORY LIST */}
            <div className="category-section">
              <div className="section-header">
                <h3>
                  <ListFilter size={16} /> Danh mục món ăn
                  <span className="count-badge">{categories.length}</span>
                </h3>

                <div className="actions">
                  <button
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="btn-icon"
                    title="Refresh dữ liệu"
                  >
                    <RefreshCw size={16} className={refreshing ? "spin" : ""} />
                  </button>
                  <button
                    onClick={onSaveIndex}
                    disabled={savingIndex || !selectedRestaurantId}
                    className="btn-primary"
                  >
                    {savingIndex ? (
                      <Loader2 size={16} className="spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Lưu ({selectedCategoryIds.length})
                  </button>
                </div>
              </div>

              <div className="category-list">
                {categoryLoading ? (
                  <div className="loading-state">
                    <Loader2 size={32} className="spin" />
                    <span>Đang tải dữ liệu...</span>
                  </div>
                ) : categories.length === 0 ? (
                  <div className="empty-state">
                    <ListFilter size={48} opacity={0.2} />
                    <p>Không có danh mục nào.</p>
                  </div>
                ) : (
                  <div className="grid-layout">
                    {categories.map((cat) => {
                      const isSelected = selectedCategoryIds.includes(
                        String(cat.id),
                      );
                      return (
                        <div
                          key={cat.id}
                          onClick={() => toggleCategory(String(cat.id))}
                          className={`category-card ${isSelected ? "selected" : ""}`}
                        >
                          <div className="card-top">
                            <div className="checkbox-circle">
                              {isSelected && <CheckCircle2 />}
                            </div>
                            <span className="item-count">
                              {cat.menuItemCount} món
                            </span>
                          </div>
                          <h4>{cat.name}</h4>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (SIDEBAR) */}
          <aside className="right-column">
            <div className="restaurant-info-card">
              <div className="card-header">
                <h3>
                  <Info size={16} /> Thông tin nhà hàng
                </h3>
                <button
                  onClick={onSaveRestaurantInfo}
                  disabled={savingRestaurant || !selectedRestaurantId}
                  className="btn-save"
                  title="Lưu thông tin"
                >
                  {savingRestaurant ? (
                    <Loader2 size={18} className="spin" />
                  ) : (
                    <Save size={18} />
                  )}
                </button>
              </div>

              {detailLoading ? (
                <div
                  className="loading-state"
                  style={{ padding: "40px", textAlign: "center" }}
                >
                  <Loader2 size={24} className="spin" />
                </div>
              ) : (
                <div className="card-body">
                  {/* Basic Info */}
                  <div className="form-section">
                    <label className="section-label">Cơ bản</label>
                    <div className="input-group">
                      <input
                        placeholder="Tên nhà hàng"
                        value={restaurantForm.name}
                        onChange={(e) =>
                          setRestaurantForm((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                      />
                      <div className="row-2">
                        <input
                          placeholder="SĐT"
                          value={restaurantForm.phone}
                          onChange={(e) =>
                            setRestaurantForm((p) => ({
                              ...p,
                              phone: e.target.value,
                            }))
                          }
                        />
                        <input
                          placeholder="Email"
                          value={restaurantForm.email}
                          onChange={(e) =>
                            setRestaurantForm((p) => ({
                              ...p,
                              email: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <select
                        value={restaurantForm.status}
                        onChange={(e) =>
                          setRestaurantForm((p) => ({
                            ...p,
                            status: e.target.value,
                          }))
                        }
                      >
                        <option value="active">Đang hoạt động</option>
                        <option value="inactive">Tạm ngưng</option>
                      </select>
                    </div>
                  </div>

                  <div className="divider" />

                  {/* Operational Info */}
                  <div className="form-section">
                    <label className="section-label">Vận hành</label>
                    <div className="input-group">
                      <div className="row-2">
                        <div className="input-with-icon">
                          <Clock />
                          <input
                            placeholder="Mở cửa"
                            value={restaurantForm.openingHours}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                openingHours: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div className="input-with-icon">
                          <Clock />
                          <input
                            placeholder="Đóng cửa"
                            value={restaurantForm.closingHours}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                closingHours: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="input-with-icon">
                        <Utensils />
                        <input
                          placeholder="Loại ẩm thực"
                          value={restaurantForm.cuisineType}
                          onChange={(e) =>
                            setRestaurantForm((p) => ({
                              ...p,
                              cuisineType: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="input-with-icon">
                        <DollarSign />
                        <input
                          placeholder="Khoảng giá"
                          value={restaurantForm.priceRange}
                          onChange={(e) =>
                            setRestaurantForm((p) => ({
                              ...p,
                              priceRange: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="divider" />

                  {/* Location Info */}
                  <div className="form-section">
                    <label className="section-label">Địa chỉ</label>
                    <div className="input-group">
                      <div className="input-with-icon">
                        <MapPin />
                        <input
                          placeholder="Số nhà, đường"
                          value={restaurantForm.line1}
                          onChange={(e) =>
                            setRestaurantForm((p) => ({
                              ...p,
                              line1: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="row-2">
                        <input
                          placeholder="Quận/Huyện"
                          value={restaurantForm.district}
                          onChange={(e) =>
                            setRestaurantForm((p) => ({
                              ...p,
                              district: e.target.value,
                            }))
                          }
                        />
                        <input
                          placeholder="Thành phố"
                          value={restaurantForm.city}
                          onChange={(e) =>
                            setRestaurantForm((p) => ({
                              ...p,
                              city: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="divider" />

                  <textarea
                    placeholder="Mô tả nhà hàng..."
                    value={restaurantForm.description}
                    onChange={(e) =>
                      setRestaurantForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
            </div>
          </aside>
        </div>
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
