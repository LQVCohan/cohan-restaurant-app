import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Minus, Plus } from "lucide-react";
import { useOrder } from "../../../../hooks/useOrder";
import Modal from "../../../common/Modal";
import Button from "../../../common/Button";
import Input from "../../../common/Input";
import "./MenuItemModal.scss";

export default function MenuItemModal({ isOpen, open, onClose, menuItem }) {
  const visible = isOpen ?? open;
  const { addToOrder } = useOrder();
  const { register, handleSubmit, setValue, watch, reset } = useForm({
    defaultValues: {
      quantity: 1,
      cookingOption: "Bình thường",
      unit: "Phần",
      note: "",
    },
  });

  const quantity = watch("quantity");
  const [selectedCookingOption, setSelectedCookingOption] =
    useState("Bình thường");
  const [selectedUnit, setSelectedUnit] = useState("Phần");

  const cookingOptions = ["Bình thường", "Ít cay", "Cay vừa", "Cay nhiều"];
  const unitOptions = ["Phần", "Kg", "Suất"];

  useEffect(() => {
    if (visible && menuItem) {
      reset({
        quantity: 1,
        cookingOption: "Bình thường",
        unit: "Phần",
        note: "",
      });
      setSelectedCookingOption("Bình thường");
      setSelectedUnit("Phần");
    }
  }, [visible, menuItem, reset]);

  const handleQuantityChange = (change) => {
    const newQuantity = Math.max(1, quantity + change);
    setValue("quantity", newQuantity);
  };

  const onSubmit = (data) => {
    if (!menuItem) return;
    addToOrder(menuItem, {
      ...data,
      cookingOption: selectedCookingOption,
      unit: selectedUnit,
    });
    onClose?.();
  };

  if (!visible || !menuItem) return null;

  return (
    <Modal isOpen={visible} onClose={onClose} title={menuItem.name} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="menu-item-form">
        <div className="form-group">
          <label className="form-label">Cách chế biến:</label>
          <div className="options-grid">
            {cookingOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`option-btn ${
                  selectedCookingOption === option ? "selected" : ""
                }`}
                onClick={() => setSelectedCookingOption(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Đơn vị tính:</label>
          <div className="options-grid">
            {unitOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`option-btn ${
                  selectedUnit === option ? "selected" : ""
                }`}
                onClick={() => setSelectedUnit(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Số lượng:</label>
          <div className="quantity-input">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleQuantityChange(-1)}
            >
              <Minus size={16} />
            </Button>
            <input
              type="number"
              {...register("quantity", { min: 1 })}
              className="quantity-field"
              min="1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => handleQuantityChange(1)}
            >
              <Plus size={16} />
            </Button>
          </div>
        </div>

        <Input
          label="Ghi chú:"
          {...register("note")}
          placeholder="Ghi chú đặc biệt..."
        />

        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Thêm vào đơn
          </Button>
        </div>
      </form>
    </Modal>
  );
}
