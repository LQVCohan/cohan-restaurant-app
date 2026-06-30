import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { AuthContext } from "../../../context/AuthContext";
import useManagerRestaurantSelection from "../../../hooks/useManagerRestaurantSelection";
import {
  MENU_MANAGEMENT_ACTIONS,
  canAccessMenuManagementAction,
} from "../../../utils/frontendRoleAccess";
import "./ModifierManagement.scss";

const MODIFIER_GROUP_FIELDS = gql`
  fragment ModifierGroupConfigFields on ModifierGroup {
    id
    restaurantId
    name
    groupType
    coverage
    menuItemIds
    selectionType
    required
    minSelected
    maxSelected
    note
    isActive
    options {
      id
      name
      isDefault
      isActive
      priceRule {
        rule
        amount
      }
      inventoryRule {
        rule
        ingredientLines {
          ingredientId
          qty
          unit
          wastePct
        }
        baseRecipeMultiplier
        note
      }
    }
  }
`;

const GET_MODIFIER_CONFIG = gql`
  query ModifierConfig($restaurantId: ID!, $search: String) {
    modifierGroups(filter: { restaurantId: $restaurantId, search: $search, isActive: null }) {
      ...ModifierGroupConfigFields
    }
    menuItems(restaurantId: $restaurantId, limit: 200) {
      id
      name
      categoryId
      status
      basePrice
    }
  }
  ${MODIFIER_GROUP_FIELDS}
`;

const CREATE_MODIFIER_GROUP = gql`
  mutation CreateModifierGroup($input: CreateModifierGroupInput!) {
    createModifierGroup(input: $input) {
      ...ModifierGroupConfigFields
    }
  }
  ${MODIFIER_GROUP_FIELDS}
`;

const UPDATE_MODIFIER_GROUP = gql`
  mutation UpdateModifierGroup($input: UpdateModifierGroupInput!) {
    updateModifierGroup(input: $input) {
      ...ModifierGroupConfigFields
    }
  }
  ${MODIFIER_GROUP_FIELDS}
`;

const DELETE_MODIFIER_GROUP = gql`
  mutation DeleteModifierGroup($id: ID!) {
    deleteModifierGroup(id: $id)
  }
`;

export const blankOption = () => ({
  id: "",
  name: "",
  isDefault: false,
  isActive: true,
  priceRule: { rule: "DELTA", amount: 0 },
  inventoryRule: { rule: "NONE", ingredientLines: [] },
});

export const blankForm = (restaurantId = "") => ({
  id: "",
  restaurantId,
  name: "",
  groupType: "CUSTOM",
  coverage: "GLOBAL",
  menuItemIds: [],
  selectionType: "multiple",
  required: false,
  minSelected: 0,
  maxSelected: "",
  note: "",
  isActive: true,
  options: [blankOption()],
});

export const toForm = (group, restaurantId) => ({
  ...blankForm(restaurantId),
  ...group,
  id: group?.id || "",
  restaurantId: group?.restaurantId || restaurantId,
  menuItemIds: Array.isArray(group?.menuItemIds) ? group.menuItemIds.map(String) : [],
  maxSelected: group?.maxSelected ?? "",
  options: group?.options?.length ? group.options.map((option) => ({
    id: option.id || "",
    name: option.name || "",
    isDefault: Boolean(option.isDefault),
    isActive: option.isActive !== false,
    priceRule: {
      rule: option.priceRule?.rule || "DELTA",
      amount: Number(option.priceRule?.amount || 0),
    },
    inventoryRule: {
      rule: option.inventoryRule?.rule || "NONE",
      ingredientLines: option.inventoryRule?.ingredientLines || [],
      baseRecipeMultiplier: option.inventoryRule?.baseRecipeMultiplier ?? undefined,
      note: option.inventoryRule?.note || undefined,
    },
  })) : [blankOption()],
});

const formatMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

export const buildOptionInput = (option) => ({
  name: String(option.name || "").trim(),
  isDefault: Boolean(option.isDefault),
  isActive: option.isActive !== false,
  priceRule: {
    rule: option.priceRule?.rule || "DELTA",
    amount: Number(option.priceRule?.amount || 0),
  },
  inventoryRule: option.inventoryRule?.rule && option.inventoryRule.rule !== "NONE"
    ? {
        rule: option.inventoryRule.rule,
        ingredientLines: option.inventoryRule.ingredientLines || [],
        baseRecipeMultiplier: option.inventoryRule.baseRecipeMultiplier ?? null,
        note: option.inventoryRule.note || null,
      }
    : { rule: "NONE", ingredientLines: [] },
});

