import React, { useState, useEffect } from "react";
import Modal from "../../common/Modal/Modal";
import FormGroup from "../../common/Form/FormGroup";
import FormLabel from "../../common/Form/FormLabel";
import FormInput from "../../common/Form/FormInput";
import FormSelect from "../../common/Form/FormSelect";
import FormTextarea from "../../common/Form/FormTextarea";
import Button from "../../common/Button/Button";
import { INGREDIENT_CATEGORIES, UNITS } from "../../../utils/constants";

const IngredientModal = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  ingredient = null,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    category: "meat",
    unit: "kg",
    currentStock: "",
    minStock: "",
    costPrice: "",
    supplier: "",
    notes: "",
  });

  const [errors, setErrors] = useState({});
  const isEditing = !!ingredient;

  useEffect(() => {
    if (ingredient) {
      setFormData({
        name: ingredient.name,
        category: ingredient.category,
        unit: ingredient.unit,
        currentStock: ingredient.currentStock.toString(),
        minStock: ingredient.minStock.toString(),
        costPrice: ingredient.costPrice.toString(),
        supplier: ingredient.supplier,
        notes: ingredient.notes,
      });
    } else {
      setFormData({
        name: "",
        category: "meat",
        unit: "kg",
        currentStock: "",
        minStock: "",
        costPrice: "",
        supplier: "",
        notes: "",
      });
    }
    setErrors({});
  }, [ingredient, isOpen]);

  const handleChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Tên nguyên liệu là bắt buộc";
    }

    if (!formData.currentStock || parseFloat(formData.currentStock) < 0) {
      newErrors.currentStock = "Số lượng hiện tại phải >= 0";
    }

    if (!formData.minStock || parseFloat(formData.minStock) < 0) {
      newErrors.minStock = "Mức tối thiểu phải >= 0";
    }

    if (!formData.costPrice || parseInt(formData.costPrice) < 0) {
      newErrors.costPrice = "Giá nhập phải >= 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const ingredientData = {
      ...formData,
      currentStock: parseFloat(formData.currentStock) || 0,
      minStock: parseFloat(formData.minStock) || 0,
      costPrice: parseInt(formData.costPrice) || 0,
      icon: getCategoryIcon(formData.category),
    };

    onSave(ingredientData);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa nguyên liệu này?")) {
      onDelete(ingredient.id);
      onClose();
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      meat: "🥩",
      vegetable: "🥬",
      spice: "🧂",
      dairy: "🥛",
      grain: "🌾",
    };
    return icons[category] || "📦";
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Chỉnh sửa nguyên liệu" : "Thêm nguyên liệu"}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <FormGroup>
            <FormLabel required>Tên nguyên liệu</FormLabel>
            <FormInput
              placeholder="Ví dụ: Thịt bò Wagyu"
              value={formData.name}
              onChange={handleChange("name")}
              required
            />
            {errors.name && <div className="error-message">{errors.name}</div>}
          </FormGroup>

          <FormGroup>
            <FormLabel>Danh mục</FormLabel>
            <FormSelect
              options={INGREDIENT_CATEGORIES}
              value={formData.category}
              onChange={handleChange("category")}
            />
          </FormGroup>
        </div>

        <div className="form-row-3">
          <FormGroup>
            <FormLabel>Đơn vị tính</FormLabel>
            <FormSelect
              options={UNITS}
              value={formData.unit}
              onChange={handleChange("unit")}
            />
          </FormGroup>

          <FormGroup>
            <FormLabel required>Số lượng hiện tại</FormLabel>
            <FormInput
              type="number"
              placeholder="0"
              min="0"
              step="0.1"
              value={formData.currentStock}
              onChange={handleChange("currentStock")}
              required
            />
            {errors.currentStock && (
              <div className="error-message">{errors.currentStock}</div>
            )}
          </FormGroup>

          <FormGroup>
            <FormLabel required>Mức tối thiểu</FormLabel>
            <FormInput
              type="number"
              placeholder="0"
              min="0"
              step="0.1"
              value={formData.minStock}
              onChange={handleChange("minStock")}
              required
            />
            {errors.minStock && (
              <div className="error-message">{errors.minStock}</div>
            )}
          </FormGroup>
        </div>

        <div className="form-row">
          <FormGroup>
            <FormLabel required>Giá nhập (VNĐ)</FormLabel>
            <FormInput
              type="number"
              placeholder="0"
              min="0"
              value={formData.costPrice}
              onChange={handleChange("costPrice")}
              required
            />
            {errors.costPrice && (
              <div className="error-message">{errors.costPrice}</div>
            )}
          </FormGroup>

          <FormGroup>
            <FormLabel>Nhà cung cấp</FormLabel>
            <FormInput
              placeholder="Tên nhà cung cấp"
              value={formData.supplier}
              onChange={handleChange("supplier")}
            />
          </FormGroup>
        </div>

        <FormGroup>
          <FormLabel>Ghi chú</FormLabel>
          <FormTextarea
            placeholder="Ghi chú về nguyên liệu..."
            value={formData.notes}
            onChange={handleChange("notes")}
          />
        </FormGroup>

        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          {isEditing && (
            <Button type="button" variant="danger" onClick={handleDelete}>
              Xóa
            </Button>
          )}
          <Button type="submit" variant="primary">
            Lưu
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default IngredientModal;
