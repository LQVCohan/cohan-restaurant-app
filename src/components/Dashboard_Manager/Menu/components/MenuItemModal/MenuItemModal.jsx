// src/pages/Restaurant/MenuManagement/components/MenuItemModal/MenuItemModal.jsx
import React, { useState, useEffect } from "react";
import Modal from "../../../../common/Modal";
import "./MenuItemModal.scss";

const MenuItemModal = ({
  isOpen,
  editId,
  categories,
  menuItems,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    status: "available",
    image: "",
    description: "",
    // Chỉ còn methods (dùng cho UI) — sẽ map từ/ra preparationMethods ở tầng mutation nếu cần
    methods: [{ name: "", price: "", cookTime: "", unit: "portion" }],
  });

  // Load data khi edit
  useEffect(() => {
    if (editId && Array.isArray(menuItems)) {
      const item = menuItems.find((i) => i.id === editId);
      if (item) {
        // Ưu tiên lấy từ item.methods (nếu normalize ở trang manager đã có)
        let methods = Array.isArray(item.methods) ? item.methods : [];
        // fallback từ preparationMethods (BE) -> map về methods cho UI modal
        if (!methods.length && Array.isArray(item.preparationMethods)) {
          methods = item.preparationMethods.map((m) => ({
            name: m.name,
            price: m.price,
            // cookTime không có ở m — lấy avgPrepTimeMin nếu có trong item
            cookTime: item.avgPrepTimeMin || "",
            unit: "portion",
          }));
        }
        setFormData({
          name: item.name || "",
          category: item.category || "",
          status: item.status || "available",
          image: item.image || "",
          description: item.description || "",
          methods: methods.length
            ? methods
            : [{ name: "", price: "", cookTime: "", unit: "portion" }],
        });
      }
    } else {
      // Reset form
      setFormData({
        name: "",
        category: "",
        status: "available",
        image: "",
        description: "",
        methods: [{ name: "", price: "", cookTime: "", unit: "portion" }],
      });
    }
  }, [editId, menuItems, isOpen]);

  const handleInputChange = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleMethodChange = (index, field, value) =>
    setFormData((prev) => ({
      ...prev,
      methods: prev.methods.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      ),
    }));

  const addMethod = () =>
    setFormData((prev) => ({
      ...prev,
      methods: [
        ...prev.methods,
        { name: "", price: "", cookTime: "", unit: "portion" },
      ],
    }));

  const removeMethod = (index) => {
    if (formData.methods.length > 1) {
      setFormData((prev) => ({
        ...prev,
        methods: prev.methods.filter((_, i) => i !== index),
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.category) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    const validMethods = formData.methods.filter(
      (m) => m.name.trim() && m.price !== "" && m.cookTime !== ""
    );
    if (!validMethods.length) {
      alert("Vui lòng thêm ít nhất một cách chế biến");
      return;
    }

    const processedData = {
      ...formData,
      methods: validMethods.map((m) => ({
        ...m,
        price: parseFloat(m.price),
        cookTime: parseInt(m.cookTime),
      })),
    };

    // Lưu ý: nếu BE của bạn nhận "preparationMethods",
    // thì ở mutation bạn map processedData.methods -> preparationMethods trước khi gửi.
    onSave(processedData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editId ? "Chi tiết món ăn" : "Thêm món ăn"}
      size="large"
      className="menu-item-modal"
    >
      <form onSubmit={handleSubmit} className="menu-item-form">
        {/* Thông tin cơ bản */}
        <div className="form-section">
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Tên món ăn *</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Danh mục *</label>
              <select
                className="form-select"
                value={formData.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
                required
              >
                <option value="">Chọn danh mục</option>
                {Array.isArray(categories) &&
                  categories.map((c) => (
                    <option key={c.id || c._id || c.name} value={c.name}>
                      {c.icon ? `${c.icon} ` : ""}
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Trạng thái</label>
              <select
                className="form-select"
                value={formData.status}
                onChange={(e) => handleInputChange("status", e.target.value)}
              >
                <option value="available">Có sẵn</option>
                <option value="unavailable">Không có sẵn</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ảnh món ăn</label>
              <input
                type="text"
                className="form-input"
                value={formData.image}
                onChange={(e) => handleInputChange("image", e.target.value)}
                placeholder="URL ảnh hoặc emoji"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mô tả</label>
            <textarea
              className="form-textarea"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows="3"
            />
          </div>
        </div>

        {/* Cách chế biến */}
        <div className="form-section">
          <div className="section-header">
            <h4 className="section-title">🍳 Cách chế biến</h4>
            <button
              type="button"
              className="btn btn--primary"
              onClick={addMethod}
            >
              ➕ Thêm cách
            </button>
          </div>

          <div className="methods-list">
            {formData.methods.map((method, index) => (
              <div key={index} className="method-item">
                <div className="method-header">
                  <h5 className="method-title">Cách chế biến {index + 1}</h5>
                  {formData.methods.length > 1 && (
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      onClick={() => removeMethod(index)}
                    >
                      🗑️ Xóa
                    </button>
                  )}
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Tên cách chế biến</label>
                    <input
                      type="text"
                      className="form-input"
                      value={method.name}
                      onChange={(e) =>
                        handleMethodChange(index, "name", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Giá (VNĐ)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={method.price}
                      onChange={(e) =>
                        handleMethodChange(index, "price", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Thời gian nấu (phút)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={method.cookTime}
                      onChange={(e) =>
                        handleMethodChange(index, "cookTime", e.target.value)
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Đơn vị tính</label>
                    <select
                      className="form-select"
                      value={method.unit}
                      onChange={(e) =>
                        handleMethodChange(index, "unit", e.target.value)
                      }
                    >
                      <option value="portion">Phần</option>
                      <option value="kg">Kg</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onClose}
          >
            Hủy
          </button>
          <button type="submit" className="btn btn--primary">
            {editId ? "Cập nhật món ăn" : "Lưu món ăn"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default MenuItemModal;
