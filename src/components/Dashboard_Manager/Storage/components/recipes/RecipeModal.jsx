import React, { useState, useEffect } from "react";
import Modal from "../../../../common/Modal";
import FormGroup from "../Form/FormGroup";
import FormLabel from "../Form/FormLabel";
import FormInput from "../Form/FormInput";
import FormSelect from "../Form/FormSelect";
import FormTextarea from "../Form/FormTextarea";
import Button from "../../../../common/Button";
import Card from "../../../../common/Card";
import { RECIPE_CATEGORIES, UNITS } from "../../../../../utils/constants";
import { useIngredients } from "../../../../../hooks/useIngredients";
import { formatPrice } from "../../../../../utils/formatters";

const RecipeModal = ({ isOpen, onClose, onSave, onDelete, recipe = null }) => {
  const { ingredients } = useIngredients();
  const [formData, setFormData] = useState({
    name: "",
    category: "main",
    description: "",
    baseIngredients: [],
    methods: [],
  });

  const [errors, setErrors] = useState({});
  const [activeMethodIndex, setActiveMethodIndex] = useState(0);
  const isEditing = !!recipe;

  useEffect(() => {
    if (recipe) {
      setFormData({
        name: recipe.name,
        category: recipe.category,
        description: recipe.description,
        baseIngredients: recipe.baseIngredients || [],
        methods: recipe.methods || [],
      });
    } else {
      setFormData({
        name: "",
        category: "main",
        description: "",
        baseIngredients: [],
        methods: [
          {
            id: 1,
            name: "Phương pháp cơ bản",
            description: "",
            ingredients: [],
          },
        ],
      });
    }
    setErrors({});
    setActiveMethodIndex(0);
  }, [recipe, isOpen]);

  const handleChange = (field) => (e) => {
    setFormData({ ...formData, [field]: e.target.value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const handleBaseIngredientAdd = () => {
    setFormData({
      ...formData,
      baseIngredients: [
        ...formData.baseIngredients,
        { ingredientId: "", amount: "", unit: "kg" },
      ],
    });
  };

  const handleBaseIngredientChange = (index, field, value) => {
    const newIngredients = [...formData.baseIngredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setFormData({ ...formData, baseIngredients: newIngredients });
  };

  const handleBaseIngredientRemove = (index) => {
    const newIngredients = formData.baseIngredients.filter(
      (_, i) => i !== index
    );
    setFormData({ ...formData, baseIngredients: newIngredients });
  };

  const handleMethodAdd = () => {
    const newMethodId = Math.max(...formData.methods.map((m) => m.id), 0) + 1;
    setFormData({
      ...formData,
      methods: [
        ...formData.methods,
        {
          id: newMethodId,
          name: `Phương pháp ${newMethodId}`,
          description: "",
          ingredients: [...formData.baseIngredients],
        },
      ],
    });
    setActiveMethodIndex(formData.methods.length);
  };

  const handleMethodChange = (methodIndex, field, value) => {
    const newMethods = [...formData.methods];
    newMethods[methodIndex] = { ...newMethods[methodIndex], [field]: value };
    setFormData({ ...formData, methods: newMethods });
  };

  const handleMethodIngredientChange = (
    methodIndex,
    ingredientIndex,
    field,
    value
  ) => {
    const newMethods = [...formData.methods];
    newMethods[methodIndex].ingredients[ingredientIndex] = {
      ...newMethods[methodIndex].ingredients[ingredientIndex],
      [field]: value,
    };
    setFormData({ ...formData, methods: newMethods });
  };

  const handleMethodIngredientAdd = (methodIndex) => {
    const newMethods = [...formData.methods];
    newMethods[methodIndex].ingredients.push({
      ingredientId: "",
      amount: "",
      unit: "kg",
    });
    setFormData({ ...formData, methods: newMethods });
  };

  const handleMethodIngredientRemove = (methodIndex, ingredientIndex) => {
    const newMethods = [...formData.methods];
    newMethods[methodIndex].ingredients = newMethods[
      methodIndex
    ].ingredients.filter((_, i) => i !== ingredientIndex);
    setFormData({ ...formData, methods: newMethods });
  };

  const handleMethodRemove = (methodIndex) => {
    if (formData.methods.length <= 1) {
      alert("Phải có ít nhất một phương pháp chế biến");
      return;
    }

    const newMethods = formData.methods.filter((_, i) => i !== methodIndex);
    setFormData({ ...formData, methods: newMethods });

    if (activeMethodIndex >= newMethods.length) {
      setActiveMethodIndex(newMethods.length - 1);
    }
  };

  const calculateMethodCost = (method) => {
    return method.ingredients.reduce((total, ing) => {
      const ingredient = ingredients.find(
        (i) => i.id === parseInt(ing.ingredientId)
      );
      if (ingredient && ing.amount) {
        return total + ingredient.costPrice * parseFloat(ing.amount);
      }
      return total;
    }, 0);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Tên món ăn là bắt buộc";
    }

    if (!formData.description.trim()) {
      newErrors.description = "Mô tả món ăn là bắt buộc";
    }

    if (formData.baseIngredients.length === 0) {
      newErrors.baseIngredients = "Phải có ít nhất một nguyên liệu cơ bản";
    }

    // Validate base ingredients
    formData.baseIngredients.forEach((ing, index) => {
      if (!ing.ingredientId) {
        newErrors[`baseIngredient_${index}_id`] = "Chọn nguyên liệu";
      }
      if (!ing.amount || parseFloat(ing.amount) <= 0) {
        newErrors[`baseIngredient_${index}_amount`] = "Số lượng phải > 0";
      }
    });

    // Validate methods
    formData.methods.forEach((method, methodIndex) => {
      if (!method.name.trim()) {
        newErrors[`method_${methodIndex}_name`] = "Tên phương pháp là bắt buộc";
      }
      if (!method.description.trim()) {
        newErrors[`method_${methodIndex}_description`] =
          "Mô tả phương pháp là bắt buộc";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const recipeData = {
      ...formData,
      baseIngredients: formData.baseIngredients.map((ing) => ({
        ...ing,
        ingredientId: parseInt(ing.ingredientId),
        amount: parseFloat(ing.amount),
      })),
      methods: formData.methods.map((method) => ({
        ...method,
        ingredients: method.ingredients.map((ing) => ({
          ...ing,
          ingredientId: parseInt(ing.ingredientId),
          amount: parseFloat(ing.amount),
        })),
      })),
      icon: getRecipeCategoryIcon(formData.category),
    };

    onSave(recipeData);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa công thức này?")) {
      onDelete(recipe.id);
      onClose();
    }
  };

  const getRecipeCategoryIcon = (category) => {
    const icons = {
      appetizer: "🥗",
      main: "🍽️",
      dessert: "🍰",
      drink: "🥤",
    };
    return icons[category] || "🍽️";
  };

  const getIngredientName = (ingredientId) => {
    const ingredient = ingredients.find((i) => i.id === parseInt(ingredientId));
    return ingredient ? ingredient.name : "Chọn nguyên liệu";
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Chỉnh sửa công thức" : "Thêm công thức"}
      size="xl"
    >
      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div className="recipe-section">
          <h3 className="section-title">📝 Thông tin cơ bản</h3>

          <div className="form-row">
            <FormGroup>
              <FormLabel required>Tên món ăn</FormLabel>
              <FormInput
                placeholder="Ví dụ: Bò Wagyu nướng"
                value={formData.name}
                onChange={handleChange("name")}
                required
              />
              {errors.name && (
                <div className="error-message">{errors.name}</div>
              )}
            </FormGroup>

            <FormGroup>
              <FormLabel>Danh mục</FormLabel>
              <FormSelect
                options={RECIPE_CATEGORIES}
                value={formData.category}
                onChange={handleChange("category")}
              />
            </FormGroup>
          </div>

          <FormGroup>
            <FormLabel required>Mô tả món ăn</FormLabel>
            <FormTextarea
              placeholder="Mô tả chi tiết về món ăn..."
              value={formData.description}
              onChange={handleChange("description")}
              rows={3}
            />
            {errors.description && (
              <div className="error-message">{errors.description}</div>
            )}
          </FormGroup>
        </div>

        {/* Base Ingredients */}
        <div className="recipe-section">
          <div className="section-header">
            <h3 className="section-title">🥬 Nguyên liệu cơ bản</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleBaseIngredientAdd}
            >
              ➕ Thêm nguyên liệu
            </Button>
          </div>

          {formData.baseIngredients.map((ingredient, index) => (
            <Card key={index} className="ingredient-row">
              <div className="form-row-3">
                <FormGroup>
                  <FormLabel>Nguyên liệu</FormLabel>
                  <FormSelect
                    options={ingredients.map((ing) => ({
                      value: ing.id.toString(),
                      label: ing.name,
                    }))}
                    value={ingredient.ingredientId.toString()}
                    onChange={(e) =>
                      handleBaseIngredientChange(
                        index,
                        "ingredientId",
                        e.target.value
                      )
                    }
                    placeholder="Chọn nguyên liệu"
                  />
                  {errors[`baseIngredient_${index}_id`] && (
                    <div className="error-message">
                      {errors[`baseIngredient_${index}_id`]}
                    </div>
                  )}
                </FormGroup>

                <FormGroup>
                  <FormLabel>Số lượng</FormLabel>
                  <FormInput
                    type="number"
                    placeholder="0"
                    min="0"
                    step="0.1"
                    value={ingredient.amount}
                    onChange={(e) =>
                      handleBaseIngredientChange(
                        index,
                        "amount",
                        e.target.value
                      )
                    }
                  />
                  {errors[`baseIngredient_${index}_amount`] && (
                    <div className="error-message">
                      {errors[`baseIngredient_${index}_amount`]}
                    </div>
                  )}
                </FormGroup>

                <FormGroup>
                  <FormLabel>Đơn vị</FormLabel>
                  <div className="input-with-action">
                    <FormSelect
                      options={UNITS}
                      value={ingredient.unit}
                      onChange={(e) =>
                        handleBaseIngredientChange(
                          index,
                          "unit",
                          e.target.value
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleBaseIngredientRemove(index)}
                    >
                      🗑️
                    </Button>
                  </div>
                </FormGroup>
              </div>
            </Card>
          ))}

          {errors.baseIngredients && (
            <div className="error-message">{errors.baseIngredients}</div>
          )}
        </div>

        {/* Cooking Methods */}
        <div className="recipe-section">
          <div className="section-header">
            <h3 className="section-title">👨‍🍳 Phương pháp chế biến</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleMethodAdd}
            >
              ➕ Thêm phương pháp
            </Button>
          </div>

          {/* Method Tabs */}
          <div className="method-tabs">
            {formData.methods.map((method, index) => (
              <button
                key={method.id}
                type="button"
                className={`method-tab ${
                  activeMethodIndex === index ? "active" : ""
                }`}
                onClick={() => setActiveMethodIndex(index)}
              >
                {method.name}
                {formData.methods.length > 1 && (
                  <span
                    className="method-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMethodRemove(index);
                    }}
                  >
                    ×
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Active Method Content */}
          {formData.methods[activeMethodIndex] && (
            <Card className="method-content">
              <div className="form-row">
                <FormGroup>
                  <FormLabel required>Tên phương pháp</FormLabel>
                  <FormInput
                    placeholder="Ví dụ: Nướng than hoa"
                    value={formData.methods[activeMethodIndex].name}
                    onChange={(e) =>
                      handleMethodChange(
                        activeMethodIndex,
                        "name",
                        e.target.value
                      )
                    }
                  />
                  {errors[`method_${activeMethodIndex}_name`] && (
                    <div className="error-message">
                      {errors[`method_${activeMethodIndex}_name`]}
                    </div>
                  )}
                </FormGroup>
              </div>

              <FormGroup>
                <FormLabel required>Mô tả cách làm</FormLabel>
                <FormTextarea
                  placeholder="Mô tả chi tiết cách chế biến..."
                  value={formData.methods[activeMethodIndex].description}
                  onChange={(e) =>
                    handleMethodChange(
                      activeMethodIndex,
                      "description",
                      e.target.value
                    )
                  }
                  rows={4}
                />
                {errors[`method_${activeMethodIndex}_description`] && (
                  <div className="error-message">
                    {errors[`method_${activeMethodIndex}_description`]}
                  </div>
                )}
              </FormGroup>

              {/* Method Ingredients */}
              <div className="method-ingredients">
                <div className="subsection-header">
                  <h4>Nguyên liệu cho phương pháp này</h4>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleMethodIngredientAdd(activeMethodIndex)}
                  >
                    ➕ Thêm nguyên liệu
                  </Button>
                </div>

                {formData.methods[activeMethodIndex].ingredients.map(
                  (ingredient, ingredientIndex) => (
                    <div
                      key={ingredientIndex}
                      className="method-ingredient-row"
                    >
                      <div className="form-row-3">
                        <FormGroup>
                          <FormSelect
                            options={ingredients.map((ing) => ({
                              value: ing.id.toString(),
                              label: ing.name,
                            }))}
                            value={ingredient.ingredientId.toString()}
                            onChange={(e) =>
                              handleMethodIngredientChange(
                                activeMethodIndex,
                                ingredientIndex,
                                "ingredientId",
                                e.target.value
                              )
                            }
                            placeholder="Chọn nguyên liệu"
                          />
                        </FormGroup>

                        <FormGroup>
                          <FormInput
                            type="number"
                            placeholder="0"
                            min="0"
                            step="0.1"
                            value={ingredient.amount}
                            onChange={(e) =>
                              handleMethodIngredientChange(
                                activeMethodIndex,
                                ingredientIndex,
                                "amount",
                                e.target.value
                              )
                            }
                          />
                        </FormGroup>

                        <FormGroup>
                          <div className="input-with-action">
                            <FormSelect
                              options={UNITS}
                              value={ingredient.unit}
                              onChange={(e) =>
                                handleMethodIngredientChange(
                                  activeMethodIndex,
                                  ingredientIndex,
                                  "unit",
                                  e.target.value
                                )
                              }
                            />
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() =>
                                handleMethodIngredientRemove(
                                  activeMethodIndex,
                                  ingredientIndex
                                )
                              }
                            >
                              🗑️
                            </Button>
                          </div>
                        </FormGroup>
                      </div>
                    </div>
                  )
                )}

                {/* Method Cost */}
                <div className="method-cost">
                  <strong>
                    Chi phí ước tính:{" "}
                    {formatPrice(
                      calculateMethodCost(formData.methods[activeMethodIndex])
                    )}
                  </strong>
                </div>
              </div>
            </Card>
          )}
        </div>

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

export default RecipeModal;
