import React, { useEffect, useMemo, useRef, useState } from "react";
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
  X,
} from "lucide-react";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import { useNotification } from "@/hooks/useNotification";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import ManagerCommandBar from "../shared/ManagerCommandBar";
import "./ComboManagement.scss";

const MANAGER_COMBOS = gql`
  query ManagerCombos($restaurantId: ID!, $search: String, $status: String) {
    managerCombos(
      restaurantId: $restaurantId
      search: $search
      status: $status
    ) {
      id
      name
      description
      imageUrl
      price
      originalPrice
      isActive
      restaurantId
      restaurantName
      createdAt
      updatedAt
      items {
        menuItemId
        name
        qty
        price
        imageUrl
      }
    }
  }
`;

const MENU_ITEMS = gql`
  query ComboMenuItems($restaurantId: ID!) {
    menuItems(restaurantId: $restaurantId, limit: 500) {
      id
      name
      basePrice
      thumbImage
      status
      restaurantId
    }
  }
`;

const CREATE_COMBO = gql`
  mutation CreateCombo($input: ComboInput!) {
    createCombo(input: $input) {
      id
    }
  }
`;

const UPDATE_COMBO = gql`
  mutation UpdateCombo($id: ID!, $input: ComboInput!) {
    updateCombo(id: $id, input: $input) {
      id
    }
  }
`;

const DELETE_COMBO = gql`
  mutation DeleteCombo($id: ID!) {
    deleteCombo(id: $id)
  }
`;

const TOGGLE_COMBO = gql`
  mutation ToggleCombo($id: ID!, $isActive: Boolean!) {
    toggleComboStatus(id: $id, isActive: $isActive) {
      id
      isActive
    }
  }
`;

const STATUS_TABS = [
  { id: "active", label: "Đang bán" },
  { id: "inactive", label: "Tạm tắt" },
  { id: "all", label: "Tất cả" },
];

const makeEmptyForm = () => ({
  name: "",
  description: "",
  imageUrl: "",
  price: "",
  isActive: true,
  items: [],
});

const money = (value) =>
  `${Number(value || 0).toLocaleString("vi-VN")}đ`;

