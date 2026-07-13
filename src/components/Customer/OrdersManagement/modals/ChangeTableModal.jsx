// src/components/orders/modals/ChangeTableModal.jsx
import React, { useMemo, useState, useEffect } from "react";
import Modal from "@/components/common/Modal";
import "./ChangeTableModal.scss";

const formatDeposit = (value) => {
  const amount = Number(value || 0);
  return amount > 0 ? `${amount.toLocaleString("vi-VN")}đ` : "Miễn phí";
};

export default function ChangeTableModal({
  isOpen,
  onClose,
  currentReservation,
  restaurants = [],
  tablesByRestaurant = {},
  onSubmit,
}) {
  const currentRid = currentReservation?.restaurantId || restaurants?.[0]?.id || "";
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState(currentReservation?.partySize || 2);
  const [sort, setSort] = useState("best_fit");
  const [selectedTable, setSelectedTable] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setPeople(currentReservation?.partySize || 2);
    setSelectedTable(null);
    setSearch("");
    setSort("best_fit");
  }, [isOpen, currentReservation]);

  const tables = useMemo(() => {
    const list = [...(tablesByRestaurant?.[currentRid] || [])];
    const query = search.trim().toLowerCase();
    const filtered = list.filter((table) =>
      (!people || Number(table.capacity || 0) >= people) &&
      (!query ||
        String(table.name || "").toLowerCase().includes(query) ||
        String(table.floor || "").toLowerCase().includes(query) ||
        String(table.capacity || "").includes(query)));

    if (sort === "deposit_asc") {
      filtered.sort((a, b) => Number(a.deposit || 0) - Number(b.deposit || 0));
    } else if (sort === "capacity_desc") {
      filtered.sort((a, b) => Number(b.capacity || 0) - Number(a.capacity || 0));
    } else {
      filtered.sort((a, b) => {
        const aGap = Math.max(0, Number(a.capacity || 0) - Number(people || 0));
        const bGap = Math.max(0, Number(b.capacity || 0) - Number(people || 0));
        return aGap - bGap || Number(a.deposit || 0) - Number(b.deposit || 0);
      });
    }
    return filtered;
  }, [tablesByRestaurant, currentRid, people, search, sort]);

  useEffect(() => {
    if (!isOpen || !tables.length) return;
    if (selectedTable && tables.some((table) => table.id === selectedTable.id)) return;
    setSelectedTable(tables[0]);
  }, [isOpen, selectedTable, tables]);

  const confirm = () => {
    if (!selectedTable) return;
    onSubmit?.({ restaurantId: currentRid, tableId: selectedTable.id });
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Đổi bàn đã đặt" size="lg">
      <div className="changetable changetable--compact">
        <header className="changetable__summary">
          <div>
            <span>Nhà hàng</span>
            <strong>{currentReservation?.restaurantName || restaurants?.[0]?.name || "Nhà hàng hiện tại"}</strong>
          </div>
          <div>
            <span>Số khách</span>
            <strong>{people} người</strong>
          </div>
          <div>
            <span>Cọc hiện tại</span>
            <strong>{formatDeposit(currentReservation?.depositAmount)}</strong>
          </div>
        </header>

        <div className="changetable__toolbar">
          <label>
            <span>Số khách</span>
            <input
              type="number"
              min={1}
              value={people}
              onChange={(e) => setPeople(Math.max(1, Number(e.target.value)))}
            />
          </label>
          <label className="changetable__search">
            <span>Tìm bàn hoặc khu vực</span>
            <input
              type="search"
              placeholder="Ví dụ: T201, tầng 2..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            <span>Sắp xếp</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="best_fit">Phù hợp nhất</option>
              <option value="deposit_asc">Cọc thấp trước</option>
              <option value="capacity_desc">Sức chứa lớn trước</option>
            </select>
          </label>
        </div>

        <section className="changetable__list" aria-live="polite">
          {tables.length === 0 ? (
            <div className="empty">Không có bàn trống phù hợp với số khách và từ khóa hiện tại.</div>
          ) : (
            <div className="grid">
              {tables.map((table) => {
                const active = selectedTable?.id === table.id;
                const freeDeposit = Number(table.deposit || 0) <= 0;
                return (
                  <button
                    key={table.id}
                    type="button"
                    className={`table-card ${active ? "active" : ""}`}
                    onClick={() => setSelectedTable(table)}
                    aria-pressed={active}
                  >
                    <div className="table-card__top">
                      <div className="name">{table.name}</div>
                      <div className="cap">{table.capacity} chỗ</div>
                    </div>
                    <div className="meta">
                      <span>Tiền cọc</span>
                      <strong data-free={freeDeposit ? "true" : "false"}>
                        {formatDeposit(table.deposit)}
                      </strong>
                    </div>
                    {table.floor && <div className="sub">{table.floor}</div>}
                    {table.note && <div className="sub">{table.note}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="changetable__review" role="status">
          {selectedTable
            ? <>Bàn đề nghị: <strong>{selectedTable.name}</strong> • {selectedTable.capacity} chỗ • {formatDeposit(selectedTable.deposit)}</>
            : "Chọn một bàn trống để gửi yêu cầu."}
        </div>
      </div>

      <Modal.Footer>
        <button className="btn btn--secondary" onClick={onClose}>
          Hủy
        </button>
        <button
          className="btn btn--primary"
          onClick={confirm}
          disabled={!selectedTable}
        >
          Gửi yêu cầu đổi bàn
        </button>
      </Modal.Footer>
    </Modal>
  );
}
