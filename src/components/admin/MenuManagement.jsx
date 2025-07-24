import React, { useState, useEffect } from "react";
import "../../styles/MenuManagement.scss";

const MenuManagement = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [sortBy, setSortBy] = useState("name");
  const [filterStatus, setFilterStatus] = useState("all");

  // Sample data
  useEffect(() => {
    const sampleCategories = [
      { id: 1, name: "Khai vị", icon: "🥗", color: "#10b981", itemCount: 8 },
      { id: 2, name: "Món chính", icon: "🍖", color: "#f59e0b", itemCount: 15 },
      {
        id: 3,
        name: "Tráng miệng",
        icon: "🍰",
        color: "#ec4899",
        itemCount: 6,
      },
      { id: 4, name: "Đồ uống", icon: "🥤", color: "#3b82f6", itemCount: 12 },
      { id: 5, name: "Món chay", icon: "🥬", color: "#22c55e", itemCount: 7 },
    ];

    const sampleMenuItems = [
      {
        id: 1,
        name: "Salad Caesar",
        description:
          "Salad tươi với sốt Caesar đặc biệt, phô mai Parmesan và bánh mì nướng",
        price: 120000,
        categoryId: 1,
        image: "🥗",
        status: "available",
        preparationTime: 10,
        ingredients: [
          "Xà lách",
          "Phô mai Parmesan",
          "Bánh mì nướng",
          "Sốt Caesar",
        ],
        allergens: ["Gluten", "Sữa"],
        nutrition: { calories: 280, protein: 12, carbs: 15, fat: 20 },
        isVegetarian: true,
        isSpicy: false,
        popularity: 85,
      },
      {
        id: 2,
        name: "Bò bít tết Úc",
        description:
          "Thịt bò Úc cao cấp nướng tại bàn, kèm khoai tây nghiền và rau củ",
        price: 450000,
        categoryId: 2,
        image: "🥩",
        status: "available",
        preparationTime: 25,
        ingredients: ["Thịt bò Úc", "Khoai tây", "Rau củ", "Bơ tỏi"],
        allergens: ["Sữa"],
        nutrition: { calories: 650, protein: 45, carbs: 30, fat: 35 },
        isVegetarian: false,
        isSpicy: false,
        popularity: 92,
      },
      {
        id: 3,
        name: "Tiramisu",
        description:
          "Bánh Tiramisu Ý truyền thống với cà phê Espresso và mascarpone",
        price: 85000,
        categoryId: 3,
        image: "🍰",
        status: "available",
        preparationTime: 5,
        ingredients: [
          "Mascarpone",
          "Cà phê Espresso",
          "Bánh ladyfinger",
          "Bột cacao",
        ],
        allergens: ["Gluten", "Sữa", "Trứng"],
        nutrition: { calories: 420, protein: 8, carbs: 35, fat: 28 },
        isVegetarian: true,
        isSpicy: false,
        popularity: 78,
      },
      {
        id: 4,
        name: "Sinh tố bơ",
        description: "Sinh tố bơ tươi mát với sữa đặc và đá bào",
        price: 45000,
        categoryId: 4,
        image: "🥤",
        status: "available",
        preparationTime: 5,
        ingredients: ["Bơ tươi", "Sữa đặc", "Đường", "Đá"],
        allergens: ["Sữa"],
        nutrition: { calories: 320, protein: 6, carbs: 45, fat: 15 },
        isVegetarian: true,
        isSpicy: false,
        popularity: 70,
      },
      {
        id: 5,
        name: "Đậu hũ sốt nấm",
        description: "Đậu hũ non chiên giòn với nấm đông cô và rau cải",
        price: 95000,
        categoryId: 5,
        image: "🥬",
        status: "out_of_stock",
        preparationTime: 15,
        ingredients: ["Đậu hũ", "Nấm đông cô", "Rau cải", "Sốt đậu nành"],
        allergens: ["Đậu nành"],
        nutrition: { calories: 280, protein: 18, carbs: 20, fat: 15 },
        isVegetarian: true,
        isSpicy: false,
        popularity: 65,
      },
    ];

    setCategories(sampleCategories);
    setMenuItems(sampleMenuItems);
  }, []);

  // Form state
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

  // Filter and search logic
  const filteredItems = menuItems.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" ||
      item.categoryId === parseInt(selectedCategory);
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || item.status === filterStatus;

    return matchesCategory && matchesSearch && matchesStatus;
  });

  // Sort logic
  const sortedItems = [...filteredItems].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "price":
        return a.price - b.price;
      case "popularity":
        return b.popularity - a.popularity;
      case "category":
        return a.categoryId - b.categoryId;
      default:
        return 0;
    }
  });

  // CRUD operations
  const handleAddItem = (e) => {
    e.preventDefault();
    const newItem = {
      id: Date.now(),
      ...formData,
      price: parseFloat(formData.price),
      categoryId: parseInt(formData.categoryId),
      preparationTime: parseInt(formData.preparationTime),
      nutrition: {
        calories: parseInt(formData.calories) || 0,
        protein: parseInt(formData.protein) || 0,
        carbs: parseInt(formData.carbs) || 0,
        fat: parseInt(formData.fat) || 0,
      },
      popularity: Math.floor(Math.random() * 100),
    };

    setMenuItems([...menuItems, newItem]);
    setShowAddModal(false);
    resetForm();
  };

  const handleEditItem = (e) => {
    e.preventDefault();
    const updatedItems = menuItems.map((item) =>
      item.id === editingItem.id
        ? {
            ...item,
            ...formData,
            price: parseFloat(formData.price),
            categoryId: parseInt(formData.categoryId),
            preparationTime: parseInt(formData.preparationTime),
            nutrition: {
              calories: parseInt(formData.calories) || 0,
              protein: parseInt(formData.protein) || 0,
              carbs: parseInt(formData.carbs) || 0,
              fat: parseInt(formData.fat) || 0,
            },
          }
        : item
    );

    setMenuItems(updatedItems);
    setShowEditModal(false);
    setEditingItem(null);
    resetForm();
  };

  const handleDeleteItem = (id) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa món này?")) {
      setMenuItems(menuItems.filter((item) => item.id !== id));
    }
  };

  const handleDuplicateItem = (item) => {
    const duplicatedItem = {
      ...item,
      id: Date.now(),
      name: `${item.name} (Copy)`,
    };
    setMenuItems([...menuItems, duplicatedItem]);
  };

  const handleToggleStatus = (id) => {
    const updatedItems = menuItems.map((item) =>
      item.id === id
        ? {
            ...item,
            status: item.status === "available" ? "out_of_stock" : "available",
          }
        : item
    );
    setMenuItems(updatedItems);
  };

  // Category operations
  const handleAddCategory = (e) => {
    e.preventDefault();
    const category = {
      id: Date.now(),
      ...newCategory,
      itemCount: 0,
    };
    setCategories([...categories, category]);
    setShowCategoryModal(false);
    setNewCategory({ name: "", icon: "", color: "#3b82f6" });
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
      categoryId: item.categoryId.toString(),
      image: item.image,
      status: item.status,
      preparationTime: item.preparationTime.toString(),
      ingredients: item.ingredients,
      allergens: item.allergens,
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

  return (
    <div className="menu-management">
      {/* Header */}
      <div className="menu-header">
        <div className="header-left">
          <h1>Quản lý Thực đơn</h1>
          <p>Quản lý món ăn và danh mục thực đơn</p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-outline"
            onClick={() => setShowCategoryModal(true)}
          >
            <span>📁</span> Quản lý danh mục
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <span>➕</span> Thêm món mới
          </button>
        </div>
      </div>

      {/* Stats Cards */}
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

      {/* Categories */}
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
                selectedCategory === category.id.toString() ? "active" : ""
              }`}
              onClick={() => setSelectedCategory(category.id.toString())}
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
                <span>
                  {
                    menuItems.filter((item) => item.categoryId === category.id)
                      .length
                  }{" "}
                  món
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters and Search */}
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

      {/* Menu Items */}
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

      {/* Add/Edit Modal */}
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

      {/* Category Modal */}
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
              <h3>Thêm danh mục mới</h3>
              <button
                className="close-btn"
                onClick={() => setShowCategoryModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="modal-form">
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
                  Thêm danh mục
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
