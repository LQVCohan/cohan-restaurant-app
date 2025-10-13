import React, { useState, useEffect } from "react";
import Modal from "../../common/Modal/Modal";
import FormGroup from "../../common/Form/FormGroup";
import FormLabel from "../../common/Form/FormLabel";
import FormInput from "../../common/Form/FormInput";
import FormSelect from "../../common/Form/FormSelect";
import FormTextarea from "../../common/Form/FormTextarea";
import Button from "../../common/Button/Button";
import Card from "../../common/Card/Card";
import { useRecipes } from "../../../hooks/useRecipes";
import { useAllocation } from "../../../hooks/useAllocation";
import { useIngredients } from "../../../hooks/useIngredients";
import { formatPrice } from "../../../utils/formatters";

const AllocationModal = ({ isOpen, onClose, onSuccess }) => {
  const { recipes } = useRecipes();
  const { ingredients } = useIngredients();
  const { canMakeRecipe, getMaxQuantity, allocateIngredients } =
    useAllocation();

  const [formData, setFormData] = useState({
    recipeId: "",
    methodId: "",
    quantity: 1,
    notes: "",
  });

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [maxQuantity, setMaxQuantity] = useState(0);
  const [canMake, setCanMake] = useState({ canMake: false, missing: [] });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (formData.recipeId) {
      const recipe = recipes.find((r) => r.id === parseInt(formData.recipeId));
      setSelectedRecipe(recipe);

      if (recipe && recipe.methods.length > 0) {
        const firstMethodId = recipe.methods[0].id.toString();
        setFormData((prev) => ({ ...prev, methodId: firstMethodId }));
      }
    } else {
      setSelectedRecipe(null);
      setSelectedMethod(null);
    }
  }, [formData.recipeId, recipes]);

  useEffect(() => {
    if (selectedRecipe && formData.methodId) {
      const method = selectedRecipe.methods.find(
        (m) => m.id === parseInt(formData.methodId)
      );
      setSelectedMethod(method);

      if (method) {
        const max = getMaxQuantity(selectedRecipe, method);
        setMaxQuantity(max);

        const checkResult = canMakeRecipe(
          selectedRecipe,
          method,
          formData.quantity
        );
        setCanMake(checkResult);
      }
    }
  }, [
    selectedRecipe,
    formData.methodId,
    formData.quantity,
    getMaxQuantity,
    canMakeRecipe,
  ]);

  const handleChange = (field) => (e) => {
    const value =
      field === "quantity" ? parseInt(e.target.value) || 1 : e.target.value;
    setFormData({ ...formData, [field]: value });

    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.recipeId) {
      newErrors.recipeId = "Chọn công thức";
    }

    if (!formData.methodId) {
      newErrors.methodId = "Chọn phương pháp chế biến";
    }

    if (!formData.quantity || formData.quantity < 1) {
      newErrors.quantity = "Số lượng phải >= 1";
    }

    if (formData.quantity > maxQuantity) {
      newErrors.quantity = `Số lượng tối đa có thể làm: ${maxQuantity}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!canMake.canMake) {
      alert("Không đủ nguyên liệu để thực hiện phân bổ này");
      return;
    }

    const result = allocateIngredients(
      parseInt(formData.recipeId),
      parseInt(formData.methodId),
      formData.quantity,
      formData.notes
    );

    if (result.success) {
      onSuccess && onSuccess(result.allocation);
      onClose();
      // Reset form
      setFormData({
        recipeId: "",
        methodId: "",
        quantity: 1,
        notes: "",
      });
    } else {
      alert(result.error);
    }
  };

  const getIngredientName = (ingredientId) => {
    const ingredient = ingredients.find((i) => i.id === ingredientId);
    return ingredient ? ingredient.name : "Không tìm thấy";
  };

  const calculateTotalCost = () => {
    if (!selectedMethod) return 0;

    return selectedMethod.ingredients.reduce((total, ing) => {
      const ingredient = ingredients.find((i) => i.id === ing.ingredientId);
      if (ingredient) {
        return total + ingredient.costPrice * ing.amount * formData.quantity;
      }
      return total;
    }, 0);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📋 Phân bổ nguyên liệu"
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <FormGroup>
            <FormLabel required>Chọn công thức</FormLabel>
            <FormSelect
              options={recipes.map((recipe) => ({
                value: recipe.id.toString(),
                label: `${recipe.icon} ${recipe.name}`,
              }))}
              value={formData.recipeId}
              onChange={handleChange("recipeId")}
              placeholder="Chọn công thức..."
            />
            {errors.recipeId && (
              <div className="error-message">{errors.recipeId}</div>
            )}
          </FormGroup>

          {selectedRecipe && (
            <FormGroup>
              <FormLabel required>Phương pháp chế biến</FormLabel>
              <FormSelect
                options={selectedRecipe.methods.map((method) => ({
                  value: method.id.toString(),
                  label: method.name,
                }))}
                value={formData.methodId}
                onChange={handleChange("methodId")}
              />
              {errors.methodId && (
                <div className="error-message">{errors.methodId}</div>
              )}
            </FormGroup>
          )}
        </div>

        {selectedMethod && (
          <>
            <div className="form-row">
              <FormGroup>
                <FormLabel required>Số lượng</FormLabel>
                <FormInput
                  type="number"
                  min="1"
                  max={maxQuantity}
                  value={formData.quantity}
                  onChange={handleChange("quantity")}
                />
                <div className="quantity-info">
                  Tối đa có thể làm: <strong>{maxQuantity}</strong> phần
                </div>
                {errors.quantity && (
                  <div className="error-message">{errors.quantity}</div>
                )}
              </FormGroup>

              <FormGroup>
                <FormLabel>Ghi chú</FormLabel>
                <FormTextarea
                  placeholder="Ghi chú về việc phân bổ..."
                  value={formData.notes}
                  onChange={handleChange("notes")}
                  rows={3}
                />
              </FormGroup>
            </div>

            {/* Ingredient Requirements */}
            <Card className="allocation-preview">
              <h4>📋 Nguyên liệu cần thiết</h4>
              <div className="ingredients-table">
                <div className="table-header">
                  <div>Nguyên liệu</div>
                  <div>Cần thiết</div>
                  <div>Tồn kho</div>
                  <div>Trạng thái</div>
                </div>
                {selectedMethod.ingredients.map((ing, index) => {
                  const ingredient = ingredients.find(
                    (i) => i.id === ing.ingredientId
                  );
                  const needed = ing.amount * formData.quantity;
                  const available = ingredient ? ingredient.currentStock : 0;
                  const isEnough = available >= needed;

                  return (
                    <div
                      key={index}
                      className={`table-row ${!isEnough ? "insufficient" : ""}`}
                    >
                      <div>{getIngredientName(ing.ingredientId)}</div>
                      <div>
                        {needed} {ing.unit}
                      </div>
                      <div>
                        {available} {ing.unit}
                      </div>
                      <div>
                        {isEnough ? (
                          <span className="status-ok">✅ Đủ</span>
                        ) : (
                          <span className="status-insufficient">
                            ❌ Thiếu {needed - available} {ing.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="cost-summary">
                <div className="cost-item">
                  <span>Tổng chi phí:</span>
                  <span className="cost-value">
                    {formatPrice(calculateTotalCost())}
                  </span>
                </div>
                <div className="cost-item">
                  <span>Chi phí/phần:</span>
                  <span className="cost-value">
                    {formatPrice(calculateTotalCost() / formData.quantity)}
                  </span>
                </div>
              </div>
            </Card>
          </>
        )}

        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={!canMake.canMake || maxQuantity === 0}
          >
            Phân bổ nguyên liệu
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AllocationModal;
