import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import { useNotification } from "@/hooks/useNotification";
import "./ComboManagement.scss";

const MANAGER_COMBOS = gql`
  query ManagerCombos($restaurantId: ID!, $search: String, $status: String) {
    managerCombos(restaurantId: $restaurantId, search: $search, status: $status) {
      id name description imageUrl price originalPrice isActive restaurantId restaurantName createdAt updatedAt
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

const makeEmptyForm = () => ({ name: "", description: "", imageUrl: "", price: "", isActive: true, items: [] });
const money = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
const formatDate = (value) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function ComboManagement() {
  const { selectedRestaurantId, restaurantOptions, setSelectedRestaurantId, hasRestaurants } = useManagerRestaurantSelection();
  const { showNotification } = useNotification();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(makeEmptyForm);
  const { data, loading, refetch } = useQuery(MANAGER_COMBOS, {
    variables: { restaurantId: selectedRestaurantId, search, status },
    skip: !selectedRestaurantId,
    fetchPolicy: "cache-and-network",
  });
  const { data: menuData, loading: menuLoading } = useQuery(MENU_ITEMS, {
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
  const menuById = useMemo(() => new Map(menuItems.map((item) => [String(item.id), item])), [menuItems]);
  const originalPrice = form.items.reduce((sum, row) => sum + Number(menuById.get(String(row.menuItemId))?.basePrice || 0) * Number(row.qty || 1), 0);
  const saving = Math.max(0, originalPrice - Number(form.price || 0));

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
      items: (combo.items || []).map((item) => ({ menuItemId: item.menuItemId, qty: item.qty || 1 })),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm(makeEmptyForm());
  };

  const addItem = () => {
    if (!menuItems.length) {
      showNotification("Nhà hàng này chưa có món để thêm vào combo.", "warning");
      return;
    }
    setForm((prev) => ({ ...prev, items: [...prev.items, { menuItemId: menuItems[0].id, qty: 1 }] }));
  };

  const updateItem = (index, patch) => setForm((prev) => ({ ...prev, items: prev.items.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  const removeItem = (index) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedRestaurantId) {
      showNotification("Hãy chọn nhà hàng hợp lệ trước khi lưu combo.", "warning");
      return;
    }
    if (!form.name.trim() || Number(form.price) <= 0 || form.items.length < 1 || form.items.some((item) => !item.menuItemId)) {
      showNotification("Vui lòng nhập tên, giá và ít nhất 1 món hợp lệ.", "warning");
      return;
    }
    const input = {
      restaurantId: selectedRestaurantId,
      name: form.name.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      price: Number(form.price),
      isActive: form.isActive,
      items: form.items.map((item) => ({ menuItemId: item.menuItemId, qty: Number(item.qty || 1) })),
    };
    try {
      if (editing?.id) await updateCombo({ variables: { id: editing.id, input } });
      else await createCombo({ variables: { input } });
      showNotification("Đã lưu combo.", "success");
      closeModal();
      await refetch();
    } catch (error) {
      showNotification(error.message || "Không thể lưu combo.", "error");
    }
  };

  const handleToggle = async (combo) => {
    try {
      await toggleCombo({ variables: { id: combo.id, isActive: !combo.isActive } });
      await refetch();
    } catch (error) {
      showNotification(error.message || "Không thể cập nhật trạng thái combo.", "error");
    }
  };

  const handleDelete = async (combo) => {
    if (!window.confirm("Xóa combo này?")) return;
    try {
      await deleteCombo({ variables: { id: combo.id } });
      showNotification("Đã xóa combo.", "success");
      await refetch();
    } catch (error) {
      showNotification(error.message || "Không thể xóa combo.", "error");
    }
  };

  return (
    <main className="combo-management" aria-labelledby="combo-management-title">
      <header className="combo-management__header">
        <div>
          <span>Bundle bán cố định</span>
          <h1 id="combo-management-title">Quản lý combo</h1>
          <p>Quản lý combo, bundle và set món cố định theo từng nhà hàng.</p>
        </div>
        <button type="button" className="combo-management__primary" onClick={openCreate} title={!selectedRestaurantId ? "Chọn nhà hàng trước khi tạo combo" : "Tạo combo mới"}>
          Tạo combo
        </button>
      </header>

      <section className="combo-management__filters" aria-label="Bộ lọc combo quản lý">
        <select aria-label="Chọn nhà hàng" value={selectedRestaurantId || ""} onChange={(e) => setSelectedRestaurantId(e.target.value)}>
          {!restaurantOptions.length ? <option value="">Chưa có nhà hàng</option> : null}
          {restaurantOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input aria-label="Tìm combo" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên combo" />
        <select aria-label="Lọc trạng thái" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">Đang bán</option>
          <option value="inactive">Tạm tắt</option>
          <option value="all">Tất cả</option>
        </select>
      </section>

      {!hasRestaurants ? (
        <section className="combo-management__empty"><h2>Chưa có nhà hàng</h2><p>Thêm hoặc chọn nhà hàng để quản lý combo.</p></section>
      ) : loading ? (
        <section className="combo-management__grid" aria-label="Đang tải combo">
          {Array.from({ length: 3 }).map((_, index) => <div className="manager-combo-card manager-combo-card--skeleton" key={index} />)}
        </section>
      ) : combos.length ? (
        <section className="combo-management__grid" aria-label="Danh sách combo">
          {combos.map((combo) => (
            <article className="manager-combo-card" key={combo.id}>
              <img src={combo.imageUrl || combo.items?.[0]?.imageUrl || "/default-dishes.jpg"} alt={combo.name} />
              <div className="manager-combo-card__body">
                <div className="manager-combo-card__topline">
                  <span className={combo.isActive ? "is-active" : "is-muted"}>{combo.isActive ? "Đang bán" : "Tạm tắt"}</span>
                  <span>{combo.items.length} món</span>
                </div>
                <h3>{combo.name}</h3>
                <p>{combo.description || "Combo cố định cho khách đặt nhanh."}</p>
                <dl>
                  <div><dt>Giá combo</dt><dd>{money(combo.price)}</dd></div>
                  <div><dt>Giá món lẻ</dt><dd>{money(combo.originalPrice)}</dd></div>
                  <div><dt>Cập nhật</dt><dd>{formatDate(combo.updatedAt || combo.createdAt)}</dd></div>
                </dl>
                <div className="manager-combo-card__actions">
                  <button type="button" onClick={() => openEdit(combo)}>Sửa</button>
                  <button type="button" onClick={() => handleToggle(combo)}>{combo.isActive ? "Tắt" : "Bật"}</button>
                  <button type="button" onClick={() => handleDelete(combo)}>Xóa</button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="combo-management__empty">
          <h2>Chưa có combo phù hợp</h2>
          <p>Tạo combo đầu tiên hoặc đổi bộ lọc để xem các combo đang vận hành.</p>
          <button type="button" onClick={openCreate}>Tạo combo đầu tiên</button>
        </section>
      )}

      {modalOpen && (
        <div className="combo-management__modal" role="presentation">
          <form className="combo-management__dialog" role="dialog" aria-modal="true" aria-label={editing ? "Sửa combo" : "Tạo combo"} onSubmit={submit}>
            <button type="button" aria-label="Đóng modal" className="combo-management__close" onClick={closeModal}>×</button>
            <div className="combo-management__dialog-heading">
              <span>{editing ? "Cập nhật set món" : "Combo mới"}</span>
              <h2>{editing ? "Sửa combo" : "Tạo combo"}</h2>
              <p>{menuLoading ? "Đang tải món..." : `${menuItems.length} món có thể thêm vào combo.`}</p>
            </div>
            <label>Tên combo<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: Combo trưa no đủ" /></label>
            <label>Mô tả<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả ngắn để nhân viên và khách dễ hiểu" /></label>
            <div className="combo-management__form-grid">
              <label>Ảnh combo<input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." /></label>
              <label>Giá combo<input type="number" min="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
            </div>
            <div className="combo-management__items">
              <div>
                <strong>Món trong combo</strong>
                <button type="button" onClick={addItem}>Thêm món</button>
              </div>
              {form.items.map((item, index) => (
                <div className="combo-management__item-row" key={`${item.menuItemId}-${index}`}>
                  <select aria-label={`Chọn món ${index + 1}`} value={item.menuItemId} onChange={(e) => updateItem(index, { menuItemId: e.target.value })}>
                    {menuItems.map((menuItem) => <option key={menuItem.id} value={menuItem.id}>{menuItem.name} · {money(menuItem.basePrice)}</option>)}
                  </select>
                  <input aria-label={`Số lượng món ${index + 1}`} type="number" min="1" value={item.qty} onChange={(e) => updateItem(index, { qty: e.target.value })} />
                  <button type="button" onClick={() => removeItem(index)}>Xóa</button>
                </div>
              ))}
              {!form.items.length ? <p className="combo-management__hint">Thêm ít nhất 1 món để lưu combo.</p> : null}
            </div>
            <div className="combo-management__preview"><span>Giá món lẻ: {money(originalPrice)}</span><span>Tiết kiệm: {money(saving)}</span></div>
            <label className="combo-management__check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Đang bán</label>
            <button type="submit" className="combo-management__submit" disabled={mutationLoading}>{mutationLoading ? "Đang lưu..." : "Lưu combo"}</button>
          </form>
        </div>
      )}
    </main>
  );
}