export const buildModifierInput = (form, restaurantId) => {
  const coverage = form.coverage || "GLOBAL";
  const selectionType = form.selectionType || "multiple";
  const input = {
    restaurantId,
    name: String(form.name || "").trim(),
    groupType: form.groupType || "CUSTOM",
    coverage,
    menuItemIds: coverage === "ITEMS" ? form.menuItemIds : [],
    selectionType,
    required: Boolean(form.required),
    minSelected: selectionType === "single" ? (form.required ? 1 : 0) : Number(form.minSelected || 0),
    maxSelected: selectionType === "single" ? 1 : form.maxSelected ? Number(form.maxSelected) : null,
    options: form.options.map(buildOptionInput).filter((option) => option.name),
    note: form.note || null,
    isActive: form.isActive !== false,
  };

  if (input.maxSelected == null) delete input.maxSelected;
  return input;
};

export const getModifierFormValidationError = (form, restaurantId) => {
  if (!restaurantId) return "Vui lòng chọn chi nhánh.";
  if (!form.name.trim()) return "Tên nhóm tuỳ chọn là bắt buộc.";
  if (form.coverage === "ITEMS" && !form.menuItemIds.length) return "Chọn ít nhất một món khi áp dụng theo món.";
  const namedOptions = form.options.filter((option) => option.name.trim());
  if (!namedOptions.length) return "Cần ít nhất một lựa chọn.";
  if (form.selectionType === "multiple" && form.maxSelected && Number(form.maxSelected) < Number(form.minSelected || 0)) {
    return "Số lựa chọn tối đa phải lớn hơn hoặc bằng tối thiểu.";
  }
  return "";
};

const getGroupTypeLabel = (type) => ({
  SIZE: "Kích cỡ",
  TOPPING: "Topping",
  PREPARATION: "Chế biến",
  CUSTOM: "Tuỳ chỉnh",
}[type] || "Tuỳ chỉnh");

const getCoverageLabel = (coverage) => coverage === "GLOBAL" ? "Toàn menu" : "Theo món";

