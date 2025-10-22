// src/pages/Restaurant/MenuManagement/components/MenuItemModal/MenuItemModal.jsx
import React, { useState, useEffect } from "react";
import Modal from "../../../../common/Modal";
import "./MenuItemModal.scss";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";

const UPDATE_MENUITEM = gql`
  mutation UpdateMenuItem($input: UpdateMenuItemInput!) {
    updateMenuItem(input: $input) {
      id
      restaurantId
      menuId
      categoryId
      name
      description
      basePrice
      preparationMethods {
        name
        price
      }
      thumbImage
      mediaAssetIds
      modifierGroupIds
      status
      avgPrepTimeMin
      recipe
      notes
      point
      createdAt
      updatedAt
    }
  }
`;

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
    categoryId: "",
    status: "available",
    thumbImage: "",
    description: "",
    preparationMethods: [
      { name: "", price: "", cookTime: "", unit: "portion" },
    ],
  });
  const [toasts, setToasts] = useState([]);

  const pushToast = (text, type = "success") =>
    setToasts((t) => [
      ...t,
      { id: crypto?.randomUUID?.() || String(Math.random()), text, type },
    ]);

  const [updateMenuItemMutation] = useMutation(UPDATE_MENUITEM, {
    onError: (e) => {
      pushToast(`Lỗi cập nhật món: ${e.message}`, "error");
      onSave?.();
    },
    onCompleted: () => {
      pushToast("Cập nhật món thành công", "success");
      onSave?.();
    },
  });

  // Load data khi edit
  useEffect(() => {
    if (editId && Array.isArray(menuItems)) {
      const item = menuItems.find((i) => i.id === editId);
      if (item) {
        // Ưu tiên dùng item.preparationMethods (chuẩn BE)
        let pm = Array.isArray(item.preparationMethods)
          ? item.preparationMethods.map((m) => ({
              name: m.name,
              price: m.price,
              // UI có cookTime để tính avg; nếu không có thì mượn avgPrepTimeMin
              cookTime: item.avgPrepTimeMin || "",
              unit: "portion",
            }))
          : [];

        setFormData({
          name: item.name || "",
          categoryId:
            item.categoryId || item.category?.id || item.category || "",
          status: item.status || "available",
          thumbImage: item.thumbImage || "",
          description: item.description || "",
          preparationMethods: pm.length
            ? pm
            : [{ name: "", price: "", cookTime: "", unit: "portion" }],
        });
      }
    } else {
      // Reset form
      setFormData({
        name: "",
        categoryId: "",
        status: "available",
        thumbImage: "",
        description: "",
        preparationMethods: [
          { name: "", price: "", cookTime: "", unit: "portion" },
        ],
      });
    }
  }, [editId, menuItems, isOpen]);

  const handleInputChange = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handlePMChange = (index, field, value) =>
    setFormData((prev) => ({
      ...prev,
      preparationMethods: prev.preparationMethods.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      ),
    }));

  const addPM = () =>
    setFormData((prev) => ({
      ...prev,
      preparationMethods: [
        ...prev.preparationMethods,
        { name: "", price: "", cookTime: "", unit: "portion" },
      ],
    }));

  const removePM = (index) => {
    if (formData.preparationMethods.length > 1) {
      setFormData((prev) => ({
        ...prev,
        preparationMethods: prev.preparationMethods.filter(
          (_, i) => i !== index
        ),
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.categoryId) {
      alert("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    const validPM = formData.preparationMethods.filter(
      (m) => m.name.trim() && m.price !== "" && m.cookTime !== ""
    );
    if (!validPM.length) {
      alert("Vui lòng thêm ít nhất một cách chế biến");
      return;
    }

    // Tính avgPrepTimeMin từ cookTime của các preparationMethods (số nguyên phút)
    const cookTimes = validPM
      .map((m) => parseInt(m.cookTime, 10))
      .filter((n) => Number.isFinite(n) && n >= 0);

    const avgPrepTimeMin =
      cookTimes.length > 0
        ? Math.round(cookTimes.reduce((a, b) => a + b, 0) / cookTimes.length)
        : undefined;

    // XÂY DỰNG INPUT ĐÚNG SCHEMA: dùng preparationMethods, KHÔNG dùng image
    const inputPayload = {
      id: editId,
      name: formData.name,
      categoryId: formData.categoryId,
      status: formData.status,
      description: formData.description,
      preparationMethods: validPM.map((m) => ({
        name: m.name,
        price: parseFloat(m.price),
      })),
      ...(Number.isFinite(avgPrepTimeMin) ? { avgPrepTimeMin } : {}),
      ...(formData.thumbImage?.trim()
        ? { thumbImage: formData.thumbImage.trim() }
        : {}),
    };

    updateMenuItemMutation({
      variables: {
        input: inputPayload,
      },
    });
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
                value={formData.categoryId}
                onChange={(e) =>
                  handleInputChange("categoryId", e.target.value)
                }
                required
              >
                <option value="">Chọn danh mục</option>
                {Array.isArray(categories) &&
                  categories.map((c) => (
                    <option key={c.id || c._id || c.name} value={c.id || c._id}>
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
              <label className="form-label">Ảnh món ăn (URL/emoji)</label>
              <input
                type="text"
                className="form-input"
                value={formData.thumbImage}
                onChange={(e) =>
                  handleInputChange("thumbImage", e.target.value)
                }
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
            <button type="button" className="btn btn--primary" onClick={addPM}>
              ➕ Thêm cách
            </button>
          </div>

          <div className="methods-list">
            {formData.preparationMethods.map((method, index) => (
              <div key={index} className="method-item">
                <div className="method-header">
                  <h5 className="method-title">Cách chế biến {index + 1}</h5>
                  {formData.preparationMethods.length > 1 && (
                    <button
                      type="button"
                      className="btn btn--danger btn--small"
                      onClick={() => removePM(index)}
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
                        handlePMChange(index, "name", e.target.value)
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
                        handlePMChange(index, "price", e.target.value)
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
                        handlePMChange(index, "cookTime", e.target.value)
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
                        handlePMChange(index, "unit", e.target.value)
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
