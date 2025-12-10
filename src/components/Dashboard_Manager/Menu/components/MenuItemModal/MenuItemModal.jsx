// src/pages/Restaurant/MenuManagement/components/MenuItemModal/MenuItemModal.jsx
import React, { useState, useEffect, useMemo } from "react";
import Modal from "../../../../common/Modal";
import "./MenuItemModal.scss";

import useMenuManagement from "../../../../../hooks/useMenuManagement";
import useRecipes from "../../../../../hooks/useRecipes";

const MenuItemModal = ({
  isOpen,
  editId,
  categories,
  menuItems,
  restaurantId,
  timeSlot,
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
      {
        key: "",
        name: "",
        price: "",
        cookTime: "",
        unit: "portion",
        mode: "PORTION",
        yieldQty: 1,
        yieldUnit: "portion",
      },
    ],
  });

  const [toasts, setToasts] = useState([]);

  const pushToast = (text, type = "success") =>
    setToasts((t) => [
      ...t,
      { id: crypto?.randomUUID?.() || String(Math.random()), text, type },
    ]);

  // Lấy item hiện tại từ list menuItems mà parent pass xuống
  const currentItem = useMemo(
    () =>
      Array.isArray(menuItems) && editId
        ? menuItems.find((i) => i.id === editId)
        : null,
    [menuItems, editId]
  );

  // Hook menu management (chỉ dùng mutation)
  const { updateMenuItem } = useMenuManagement({
    restaurantId,
    defaultTimeSlot: timeSlot,
    pageSize: 1,
    useConnection: false,
  });

  // Hook recipes (dùng để upsert servingVariants)
  const { updateRecipe, loading: recipeLoading } = useRecipes(
    restaurantId,
    timeSlot,
    { search: null, categoryId: null }
  );

  /* ===========================
     Load dữ liệu khi mở modal
     =========================== */

  useEffect(() => {
    if (editId && currentItem) {
      const svList = Array.isArray(currentItem.servingVariants)
        ? currentItem.servingVariants
        : [];

      const methods =
        svList.length > 0
          ? svList.map((sv) => ({
              key: sv.key || "",
              name: sv.name || "",
              price:
                typeof sv.price === "number" && !Number.isNaN(sv.price)
                  ? sv.price
                  : "",
              cookTime:
                typeof currentItem.avgPrepTimeMin === "number"
                  ? currentItem.avgPrepTimeMin
                  : "",
              unit: sv.yieldUnit || "portion",
              mode: sv.mode || "PORTION",
              yieldQty:
                typeof sv.yieldQty === "number" && sv.yieldQty > 0
                  ? sv.yieldQty
                  : 1,
              yieldUnit: sv.yieldUnit || "portion",
            }))
          : [
              {
                key: "",
                name: "",
                price: "",
                cookTime: "",
                unit: "portion",
                mode: "PORTION",
                yieldQty: 1,
                yieldUnit: "portion",
              },
            ];

      setFormData({
        name: currentItem.name || "",
        categoryId:
          currentItem.categoryId ||
          currentItem.category?.id ||
          currentItem.category ||
          "",
        status: currentItem.status || "available",
        thumbImage: currentItem.thumbImage || "",
        description: currentItem.description || "",
        preparationMethods: methods,
      });
    } else if (!editId) {
      // Flow tạo mới nếu sau này bạn muốn dùng:
      setFormData({
        name: "",
        categoryId: "",
        status: "available",
        thumbImage: "",
        description: "",
        preparationMethods: [
          {
            key: "",
            name: "",
            price: "",
            cookTime: "",
            unit: "portion",
            mode: "PORTION",
            yieldQty: 1,
            yieldUnit: "portion",
          },
        ],
      });
    }
  }, [editId, currentItem, isOpen]);

  /* ===========================
     Handlers
     =========================== */

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
        {
          key: "",
          name: "",
          price: "",
          cookTime: "",
          unit: "portion",
          mode: "PORTION",
          yieldQty: 1,
          yieldUnit: "portion",
        },
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!restaurantId || !editId) {
      alert("Thiếu restaurantId hoặc editId.");
      return;
    }

    if (!formData.name.trim() || !formData.categoryId) {
      alert("Vui lòng điền đầy đủ tên món và danh mục");
      return;
    }

    const validPM = formData.preparationMethods.filter(
      (m) => m.name.trim() && m.price !== ""
    );
    if (!validPM.length) {
      alert("Vui lòng thêm ít nhất một cách chế biến (tên + giá).");
      return;
    }

    const cookTimes = validPM
      .map((m) => parseInt(m.cookTime, 10))
      .filter((n) => Number.isFinite(n) && n >= 0);

    const avgPrepTimeMin =
      cookTimes.length > 0
        ? Math.round(cookTimes.reduce((a, b) => a + b, 0) / cookTimes.length)
        : undefined;

    try {
      // 1) Update MenuItem bằng hook useMenuManagement
      const menuItemPayload = {
        id: editId,
        name: formData.name,
        categoryId: formData.categoryId,
        status: formData.status,
        description: formData.description,
        ...(Number.isFinite(avgPrepTimeMin) ? { avgPrepTimeMin } : {}),
        ...(formData.thumbImage?.trim()
          ? { thumbImage: formData.thumbImage.trim() }
          : {}),
      };

      await updateMenuItem(menuItemPayload);

      // 2) Chuẩn hóa form -> form cho useRecipes.updateRecipe
      const recipeForm = {
        description: formData.description,
        servingVariants: formData.preparationMethods.map((m, idx) => {
          const isByWeight = m.mode === "BY_WEIGHT";

          // Giữ key cũ nếu đã có, tránh tạo bản mới
          const fallbackKey =
            (m.name || "").toLowerCase().replace(/\s+/g, "_") || `sv_${idx}`;

          return {
            key: m.key || fallbackKey,
            mode: m.mode || "PORTION",
            yieldQty:
              typeof m.yieldQty === "number" && m.yieldQty > 0 ? m.yieldQty : 1,
            yieldUnit: m.yieldUnit || (isByWeight ? "100g" : "portion"),
            preparationMethodName: m.name,
            ingredients: [], // chưa edit nguyên liệu ở modal này
            price:
              m.price !== "" && !Number.isNaN(Number(m.price))
                ? Number(m.price)
                : 0,
          };
        }),
      };

      // 3) Upsert recipe bằng hook useRecipes
      await updateRecipe(editId, recipeForm);

      pushToast("Cập nhật món ăn thành công", "success");
      onSave?.();
    } catch (err) {
      console.error("Update menu item / recipe error:", err);
      pushToast(`Lỗi cập nhật món: ${err.message}`, "error");
    }
  };

  const isSaving = recipeLoading; // có thể kết hợp thêm state loading riêng nếu muốn

  /* ===========================
     Render
     =========================== */

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
          <button
            type="submit"
            className="btn btn--primary"
            disabled={isSaving}
          >
            {isSaving
              ? "Đang lưu..."
              : editId
              ? "Cập nhật món ăn"
              : "Lưu món ăn"}
          </button>
        </div>
      </form>

      {/* Toasts đơn giản */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast--${t.type || "success"}`}>
              {t.text}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default MenuItemModal;
