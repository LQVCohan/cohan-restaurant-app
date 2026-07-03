import React, { useContext, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  CheckCircle2,
  CircleOff,
  Globe2,
  Layers3,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  SlidersHorizontal,
  Store,
  Trash2,
  Utensils,
} from "lucide-react";
import { AuthContext } from "../../../context/AuthContext";
import useManagerRestaurantSelection from "../../../hooks/useManagerRestaurantSelection";
import {
  MENU_MANAGEMENT_ACTIONS,
  canAccessMenuManagementAction,
  isAdminRole,
} from "../../../utils/frontendRoleAccess";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import ManagerCommandBar from "../shared/ManagerCommandBar";
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

const STATUS_TABS = [
  { id: "all", label: "Tất cả" },
  { id: "active", label: "Đang bật" },
  { id: "inactive", label: "Đã tắt" },
];

const GROUP_TYPE_OPTIONS = [
  { value: "all", label: "Tất cả loại" },
  { value: "SIZE", label: "Kích cỡ" },
  { value: "TOPPING", label: "Topping" },
  { value: "PREPARATION", label: "Chế biến" },
  { value: "CUSTOM", label: "Tuỳ chỉnh" },
];

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
  options: group?.options?.length
    ? group.options.map((option) => ({
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
      }))
    : [blankOption()],
});

const formatMoney = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;

export const formatModifierPriceRule = (priceRule = {}) => {
  const amount = Number(priceRule.amount || 0);
  if (priceRule.rule === "SET") return `Đặt giá ${formatMoney(amount)}`;
  if (amount === 0) return "Không đổi giá";
  return `${amount > 0 ? "+" : "−"}${formatMoney(Math.abs(amount))}`;
};

export const buildOptionInput = (option) => ({
  name: String(option.name || "").trim(),
  isDefault: Boolean(option.isDefault),
  isActive: option.isActive !== false,
  priceRule: {
    rule: option.priceRule?.rule || "DELTA",
    amount: Number(option.priceRule?.amount || 0),
  },
  inventoryRule:
    option.inventoryRule?.rule && option.inventoryRule.rule !== "NONE"
      ? {
          rule: option.inventoryRule.rule,
          ingredientLines: option.inventoryRule.ingredientLines || [],
          baseRecipeMultiplier: option.inventoryRule.baseRecipeMultiplier ?? null,
          note: option.inventoryRule.note || null,
        }
      : { rule: "NONE", ingredientLines: [] },
});

export const normalizeModifierOptions = (options = [], { selectionType, required } = {}) => {
  let hasDefault = false;
  const normalized = options
    .map(buildOptionInput)
    .filter((option) => option.name)
    .map((option) => {
      if (!option.isDefault) return option;
      if (hasDefault) return { ...option, isDefault: false };
      hasDefault = true;
      return option;
    });

  if (selectionType === "single" && required && !hasDefault && normalized[0]) {
    normalized[0] = { ...normalized[0], isDefault: true };
  }
  return normalized;
};

