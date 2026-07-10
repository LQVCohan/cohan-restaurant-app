import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarDays,
  Layers3,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  Save,
  Store,
  Trash2,
  Utensils,
} from "lucide-react";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import { useNotification } from "@/hooks/useNotification";
import Modal from "../../common/Modal";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import ManagerCommandBar from "../shared/ManagerCommandBar";
import "./ComboManagement.scss";

const MANAGER_COMBOS = gql`
  query ManagerCombos($restaurantId: ID!, $search: String, $status: String) {
    managerCombos(restaurantId: $restaurantId, search: $search, status: $status) {
      id name description imageUrl price originalPrice isActive
      restaurantId restaurantName createdAt updatedAt
      items { menuItemId name qty price imageUrl }
    }
  }
`;
const MENU_ITEMS = gql`
  query ComboMenuItems($restaurantId: ID!) {
    menuItems(restaurantId: $restaurantId, limit: 500) {
      id name basePrice thumbImage status restaurantId
    }
  }
`;
const CREATE_COMBO = gql`mutation CreateCombo($input: ComboInput!) { createCombo(input: $input) { id } }`;
const UPDATE_COMBO = gql`mutation UpdateCombo($id: ID!, $input: ComboInput!) { updateCombo(id: $id, input: $input) { id } }`;
const DELETE_COMBO = gql`mutation DeleteCombo($id: ID!) { deleteCombo(id: $id) }`;
const TOGGLE_COMBO = gql`mutation ToggleCombo($id: ID!, $isActive: Boolean!) { toggleComboStatus(id: $id, isActive: $isActive) { id isActive } }`;

const STATUS_TABS = [
  { id: "active", label: "Đang bán" },
  { id: "inactive", label: "Tạm tắt" },
  { id: "all", label: "Tất cả" },
];
const makeEmptyForm = () => ({ name: "", description: "", imageUrl: "", price: "", isActive: true, items: [] });
const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
const formatDate = (value) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const replaceBrokenImage = (event) => {
  if (event.currentTarget.dataset.fallbackApplied) return;
  event.currentTarget.dataset.fallbackApplied = "true";
  event.currentTarget.src = "/default-dishes.jpg";
};
const getMenuItemStatusLabel = (status) => status === "out_of_stock" ? "Hết món" : "Đang bán";