const ModifierManagement = () => {
  const { user } = useContext(AuthContext);
  const canView = canAccessMenuManagementAction(user, MENU_MANAGEMENT_ACTIONS.VIEW);
  const canWrite = canAccessMenuManagementAction(user, MENU_MANAGEMENT_ACTIONS.MANAGE_MODIFIER);
  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
    hasRestaurants,
  } = useManagerRestaurantSelection();

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(() => blankForm(selectedRestaurantId));
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");

  const { data, loading, error, refetch } = useQuery(GET_MODIFIER_CONFIG, {
    variables: { restaurantId: selectedRestaurantId || "", search: search.trim() || null },
    skip: !selectedRestaurantId || !canView,
    fetchPolicy: "cache-and-network",
  });

  const [createModifierGroup, { loading: creating }] = useMutation(CREATE_MODIFIER_GROUP);
  const [updateModifierGroup, { loading: updating }] = useMutation(UPDATE_MODIFIER_GROUP);
  const [deleteModifierGroup, { loading: deleting }] = useMutation(DELETE_MODIFIER_GROUP);

  const modifierGroups = data?.modifierGroups || [];
  const menuItems = data?.menuItems || [];
  const selectedGroup = useMemo(
    () => modifierGroups.find((group) => String(group.id) === String(editingId)),
    [editingId, modifierGroups],
  );

  const stats = useMemo(() => ({
    total: modifierGroups.length,
    active: modifierGroups.filter((group) => group.isActive !== false).length,
    global: modifierGroups.filter((group) => group.coverage === "GLOBAL").length,
    optionCount: modifierGroups.reduce((sum, group) => sum + (group.options?.length || 0), 0),
  }), [modifierGroups]);

  const resetForm = () => {
    setEditingId("");
    setForm(blankForm(selectedRestaurantId));
    setFormError("");
  };

  const editGroup = (group) => {
    setEditingId(group.id);
    setForm(toForm(group, selectedRestaurantId));
    setFormError("");
  };

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));

  const updateOption = (index, patch) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => (
        optionIndex === index ? { ...option, ...patch } : option
      )),
    }));
  };

  const updateOptionPriceRule = (index, patch) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => (
        optionIndex === index
          ? { ...option, priceRule: { ...option.priceRule, ...patch } }
          : option
      )),
    }));
  };

  const toggleDefaultOption = (index, checked) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => ({
        ...option,
        isDefault: current.selectionType === "single"
          ? optionIndex === index && checked
          : optionIndex === index ? checked : option.isDefault,
      })),
    }));
  };

  const addOption = () => updateForm({ options: [...form.options, blankOption()] });

  const removeOption = (index) => {
    if (form.options.length <= 1) return;
    updateForm({ options: form.options.filter((_, optionIndex) => optionIndex !== index) });
  };

  const toggleMenuItem = (itemId) => {
    const id = String(itemId);
    const current = new Set(form.menuItemIds.map(String));
    if (current.has(id)) current.delete(id);
    else current.add(id);
    updateForm({ menuItemIds: [...current] });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setToast("");
    const validation = getModifierFormValidationError(form, selectedRestaurantId);
    if (validation) {
      setFormError(validation);
      return;
    }

    const input = buildModifierInput(form, selectedRestaurantId);
    try {
      if (editingId) {
        const { restaurantId, ...updateInput } = input;
        await updateModifierGroup({ variables: { input: { id: editingId, ...updateInput } } });
        setToast("Đã cập nhật nhóm tuỳ chọn.");
      } else {
        await createModifierGroup({ variables: { input } });
        setToast("Đã tạo nhóm tuỳ chọn.");
      }
      await refetch?.();
      resetForm();
    } catch (submitError) {
      setFormError(submitError.message || "Không thể lưu nhóm tuỳ chọn.");
    }
  };

  const handleDelete = async (group) => {
    if (!group?.id || !window.confirm(`Xoá nhóm tuỳ chọn "${group.name}"?`)) return;
    setFormError("");
    setToast("");
    try {
      await deleteModifierGroup({ variables: { id: group.id } });
      await refetch?.();
      if (editingId === group.id) resetForm();
      setToast("Đã xoá nhóm tuỳ chọn.");
    } catch (deleteError) {
      setFormError(deleteError.message || "Không thể xoá nhóm tuỳ chọn.");
    }
  };

  if (!canView) {
    return <div className="modifier-management-empty">Bạn không có quyền xem cấu hình tuỳ chọn món.</div>;
  }

  return (
    <main className="modifier-management" aria-labelledby="modifier-management-title">
      <section className="modifier-management__hero">
        <div>
          <p className="modifier-management__eyebrow">Menu operations</p>
          <h1 id="modifier-management-title">Cấu hình tuỳ chọn món</h1>
          <p>
            Tạo size, topping, cách chế biến và gán cho toàn menu hoặc từng món để khách chọn khi đặt hàng.
          </p>
        </div>
        <div className="modifier-management__stats" aria-label="Tổng quan cấu hình tuỳ chọn">
          <span><strong>{stats.total}</strong> nhóm</span>
          <span><strong>{stats.active}</strong> đang bật</span>
          <span><strong>{stats.optionCount}</strong> lựa chọn</span>
          <span><strong>{stats.global}</strong> toàn menu</span>
        </div>
      </section>

      <section className="modifier-management__toolbar" aria-label="Bộ lọc cấu hình modifier">
        <label>
          <span>Chi nhánh</span>
          <select
            value={selectedRestaurantId || ""}
            onChange={(event) => {
              setSelectedRestaurantId(event.target.value);
              setForm(blankForm(event.target.value));
              setEditingId("");
            }}
            disabled={restaurantsLoading || restaurantOptions.length <= 1}
          >
            {!hasRestaurants && <option value="">Chưa có chi nhánh</option>}
            {restaurantOptions.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Tìm nhóm</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Size, topping, độ cay..."
          />
        </label>
        <button type="button" className="modifier-management__ghost-button" onClick={() => refetch?.()} disabled={!selectedRestaurantId || loading}>
          Làm mới
        </button>
      </section>

      {toast && <div className="modifier-management__notice" role="status">{toast}</div>}
      {formError && <div className="modifier-management__error" role="alert">{formError}</div>}
      {error && <div className="modifier-management__error" role="alert">{error.message}</div>}

      <div className="modifier-management__grid">
        <section className="modifier-management__list" aria-label="Danh sách nhóm tuỳ chọn">
          <div className="modifier-management__section-heading">
            <div>
              <p>Nhóm hiện có</p>
              <h2>{loading ? "Đang tải..." : `${modifierGroups.length} nhóm tuỳ chọn`}</h2>
            </div>
            <button type="button" onClick={resetForm} className="modifier-management__primary-button" disabled={!canWrite}>
              Tạo nhóm mới
            </button>
          </div>

          {!selectedRestaurantId ? (
            <div className="modifier-management-empty">Chọn chi nhánh để cấu hình modifier.</div>
          ) : loading && !modifierGroups.length ? (
            <div className="modifier-management-empty">Đang tải nhóm tuỳ chọn...</div>
          ) : !modifierGroups.length ? (
            <div className="modifier-management-empty">Chưa có nhóm tuỳ chọn. Tạo nhóm đầu tiên ở form bên phải.</div>
          ) : (
            <div className="modifier-management__cards">
              {modifierGroups.map((group) => (
                <article key={group.id} className={`modifier-card ${selectedGroup?.id === group.id ? "is-selected" : ""}`}>
                  <div className="modifier-card__header">
                    <div>
                      <h3>{group.name}</h3>
                      <p>{getGroupTypeLabel(group.groupType)} · {getCoverageLabel(group.coverage)}</p>
                    </div>
                    <span className={`modifier-card__status ${group.isActive === false ? "is-off" : ""}`}>
                      {group.isActive === false ? "Tắt" : "Bật"}
                    </span>
                  </div>
                  <div className="modifier-card__meta">
                    <span>{group.selectionType === "single" ? "Chọn 1" : "Chọn nhiều"}</span>
                    <span>{group.required ? "Bắt buộc" : "Không bắt buộc"}</span>
                    <span>{group.options?.length || 0} lựa chọn</span>
                    {group.coverage === "ITEMS" && <span>{group.menuItemIds?.length || 0} món</span>}
                  </div>
                  <ul className="modifier-card__options" aria-label={`Lựa chọn của ${group.name}`}>
                    {(group.options || []).slice(0, 4).map((option) => (
                      <li key={option.id || option.name}>
                        <span>{option.name}</span>
                        <strong>{Number(option.priceRule?.amount || 0) === 0 ? "Miễn phí" : formatMoney(option.priceRule?.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                  <div className="modifier-card__actions">
                    <button type="button" onClick={() => editGroup(group)} disabled={!canWrite}>Sửa</button>
                    <button type="button" className="is-danger" onClick={() => handleDelete(group)} disabled={!canWrite || deleting}>Xoá</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="modifier-management__form-panel" aria-label="Form cấu hình nhóm tuỳ chọn">
          <div className="modifier-management__section-heading">
            <div>
              <p>{editingId ? "Chỉnh sửa" : "Tạo mới"}</p>
              <h2>{editingId ? form.name || "Nhóm tuỳ chọn" : "Nhóm tuỳ chọn mới"}</h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="modifier-form">
            <fieldset disabled={!canWrite || !selectedRestaurantId || creating || updating}>
              <label className="modifier-form__field">
                <span>Tên nhóm</span>
                <input value={form.name} onChange={(event) => updateForm({ name: event.target.value })} placeholder="Ví dụ: Size, Topping, Độ cay" required />
              </label>

              <div className="modifier-form__row">
                <label className="modifier-form__field">
                  <span>Loại nhóm</span>
                  <select value={form.groupType} onChange={(event) => updateForm({ groupType: event.target.value })}>
                    <option value="CUSTOM">Tuỳ chỉnh</option>
                    <option value="SIZE">Kích cỡ</option>
                    <option value="TOPPING">Topping</option>
                    <option value="PREPARATION">Chế biến</option>
                  </select>
                </label>
                <label className="modifier-form__field">
                  <span>Kiểu chọn</span>
                  <select value={form.selectionType} onChange={(event) => updateForm({ selectionType: event.target.value })}>
                    <option value="single">Chọn một</option>
                    <option value="multiple">Chọn nhiều</option>
                  </select>
                </label>
              </div>

              <div className="modifier-form__switches">
                <label><input type="checkbox" checked={form.required} onChange={(event) => updateForm({ required: event.target.checked })} /> Bắt buộc chọn</label>
                <label><input type="checkbox" checked={form.isActive !== false} onChange={(event) => updateForm({ isActive: event.target.checked })} /> Đang bật</label>
              </div>

              {form.selectionType === "multiple" && (
                <div className="modifier-form__row">
                  <label className="modifier-form__field">
                    <span>Tối thiểu</span>
                    <input type="number" min="0" value={form.minSelected} onChange={(event) => updateForm({ minSelected: event.target.value })} />
                  </label>
                  <label className="modifier-form__field">
                    <span>Tối đa</span>
                    <input type="number" min="1" value={form.maxSelected} onChange={(event) => updateForm({ maxSelected: event.target.value })} placeholder="Không giới hạn" />
                  </label>
                </div>
              )}

              <fieldset className="modifier-form__coverage">
                <legend>Phạm vi áp dụng</legend>
                <label><input type="radio" name="coverage" value="GLOBAL" checked={form.coverage === "GLOBAL"} onChange={(event) => updateForm({ coverage: event.target.value, menuItemIds: [] })} /> Toàn menu</label>
                <label><input type="radio" name="coverage" value="ITEMS" checked={form.coverage === "ITEMS"} onChange={(event) => updateForm({ coverage: event.target.value })} /> Chọn món cụ thể</label>
              </fieldset>

              {form.coverage === "ITEMS" && (
                <div className="modifier-form__menu-items" aria-label="Chọn món áp dụng modifier">
                  {menuItems.map((item) => (
                    <label key={item.id}>
                      <input type="checkbox" checked={form.menuItemIds.map(String).includes(String(item.id))} onChange={() => toggleMenuItem(item.id)} />
                      <span>{item.name}</span>
                      <small>{formatMoney(item.basePrice)}</small>
                    </label>
                  ))}
                  {!menuItems.length && <p>Chưa có món để gán modifier.</p>}
                </div>
              )}

              <div className="modifier-form__options-heading">
                <h3>Lựa chọn</h3>
                <button type="button" onClick={addOption}>Thêm lựa chọn</button>
              </div>

              <div className="modifier-form__options">
                {form.options.map((option, index) => (
                  <div key={option.id || index} className="modifier-option-editor">
                    <label className="modifier-form__field">
                      <span>Tên lựa chọn</span>
                      <input value={option.name} onChange={(event) => updateOption(index, { name: event.target.value })} placeholder="Ví dụ: Size L, thêm bò, ít cay" required={index === 0} />
                    </label>
                    <div className="modifier-form__row">
                      <label className="modifier-form__field">
                        <span>Quy tắc giá</span>
                        <select value={option.priceRule.rule} onChange={(event) => updateOptionPriceRule(index, { rule: event.target.value })}>
                          <option value="DELTA">Cộng/trừ giá</option>
                          <option value="SET">Đặt giá món</option>
                        </select>
                      </label>
                      <label className="modifier-form__field">
                        <span>Số tiền</span>
                        <input type="number" value={option.priceRule.amount} onChange={(event) => updateOptionPriceRule(index, { amount: event.target.value })} />
                      </label>
                    </div>
                    <div className="modifier-option-editor__checks">
                      <label><input type="checkbox" checked={option.isDefault} onChange={(event) => toggleDefaultOption(index, event.target.checked)} /> Mặc định</label>
                      <label><input type="checkbox" checked={option.isActive !== false} onChange={(event) => updateOption(index, { isActive: event.target.checked })} /> Đang bật</label>
                    </div>
                    <button type="button" className="modifier-option-editor__remove" onClick={() => removeOption(index)} disabled={form.options.length <= 1}>Xoá lựa chọn</button>
                  </div>
                ))}
              </div>

              <label className="modifier-form__field">
                <span>Ghi chú nội bộ</span>
                <textarea value={form.note || ""} onChange={(event) => updateForm({ note: event.target.value })} placeholder="Ví dụ: Dùng cho menu delivery cuối tuần" rows="3" />
              </label>

              <div className="modifier-form__actions">
                <button type="button" className="modifier-management__ghost-button" onClick={resetForm}>Huỷ</button>
                <button type="submit" className="modifier-management__primary-button">
                  {creating || updating ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Tạo nhóm"}
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      </div>
    </main>
  );
};

export default ModifierManagement;
