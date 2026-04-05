import React, { useMemo, useState } from "react";
import Modal from "../../../../common/Modal";
import Button from "../../../../common/Button";

const IngredientCategoryManagerModal = ({
  isOpen,
  onClose,
  categories = [],
  onCreate,
  onRename,
  onDelete,
  onSync,
}) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const sorted = useMemo(
    () => [...(categories || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [categories],
  );

  if (!isOpen) return null;

  const create = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate?.(name.trim());
      setName("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      title="Quản lý danh mục nguyên liệu"
      size="md"
      closeOnOverlayClick={false}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên danh mục mới"
            style={{ flex: 1, minHeight: 40, padding: "0 12px" }}
          />
          <Button type="button" onClick={create} disabled={loading}>
            Thêm
          </Button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>Danh mục hiện có</b>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              setLoading(true);
              try {
                await onSync?.();
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            Đồng bộ từ nguyên liệu
          </Button>
        </div>

        <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
          {sorted.map((cat) => (
            <div
              key={cat.id}
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid #eef2f7",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{cat.name}</div>
                <small style={{ color: "#64748b" }}>
                  {cat.source || "manual"} • usage: {cat.usageCount || 0}
                </small>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={async () => {
                    const next = window.prompt("Đổi tên danh mục", cat.name || "");
                    if (!next?.trim() || next.trim() === cat.name) return;
                    setLoading(true);
                    try {
                      await onRename?.(cat.id, next.trim());
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Đổi tên
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Xóa danh mục "${cat.name}"?`)) return;
                    setLoading(true);
                    try {
                      await onDelete?.(cat.id);
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {!sorted.length && (
            <div style={{ padding: 16, color: "#64748b" }}>Chưa có danh mục nào.</div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default IngredientCategoryManagerModal;