export const buildModifierInput = (form, restaurantId) => {
  const coverage = form.coverage || "GLOBAL";
  const selectionType = form.selectionType || "multiple";
  const minimum = selectionType === "single"
    ? form.required ? 1 : 0
    : Math.max(form.required ? 1 : 0, Number(form.minSelected || 0));
  const input = {
    restaurantId,
    name: String(form.name || "").trim(),
    groupType: form.groupType || "CUSTOM",
    coverage,
    menuItemIds: coverage === "ITEMS" ? form.menuItemIds : [],
    selectionType,
    required: Boolean(form.required),
    minSelected: minimum,
    maxSelected: selectionType === "single" ? 1 : form.maxSelected ? Number(form.maxSelected) : null,
    options: normalizeModifierOptions(form.options, { selectionType, required: form.required }),
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

  if (form.selectionType === "multiple") {
    const minimum = Math.max(form.required ? 1 : 0, Number(form.minSelected || 0));
    if (minimum > namedOptions.length) return "Số lựa chọn tối thiểu không được vượt quá số lựa chọn đang có.";
    if (form.maxSelected && Number(form.maxSelected) < minimum) {
      return "Số lựa chọn tối đa phải lớn hơn hoặc bằng tối thiểu.";
    }
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
  const canDelete = isAdminRole(user);
  const {
    restaurantOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    restaurantsLoading,
    hasRestaurants,
  } = useManagerRestaurantSelection();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [groupTypeFilter, setGroupTypeFilter] = useState("all");
  const [itemSearch, setItemSearch] = useState("");
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
  const visibleGroups = useMemo(
    () => modifierGroups.filter((group) => {
      if (statusFilter === "active" && group.isActive === false) return false;
      if (statusFilter === "inactive" && group.isActive !== false) return false;
      if (groupTypeFilter !== "all" && group.groupType !== groupTypeFilter) return false;
      return true;
    }),
    [groupTypeFilter, modifierGroups, statusFilter],
  );
  const visibleMenuItems = useMemo(() => {
    const keyword = itemSearch.trim().toLowerCase();
    if (!keyword) return menuItems;
    return menuItems.filter((item) => String(item.name || "").toLowerCase().includes(keyword));
  }, [itemSearch, menuItems]);
  const selectedRestaurantName = restaurantOptions.find(
    (restaurant) => String(restaurant.id) === String(selectedRestaurantId),
  )?.name || "chi nhánh hiện tại";
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
    setItemSearch("");
  };

  const editGroup = (group) => {
    setEditingId(group.id);
    setForm(toForm(group, selectedRestaurantId));
    setFormError("");
    setItemSearch("");
  };

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));
  const updateOption = (index, patch) => setForm((current) => ({
    ...current,
    options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option),
  }));
  const updateOptionPriceRule = (index, patch) => setForm((current) => ({
    ...current,
    options: current.options.map((option, optionIndex) => optionIndex === index
      ? { ...option, priceRule: { ...option.priceRule, ...patch } }
      : option),
  }));

  const toggleDefaultOption = (index, checked) => setForm((current) => ({
    ...current,
    options: current.options.map((option, optionIndex) => ({
      ...option,
      isDefault: checked ? optionIndex === index : optionIndex === index ? false : option.isDefault,
    })),
  }));

  const changeSelectionType = (selectionType) => setForm((current) => ({
    ...current,
    selectionType,
    minSelected: selectionType === "single" ? current.required ? 1 : 0 : current.required ? 1 : 0,
    maxSelected: selectionType === "single" ? 1 : "",
    options: selectionType === "single"
      ? current.options.map((option, index) => ({ ...option, isDefault: index === current.options.findIndex((item) => item.isDefault) }))
      : current.options,
  }));

  const changeRequired = (required) => setForm((current) => ({
    ...current,
    required,
    minSelected: required ? Math.max(1, Number(current.minSelected || 0)) : current.selectionType === "single" ? 0 : current.minSelected,
  }));

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

  const handleRestaurantChange = (restaurantId) => {
    setSelectedRestaurantId(restaurantId);
    setForm(blankForm(restaurantId));
    setEditingId("");
    setFormError("");
    setToast("");
    setItemSearch("");
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
    if (!canDelete || !group?.id || !window.confirm(`Xoá nhóm tuỳ chọn "${group.name}"?`)) return;
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
    <main className="modifier-management">
      <ManagementPageHeader
        className="modifier-management__page-header"
        density="compact"
        statsPlacement="right"
        showTimeWidget={false}
        eyebrow="Menu operations"
        title="Cấu hình tuỳ chọn món"
        icon={<SlidersHorizontal size={18} aria-hidden="true" />}
        subtitle="Quản lý size, topping và cách chế biến cho từng món hoặc toàn menu."
        loading={loading}
        stats={[
          { id: "total", label: "Tổng nhóm", value: stats.total, icon: <Layers3 size={17} aria-hidden="true" /> },
          { id: "active", label: "Đang bật", value: stats.active, icon: <CheckCircle2 size={17} aria-hidden="true" /> },
          { id: "options", label: "Lựa chọn", value: stats.optionCount, icon: <Utensils size={17} aria-hidden="true" /> },
          { id: "global", label: "Toàn menu", value: stats.global, icon: <Globe2 size={17} aria-hidden="true" /> },
        ]}
        primaryAction={{
          label: "Tạo nhóm",
          icon: <Plus size={16} aria-hidden="true" />,
          onClick: resetForm,
          disabled: !canWrite || !selectedRestaurantId,
        }}
      />

      <ManagerCommandBar
        className="modifier-management__command-bar"
        tabs={STATUS_TABS}
        activeTab={statusFilter}
        onTabChange={setStatusFilter}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm size, topping, độ cay..."
        searchAriaLabel="Tìm nhóm tuỳ chọn"
        leftSlot={
          <label className="modifier-management__restaurant-filter">
            <Store size={16} aria-hidden="true" />
            <select
              aria-label="Chọn chi nhánh"
              value={selectedRestaurantId || ""}
              onChange={(event) => handleRestaurantChange(event.target.value)}
              disabled={restaurantsLoading || restaurantOptions.length <= 1}
            >
              {!hasRestaurants && <option value="">Chưa có chi nhánh</option>}
              {restaurantOptions.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
              ))}
            </select>
          </label>
        }
        filters={
          <select
            className="modifier-management__type-filter"
            aria-label="Lọc theo loại nhóm"
            value={groupTypeFilter}
            onChange={(event) => setGroupTypeFilter(event.target.value)}
          >
            {GROUP_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        }
        actions={[
          {
            label: "Làm mới",
            icon: <RefreshCcw size={15} aria-hidden="true" />,
            onClick: () => refetch?.(),
            disabled: !selectedRestaurantId,
            loading,
          },
        ]}
        rightSlot={<span className="modifier-management__result-count" aria-live="polite">{visibleGroups.length} nhóm</span>}
      />

      {toast && <div className="modifier-management__notice" role="status">{toast}</div>}
      {formError && <div className="modifier-management__error" role="alert">{formError}</div>}
      {error && <div className="modifier-management__error" role="alert">{error.message}</div>}

      <div className="modifier-management__workspace">
        <section className="modifier-management__list" aria-label="Danh sách nhóm tuỳ chọn">
          <div className="modifier-management__section-heading">
            <div>
              <p>Danh mục vận hành</p>
              <h2>Nhóm tại {selectedRestaurantName}</h2>
              <span>{loading ? "Đang tải dữ liệu" : `${visibleGroups.length}/${modifierGroups.length} nhóm phù hợp`}</span>
            </div>
            <button type="button" onClick={resetForm} className="modifier-management__primary-button" disabled={!canWrite || !selectedRestaurantId}>
              <Plus size={15} aria-hidden="true" />
              Tạo mới
            </button>
          </div>

          {!selectedRestaurantId ? (
            <div className="modifier-management-empty"><Store size={24} aria-hidden="true" /><strong>Chọn chi nhánh</strong><span>Chọn chi nhánh để cấu hình tuỳ chọn món.</span></div>
          ) : loading && !modifierGroups.length ? (
            <div className="modifier-management__skeletons" aria-label="Đang tải nhóm tuỳ chọn">
              {Array.from({ length: 3 }).map((_, index) => <div className="modifier-card modifier-card--skeleton" key={index} />)}
            </div>
          ) : !visibleGroups.length ? (
            <div className="modifier-management-empty"><CircleOff size={24} aria-hidden="true" /><strong>Không có nhóm phù hợp</strong><span>Đổi bộ lọc hoặc tạo nhóm tuỳ chọn mới.</span></div>
          ) : (
            <div className="modifier-management__cards" role="list">
              {visibleGroups.map((group) => (
                <article key={group.id} role="listitem" className={`modifier-card ${selectedGroup?.id === group.id ? "is-selected" : ""}`}>
                  <div className="modifier-card__header">
                    <div className="modifier-card__title-wrap">
                      <span className="modifier-card__type">{getGroupTypeLabel(group.groupType)}</span>
                      <h3>{group.name}</h3>
                      <p>{getCoverageLabel(group.coverage)}{group.coverage === "ITEMS" ? ` · ${group.menuItemIds?.length || 0} món` : ""}</p>
                    </div>
                    <span className={`modifier-card__status ${group.isActive === false ? "is-off" : ""}`}>
                      {group.isActive === false ? "Đã tắt" : "Đang bật"}
                    </span>
                  </div>

                  <div className="modifier-card__meta">
                    <span>{group.selectionType === "single" ? "Chọn một" : "Chọn nhiều"}</span>
                    <span>{group.required ? "Bắt buộc" : "Tuỳ chọn"}</span>
                    {group.selectionType === "multiple" && (
                      <span>{group.minSelected || 0}–{group.maxSelected || "∞"} lựa chọn</span>
                    )}
                  </div>

                  <ul className="modifier-card__options" aria-label={`Lựa chọn của ${group.name}`}>
                    {(group.options || []).slice(0, 4).map((option) => (
                      <li key={option.id || option.name} className={option.isActive === false ? "is-off" : ""}>
                        <span>{option.name}{option.isDefault ? " · Mặc định" : ""}</span>
                        <strong>{formatModifierPriceRule(option.priceRule)}</strong>
                      </li>
                    ))}
                    {(group.options?.length || 0) > 4 && <li className="modifier-card__more">+{group.options.length - 4} lựa chọn khác</li>}
                  </ul>

                  {group.note && <p className="modifier-card__note">{group.note}</p>}

                  <div className="modifier-card__actions">
                    <button type="button" onClick={() => editGroup(group)} disabled={!canWrite} aria-label={`Sửa ${group.name}`}>
                      <Pencil size={14} aria-hidden="true" />
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => handleDelete(group)}
                      disabled={!canDelete || deleting}
                      title={canDelete ? "Xoá nhóm tuỳ chọn" : "Chỉ quản trị viên được xoá nhóm đã tạo"}
                      aria-label={`Xoá ${group.name}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Xoá
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="modifier-editor" className="modifier-management__form-panel" aria-labelledby="modifier-editor-title">
          <div className="modifier-management__section-heading modifier-management__section-heading--editor">
            <div>
              <p>{editingId ? "Chỉnh sửa" : "Tạo mới"}</p>
              <h2 id="modifier-editor-title">{editingId ? form.name || "Nhóm tuỳ chọn" : "Nhóm tuỳ chọn mới"}</h2>
              <span>{editingId ? "Thay đổi áp dụng sau khi lưu." : "Khai báo nhóm và các lựa chọn bên dưới."}</span>
            </div>
            {editingId && <button type="button" className="modifier-management__icon-button" onClick={resetForm} aria-label="Đóng chế độ chỉnh sửa"><Plus size={17} aria-hidden="true" /></button>}
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
                  <select value={form.selectionType} onChange={(event) => changeSelectionType(event.target.value)}>
                    <option value="single">Chọn một</option>
                    <option value="multiple">Chọn nhiều</option>
                  </select>
                </label>
              </div>

              <div className="modifier-form__switches">
                <label><input type="checkbox" checked={form.required} onChange={(event) => changeRequired(event.target.checked)} /> Bắt buộc chọn</label>
                <label><input type="checkbox" checked={form.isActive !== false} onChange={(event) => updateForm({ isActive: event.target.checked })} /> Đang bật</label>
              </div>

              {form.selectionType === "multiple" && (
                <div className="modifier-form__row">
                  <label className="modifier-form__field">
                    <span>Tối thiểu</span>
                    <input type="number" min={form.required ? 1 : 0} value={form.minSelected} onChange={(event) => updateForm({ minSelected: event.target.value })} />
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
                <div className="modifier-form__menu-block">
                  <div className="modifier-form__menu-heading">
                    <strong>Món áp dụng</strong>
                    <span>{form.menuItemIds.length} món đã chọn</span>
                  </div>
                  <input type="search" aria-label="Tìm món để áp dụng" value={itemSearch} onChange={(event) => setItemSearch(event.target.value)} placeholder="Tìm món..." />
                  <div className="modifier-form__menu-items" aria-label="Chọn món áp dụng modifier">
                    {visibleMenuItems.map((item) => (
                      <label key={item.id}>
                        <input type="checkbox" checked={form.menuItemIds.map(String).includes(String(item.id))} onChange={() => toggleMenuItem(item.id)} />
                        <span>{item.name}</span>
                        <small>{formatMoney(item.basePrice)}</small>
                      </label>
                    ))}
                    {!visibleMenuItems.length && <p>Không có món phù hợp.</p>}
                  </div>
                </div>
              )}

              <div className="modifier-form__options-heading">
                <div><h3>Lựa chọn</h3><span>Chỉ một lựa chọn được đặt làm mặc định.</span></div>
                <button type="button" onClick={addOption}><Plus size={14} aria-hidden="true" />Thêm lựa chọn</button>
              </div>

              <div className="modifier-form__options">
                {form.options.map((option, index) => (
                  <div key={option.id || index} className="modifier-option-editor">
                    <div className="modifier-option-editor__heading">
                      <span>Lựa chọn {index + 1}</span>
                      <strong>{formatModifierPriceRule(option.priceRule)}</strong>
                    </div>
                    <label className="modifier-form__field">
                      <span>Tên lựa chọn</span>
                      <input value={option.name} onChange={(event) => updateOption(index, { name: event.target.value })} placeholder="Ví dụ: Size L, thêm bò, ít cay" required={index === 0} />
                    </label>
                    <div className="modifier-form__row">
                      <label className="modifier-form__field">
                        <span>Quy tắc giá</span>
                        <select value={option.priceRule.rule} onChange={(event) => updateOptionPriceRule(index, { rule: event.target.value })}>
                          <option value="DELTA">Cộng/trừ giá món</option>
                          <option value="SET">Đặt lại giá món</option>
                        </select>
                      </label>
                      <label className="modifier-form__field">
                        <span>{option.priceRule.rule === "SET" ? "Giá món mới" : "Số tiền thay đổi"}</span>
                        <input type="number" min={option.priceRule.rule === "SET" ? 0 : undefined} value={option.priceRule.amount} onChange={(event) => updateOptionPriceRule(index, { amount: event.target.value })} />
                      </label>
                    </div>
                    <div className="modifier-option-editor__checks">
                      <label><input type="checkbox" checked={option.isDefault} onChange={(event) => toggleDefaultOption(index, event.target.checked)} /> Mặc định</label>
                      <label><input type="checkbox" checked={option.isActive !== false} onChange={(event) => updateOption(index, { isActive: event.target.checked })} /> Đang bật</label>
                    </div>
                    <button type="button" className="modifier-option-editor__remove" onClick={() => removeOption(index)} disabled={form.options.length <= 1}><Trash2 size={14} aria-hidden="true" />Xoá lựa chọn</button>
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
                  <Save size={15} aria-hidden="true" />
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