const formatDate = (value) => {
  if (!value) return "Chưa cập nhật";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const replaceBrokenImage = (event) => {
  if (event.currentTarget.dataset.fallbackApplied) return;
  event.currentTarget.dataset.fallbackApplied = "true";
  event.currentTarget.src = "/default-dishes.jpg";
};

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
  const dialogRef = useRef(null);
  const nameInputRef = useRef(null);

  const { data, loading, error, refetch } = useQuery(MANAGER_COMBOS, {
    variables: { restaurantId: selectedRestaurantId, search, status },
    skip: !selectedRestaurantId,
    fetchPolicy: "cache-and-network",
  });
  const {
    data: menuData,
    loading: menuLoading,
    error: menuError,
  } = useQuery(MENU_ITEMS, {
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
  const selectedRestaurantName =
    restaurantOptions.find(
      (restaurant) => String(restaurant.id) === String(selectedRestaurantId),
    )?.name || "nhà hàng hiện tại";

  const menuById = useMemo(
    () => new Map(menuItems.map((item) => [String(item.id), item])),
    [menuItems],
  );

  const originalPrice = form.items.reduce(
    (sum, row) =>
      sum +
      Number(menuById.get(String(row.menuItemId))?.basePrice || 0) *
        Number(row.qty || 1),
    0,
  );
  const saving = Math.max(0, originalPrice - Number(form.price || 0));

  const summary = useMemo(() => {
    const itemQuantity = combos.reduce(
      (total, combo) =>
        total +
        (combo.items || []).reduce(
          (sum, item) => sum + Number(item.qty || 1),
          0,
        ),
      0,
    );
    const totalSaving = combos.reduce(
      (total, combo) =>
        total +
        Math.max(
          0,
          Number(combo.originalPrice || 0) - Number(combo.price || 0),
        ),
      0,
    );

    return {
      visible: combos.length,
      itemQuantity,
      averageSaving: combos.length
        ? Math.round(totalSaving / combos.length)
        : 0,
    };
  }, [combos]);

  useEffect(() => {
    if (!modalOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setModalOpen(false);
        setEditing(null);
        setForm(makeEmptyForm());
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [modalOpen]);

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
      })),
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
      showNotification(
        "Nhà hàng này chưa có món để thêm vào combo.",
        "warning",
      );
      return;
    }
    setForm((previous) => ({
      ...previous,
      items: [
        ...previous.items,
        { menuItemId: menuItems[0].id, qty: 1 },
      ],
    }));
  };

  const updateItem = (index, patch) =>
    setForm((previous) => ({
      ...previous,
      items: previous.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));

  const removeItem = (index) =>
    setForm((previous) => ({
      ...previous,
      items: previous.items.filter((_, itemIndex) => itemIndex !== index),
    }));

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedRestaurantId) {
      showNotification(
        "Hãy chọn nhà hàng hợp lệ trước khi lưu combo.",
        "warning",
      );
      return;
    }
    if (
      !form.name.trim() ||
      Number(form.price) <= 0 ||
      form.items.length < 1 ||
      form.items.some((item) => !item.menuItemId)
    ) {
      showNotification(
        "Vui lòng nhập tên, giá và ít nhất 1 món hợp lệ.",
        "warning",
      );
      return;
    }

    const input = {
      restaurantId: selectedRestaurantId,
      name: form.name.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      price: Number(form.price),
      isActive: form.isActive,
      items: form.items.map((item) => ({
        menuItemId: item.menuItemId,
        qty: Number(item.qty || 1),
      })),
    };

    try {
      if (editing?.id) {
        await updateCombo({ variables: { id: editing.id, input } });
      } else {
        await createCombo({ variables: { input } });
      }
      showNotification("Đã lưu combo.", "success");
      closeModal();
      await refetch();
    } catch (submitError) {
      showNotification(submitError.message || "Không thể lưu combo.", "error");
    }
  };

  const handleToggle = async (combo) => {
    const key = `toggle:${combo.id}`;
    setBusyKey(key);
    try {
      await toggleCombo({
        variables: { id: combo.id, isActive: !combo.isActive },
      });
      showNotification(
        combo.isActive ? "Đã tạm tắt combo." : "Đã bật bán combo.",
        "success",
      );
      await refetch();
    } catch (toggleError) {
      showNotification(
        toggleError.message || "Không thể cập nhật trạng thái combo.",
        "error",
      );
    } finally {
      setBusyKey("");
    }
  };

  const handleDelete = async (combo) => {
    if (!window.confirm(`Xóa combo “${combo.name}”?`)) return;

    const key = `delete:${combo.id}`;
    setBusyKey(key);
    try {
      await deleteCombo({ variables: { id: combo.id } });
      showNotification("Đã xóa combo.", "success");
      await refetch();
    } catch (deleteError) {
      showNotification(
        deleteError.message || "Không thể xóa combo.",
        "error",
      );
    } finally {
      setBusyKey("");
    }
  };

  return (
    <main className="combo-management">
      <ManagementPageHeader
        className="combo-management__page-header"
        density="compact"
        statsPlacement="right"
        showTimeWidget={false}
        eyebrow="Bundle bán cố định"
        title="Quản lý combo"
        icon={<Layers3 size={18} aria-hidden="true" />}
        subtitle="Tạo và vận hành các set món bán cố định theo từng nhà hàng."
        loading={loading}
        stats={[
          {
            id: "visible",
            label: "Đang hiển thị",
            value: summary.visible,
            icon: <Layers3 size={17} aria-hidden="true" />,
          },
          {
            id: "items",
            label: "Tổng suất món",
            value: summary.itemQuantity,
            icon: <Utensils size={17} aria-hidden="true" />,
          },
          {
            id: "saving",
            label: "Tiết kiệm TB",
            value: money(summary.averageSaving),
            icon: <BadgeDollarSign size={17} aria-hidden="true" />,
          },
        ]}
        primaryAction={{
          label: "Tạo combo",
          icon: <Plus size={16} aria-hidden="true" />,
          onClick: openCreate,
          disabled: !selectedRestaurantId,
          title: selectedRestaurantId
            ? "Tạo combo mới"
            : "Chọn nhà hàng trước khi tạo combo",
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
            <select
              aria-label="Chọn nhà hàng"
              value={selectedRestaurantId || ""}
              onChange={(event) =>
                setSelectedRestaurantId(event.target.value)
              }
            >
              {!restaurantOptions.length ? (
                <option value="">Chưa có nhà hàng</option>
              ) : null}
              {restaurantOptions.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </label>
        }
        rightSlot={
          <span className="combo-management__result-count" aria-live="polite">
            {loading ? "Đang tải" : `${combos.length} combo`}
          </span>
        }
      />

      <div className="combo-management__list-heading">
        <div>
          <span>Danh mục vận hành</span>
          <h2>Combo tại {selectedRestaurantName}</h2>
        </div>
        <p>Giá, món thành phần và trạng thái bán được cập nhật ngay tại đây.</p>
      </div>

      {!hasRestaurants ? (
        <section className="combo-management__state">
          <Store size={28} aria-hidden="true" />
          <h2>Chưa có nhà hàng</h2>
          <p>Thêm hoặc chọn nhà hàng để quản lý combo.</p>
        </section>
      ) : error ? (
        <section
          className="combo-management__state combo-management__state--error"
          role="alert"
        >
          <AlertTriangle size={28} aria-hidden="true" />
          <h2>Không thể tải danh sách combo</h2>
          <p>{error.message || "Vui lòng kiểm tra kết nối và thử lại."}</p>
          <button
            type="button"
            className="combo-management__state-action"
            onClick={() => refetch()}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Thử lại
          </button>
        </section>
      ) : loading ? (
        <section className="combo-management__grid" aria-label="Đang tải combo">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              className="manager-combo-card manager-combo-card--skeleton"
              key={index}
            />
          ))}
        </section>
      ) : combos.length ? (
        <section
          className="combo-management__grid"
          aria-label="Danh sách combo"
          role="list"
        >
          {combos.map((combo) => {
            const items = combo.items || [];
            const comboSaving = Math.max(
              0,
              Number(combo.originalPrice || 0) - Number(combo.price || 0),
            );
            const visibleItems = items.slice(0, 3);

            return (
              <article
                className="manager-combo-card"
                key={combo.id}
                role="listitem"
              >
                <div className="manager-combo-card__media">
                  <img
                    src={
                      combo.imageUrl ||
                      items[0]?.imageUrl ||
                      "/default-dishes.jpg"
                    }
                    alt={`Ảnh ${combo.name}`}
                    onError={replaceBrokenImage}
                  />
                  <span
                    className={`manager-combo-card__status ${
                      combo.isActive ? "is-active" : "is-muted"
                    }`}
                  >
                    {combo.isActive ? "Đang bán" : "Tạm tắt"}
                  </span>
                  {comboSaving > 0 ? (
                    <span className="manager-combo-card__saving">
                      Tiết kiệm {money(comboSaving)}
                    </span>
                  ) : null}
                </div>

                <div className="manager-combo-card__body">
                  <div className="manager-combo-card__title-row">
                    <h3>{combo.name}</h3>
                    <span>{items.length} món</span>
                  </div>

                  <p className="manager-combo-card__description">
                    {combo.description ||
                      "Combo cố định giúp khách chọn món nhanh hơn."}
                  </p>

                  {visibleItems.length ? (
                    <ul className="manager-combo-card__items">
                      {visibleItems.map((item) => (
                        <li key={item.menuItemId}>
                          <span>{item.name || "Món trong combo"}</span>
                          <strong>×{item.qty || 1}</strong>
                        </li>
                      ))}
                      {items.length > visibleItems.length ? (
                        <li className="manager-combo-card__items-more">
                          +{items.length - visibleItems.length} món khác
                        </li>
                      ) : null}
                    </ul>
                  ) : null}

                  <dl className="manager-combo-card__prices">
                    <div>
                      <dt>Giá combo</dt>
                      <dd>{money(combo.price)}</dd>
                    </div>
                    <div>
                      <dt>Giá món lẻ</dt>
                      <dd>{money(combo.originalPrice)}</dd>
                    </div>
                  </dl>

                  <footer className="manager-combo-card__footer">
                    <span className="manager-combo-card__updated">
                      <CalendarDays size={14} aria-hidden="true" />
                      {formatDate(combo.updatedAt || combo.createdAt)}
                    </span>
                    <div className="manager-combo-card__actions">
                      <button
                        type="button"
                        onClick={() => openEdit(combo)}
                        disabled={Boolean(busyKey)}
                        aria-label={`Sửa ${combo.name}`}
                      >
                        <Pencil size={14} aria-hidden="true" />
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(combo)}
                        disabled={Boolean(busyKey)}
                        aria-label={`${combo.isActive ? "Tắt" : "Bật"} ${
                          combo.name
                        }`}
                      >
                        {combo.isActive ? (
                          <PowerOff size={14} aria-hidden="true" />
                        ) : (
                          <Power size={14} aria-hidden="true" />
                        )}
                        {busyKey === `toggle:${combo.id}`
                          ? "Đang lưu"
                          : combo.isActive
                            ? "Tắt"
                            : "Bật"}
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => handleDelete(combo)}
                        disabled={Boolean(busyKey)}
                        aria-label={`Xóa ${combo.name}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        {busyKey === `delete:${combo.id}` ? "Đang xóa" : "Xóa"}
                      </button>
                    </div>
                  </footer>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="combo-management__state">
          <Layers3 size={28} aria-hidden="true" />
          <h2>Chưa có combo phù hợp</h2>
          <p>
            Tạo combo đầu tiên hoặc đổi từ khóa và trạng thái để xem dữ liệu.
          </p>
          <button
            type="button"
            className="combo-management__state-action"
            onClick={openCreate}
          >
            <Plus size={16} aria-hidden="true" />
            Tạo combo đầu tiên
          </button>
        </section>
      )}

      {modalOpen ? (
        <div
          className="combo-management__modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <form
            ref={dialogRef}
            className="combo-management__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="combo-dialog-title"
            aria-describedby="combo-dialog-description"
            onSubmit={submit}
          >
            <button
              type="button"
              aria-label="Đóng cửa sổ combo"
              className="combo-management__close"
              onClick={closeModal}
            >
              <X size={18} aria-hidden="true" />
            </button>

            <div className="combo-management__dialog-heading">
              <span>{editing ? "Cập nhật set món" : "Combo mới"}</span>
              <h2 id="combo-dialog-title">
                {editing ? "Sửa combo" : "Tạo combo"}
              </h2>
              <p id="combo-dialog-description">
                {menuError
                  ? "Không thể tải danh sách món của nhà hàng."
                  : menuLoading
                    ? "Đang tải món..."
                    : `${menuItems.length} món có thể thêm vào combo.`}
              </p>
            </div>

            <label>
              Tên combo
              <input
                ref={nameInputRef}
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="VD: Combo trưa no đủ"
              />
            </label>

            <label>
              Mô tả
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Mô tả ngắn để nhân viên và khách dễ hiểu"
              />
            </label>

            <div className="combo-management__form-grid">
              <label>
                Ảnh combo
                <input
                  value={form.imageUrl}
                  onChange={(event) =>
                    setForm({ ...form, imageUrl: event.target.value })
                  }
                  placeholder="https://..."
                />
              </label>
              <label>
                Giá combo
                <input
                  required
                  type="number"
                  min="1"
                  value={form.price}
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                />
              </label>
            </div>

            <div className="combo-management__items">
              <div className="combo-management__items-heading">
                <div>
                  <strong>Món trong combo</strong>
                  <span>{form.items.length} món đã chọn</span>
                </div>
                <button
                  type="button"
                  className="combo-management__secondary-button"
                  onClick={addItem}
                  disabled={menuLoading || Boolean(menuError)}
                >
                  <Plus size={15} aria-hidden="true" />
                  Thêm món
                </button>
              </div>

              {form.items.map((item, index) => (
                <div
                  className="combo-management__item-row"
                  key={`${item.menuItemId}-${index}`}
                >
                  <select
                    aria-label={`Chọn món ${index + 1}`}
                    value={item.menuItemId}
                    onChange={(event) =>
                      updateItem(index, { menuItemId: event.target.value })
                    }
                  >
                    {menuItems.map((menuItem) => (
                      <option key={menuItem.id} value={menuItem.id}>
                        {menuItem.name} · {money(menuItem.basePrice)}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Số lượng món ${index + 1}`}
                    type="number"
                    min="1"
                    required
                    value={item.qty}
                    onChange={(event) =>
                      updateItem(index, { qty: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="combo-management__remove-item"
                    onClick={() => removeItem(index)}
                    aria-label={`Xóa món ${index + 1} khỏi combo`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}

              {!form.items.length ? (
                <p className="combo-management__hint">
                  Thêm ít nhất 1 món để lưu combo.
                </p>
              ) : null}
            </div>

            <div className="combo-management__preview" aria-live="polite">
              <span>
                Giá món lẻ <strong>{money(originalPrice)}</strong>
              </span>
              <span>
                Khách tiết kiệm <strong>{money(saving)}</strong>
              </span>
            </div>

            <div className="combo-management__dialog-footer">
              <label className="combo-management__check">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm({ ...form, isActive: event.target.checked })
                  }
                />
                Mở bán combo sau khi lưu
              </label>
              <button
                type="submit"
                className="combo-management__submit"
                disabled={mutationLoading}
              >
                <Save size={16} aria-hidden="true" />
                {mutationLoading ? "Đang lưu..." : "Lưu combo"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
