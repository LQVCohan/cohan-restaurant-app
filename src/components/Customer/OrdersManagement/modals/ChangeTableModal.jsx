// src/components/orders/modals/ChangeTableModal.jsx
import React, { useMemo, useState, useEffect } from "react";
import Modal from "@/components/common/Modal";
import "./ChangeTableModal.scss";

/**
 * Props
 * - isOpen, onClose
 * - currentReservation: { restaurantId, restaurantName, partySize, depositAmount }
 * - restaurants: [{id, name}]
 * - tablesByRestaurant: Map<string, Table[]> | { [rid]: Table[] }
 *   Table: { id, name, capacity, deposit, floor?:string, note?:string }
 * - onSubmit: ({restaurantId, tableId}) => void
 */
export default function ChangeTableModal({
  isOpen,
  onClose,
  currentReservation,
  restaurants = [],
  tablesByRestaurant = {},
  onSubmit,
}) {
  const currentRid = currentReservation?.restaurantId;
  const [restaurantId, setRestaurantId] = useState(currentRid || "");
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState(currentReservation?.partySize || 2);
  const [sort, setSort] = useState("deposit_asc"); // deposit_asc | deposit_desc | capacity_desc
  const [selectedTable, setSelectedTable] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setRestaurantId(currentRid || restaurants?.[0]?.id || "");
      setPeople(currentReservation?.partySize || 2);
      setSelectedTable(null);
      setSearch("");
      setSort("deposit_asc");
    }
  }, [isOpen, currentRid, currentReservation, restaurants]);

  const tables = useMemo(() => {
    const list = tablesByRestaurant?.[restaurantId] || [];
    let filtered = list.filter(
      (t) =>
        (!people || t.capacity >= people) &&
        (!search ||
          t.name?.toLowerCase().includes(search.toLowerCase()) ||
          String(t.capacity).includes(search))
    );
    if (sort === "deposit_asc")
      filtered.sort((a, b) => (a.deposit ?? 0) - (b.deposit ?? 0));
    if (sort === "deposit_desc")
      filtered.sort((a, b) => (b.deposit ?? 0) - (a.deposit ?? 0));
    if (sort === "capacity_desc")
      filtered.sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0));
    return filtered;
  }, [tablesByRestaurant, restaurantId, people, search, sort]);

  useEffect(() => {
    if (!isOpen || !tables.length) return;
    if (selectedTable && tables.some((table) => table.id === selectedTable.id)) return;
    setSelectedTable(tables[0]);
  }, [isOpen, selectedTable, tables]);

  const switchingRestaurant = restaurantId && restaurantId !== currentRid;
  const currentDeposit = Number(currentReservation?.depositAmount || 0);
  const penalty = switchingRestaurant ? Math.floor(currentDeposit * 0.5) : 0;

  const confirm = () => {
    if (!selectedTable) return;
    onSubmit?.({ restaurantId, tableId: selectedTable.id });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🪑 Đổi bàn" size="lg">
      <div className="changetable">
        <aside className="changetable__filters">
          <div className="form-row">
            <label>Nhà hàng</label>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Số người</label>
            <input
              type="number"
              min={1}
              value={people}
              onChange={(e) => setPeople(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <div className="form-row">
            <label>Tìm kiếm</label>
            <input
              type="text"
              placeholder="Số bàn, tên khu vực…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>Sắp xếp</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="deposit_asc">Cọc tăng dần</option>
              <option value="deposit_desc">Cọc giảm dần</option>
              <option value="capacity_desc">Sức chứa lớn trước</option>
            </select>
          </div>

          {selectedTable && (
            <div className="alert alert--info">
              ⚡ Đã tự chọn <b>{selectedTable.name}</b> phù hợp với {people} khách.
              Bạn có thể đổi bàn khác trước khi xác nhận.
            </div>
          )}

          {switchingRestaurant ? (
            <div className="alert alert--warning">
              🔁 Bạn đang chuyển sang <b>nhà hàng khác</b>.<br />
              Xác nhận đổi sẽ <b>khấu trừ 50%</b> tiền cọc hiện tại:{" "}
              <b>{currentDeposit.toLocaleString("vi-VN")}đ</b> → mất{" "}
              <b>{penalty.toLocaleString("vi-VN")}đ</b>.
            </div>
          ) : (
            <div className="alert alert--info">
              ✅ Chỉ đổi bàn trong cùng nhà hàng. Vui lòng đợi nhà hàng xác nhận
              sau khi gửi yêu cầu.
            </div>
          )}
        </aside>

        <section className="changetable__list">
          {tables.length === 0 ? (
            <div className="empty">Không tìm thấy bàn phù hợp.</div>
          ) : (
            <div className="grid">
              {tables.map((t) => {
                const active = selectedTable?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`table-card ${active ? "active" : ""}`}
                    onClick={() => setSelectedTable(t)}
                  >
                    <div className="table-card__top">
                      <div className="name">{t.name}</div>
                      <div className="cap">👥 {t.capacity}</div>
                    </div>
                    <div className="meta">
                      <span>Tiền cọc</span>
                      <strong>
                        {(t.deposit ?? 0).toLocaleString("vi-VN")}đ
                      </strong>
                    </div>
                    {t.floor && <div className="sub">Tầng/Khu: {t.floor}</div>}
                    {t.note && <div className="sub">{t.note}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <Modal.Footer>
        <button className="btn btn--secondary" onClick={onClose}>
          Huỷ
        </button>
        <button
          className="btn btn--primary"
          onClick={confirm}
          disabled={!selectedTable}
          title={!selectedTable ? "Chọn một bàn để tiếp tục" : undefined}
        >
          Xác nhận đổi bàn
        </button>
      </Modal.Footer>
    </Modal>
  );
}