export default function ComboManagement() {
  const {
    selectedRestaurantId,
    restaurantOptions,
    setSelectedRestaurantId,
    hasRestaurants,
  } = useManagerRestaurantSelection();
  const { showNotification } = useNotification();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(makeEmptyForm);
  const [busyKey, setBusyKey] = useState("");

  const { data, loading, error, refetch } = useQuery(MANAGER_COMBOS, {
    variables: { restaurantId: selectedRestaurantId, search, status },
    skip: !selectedRestaurantId,
    fetchPolicy: "cache-and-network",
  });
  const { data: menuData, loading: menuLoading, error: menuError } = useQuery(MENU_ITEMS, {
    variables: { restaurantId: selectedRestaurantId },
    skip: !selectedRestaurantId,
  });
  const [createCombo, { loading: creating }] = useMutation(CREATE_COMBO);
  const [updateCombo, { loading: updating }] = useMutation(UPDATE_COMBO);
  const [deleteCombo] = useMutation(DELETE_COMBO);
  const [toggleCombo] = useMutation(TOGGLE_COMBO);

  const combos = data?.managerCombos || [];
  const menuItems = menuData?.menuItems || [];
  const mutationLoading = creating || updating;
  const selectedRestaurantName = restaurantOptions.find(
    (restaurant) => String(restaurant.id) === String(selectedRestaurantId),
  )?.name || "nhà hàng hiện tại";
  const menuById = useMemo(
    () => new Map(menuItems.map((item) => [String(item.id), item])),
    [menuItems],
  );
  const selectedItemIds = useMemo(
    () => new Set(form.items.map((item) => String(item.menuItemId || "")).filter(Boolean)),
    [form.items],
  );
  const selectedRows = useMemo(
    () => form.items.map((row) => {
      const currentItem = menuById.get(String(row.menuItemId));
      return {
        ...row,
        name: currentItem?.name || row.name || "Món không còn trong danh sách",
        price: Number(currentItem?.basePrice ?? row.price ?? 0),
        imageUrl: currentItem?.thumbImage || row.imageUrl || "/default-dishes.jpg",
        status: currentItem?.status || row.status || "unavailable",
        missingFromMenu: !currentItem,
      };
    }),
    [form.items, menuById],
  );
  const originalPrice = selectedRows.reduce(
    (sum, row) => sum + Number(row.price || 0) * Number(row.qty || 0),
    0,
  );
  const comboPrice = Number(form.price || 0);
  const saving = Math.max(0, originalPrice - comboPrice);
  const savingPercent = originalPrice > 0 && saving > 0 ? Math.round((saving / originalPrice) * 100) : 0;
  const previewImage = form.imageUrl.trim() || selectedRows.find((row) => row.imageUrl)?.imageUrl || "/default-dishes.jpg";
  const allMenuItemsSelected = menuItems.length > 0 && menuItems.every((item) => selectedItemIds.has(String(item.id)));
  const hasActiveFilters = Boolean(search.trim()) || status !== "all";

  const summary = useMemo(() => {
    const itemQuantity = combos.reduce(
      (total, combo) => total + (combo.items || []).reduce((sum, item) => sum + Number(item.qty || 1), 0),
      0,
    );
    const totalSaving = combos.reduce(
      (total, combo) => total + Math.max(0, Number(combo.originalPrice || 0) - Number(combo.price || 0)),
      0,
    );
    return {
      visible: combos.length,
      itemQuantity,
      averageSaving: combos.length ? Math.round(totalSaving / combos.length) : 0,
    };
  }, [combos]);

  const openCreate = () => {
    if (!selectedRestaurantId) {
      showNotification("Hãy chọn nhà hàng trước khi tạo combo.", "warning");
      return;
    }
    setEditing(null);
    setForm(makeEmptyForm());
    setModalOpen(true);
  };

  const openEdit = (combo) => {
    setEditing(combo);
    setForm({
      name: combo.name || "",
      description: combo.description || "",
      imageUrl: combo.imageUrl || "",
      price: combo.price || "",
      isActive: combo.isActive !== false,
      items: (combo.items || []).map((item) => ({
        menuItemId: item.menuItemId,
        qty: item.qty || 1,
        name: item.name || "",
        price: item.price || 0,
        imageUrl: item.imageUrl || "",
      })),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (mutationLoading) return;
    setModalOpen(false);
    setEditing(null);
    setForm(makeEmptyForm());
  };

  const addItem = () => {
    if (!menuItems.length) {
      showNotification("Nhà hàng này chưa có món để thêm vào combo.", "warning");
      return;
    }
    const nextItem = menuItems.find((item) => !selectedItemIds.has(String(item.id)));
    if (!nextItem) {
      showNotification("Tất cả món hiện có đã được thêm vào combo.", "info");
      return;
    }
    setForm((previous) => ({
      ...previous,
      items: [...previous.items, {
        menuItemId: nextItem.id,
        qty: 1,
        name: nextItem.name,
        price: nextItem.basePrice || 0,
        imageUrl: nextItem.thumbImage || "",
        status: nextItem.status,
      }],
    }));
  };

  const updateItem = (index, patch) => setForm((previous) => ({
    ...previous,
    items: previous.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  }));

  const changeItemSelection = (index, menuItemId) => {
    if (form.items.some((item, itemIndex) => itemIndex !== index && String(item.menuItemId) === String(menuItemId))) {
      showNotification("Món này đã có trong combo. Hãy tăng số lượng trên dòng hiện tại.", "warning");
      return;
    }
    const selectedItem = menuById.get(String(menuItemId));
    updateItem(index, {
      menuItemId,
      name: selectedItem?.name || "",
      price: selectedItem?.basePrice || 0,
      imageUrl: selectedItem?.thumbImage || "",
      status: selectedItem?.status,
    });
  };

  const removeItem = (index) => setForm((previous) => ({
    ...previous,
    items: previous.items.filter((_, itemIndex) => itemIndex !== index),
  }));

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedRestaurantId) {
      showNotification("Hãy chọn nhà hàng hợp lệ trước khi lưu combo.", "warning");
      return;
    }
    if (!form.name.trim() || !Number.isFinite(comboPrice) || comboPrice <= 0 || !form.items.length || form.items.some((item) => !item.menuItemId)) {
      showNotification("Vui lòng nhập tên, giá và ít nhất 1 món hợp lệ.", "warning");
      return;
    }
    const invalidQuantityIndex = form.items.findIndex((item) => {
      const quantity = Number(item.qty);
      return !Number.isInteger(quantity) || quantity < 1;
    });
    if (invalidQuantityIndex >= 0) {
      showNotification(`Số lượng món ở dòng ${invalidQuantityIndex + 1} phải là số nguyên lớn hơn 0.`, "warning");
      return;
    }
    const ids = form.items.map((item) => String(item.menuItemId));
    if (new Set(ids).size !== ids.length) {
      showNotification("Mỗi món chỉ được thêm một lần. Hãy tăng số lượng trên cùng một dòng.", "warning");
      return;
    }

    const input = {
      restaurantId: selectedRestaurantId,
      name: form.name.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      price: comboPrice,
      isActive: form.isActive,
      items: form.items.map((item) => ({ menuItemId: item.menuItemId, qty: Number(item.qty) })),
    };
    try {
      if (editing?.id) await updateCombo({ variables: { id: editing.id, input } });
      else await createCombo({ variables: { input } });
      showNotification(editing?.id ? "Đã cập nhật combo." : "Đã tạo combo.", "success");
      closeModal();
      await refetch();
    } catch (submitError) {
      showNotification(submitError.message || "Không thể lưu combo.", "error");
    }
  };

  const handleToggle = async (combo) => {
    setBusyKey(`toggle:${combo.id}`);
    try {
      await toggleCombo({ variables: { id: combo.id, isActive: !combo.isActive } });
      showNotification(combo.isActive ? "Đã tạm tắt combo." : "Đã bật bán combo.", "success");
      await refetch();
    } catch (toggleError) {
      showNotification(toggleError.message || "Không thể cập nhật trạng thái combo.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const handleDelete = async (combo) => {
    if (!window.confirm(`Xóa combo “${combo.name}”?`)) return;
    setBusyKey(`delete:${combo.id}`);
    try {
      await deleteCombo({ variables: { id: combo.id } });
      showNotification("Đã xóa combo.", "success");
      await refetch();
    } catch (deleteError) {
      showNotification(deleteError.message || "Không thể xóa combo.", "error");
    } finally {
      setBusyKey("");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
  };

  return (
    <main className="combo-management">
      <ManagementPageHeader
        className="combo-management__page-header"
        density="compact"
        statsPlacement="right"
        showTimeWidget={false}
        eyebrow="Bộ món bán cố định"
        title="Quản lý combo"
        icon={<Layers3 size={18} aria-hidden="true" />}
        subtitle="Tạo, định giá và kiểm soát trạng thái bán của combo theo từng nhà hàng."
        loading={loading}
        stats={[
          { id: "visible", label: "Đang hiển thị", value: summary.visible, icon: <Layers3 size={17} aria-hidden="true" /> },
          { id: "items", label: "Tổng số suất", value: summary.itemQuantity, icon: <Utensils size={17} aria-hidden="true" /> },
          { id: "saving", label: "Tiết kiệm trung bình", value: money(summary.averageSaving), icon: <BadgeDollarSign size={17} aria-hidden="true" /> },
        ]}
        primaryAction={{
          label: "Tạo combo",
          icon: <Plus size={16} aria-hidden="true" />,
          onClick: openCreate,
          disabled: !selectedRestaurantId,
          title: selectedRestaurantId ? "Tạo combo mới" : "Chọn nhà hàng trước khi tạo combo",
        }}
      />

      <ManagerCommandBar
        className="combo-management__command-bar"
        tabs={STATUS_TABS}
        activeTab={status}
        onTabChange={setStatus}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Tìm theo tên combo"
        searchAriaLabel="Tìm combo"
        leftSlot={
          <label className="combo-management__restaurant-filter">
            <Store size={16} aria-hidden="true" />
            <select aria-label="Chọn nhà hàng" value={selectedRestaurantId || ""} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
              {!restaurantOptions.length ? <option value="">Chưa có nhà hàng</option> : null}
              {restaurantOptions.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
            </select>
          </label>
        }
        rightSlot={<span className="combo-management__result-count" aria-live="polite">{loading ? "Đang tải" : `${combos.length} combo`}</span>}
      />

      <div className="combo-management__list-heading">
        <div><span>Danh mục vận hành</span><h2>Combo tại {selectedRestaurantName}</h2></div>
        <p>Giá bán, món thành phần và trạng thái được quản lý tại một nơi.</p>
      </div>

      {!hasRestaurants ? (
        <section className="combo-management__state"><Store size={28} aria-hidden="true" /><h2>Chưa có nhà hàng</h2><p>Thêm hoặc chọn nhà hàng để quản lý combo.</p></section>
      ) : error ? (
        <section className="combo-management__state combo-management__state--error" role="alert">
          <AlertTriangle size={28} aria-hidden="true" /><h2>Không thể tải danh sách combo</h2>
          <p>{error.message || "Vui lòng kiểm tra kết nối và thử lại."}</p>
          <button type="button" className="combo-management__state-action" onClick={() => refetch()}><RotateCcw size={16} aria-hidden="true" />Thử lại</button>
        </section>
      ) : loading ? (
        <section className="combo-management__grid" aria-label="Đang tải combo">
          {Array.from({ length: 3 }).map((_, index) => <div className="manager-combo-card manager-combo-card--skeleton" key={index} />)}
        </section>
      ) : combos.length ? (
        <section className="combo-management__grid" aria-label="Danh sách combo" role="list">
          {combos.map((combo) => {
            const items = combo.items || [];
            const comboSaving = Math.max(0, Number(combo.originalPrice || 0) - Number(combo.price || 0));
            const itemText = items.slice(0, 3).map((item) => `${item.name || "Món"} ×${item.qty || 1}`).join(" • ");
            return (
              <article className="manager-combo-card" key={combo.id} role="listitem">
                <div className="manager-combo-card__media">
                  <img src={combo.imageUrl || items[0]?.imageUrl || "/default-dishes.jpg"} alt={`Ảnh ${combo.name}`} onError={replaceBrokenImage} />
                  <span className={`manager-combo-card__status ${combo.isActive ? "is-active" : "is-muted"}`}>{combo.isActive ? "Đang bán" : "Tạm tắt"}</span>
                  {comboSaving > 0 ? <span className="manager-combo-card__saving">Tiết kiệm {money(comboSaving)}</span> : null}
                </div>
                <div className="manager-combo-card__body">
                  <div className="manager-combo-card__title-row"><h3>{combo.name}</h3><span>{items.length} món</span></div>
                  <p className="manager-combo-card__description">{combo.description || "Combo cố định giúp khách chọn món nhanh hơn."}</p>
                  {itemText ? <p className="manager-combo-card__item-summary">{itemText}{items.length > 3 ? ` • +${items.length - 3} món khác` : ""}</p> : null}
                  <dl className="manager-combo-card__prices">
                    <div><dt>Giá combo</dt><dd>{money(combo.price)}</dd></div>
                    <div><dt>Giá món lẻ</dt><dd>{money(combo.originalPrice)}</dd></div>
                  </dl>
                  <footer className="manager-combo-card__footer">
                    <span className="manager-combo-card__updated"><CalendarDays size={14} aria-hidden="true" />Cập nhật {formatDate(combo.updatedAt || combo.createdAt)}</span>
                    <div className="manager-combo-card__actions">
                      <button type="button" onClick={() => openEdit(combo)} disabled={Boolean(busyKey)} aria-label={`Sửa ${combo.name}`}><Pencil size={14} aria-hidden="true" />Sửa</button>
                      <button type="button" onClick={() => handleToggle(combo)} disabled={Boolean(busyKey)} aria-label={`${combo.isActive ? "Tắt" : "Bật"} ${combo.name}`}>
                        {combo.isActive ? <PowerOff size={14} aria-hidden="true" /> : <Power size={14} aria-hidden="true" />}
                        {busyKey === `toggle:${combo.id}` ? "Đang lưu" : combo.isActive ? "Tạm tắt" : "Bật bán"}
                      </button>
                      <button type="button" className="is-danger" onClick={() => handleDelete(combo)} disabled={Boolean(busyKey)} aria-label={`Xóa ${combo.name}`}><Trash2 size={14} aria-hidden="true" />{busyKey === `delete:${combo.id}` ? "Đang xóa" : "Xóa"}</button>
                    </div>
                  </footer>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="combo-management__state">
          <Layers3 size={28} aria-hidden="true" /><h2>Chưa có combo phù hợp</h2>
          <p>{hasActiveFilters ? "Không có combo khớp từ khóa hoặc trạng thái đang chọn." : "Tạo combo đầu tiên để bắt đầu bán theo bộ món."}</p>
          {hasActiveFilters ? (
            <button type="button" className="combo-management__state-action" onClick={clearFilters}><RotateCcw size={16} aria-hidden="true" />Xem tất cả combo</button>
          ) : (
            <button type="button" className="combo-management__state-action" onClick={openCreate}><Plus size={16} aria-hidden="true" />Tạo combo đầu tiên</button>
          )}
        </section>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        onBeforeClose={() => !mutationLoading}
        closeOnOverlayClick={!mutationLoading}
        title={editing ? "Cập nhật combo" : "Tạo combo"}
        size="xl"
        className="combo-management__dialog"
        autoWrapBody={false}
      >
        <form className="combo-management__form" onSubmit={submit}>
          <div className="combo-management__dialog-content">
            <section className="combo-management__editor" aria-label="Thông tin combo">
              <div className="combo-management__dialog-intro">
                <span>{editing ? "Chỉnh sửa bộ món" : "Combo mới"}</span>
                <h3>{selectedRestaurantName}</h3>
                <p>{menuError ? "Không thể tải danh sách món mới; các món đang có vẫn được giữ nguyên." : menuLoading ? "Đang tải danh sách món..." : `${menuItems.length} món có thể chọn tại nhà hàng này.`}</p>
              </div>

              <div className="combo-management__fields">
                <label className="combo-management__field--wide">Tên combo
                  <input required autoFocus maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ví dụ: Combo trưa no đủ" />
                </label>
                <label className="combo-management__field--wide">Mô tả
                  <textarea maxLength={500} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Mô tả ngắn để nhân viên và khách dễ hiểu" />
                </label>
                <label>Đường dẫn ảnh combo
                  <input value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} placeholder="https://..." />
                </label>
                <label>Giá bán combo
                  <input required type="number" inputMode="numeric" min="1" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="0" />
                </label>
              </div>

              <div className="combo-management__items">
                <div className="combo-management__items-heading">
                  <div><strong>Món trong combo</strong><span>{form.items.length} món · {form.items.reduce((sum, item) => sum + Number(item.qty || 0), 0)} suất</span></div>
                  <button type="button" className="combo-management__secondary-button" onClick={addItem} disabled={menuLoading || Boolean(menuError) || allMenuItemsSelected}><Plus size={15} aria-hidden="true" />{allMenuItemsSelected ? "Đã chọn hết món" : "Thêm món"}</button>
                </div>

                <div className="combo-management__item-list">
                  {selectedRows.map((item, index) => (
                    <div className="combo-management__item-row" key={`${item.menuItemId}-${index}`}>
                      <img src={item.imageUrl || "/default-dishes.jpg"} alt="" onError={replaceBrokenImage} />
                      <label className="combo-management__item-select"><span>Món {index + 1}</span>
                        <select aria-label={`Chọn món ${index + 1}`} value={item.menuItemId} onChange={(event) => changeItemSelection(index, event.target.value)}>
                          {item.missingFromMenu ? <option value={item.menuItemId}>{item.name} · Không còn trong danh sách bán</option> : null}
                          {menuItems.map((menuItem) => (
                            <option
                              key={menuItem.id}
                              value={menuItem.id}
                              disabled={String(menuItem.id) !== String(item.menuItemId) && selectedItemIds.has(String(menuItem.id))}
                            >
                              {menuItem.name} · {money(menuItem.basePrice)} · {getMenuItemStatusLabel(menuItem.status)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="combo-management__item-quantity"><span>Số lượng</span>
                        <input aria-label={`Số lượng món ${index + 1}`} type="number" inputMode="numeric" min="1" step="1" required value={item.qty} onChange={(event) => updateItem(index, { qty: event.target.value })} />
                      </label>
                      <div className="combo-management__item-subtotal"><span>Tạm tính</span><strong>{money(Number(item.price || 0) * Number(item.qty || 0))}</strong></div>
                      <button type="button" className="combo-management__remove-item" onClick={() => removeItem(index)} aria-label={`Xóa món ${index + 1} khỏi combo`}><Trash2 size={16} aria-hidden="true" /></button>
                    </div>
                  ))}
                </div>

                {!form.items.length ? (
                  <div className="combo-management__hint"><Utensils size={19} aria-hidden="true" /><strong>Chưa có món nào</strong><span>Thêm ít nhất một món để có thể lưu combo.</span></div>
                ) : null}
              </div>
            </section>

            <aside className="combo-management__summary" aria-label="Xem trước combo">
              <div className="combo-management__preview-card">
                <div className="combo-management__preview-media">
                  <img src={previewImage} alt={`Xem trước ${form.name || "combo"}`} onError={replaceBrokenImage} />
                  <span className={form.isActive ? "is-active" : "is-muted"}>{form.isActive ? "Sẽ mở bán" : "Sẽ tạm tắt"}</span>
                </div>
                <div className="combo-management__preview-body">
                  <span className="combo-management__preview-eyebrow">Xem trước</span>
                  <h3>{form.name.trim() || "Tên combo sẽ hiển thị tại đây"}</h3>
                  <p>{form.description.trim() || "Mô tả ngắn giúp khách hiểu nhanh combo gồm những gì."}</p>
                  <div className="combo-management__preview-items">
                    {selectedRows.length ? selectedRows.slice(0, 4).map((item, index) => <span key={`${item.menuItemId}-${index}`}>{item.name} ×{item.qty || 0}</span>) : <span>Chưa chọn món</span>}
                    {selectedRows.length > 4 ? <span>+{selectedRows.length - 4} món khác</span> : null}
                  </div>
                  <dl className="combo-management__preview-prices">
                    <div><dt>Giá món lẻ</dt><dd>{money(originalPrice)}</dd></div>
                    <div><dt>Giá combo</dt><dd>{money(comboPrice)}</dd></div>
                    <div className="is-saving"><dt>Khách tiết kiệm</dt><dd>{money(saving)}{savingPercent > 0 ? ` · ${savingPercent}%` : ""}</dd></div>
                  </dl>
                </div>
              </div>
              <p className="combo-management__summary-note">Giá món lẻ được tính từ giá hiện tại của từng món và số lượng đã chọn. Một món chỉ xuất hiện một lần; hãy tăng số lượng khi cần nhiều suất.</p>
            </aside>
          </div>

          <footer className="combo-management__form-footer">
            <label className="combo-management__check"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /><span><strong>Mở bán sau khi lưu</strong><small>Combo sẽ xuất hiện ở các luồng bán hàng khi món thành phần còn khả dụng.</small></span></label>
            <div className="combo-management__footer-actions">
              <button type="button" className="combo-management__cancel" onClick={closeModal} disabled={mutationLoading}>Hủy</button>
              <button type="submit" className="combo-management__submit" disabled={mutationLoading}><Save size={16} aria-hidden="true" />{mutationLoading ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Tạo combo"}</button>
            </div>
          </footer>
        </form>
      </Modal>
    </main>
  );
}
