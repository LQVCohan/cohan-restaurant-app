import React, { useState, useEffect } from "react";
import Modal from "../../../../common/Modal";
import FormGroup from "../Form/FormGroup";
import FormLabel from "../Form/FormLabel";
import FormInput from "../Form/FormInput";
import FormSelect from "../Form/FormSelect";
import FormTextarea from "../Form/FormTextarea";
import Button from "../../../../common/Button";
import {
  SUPPLY_CATEGORIES,
  SUPPLY_UNITS,
} from "../../../../../utils/constants";

const SupplyModal = ({ isOpen, onClose, onSave, onDelete, supply = null }) => {
  const [formData, setFormData] = useState({
    name: "",
    category: "beverage",
    unit: "chai",
    currentStock: "",
    minStock: "",
    costPrice: "",
    supplier: "",
    notes: "",
  });

  const [errors, setErrors] = useState({});
  const isEditing = !!supply;

  useEffect(() => {
    if (supply) {
      setFormData({
        name: supply.name,
        category: supply.category,
        unit: supply.unit,
        currentStock: supply.currentStock.toString(),
        minStock: supply.minStock.toString(),
        costPrice: supply.costPrice.toString(),
        supplier: supply.supplier,
        notes: supply.notes,
      });
    } else {
      setFormData({
        name: "",
        category: "beverage",
        unit: "chai",
        currentStock: "",
        minStock: "",
        costPrice: "",
        supplier: "",
        notes: "",
      });
    }
    setErrors({});
  }, [supply, isOpen]);

  const handleChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Tên vật phẩm là bắt buộc";
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

    const supplyData = {
      ...formData,
      currentStock: parseFloat(formData.currentStock) || 0,
      minStock: parseFloat(formData.minStock) || 0,
      costPrice: parseInt(formData.costPrice) || 0,
      icon: getSupplyCategoryIcon(formData.category),
    };

    onSave(supplyData);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa vật phẩm này?")) {
      onDelete(supply.id);
      onClose();
    }
  };

  const getSupplyCategoryIcon = (category) => {
    const icons = {
      beverage: "🥤",
      cleaning: "🧻",
      packaging: "📦",
      utensil: "🍴",
    };
    return icons[category] || "📦";
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Chỉnh sửa vật phẩm" : "Thêm vật phẩm"}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <FormGroup>
            <FormLabel required>Tên vật phẩm</FormLabel>
            <FormInput
              placeholder="Ví dụ: Coca Cola"
              value={formData.name}
              onChange={handleChange("name")}
              required
            />
            {errors.name && <div className="error-message">{errors.name}</div>}
          </FormGroup>

          <FormGroup>
            <FormLabel>Danh mục</FormLabel>
            <FormSelect
              options={SUPPLY_CATEGORIES}
              value={formData.category}
              onChange={handleChange("category")}
            />
          </FormGroup>
        </div>

        <div className="form-row-3">
          <FormGroup>
            <FormLabel>Đơn vị tính</FormLabel>
            <FormSelect
              options={SUPPLY_UNITS}
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
            placeholder="Ghi chú về vật phẩm..."
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

export default SupplyModal;
