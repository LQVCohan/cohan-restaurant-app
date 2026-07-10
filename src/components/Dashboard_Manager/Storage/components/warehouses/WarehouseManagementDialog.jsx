import React, { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@apollo/client";
import {
  CheckCircle2,
  Hash,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { hasAnyPermission } from "@/utils/frontendPermissionAccess";
import { getInventoryActionErrorMessage } from "@/utils/inventorySupplySupplierPrintErrorMessages";
import {
  CREATE_WAREHOUSE,
  WAREHOUSES_QUERY,
} from "../../graphql/inventory.gql";
import {
  DELETE_WAREHOUSE,
  UPDATE_WAREHOUSE,
} from "../../graphql/warehouse.gql";
import "./WarehouseManagementDialog.scss";

const EMPTY_FORM = Object.freeze({ name: "", code: "", address: "" });

const formatCreatedAt = (value) => {
  if (!value) return "Chưa xác định";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa xác định";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
};

export default function WarehouseManagementDialog({
  open,
  onClose,
  restaurantId,
  warehouses = [],
  selectedWarehouseId = null,
  onSelectWarehouse,
}) {
  const { user } = useContext(AuthContext);
  const canWriteInventory = hasAnyPermission(user, [
    "inventory.write",
    "stock.write",
  ]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [feedback, setFeedback] = useState(null);

  const [createWarehouse, { loading: creating }] = useMutation(CREATE_WAREHOUSE);
  const [updateWarehouse, { loading: updating }] = useMutation(UPDATE_WAREHOUSE);
  const [deleteWarehouse, { loading: deleting }] = useMutation(DELETE_WAREHOUSE);
  const busy = creating || updating || deleting;

  useEffect(() => {
    if (open) return;
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFeedback(null);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event) => {
      if (event.key === "Escape" && !busy) onClose?.();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [busy, onClose, open]);

  if (!open) return null;

  const refetchQueries = [
    { query: WAREHOUSES_QUERY, variables: { restaurantId } },
  ];

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startCreate = () => {
    setFeedback(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const startEdit = (warehouse) => {
    setFeedback(null);
    setEditingId(warehouse.id);
    setForm({
      name: warehouse.name || "",
      code: warehouse.code || "",
      address: warehouse.address || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFeedback({ tone: "error", message: "Vui lòng nhập tên kho." });
      return;
    }

    setFeedback(null);
    const fields = {
      name,
      code: form.code.trim().toUpperCase() || null,
      address: form.address.trim() || null,
    };

    try {
      if (editingId) {
        await updateWarehouse({
          variables: { input: { id: editingId, ...fields } },
          refetchQueries,
          awaitRefetchQueries: true,
        });
        setFeedback({ tone: "success", message: "Đã cập nhật thông tin kho." });
      } else {
        const { data } = await createWarehouse({
          variables: {
            input: {
              restaurantId,
              ...fields,
              isActive: true,
            },
          },
          refetchQueries,
          awaitRefetchQueries: true,
        });
        const created = data?.createWarehouse;
        if (created?.id) onSelectWarehouse?.(created.id);
        setFeedback({ tone: "success", message: "Đã tạo kho mới." });
      }
      resetForm();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: getInventoryActionErrorMessage(
          error,
          editingId ? "Không thể cập nhật kho." : "Không thể tạo kho.",
        ),
      });
    }
  };

  const handleDelete = async (warehouse) => {
    if (warehouses.length <= 1) {
      setFeedback({
        tone: "error",
        message: "Nhà hàng phải còn ít nhất một kho đang hoạt động.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Xóa kho “${warehouse.name}”? Kho chỉ có thể xóa khi không còn tồn kho.`,
    );
    if (!confirmed) return;

    setFeedback(null);
    try {
      const { data } = await deleteWarehouse({
        variables: { id: warehouse.id },
        refetchQueries,
        awaitRefetchQueries: true,
      });
      if (!data?.deleteWarehouse) throw new Error("Không tìm thấy kho cần xóa.");

      if (String(selectedWarehouseId) === String(warehouse.id)) {
        const replacement = warehouses.find(
          (item) => String(item.id) !== String(warehouse.id),
        );
        onSelectWarehouse?.(replacement?.id || null);
      }
      setFeedback({ tone: "success", message: "Đã xóa kho." });
      if (editingId === warehouse.id) resetForm();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: getInventoryActionErrorMessage(
          error,
          "Không thể xóa kho. Hãy chuyển hoặc xử lý hết tồn kho trước.",
        ),
      });
    }
  };

  return createPortal(
    <div
      className="warehouse-manager-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <section
        className="warehouse-manager-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="warehouse-manager-title"
      >
        <header className="warehouse-manager-dialog__header">
          <div>
            <p className="warehouse-manager-dialog__eyebrow">Phạm vi nhà hàng</p>
            <h2 id="warehouse-manager-title">Quản lý danh sách kho</h2>
            <p>
              Tạo và duy trì các kho dùng cho nhập hàng, kiểm kê và chuyển hàng nội bộ.
            </p>
          </div>
          <button
            type="button"
            className="warehouse-manager-icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng quản lý kho"
          >
            <X size={20} />
          </button>
        </header>

        <div className="warehouse-manager-summary">
          <span className="warehouse-manager-summary__icon" aria-hidden="true">
            <Warehouse size={20} />
          </span>
          <div>
            <strong>{warehouses.length}</strong>
            <span>kho đang hoạt động</span>
          </div>
          {canWriteInventory ? (
            <button
              type="button"
              className="sm-btn primary warehouse-manager-summary__action"
              onClick={startCreate}
              disabled={busy || !restaurantId}
            >
              <Plus size={17} /> Thêm kho
            </button>
          ) : null}
        </div>

        {feedback ? (
          <div
            className={`warehouse-manager-feedback warehouse-manager-feedback--${feedback.tone}`}
            role={feedback.tone === "error" ? "alert" : "status"}
          >
            {feedback.tone === "success" ? <CheckCircle2 size={17} /> : null}
            <span>{feedback.message}</span>
          </div>
        ) : null}

        {!canWriteInventory ? (
          <p className="warehouse-manager-readonly">
            Bạn đang xem danh sách kho. Cần quyền quản lý kho để tạo, sửa hoặc xóa.
          </p>
        ) : null}

        {formOpen && canWriteInventory ? (
          <form className="warehouse-manager-form" onSubmit={handleSubmit}>
            <div className="warehouse-manager-form__heading">
              <div>
                <strong>{editingId ? "Sửa thông tin kho" : "Tạo kho mới"}</strong>
                <span>Các trường mã kho và địa chỉ có thể để trống.</span>
              </div>
              <button type="button" className="sm-btn ghost" onClick={resetForm} disabled={busy}>
                Hủy
              </button>
            </div>

            <label>
              <span>Tên kho *</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                maxLength={120}
                autoFocus
                disabled={busy}
                placeholder="Ví dụ: Kho nguyên liệu khô"
              />
            </label>

            <label>
              <span>Mã kho</span>
              <div className="warehouse-manager-input-icon">
                <Hash size={16} aria-hidden="true" />
                <input
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  maxLength={30}
                  disabled={busy}
                  placeholder="KHO-KHO"
                />
              </div>
            </label>

            <label className="warehouse-manager-form__wide">
              <span>Vị trí / địa chỉ</span>
              <div className="warehouse-manager-input-icon">
                <MapPin size={16} aria-hidden="true" />
                <input
                  value={form.address}
                  onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  maxLength={240}
                  disabled={busy}
                  placeholder="Ví dụ: Tầng trệt, khu phía sau"
                />
              </div>
            </label>

            <div className="warehouse-manager-form__actions">
              <button type="submit" className="sm-btn primary" disabled={busy || !restaurantId}>
                {busy ? <Loader2 size={17} className="spin" /> : null}
                {editingId ? "Lưu thay đổi" : "Tạo kho"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="warehouse-manager-list" aria-label="Danh sách kho đang hoạt động">
          {warehouses.length ? (
            warehouses.map((warehouse, index) => {
              const selected = String(selectedWarehouseId) === String(warehouse.id);
              return (
                <article
                  key={warehouse.id}
                  className={`warehouse-manager-row ${selected ? "is-selected" : ""}`}
                >
                  <button
                    type="button"
                    className="warehouse-manager-row__select"
                    onClick={() => onSelectWarehouse?.(warehouse.id)}
                    aria-pressed={selected}
                  >
                    <span className="warehouse-manager-row__index">{index + 1}</span>
                    <span className="warehouse-manager-row__copy">
                      <strong>{warehouse.name}</strong>
                      <span>
                        {warehouse.code || "Chưa có mã"} · {warehouse.address || "Chưa cập nhật vị trí"}
                      </span>
                      <small>Tạo ngày {formatCreatedAt(warehouse.createdAt)}</small>
                    </span>
                    {selected ? <span className="warehouse-manager-row__badge">Đang chọn</span> : null}
                  </button>

                  {canWriteInventory ? (
                    <div className="warehouse-manager-row__actions">
                      <button
                        type="button"
                        className="warehouse-manager-icon-button"
                        onClick={() => startEdit(warehouse)}
                        disabled={busy}
                        aria-label={`Sửa kho ${warehouse.name}`}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        type="button"
                        className="warehouse-manager-icon-button warehouse-manager-icon-button--danger"
                        onClick={() => handleDelete(warehouse)}
                        disabled={busy || warehouses.length <= 1}
                        aria-label={`Xóa kho ${warehouse.name}`}
                        title={
                          warehouses.length <= 1
                            ? "Nhà hàng phải còn ít nhất một kho"
                            : "Chỉ xóa được kho không còn tồn"
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="warehouse-manager-empty">
              <Warehouse size={28} />
              <strong>Nhà hàng chưa có kho</strong>
              <span>Hãy tạo kho đầu tiên để bắt đầu quản lý tồn.</span>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
