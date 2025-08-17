import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import "../../styles/MenuManagement.scss";

const MenuManagement = () => {
  const { user, token } = useContext(AuthContext);
  const [SelectedRestaurant, setSelectedRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("name");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restaurants, setRestaurants] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    image: "",
    status: "available",
    preparationTime: "",
    ingredients: [],
    allergens: [],
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    isVegetarian: false,
    isSpicy: false,
  });

  const [newCategory, setNewCategory] = useState({
    name: "",
    icon: "",
    color: "#3b82f6",
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        console.log("Fetching restaurants with token:", token); // Debug
        const restaurantRes = await axios.get("/api/restaurants");
        console.log("Fetching restaurants:", restaurantRes); // Debug
        setRestaurants(restaurantRes.data);

        console.log("Fetching categories with token:", token); // Debug
        const catRes = await axios.get("/api/categories", {
          headers: { Authorization: `Bearer ${token}` },
          params:
            user.role === "manager"
              ? { restaurantId: user.restaurantId }
              : {
                  restaurantId: SelectedRestaurant
                    ? SelectedRestaurant
                    : restaurantRes.data[0]._id,
                },
        });
        setCategories(catRes.data);

        console.log("Fetching menus"); // Debug
        const menuRes = await axios.get("/api/menus", {
          headers: { Authorization: `Bearer ${token}` },
          params:
            user.role === "manager"
              ? { restaurantId: user.restaurantId }
              : { restaurantId: SelectedRestaurant },
        });
        setMenuItems(
          menuRes.data.map((item) => ({
            ...item,
            id: item._id,
            nutrition: item.nutrition || {
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
            },
            popularity: item.popularity || Math.floor(Math.random() * 100),
          }))
        );
        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err); // Debug console
        setError(err.response?.data?.error || "Lỗi fetch data");
        setLoading(false);
      }
    };
    console.log("user in menu manager: ", user);
    if (user && token) fetchData(); // Check user/token tồn tại
    else {
      console.log("No token, skipping fetch"); // Debug nếu chưa login
      setLoading(false);
      setError("Vui lòng login để xem menu");
    }
  }, [user, token, SelectedRestaurant]);
  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.categoryId === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || item.status === filterStatus;

    return matchesCategory && matchesSearch && matchesStatus;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "price":
        return a.price - b.price;
      case "popularity":
        return b.popularity - a.popularity;
      case "category":
        return a.categoryId.localeCompare(b.categoryId);
      default:
        return 0;
    }
  });

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      const newItemData = {
        ...formData,
        restaurantId: user.restaurantId,
        price: parseFloat(formData.price),
        categoryId: formData.categoryId,
        preparationTime: parseInt(formData.preparationTime),
        nutrition: {
          calories: parseInt(formData.calories) || 0,
          protein: parseInt(formData.protein) || 0,
          carbs: parseInt(formData.carbs) || 0,
          fat: parseInt(formData.fat) || 0,
        },
        popularity: Math.floor(Math.random() * 100),
      };
      const res = await axios.post("/api/menus", newItemData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMenuItems([...menuItems, { ...res.data, id: res.data._id }]);
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.error || "Lỗi thêm item");
    }
  };

  const handleEditItem = async (e) => {
    e.preventDefault();
    try {
      const updatedData = {
        ...formData,
        price: parseFloat(formData.price),
        categoryId: formData.categoryId,
        preparationTime: parseInt(formData.preparationTime),
        nutrition: {
          calories: parseInt(formData.calories) || 0,
          protein: parseInt(formData.protein) || 0,
          carbs: parseInt(formData.carbs) || 0,
          fat: parseInt(formData.fat) || 0,
        },
      };
      const res = await axios.put(`/api/menus/${editingItem.id}`, updatedData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMenuItems(
        menuItems.map((item) =>
          item.id === editingItem.id ? { ...res.data, id: res.data._id } : item
        )
      );
      setShowEditModal(false);
      setEditingItem(null);
      resetForm();
    } catch (err) {
      setError(err.response?.data?.error || "Lỗi sửa item");
    }
  };

  const handleDeleteItem = async (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa món này?")) {
      try {
        await axios.delete(`/api/menus/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMenuItems(menuItems.filter((item) => item.id !== id));
      } catch (err) {
        setError(err.response?.data?.error || "Lỗi xóa item");
      }
    }
  };

  const handleDuplicateItem = async (item) => {
    try {
      const duplicatedData = {
        ...item,
        name: `${item.name} (Copy)`,
        restaurantId: user.restaurantId,
      };
      delete duplicatedData.id;
      const res = await axios.post("/api/menus", duplicatedData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMenuItems([...menuItems, { ...res.data, id: res.data._id }]);
    } catch (err) {
      setError(err.response?.data?.error || "Lỗi duplicate");
    }
  };

  const handleToggleStatus = async (id) => {
    const item = menuItems.find((i) => i.id === id);
    const newStatus =
      item.status === "available" ? "out_of_stock" : "available";
    try {
      const res = await axios.put(
        `/api/menus/${id}`,
        { status: newStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setMenuItems(
        menuItems.map((i) =>
          i.id === id ? { ...res.data, id: res.data._id } : i
        )
      );
    } catch (err) {
      setError(err.response?.data?.error || "Lỗi toggle status");
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      console.log("restaurant id now: ", SelectedRestaurant);
      console.log("user restaurant id now: ", user.restaurantId);
      const categoryData = {
        ...newCategory,
        restaurantId: SelectedRestaurant
          ? SelectedRestaurant
          : user.restaurantId,
        itemCount: 0,
      };
      const res = await axios.post("/api/categories", categoryData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories([...categories, { ...res.data, id: res.data._id }]);
      setShowCategoryModal(false);
      setNewCategory({ name: "", icon: "", color: "#3b82f6" });
    } catch (err) {
      setError(err.response?.data?.error || "Lỗi thêm category");
    }
  };

  const handleEditCategory = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(
        `/api/categories/${editingCategory.id}`,
        newCategory,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setCategories(
        categories.map((cat) =>
          cat.id === editingCategory.id
            ? { ...res.data, id: res.data._id }
            : cat
        )
      );
      setShowCategoryModal(false);
      setEditingCategory(null);
      setNewCategory({ name: "", icon: "", color: "#3b82f6" });
    } catch (err) {
      setError(err.response?.data?.error || "Lỗi sửa category");
    }
  };

  const handleDeleteCategory = async (id) => {
    console.log("category id delete : ", id);
    if (window.confirm("Xóa category? Các item liên kết sẽ không bị xóa.")) {
      try {
        await axios.delete(`/api/categories/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCategories(categories.filter((cat) => cat.id !== id));
      } catch (err) {
        setError(err.response?.data?.error || "Lỗi xóa category");
      }
    }
  };

  const openCategoryModal = (cat = null) => {
    setEditingCategory(cat);
    setNewCategory(
      cat
        ? { name: cat.name, icon: cat.icon, color: cat.color }
        : { name: "", icon: "", color: "#3b82f6" }
    );
    setShowCategoryModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: "",
      categoryId: "",
      image: "",
      status: "available",
      preparationTime: "",
      ingredients: [],
      allergens: [],
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      isVegetarian: false,
      isSpicy: false,
    });
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price.toString(),
      categoryId: item.categoryId,
      image: item.image,
      status: item.status,
      preparationTime: item.preparationTime.toString(),
      ingredients: item.ingredients || [],
      allergens: item.allergens || [],
      calories: item.nutrition.calories.toString(),
      protein: item.nutrition.protein.toString(),
      carbs: item.nutrition.carbs.toString(),
      fat: item.nutrition.fat.toString(),
      isVegetarian: item.isVegetarian,
      isSpicy: item.isSpicy,
    });
    setShowEditModal(true);
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find((cat) => cat.id === categoryId);
    return category ? category.name : "Không xác định";
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      available: { text: "Có sẵn", class: "status-available" },
      out_of_stock: { text: "Hết hàng", class: "status-out-of-stock" },
      discontinued: { text: "Ngừng bán", class: "status-discontinued" },
    };
    return statusConfig[status] || statusConfig.available;
  };

  const handleChangeRestaurant = (event) => {
    setSelectedRestaurant(event.target.value);
  };
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  console.log("restaurant is: ", SelectedRestaurant);
  return (
    <div className="menu-management">
      <div className="menu-header">
        <div className="header-left">
          <label>
            Cửa hàng hiện tại:
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
              value={SelectedRestaurant}
              onChange={handleChangeRestaurant}
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant._id} value={restaurant._id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-outline"
            onClick={() => openCategoryModal()}
          >
            <span>📁</span> Thêm danh mục
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <span>➕</span> Thêm món mới
          </button>
        </div>
      </div>

      <div className="menu-stats">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>{menuItems.length}</h3>
            <p>Tổng món ăn</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>
              {menuItems.filter((item) => item.status === "available").length}
            </h3>
            <p>Có sẵn</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <h3>
              {
                menuItems.filter((item) => item.status === "out_of_stock")
                  .length
              }
            </h3>
            <p>Hết hàng</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📁</div>
          <div className="stat-content">
            <h3>{categories.length}</h3>
            <p>Danh mục</p>
          </div>
        </div>
      </div>

      <div className="categories-section">
        <h3>Danh mục</h3>
        <div className="categories-grid">
          <div
            className={`category-card ${
              selectedCategory === "all" ? "active" : ""
            }`}
            onClick={() => setSelectedCategory("all")}
          >
            <div className="category-icon">🍽️</div>
            <div className="category-info">
              <h4>Tất cả</h4>
              <span>{menuItems.length} món</span>
            </div>
          </div>
          {categories.map((category) => (
            <div
              key={category.id}
              className={`category-card ${
                selectedCategory === category.id ? "active" : ""
              }`}
              onClick={() => setSelectedCategory(category.id)}
              style={{ borderColor: category.color }}
            >
              <div
                className="category-icon"
                style={{ backgroundColor: category.color + "20" }}
              >
                {category.icon}
              </div>
              <div className="category-info">
                <h4>{category.name}</h4>
                <span>{category.itemCount} món</span>
              </div>
              <div className="category-actions">
                <button onClick={() => openCategoryModal(category)}>✏️</button>
                <button onClick={() => handleDeleteCategory(category.id)}>
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="menu-controls">
        <div className="controls-left">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Tìm kiếm món ăn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="available">Có sẵn</option>
            <option value="out_of_stock">Hết hàng</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="name">Sắp xếp theo tên</option>
            <option value="price">Sắp xếp theo giá</option>
            <option value="popularity">Sắp xếp theo độ phổ biến</option>
            <option value="category">Sắp xếp theo danh mục</option>
          </select>
        </div>
        <div className="controls-right">
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              ⊞
            </button>
            <button
              className={`view-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      <div className={`menu-items ${viewMode}`}>
        {sortedItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🍽️</div>
            <h3>Không tìm thấy món ăn</h3>
            <p>Thử thay đổi bộ lọc hoặc thêm món mới</p>
          </div>
        ) : (
          sortedItems.map((item) => (
            <div key={item.id} className="menu-item-card">
              <div className="item-image">
                <span className="image-placeholder">{item.image}</span>
                <div className="item-badges">
                  {item.isVegetarian && (
                    <span className="badge vegetarian">🌱</span>
                  )}
                  {item.isSpicy && <span className="badge spicy">🌶️</span>}
                </div>
                <div className="item-actions">
                  <button
                    className="action-btn edit"
                    onClick={() => openEditModal(item)}
                    title="Chỉnh sửa"
                  >
                    ✏️
                  </button>
                  <button
                    className="action-btn duplicate"
                    onClick={() => handleDuplicateItem(item)}
                    title="Nhân bản"
                  >
                    📋
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={() => handleDeleteItem(item.id)}
                    title="Xóa"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="item-content">
                <div className="item-header">
                  <h4>{item.name}</h4>
                  <div
                    className={`status-badge ${
                      getStatusBadge(item.status).class
                    }`}
                  >
                    {getStatusBadge(item.status).text}
                  </div>
                </div>

                <p className="item-description">{item.description}</p>

                <div className="item-meta">
                  <span className="category">
                    {getCategoryName(item.categoryId)}
                  </span>
                  <span className="prep-time">
                    ⏱️ {item.preparationTime} phút
                  </span>
                  <span className="popularity">⭐ {item.popularity}%</span>
                </div>

                <div className="item-nutrition">
                  <span>{item.nutrition.calories} cal</span>
                  <span>P: {item.nutrition.protein}g</span>
                  <span>C: {item.nutrition.carbs}g</span>
                  <span>F: {item.nutrition.fat}g</span>
                </div>

                <div className="item-footer">
                  <div className="item-price">{formatPrice(item.price)}</div>
                  <button
                    className={`toggle-status ${
                      item.status === "available" ? "available" : "unavailable"
                    }`}
                    onClick={() => handleToggleStatus(item.id)}
                  >
                    {item.status === "available" ? "✅ Có sẵn" : "❌ Hết hàng"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {(showAddModal || showEditModal) && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setEditingItem(null);
            resetForm();
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{showAddModal ? "Thêm món mới" : "Chỉnh sửa món ăn"}</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                  setEditingItem(null);
                  resetForm();
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={showAddModal ? handleAddItem : handleEditItem}
              className="modal-form"
            >
              <div className="form-grid">
                <div className="form-group">
                  <label>Tên món ăn *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Danh mục *</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) =>
                      setFormData({ ...formData, categoryId: e.target.value })
                    }
                    required
                  >
                    <option value="">Chọn danh mục</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Giá (VNĐ) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Thời gian chuẩn bị (phút) *</label>
                  <input
                    type="number"
                    value={formData.preparationTime}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preparationTime: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label>Mô tả</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>Emoji/Icon</label>
                  <input
                    type="text"
                    value={formData.image}
                    onChange={(e) =>
                      setFormData({ ...formData, image: e.target.value })
                    }
                    placeholder="🍕"
                  />
                </div>

                <div className="form-group">
                  <label>Trạng thái</label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value })
                    }
                  >
                    <option value="available">Có sẵn</option>
                    <option value="out_of_stock">Hết hàng</option>
                    <option value="discontinued">Ngừng bán</option>
                  </select>
                </div>
              </div>

              <div className="nutrition-section">
                <h4>Thông tin dinh dưỡng</h4>
                <div className="nutrition-grid">
                  <div className="form-group">
                    <label>Calories</label>
                    <input
                      type="number"
                      value={formData.calories}
                      onChange={(e) =>
                        setFormData({ ...formData, calories: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Protein (g)</label>
                    <input
                      type="number"
                      value={formData.protein}
                      onChange={(e) =>
                        setFormData({ ...formData, protein: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Carbs (g)</label>
                    <input
                      type="number"
                      value={formData.carbs}
                      onChange={(e) =>
                        setFormData({ ...formData, carbs: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Fat (g)</label>
                    <input
                      type="number"
                      value={formData.fat}
                      onChange={(e) =>
                        setFormData({ ...formData, fat: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isVegetarian}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isVegetarian: e.target.checked,
                      })
                    }
                  />
                  <span>🌱 Món chay</span>
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isSpicy}
                    onChange={(e) =>
                      setFormData({ ...formData, isSpicy: e.target.checked })
                    }
                  />
                  <span>🌶️ Món cay</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingItem(null);
                    resetForm();
                  }}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  {showAddModal ? "Thêm món" : "Cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCategoryModal(false)}
        >
          <div
            className="modal-content small"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{editingCategory ? "Sửa danh mục" : "Thêm danh mục mới"}</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={
                editingCategory ? handleEditCategory : handleAddCategory
              }
              className="modal-form"
            >
              <div className="form-group">
                <label>Tên danh mục *</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Icon/Emoji</label>
                <input
                  type="text"
                  value={newCategory.icon}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, icon: e.target.value })
                  }
                  placeholder="🍕"
                />
              </div>

              <div className="form-group">
                <label>Màu sắc</label>
                <input
                  type="color"
                  value={newCategory.color}
                  onChange={(e) =>
                    setNewCategory({ ...newCategory, color: e.target.value })
                  }
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCategoryModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCategory ? "Cập nhật" : "Thêm danh mục"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuManagement;
