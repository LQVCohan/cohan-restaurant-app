import React, { useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import { useNotification } from "@/hooks/useNotification";
import "./ComboManagement.scss";

const MANAGER_COMBOS = gql`
  query ManagerCombos($restaurantId: ID!, $search: String, $status: String) {
    managerCombos(restaurantId: $restaurantId, search: $search, status: $status) {
      id name description imageUrl price originalPrice isActive restaurantId restaurantName
      items { menuItemId name qty price imageUrl }
    }
  }
`;
const MENU_ITEMS = gql`query ComboMenuItems($restaurantId: ID!) { menuItems(restaurantId: $restaurantId, limit: 500) { id name basePrice thumbImage status restaurantId } }`;
const CREATE_COMBO = gql`mutation CreateCombo($input: ComboInput!) { createCombo(input: $input) { id } }`;
const UPDATE_COMBO = gql`mutation UpdateCombo($id: ID!, $input: ComboInput!) { updateCombo(id: $id, input: $input) { id } }`;
const DELETE_COMBO = gql`mutation DeleteCombo($id: ID!) { deleteCombo(id: $id) }`;
const TOGGLE_COMBO = gql`mutation ToggleCombo($id: ID!, $isActive: Boolean!) { toggleComboStatus(id: $id, isActive: $isActive) { id isActive } }`;

const emptyForm = { name: "", description: "", imageUrl: "", price: "", isActive: true, items: [] };
const money = (value) => Number(value || 0).toLocaleString("vi-VN");

export default function ComboManagement() {
  const { selectedRestaurantId, restaurantOptions, setSelectedRestaurantId, hasRestaurants } = useManagerRestaurantSelection();
  const { showNotification } = useNotification();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const { data, loading, refetch } = useQuery(MANAGER_COMBOS, { variables: { restaurantId: selectedRestaurantId, search, status }, skip: !selectedRestaurantId, fetchPolicy: "cache-and-network" });
  const { data: menuData } = useQuery(MENU_ITEMS, { variables: { restaurantId: selectedRestaurantId }, skip: !selectedRestaurantId });
  const [createCombo] = useMutation(CREATE_COMBO);
  const [updateCombo] = useMutation(UPDATE_COMBO);
  const [deleteCombo] = useMutation(DELETE_COMBO);
  const [toggleCombo] = useMutation(TOGGLE_COMBO);
  const combos = data?.managerCombos || [];
  const menuItems = menuData?.menuItems || [];
  const menuById = useMemo(() => new Map(menuItems.map((item) => [String(item.id), item])), [menuItems]);
  const originalPrice = form.items.reduce((sum, row) => sum + Number(menuById.get(String(row.menuItemId))?.basePrice || 0) * Number(row.qty || 1), 0);
  const saving = Math.max(0, originalPrice - Number(form.price || 0));

  const openCreate = () => { setEditing(null); setForm(emptyForm); };
  const openEdit = (combo) => { setEditing(combo); setForm({ name: combo.name || "", description: combo.description || "", imageUrl: combo.imageUrl || "", price: combo.price || "", isActive: combo.isActive !== false, items: (combo.items || []).map((item) => ({ menuItemId: item.menuItemId, qty: item.qty || 1 })) }); };
  const closeModal = () => { setEditing(null); setForm(emptyForm); };
  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { menuItemId: menuItems[0]?.id || "", qty: 1 }] }));
  const updateItem = (index, patch) => setForm((prev) => ({ ...prev, items: prev.items.map((item, i) => i === index ? { ...item, ...patch } : item) }));
  const removeItem = (index) => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || Number(form.price) <= 0 || form.items.length < 1 || form.items.some((item) => !item.menuItemId)) {
      showNotification("Vui lòng nhập tên, giá và ít nhất 1 món hợp lệ.", "warning");
      return;
    }
    const input = { restaurantId: selectedRestaurantId, name: form.name.trim(), description: form.description.trim(), imageUrl: form.imageUrl.trim(), price: Number(form.price), isActive: form.isActive, items: form.items.map((item) => ({ menuItemId: item.menuItemId, qty: Number(item.qty || 1) })) };
    try {
      if (editing?.id) await updateCombo({ variables: { id: editing.id, input } });
      else await createCombo({ variables: { input } });
      showNotification("Đã lưu combo.", "success");
      closeModal();
      refetch();
    } catch (error) { showNotification(error.message || "Không thể lưu combo.", "error"); }
  };

  return (
    <main className="combo-management" aria-labelledby="combo-management-title">
      <header className="combo-management__header">
        <div><span>Bundle bán cố định</span><h1 id="combo-management-title">Quản lý combo</h1><p>Tạo combo cố định riêng với Promotion COMBO.</p></div>
        <button type="button" onClick={openCreate}>Tạo combo</button>
      </header>
      <section className="combo-management__filters" aria-label="Bộ lọc combo quản lý">
        <select aria-label="Chọn nhà hàng" value={selectedRestaurantId} onChange={(e) => setSelectedRestaurantId(e.target.value)}>{restaurantOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <input aria-label="Tìm combo" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm combo" />
        <select aria-label="Lọc trạng thái" value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Đang bán</option><option value="inactive">Tạm tắt</option><option value="all">Tất cả</option></select>
      </section>
      {!hasRestaurants ? <p className="combo-management__empty">Chưa có nhà hàng để quản lý combo.</p> : loading ? <p className="combo-management__empty">Đang tải combo...</p> : <section className="combo-management__grid">{combos.map((combo) => <article className="manager-combo-card" key={combo.id}><img src={combo.imageUrl || combo.items?.[0]?.imageUrl || "/default-dishes.jpg"} alt={combo.name} /><div><span className={combo.isActive ? "is-active" : "is-muted"}>{combo.isActive ? "Đang bán" : "Tạm tắt"}</span><h3>{combo.name}</h3><p>{combo.items.length} món · {money(combo.price)}đ</p><p>Giá gốc {money(combo.originalPrice)}đ · Tiết kiệm {money(Math.max(0, Number(combo.originalPrice || 0) - Number(combo.price || 0)))}đ</p><div><button type="button" onClick={() => openEdit(combo)}>Sửa</button><button type="button" onClick={() => toggleCombo({ variables: { id: combo.id, isActive: !combo.isActive } }).then(() => refetch())}>{combo.isActive ? "Tắt" : "Bật"}</button><button type="button" onClick={() => window.confirm("Xóa combo này?") && deleteCombo({ variables: { id: combo.id } }).then(() => refetch())}>Xóa</button></div></div></article>)}</section>}
      {(editing || form !== emptyForm) && <div className="combo-management__modal" role="presentation"><form className="combo-management__dialog" role="dialog" aria-modal="true" aria-label={editing ? "Sửa combo" : "Tạo combo"} onSubmit={submit}><button type="button" aria-label="Đóng modal" className="combo-management__close" onClick={closeModal}>×</button><h2>{editing ? "Sửa combo" : "Tạo combo"}</h2><label>Tên combo<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label>Mô tả<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label>Ảnh combo<input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} /></label><label>Giá combo<input type="number" min="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label><div className="combo-management__items"><div><strong>Món trong combo</strong><button type="button" onClick={addItem}>Thêm món</button></div>{form.items.map((item, index) => <div className="combo-management__item-row" key={index}><select aria-label="Chọn món" value={item.menuItemId} onChange={(e) => updateItem(index, { menuItemId: e.target.value })}>{menuItems.map((menuItem) => <option key={menuItem.id} value={menuItem.id}>{menuItem.name} · {money(menuItem.basePrice)}đ</option>)}</select><input aria-label="Số lượng" type="number" min="1" value={item.qty} onChange={(e) => updateItem(index, { qty: e.target.value })} /><button type="button" onClick={() => removeItem(index)}>Xóa</button></div>)}</div><div className="combo-management__preview"><span>Giá món lẻ: {money(originalPrice)}đ</span><span>Tiết kiệm: {money(saving)}đ</span></div><label className="combo-management__check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Đang bán</label><button type="submit">Lưu combo</button></form></div>}
    </main>
  );
}
