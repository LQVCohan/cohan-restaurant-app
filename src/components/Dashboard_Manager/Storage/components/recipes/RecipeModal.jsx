// src/components/Dashboard_Manager/Storage/components/recipes/RecipeModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import Modal from "../../../../common/Modal";
import FormGroup from "../Form/FormGroup";
import FormLabel from "../Form/FormLabel";
import FormInput from "../Form/FormInput";
import FormSelect from "../Form/FormSelect";
import FormTextarea from "../Form/FormTextarea";
import Button from "../../../../common/Button";
import Card from "../../../../common/Card";
import { RECIPE_CATEGORIES, UNITS } from "../../../../../utils/constants";
import { formatPrice } from "../../../../../utils/formatters";
import { toBaseQty, fromBaseQty } from "../../../../../utils/unitConversion";

const RecipeModal = ({
  isOpen,
  onClose,
  onSave, // async (recipeData) => void
  onDelete, // async (menuItemId) => void
  recipe = null, // { id, name, category, description, servingVariants? ... }
  restaurantId,
  ingredients = [],
}) => {
  const [formData, setFormData] = useState({
    name: "",
    category: "main",
    description: "",
    servingVariants: [
      {
        id: 1, // chỉ cho UI tab
        mode: "PORTION", // "PORTION" | "BY_WEIGHT"
        key: "portion", // ẩn, tự set theo mode
        yieldQty: 1,
        yieldUnit: "portion",
        preparationMethodName: "Phương pháp cơ bản",
        components: [], // [{ ingredientId, qty, unit, baseUnit }]
      },
    ],
  });

  const [errors, setErrors] = useState({});
  const [activeVariantIndex, setActiveVariantIndex] = useState(0);
  const [previewWeight, setPreviewWeight] = useState(100); // gram

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isEditing = !!recipe;

  // Helpers ingredient
  const findIngredient = (ingredientId) =>
    ingredients.find((x) => String(x.id) === String(ingredientId));

  const getIngredientCost = (ingredientId) =>
    findIngredient(ingredientId)?.costPerBaseUnit || 0;

  const getIngredientBaseUnit = (ingredientId) =>
    findIngredient(ingredientId)?.baseUnit || null;

  // Lấy qty theo baseUnit cho 1 component trong form
  const getComponentQtyInBase = (comp) => {
    const baseUnit = comp.baseUnit || getIngredientBaseUnit(comp.ingredientId);
    const displayUnit = comp.unit || baseUnit;
    return toBaseQty(comp.qty, displayUnit, baseUnit);
  };

  const calcVariantCostPortion = (variant) => {
    const list = variant?.components || [];
    return list.reduce((sum, c) => {
      const unitCost = getIngredientCost(c.ingredientId);
      const qtyBase = getComponentQtyInBase(c); // qty theo baseUnit
      return sum + qtyBase * unitCost;
    }, 0);
  };

  const calcVariantCostByWeight = (variant, weightGrams = 100) => {
    const ratio = (Number(weightGrams) || 0) / 100;
    const list = variant?.components || [];
    return list.reduce((sum, c) => {
      const unitCost = getIngredientCost(c.ingredientId);
      const qtyBasePer100g = getComponentQtyInBase(c);
      return sum + qtyBasePer100g * ratio * unitCost;
    }, 0);
  };

  const activeVariant = formData.servingVariants[activeVariantIndex];

  // ===== Init/Patch khi mở modal =====
  useEffect(() => {
    if (recipe) {
      const variants =
        Array.isArray(recipe.servingVariants) && recipe.servingVariants.length
          ? recipe.servingVariants
          : (recipe.methods || []).map((m, idx) => ({
              id: idx + 1,
              mode: "PORTION",
              key: "portion",
              yieldQty: 1,
              yieldUnit: "portion",
              preparationMethodName: m.name || `Phương pháp ${idx + 1}`,
              components: (m.ingredients || []).map((ing) => ({
                ingredientId: ing.ingredientId,
                qty: ing.amount,
                unit: ing.unit || "g",
                baseUnit: null,
              })),
            }));

      const normalized = variants.map((v, i) => {
        // Ưu tiên dùng v.components từ useRecipes (đã chứa baseUnit, costPerBaseUnit)
        const comps = Array.isArray(v.components)
          ? v.components
          : v.Ingredients || [];

        return {
          id: v.id || i + 1,
          mode: v.mode || "PORTION",
          key: v.key || (v.mode === "BY_WEIGHT" ? "by-weight" : "portion"),
          yieldQty: v.yieldQty || 1,
          yieldUnit:
            v.yieldUnit || (v.mode === "BY_WEIGHT" ? "100g" : "portion"),
          preparationMethodName:
            v.preparationMethodName || v.name || `Phương pháp ${i + 1}`,
          components: comps.map((c) => {
            const baseUnit =
              c.baseUnit || getIngredientBaseUnit(c.ingredientId) || "g";

            // Khi load lần đầu, hiển thị theo baseUnit (kg/l/...)
            const unit = c.unit || baseUnit;
            // c.qty trong FE (useRecipes) đang nghĩ là baseUnit, nên nếu unit khác baseUnit thì convert
            const qtyDisplay =
              unit === baseUnit ? c.qty : fromBaseQty(c.qty, unit, baseUnit);

            return {
              ingredientId: c.ingredientId,
              qty: qtyDisplay,
              unit,
              baseUnit,
            };
          }),
        };
      });

      setFormData({
        name: recipe.name || "",
        category: recipe.category || "main",
        description: recipe.description || "",
        servingVariants: normalized,
      });
    } else {
      setFormData({
        name: "",
        category: "main",
        description: "",
        servingVariants: [
          {
            id: 1,
            mode: "PORTION",
            key: "portion",
            yieldQty: 1,
            yieldUnit: "portion",
            preparationMethodName: "Phương pháp cơ bản",
            components: [],
          },
        ],
      });
    }
    setActiveVariantIndex(0);
    setErrors({});
    setPreviewWeight(100);
    setSuccessMsg("");
    setErrorMsg("");
  }, [recipe, isOpen]);

  // ===== Field handlers =====
  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((err) => ({ ...err, [field]: "" }));
  };

  const handleVariantAdd = () => {
    const nextId =
      Math.max(...formData.servingVariants.map((v) => v.id ?? 0), 0) + 1;
    setFormData((prev) => ({
      ...prev,
      servingVariants: [
        ...prev.servingVariants,
        {
          id: nextId,
          mode: "PORTION",
          key: "portion",
          yieldQty: 1,
          yieldUnit: "portion",
          preparationMethodName: `Phương pháp ${nextId}`,
          components: [],
        },
      ],
    }));
    setActiveVariantIndex(formData.servingVariants.length);
  };

  const handleVariantRemove = (index) => {
    if (formData.servingVariants.length <= 1) {
      alert("Phải có ít nhất một phương pháp chế biến");
      return;
    }
    const next = formData.servingVariants.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, servingVariants: next }));
    if (activeVariantIndex >= next.length) {
      setActiveVariantIndex(next.length - 1);
    }
  };

  const handleVariantChange = (index, patch) => {
    const next = [...formData.servingVariants];
    const original = next[index];

    if (patch.mode) {
      const mode = patch.mode;
      next[index] = {
        ...original,
        ...patch,
        key: mode === "BY_WEIGHT" ? "by-weight" : "portion",
        yieldQty: 1,
        yieldUnit: mode === "BY_WEIGHT" ? "100g" : "portion",
      };
    } else {
      next[index] = { ...original, ...patch };
    }

    setFormData((prev) => ({ ...prev, servingVariants: next }));
  };

  const handleComponentAdd = (variantIndex) => {
    const next = [...formData.servingVariants];
    next[variantIndex].components.push({
      ingredientId: "",
      qty: "",
      unit: "",
      baseUnit: null,
    });
    setFormData((prev) => ({ ...prev, servingVariants: next }));
  };

  const handleComponentChange = (variantIndex, compIndex, field, value) => {
    const next = [...formData.servingVariants];
    const comp = next[variantIndex].components[compIndex] || {};

    if (field === "ingredientId") {
      const ing = findIngredient(value);
      const baseUnit = ing?.baseUnit || "g";
      const unit = comp.unit || baseUnit;

      next[variantIndex].components[compIndex] = {
        ...comp,
        ingredientId: value,
        baseUnit,
        unit,
      };
    } else if (field === "unit") {
      const baseUnit =
        comp.baseUnit || getIngredientBaseUnit(comp.ingredientId) || "g";
      const oldUnit = comp.unit || baseUnit;
      const newUnit = value;

      // giữ nguyên ý nghĩa số lượng: convert qty cũ qua baseUnit rồi qua đơn vị mới
      const qtyBase = toBaseQty(comp.qty, oldUnit, baseUnit);
      const newQty = fromBaseQty(qtyBase, newUnit, baseUnit);

      next[variantIndex].components[compIndex] = {
        ...comp,
        unit: newUnit,
        qty: newQty,
        baseUnit,
      };
    } else if (field === "qty") {
      next[variantIndex].components[compIndex] = {
        ...comp,
        qty: value,
      };
    } else {
      next[variantIndex].components[compIndex] = {
        ...comp,
        [field]: value,
      };
    }

    setFormData((prev) => ({ ...prev, servingVariants: next }));
  };

  const handleComponentRemove = (variantIndex, compIndex) => {
    const next = [...formData.servingVariants];
    next[variantIndex].components = next[variantIndex].components.filter(
      (_, i) => i !== compIndex
    );
    setFormData((prev) => ({ ...prev, servingVariants: next }));
  };

  // ===== Validate =====
  const validateForm = () => {
    const e = {};
    if (!formData.name.trim()) e.name = "Tên món ăn là bắt buộc";
    if (!formData.description.trim())
      e.description = "Mô tả món ăn là bắt buộc";

    formData.servingVariants.forEach((v, vi) => {
      if (!v.preparationMethodName?.trim())
        e[`variant_${vi}_name`] = "Tên phương pháp là bắt buộc";

      (v.components || []).forEach((c, ci) => {
        if (!c.ingredientId)
          e[`variant_${vi}_comp_${ci}_id`] = "Chọn nguyên liệu";
        if (!c.qty || Number(c.qty) <= 0)
          e[`variant_${vi}_comp_${ci}_qty`] = "Số lượng phải > 0";
      });
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ===== Build payload gửi ra ngoài =====
  const buildPayload = () => {
    const servingVariants = formData.servingVariants.map((v) => {
      const mode = v.mode || "PORTION";
      const isByWeight = mode === "BY_WEIGHT";

      const ingredients = (v.components || []).map((c) => {
        const baseUnit =
          c.baseUnit || getIngredientBaseUnit(c.ingredientId) || null;
        const displayUnit = c.unit || baseUnit;
        const qtyBase = toBaseQty(c.qty, displayUnit, baseUnit);

        return {
          ingredientId: c.ingredientId,
          qty: qtyBase, // gửi theo baseUnit
          name: undefined,
          wastePct: 0,
        };
      });

      return {
        key: isByWeight ? "by-weight" : "portion",
        mode,
        yieldQty: 1,
        yieldUnit: isByWeight ? "100g" : "portion",
        preparationMethodName: v.preparationMethodName?.trim(),
        ingredients,
      };
    });

    // Map ra "methods" cho FE nếu những nơi khác vẫn đọc trường này
    const methods = servingVariants.map((v, idx) => ({
      id: idx + 1,
      name: v.preparationMethodName || v.key || `Phương pháp ${idx + 1}`,
      description:
        v.mode === "BY_WEIGHT"
          ? "Định mức cho 100g thành phẩm."
          : "Định mức cho 1 phần.",
      ingredients: (v.ingredients || []).map((c) => ({
        ingredientId: c.ingredientId,
        amount: c.qty,
        unit: undefined,
      })),
      _mode: v.mode,
    }));

    return {
      id: recipe?.id ?? undefined, // menuItemId để handler parent dùng
      name: formData.name,
      category: formData.category,
      description: formData.description,
      servingVariants, // cho BE
      methods, // phòng khi FE chỗ khác còn xài
      icon:
        formData.category === "appetizer"
          ? "🥗"
          : formData.category === "dessert"
          ? "🍰"
          : formData.category === "drink"
          ? "🥤"
          : "🍽️",
    };
  };

  // ===== Submit / Delete =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload = buildPayload();
      await onSave?.(payload); // không đóng modal
      setSuccessMsg("Đã lưu công thức thành công.");
    } catch (err) {
      setErrorMsg(err?.message || "Lưu công thức thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndClose = async () => {
    setSuccessMsg("");
    setErrorMsg("");

    if (!validateForm()) return;

    try {
      setSaving(true);
      const payload = buildPayload();
      await onSave?.(payload);
      onClose?.();
    } catch (err) {
      setErrorMsg(err?.message || "Lưu công thức thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !recipe?.id) return;
    if (!window.confirm("Bạn có chắc chắn muốn xóa công thức này?")) return;

    try {
      setDeleting(true);
      await onDelete(recipe.id);
      onClose?.();
    } catch (err) {
      setErrorMsg(err?.message || "Xóa công thức thất bại.");
    } finally {
      setDeleting(false);
    }
  };

  // ===== Preview cost =====
  const activeCost = useMemo(() => {
    if (!activeVariant) return 0;
    if (activeVariant.mode === "BY_WEIGHT") {
      return calcVariantCostByWeight(activeVariant, previewWeight);
    }
    return calcVariantCostPortion(activeVariant);
  }, [activeVariant, previewWeight, ingredients]);

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
                disabled={saving || deleting}
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
                disabled={saving || deleting}
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
              disabled={saving || deleting}
            />
            {errors.description && (
              <div className="error-message">{errors.description}</div>
            )}
          </FormGroup>
        </div>

        {/* Serving Variants */}
        <div className="recipe-section">
          <div className="section-header">
            <h3 className="section-title">👨‍🍳 Phương pháp chế biến</h3>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleVariantAdd}
              disabled={saving || deleting}
            >
              ➕ Thêm phương pháp
            </Button>
          </div>

          {/* Tabs */}
          <div className="method-tabs">
            {formData.servingVariants.map((v, index) => (
              <button
                key={v.id}
                type="button"
                className={`method-tab ${
                  activeVariantIndex === index ? "active" : ""
                }`}
                onClick={() => setActiveVariantIndex(index)}
                disabled={saving || deleting}
              >
                {v.preparationMethodName || `Phương pháp ${index + 1}`}
                {formData.servingVariants.length > 1 && (
                  <span
                    className="method-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!saving && !deleting) handleVariantRemove(index);
                    }}
                  >
                    ×
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Active Content */}
          {activeVariant && (
            <Card className="method-content">
              {/* Name + Mode */}
              <div className="form-row">
                <FormGroup>
                  <FormLabel required>Tên phương pháp</FormLabel>
                  <FormInput
                    placeholder="Ví dụ: Nướng than hoa / Áp chảo bơ"
                    value={activeVariant.preparationMethodName}
                    onChange={(e) =>
                      handleVariantChange(activeVariantIndex, {
                        preparationMethodName: e.target.value,
                      })
                    }
                    disabled={saving || deleting}
                  />
                  {errors[`variant_${activeVariantIndex}_name`] && (
                    <div className="error-message">
                      {errors[`variant_${activeVariantIndex}_name`]}
                    </div>
                  )}
                </FormGroup>

                <FormGroup>
                  <FormLabel>Chế độ</FormLabel>
                  <FormSelect
                    options={[
                      { value: "PORTION", label: "PORTION (Theo phần)" },
                      { value: "BY_WEIGHT", label: "BY_WEIGHT (Theo 100g)" },
                    ]}
                    value={activeVariant.mode}
                    onChange={(e) =>
                      handleVariantChange(activeVariantIndex, {
                        mode: e.target.value,
                      })
                    }
                    disabled={saving || deleting}
                  />
                </FormGroup>
              </div>

              {/* BY_WEIGHT note + preview */}
              {activeVariant.mode === "BY_WEIGHT" && (
                <Card className="ingredient-row" style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Định mức:</strong> Mọi định lượng dưới đây tính cho{" "}
                    <strong>100g</strong> thành phẩm.
                  </div>
                  <div className="form-row">
                    <FormGroup>
                      <FormLabel>Preview trọng lượng (gram)</FormLabel>
                      <FormInput
                        type="number"
                        min="1"
                        step="1"
                        value={previewWeight}
                        onChange={(e) => setPreviewWeight(e.target.value)}
                        placeholder="VD: 100, 200, 350..."
                        disabled={saving || deleting}
                      />
                      <div style={{ marginTop: 6 }}>
                        Ước tính chi phí:{" "}
                        <strong>{formatPrice(activeCost)}</strong>
                      </div>
                    </FormGroup>
                  </div>
                </Card>
              )}

              {/* Components */}
              <div className="method-ingredients">
                <div className="subsection-header">
                  <h4>
                    Nguyên liệu{" "}
                    {activeVariant.mode === "BY_WEIGHT"
                      ? "(cho 100g)"
                      : "(1 phần)"}
                  </h4>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleComponentAdd(activeVariantIndex)}
                    disabled={saving || deleting}
                  >
                    ➕ Thêm nguyên liệu
                  </Button>
                </div>

                {(activeVariant.components || []).map((c, ci) => {
                  const ing = findIngredient(c.ingredientId);
                  const baseUnit = c.baseUnit || ing?.baseUnit || "g";
                  const selectValue = c.unit || baseUnit || "g";

                  return (
                    <div key={ci} className="method-ingredient-row">
                      <div className="form-row-3">
                        <FormGroup>
                          <FormLabel>Nguyên liệu</FormLabel>
                          <FormSelect
                            options={ingredients.map((ingItem) => ({
                              value: String(ingItem.id),
                              label: ingItem.name,
                            }))}
                            value={c.ingredientId ? String(c.ingredientId) : ""}
                            onChange={(e) =>
                              handleComponentChange(
                                activeVariantIndex,
                                ci,
                                "ingredientId",
                                e.target.value
                              )
                            }
                            placeholder="Chọn nguyên liệu"
                            disabled={saving || deleting}
                          />
                          {errors[
                            `variant_${activeVariantIndex}_comp_${ci}_id`
                          ] && (
                            <div className="error-message">
                              {
                                errors[
                                  `variant_${activeVariantIndex}_comp_${ci}_id`
                                ]
                              }
                            </div>
                          )}
                        </FormGroup>

                        <FormGroup>
                          <FormLabel>
                            Số lượng
                            {activeVariant.mode === "BY_WEIGHT"
                              ? " /100g"
                              : " /phần"}
                          </FormLabel>
                          <FormInput
                            type="number"
                            placeholder="0"
                            min="0"
                            step="0.1"
                            value={c.qty}
                            onChange={(e) =>
                              handleComponentChange(
                                activeVariantIndex,
                                ci,
                                "qty",
                                e.target.value
                              )
                            }
                            disabled={saving || deleting}
                          />
                          {errors[
                            `variant_${activeVariantIndex}_comp_${ci}_qty`
                          ] && (
                            <div className="error-message">
                              {
                                errors[
                                  `variant_${activeVariantIndex}_comp_${ci}_qty`
                                ]
                              }
                            </div>
                          )}
                        </FormGroup>

                        <FormGroup>
                          <FormLabel>Đơn vị</FormLabel>
                          <div className="input-with-action">
                            <FormSelect
                              options={UNITS}
                              value={selectValue}
                              onChange={(e) =>
                                handleComponentChange(
                                  activeVariantIndex,
                                  ci,
                                  "unit",
                                  e.target.value
                                )
                              }
                              disabled={saving || deleting}
                            />
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() =>
                                handleComponentRemove(activeVariantIndex, ci)
                              }
                              disabled={saving || deleting}
                            >
                              🗑️
                            </Button>
                          </div>
                        </FormGroup>
                      </div>
                    </div>
                  );
                })}

                {/* Cost summary */}
                <div className="method-cost">
                  <strong>
                    Chi phí ước tính:{" "}
                    {activeVariant.mode === "BY_WEIGHT"
                      ? formatPrice(activeCost)
                      : formatPrice(calcVariantCostPortion(activeVariant))}
                  </strong>
                </div>
              </div>
            </Card>
          )}
        </div>

        {(successMsg || errorMsg) && (
          <div style={{ margin: "8px 0" }}>
            {successMsg && (
              <div style={{ color: "#16a34a", fontWeight: 600 }}>
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div style={{ color: "#b91c1c", fontWeight: 600 }}>
                {errorMsg}
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving || deleting}
          >
            Đóng
          </Button>
          {isEditing && (
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={saving || deleting}
            >
              {deleting ? "Đang xoá..." : "Xóa"}
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={saving || deleting}>
            {saving ? "Đang lưu..." : "Lưu"}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSaveAndClose}
            disabled={saving || deleting}
          >
            {saving ? "Đang lưu..." : "Lưu & đóng"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default RecipeModal;
