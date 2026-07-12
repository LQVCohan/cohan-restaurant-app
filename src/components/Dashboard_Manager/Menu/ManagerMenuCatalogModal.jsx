import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import { AlertCircle, Clock3, ListChecks, RefreshCw, Utensils } from "lucide-react";
import Modal from "@/components/common/Modal";
import "./ManagerMenuCatalogModal.scss";

const SLOT_CONFIG = [
  { value: "breakfast", label: "Bữa sáng" },
  { value: "lunch", label: "Bữa trưa" },
  { value: "dinner", label: "Bữa tối" },
  { value: "late_night", label: "Bữa khuya" },
];

const STATUS_LABELS = {
  available: "Đang bán",
  out_of_stock: "Hết món",
  unavailable: "Tạm dừng",
  hidden: "Đang ẩn",
  draft: "Bản nháp",
};

const MANAGER_MENU_CATALOG = gql`
  query ManagerMenuCatalog($restaurantId: ID!) {
    menus(restaurantId: $restaurantId) {
      id
      restaurantId
      timeSlot
      name
      description
      isActive
      itemCount
    }
    breakfast: menuItemsConnection(
      limit: 200
      filter: { restaurantId: $restaurantId, timeSlot: breakfast, sort: name_asc }
    ) {
      edges {
        node {
          id
          menuId
          name
          basePrice
          status
        }
      }
      pageInfo {
        hasNextPage
      }
    }
    lunch: menuItemsConnection(
      limit: 200
      filter: { restaurantId: $restaurantId, timeSlot: lunch, sort: name_asc }
    ) {
      edges {
        node {
          id
          menuId
          name
          basePrice
          status
        }
      }
      pageInfo {
        hasNextPage
      }
    }
    dinner: menuItemsConnection(
      limit: 200
      filter: { restaurantId: $restaurantId, timeSlot: dinner, sort: name_asc }
    ) {
      edges {
        node {
          id
          menuId
          name
          basePrice
          status
        }
      }
      pageInfo {
        hasNextPage
      }
    }
    lateNight: menuItemsConnection(
      limit: 200
      filter: { restaurantId: $restaurantId, timeSlot: late_night, sort: name_asc }
    ) {
      edges {
        node {
          id
          menuId
          name
          basePrice
          status
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

const CONNECTION_KEY_BY_SLOT = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  late_night: "lateNight",
};

const formatMoney = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "Chưa đặt giá";
  return `${amount.toLocaleString("vi-VN")}đ`;
};

const getConnectionItems = (connection) =>
  (connection?.edges || []).map((edge) => edge?.node).filter(Boolean);

export default function ManagerMenuCatalogModal({
  isOpen,
  onClose,
  restaurantId,
  restaurantName = "",
}) {
  const { data, loading, error, refetch } = useQuery(MANAGER_MENU_CATALOG, {
    variables: { restaurantId },
    skip: !isOpen || !restaurantId,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });

  const menuRows = useMemo(() => {
    const menus = data?.menus || [];
    const menuBySlot = new Map(
      menus.filter((menu) => menu?.timeSlot).map((menu) => [menu.timeSlot, menu]),
    );

    return SLOT_CONFIG.map((slot) => {
      const menu = menuBySlot.get(slot.value) || null;
      const connection = data?.[CONNECTION_KEY_BY_SLOT[slot.value]];
      const items = menu
        ? getConnectionItems(connection).filter(
            (item) => !item?.menuId || String(item.menuId) === String(menu.id),
          )
        : [];

      return {
        ...slot,
        menu,
        items,
        truncated: Boolean(connection?.pageInfo?.hasNextPage),
      };
    });
  }, [data]);

  const totalMenus = menuRows.filter((row) => row.menu).length;
  const totalItems = menuRows.reduce((sum, row) => sum + row.items.length, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Danh sách thực đơn"
      size="xl"
      className="manager-menu-catalog-modal"
    >
      <section className="manager-menu-catalog" aria-label="Thực đơn theo khung giờ">
        <header className="manager-menu-catalog__summary">
          <div>
            <span className="manager-menu-catalog__eyebrow">TỔNG QUAN THỰC ĐƠN</span>
            <h3>{restaurantName || "Nhà hàng đang chọn"}</h3>
            <p>Xem từng menu, khung giờ phục vụ và các món đang thuộc menu đó.</p>
          </div>
          <div className="manager-menu-catalog__metrics" aria-label="Số liệu thực đơn">
            <span><strong>{totalMenus}</strong> menu</span>
            <span><strong>{totalItems}</strong> món đã tải</span>
          </div>
        </header>

        {!restaurantId ? (
          <div className="manager-menu-catalog__state" role="status">
            <Utensils aria-hidden="true" />
            <strong>Chưa chọn chi nhánh</strong>
            <p>Chọn một chi nhánh ở header trước khi mở danh sách thực đơn.</p>
          </div>
        ) : loading && !data ? (
          <div className="manager-menu-catalog__state" role="status">
            <RefreshCw className="is-spinning" aria-hidden="true" />
            <strong>Đang tải thực đơn...</strong>
          </div>
        ) : error ? (
          <div className="manager-menu-catalog__state manager-menu-catalog__state--error" role="alert">
            <AlertCircle aria-hidden="true" />
            <strong>Không thể tải danh sách thực đơn</strong>
            <p>{error.message || "Vui lòng thử lại."}</p>
            <button type="button" onClick={() => void refetch()}>
              <RefreshCw size={16} aria-hidden="true" /> Thử lại
            </button>
          </div>
        ) : (
          <div className="manager-menu-catalog__grid">
            {menuRows.map((row) => (
              <article
                key={row.value}
                className={`manager-menu-catalog__card ${row.menu?.isActive === false ? "is-hidden" : ""}`}
              >
                <div className="manager-menu-catalog__card-heading">
                  <div>
                    <span className="manager-menu-catalog__slot">
                      <Clock3 size={15} aria-hidden="true" /> {row.label}
                    </span>
                    <h4>{row.menu?.name || "Chưa có thực đơn"}</h4>
                    <p>{row.menu?.description || "Chưa có mô tả cho khung giờ này."}</p>
                  </div>
                  <span className={`manager-menu-catalog__visibility ${row.menu?.isActive === false ? "is-hidden" : ""}`}>
                    {!row.menu ? "Chưa tạo" : row.menu.isActive === false ? "Đang ẩn" : "Đang hiển thị"}
                  </span>
                </div>

                {row.menu ? (
                  <div className="manager-menu-catalog__items">
                    <div className="manager-menu-catalog__items-heading">
                      <span><ListChecks size={15} aria-hidden="true" /> Món trong menu</span>
                      <strong>{row.items.length}</strong>
                    </div>
                    {row.items.length ? (
                      <ul>
                        {row.items.map((item) => (
                          <li key={item.id}>
                            <span className="manager-menu-catalog__item-copy">
                              <strong>{item.name || "Món chưa đặt tên"}</strong>
                              <small>{formatMoney(item.basePrice)}</small>
                            </span>
                            <span className={`manager-menu-catalog__item-status is-${item.status || "unknown"}`}>
                              {STATUS_LABELS[item.status] || "Chưa rõ trạng thái"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="manager-menu-catalog__empty">Menu này chưa có món.</div>
                    )}
                    {row.truncated ? (
                      <p className="manager-menu-catalog__limit-note">
                        Đang hiển thị 200 món đầu tiên. Dùng trang quản lý thực đơn để xem tiếp.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="manager-menu-catalog__empty">Tạo thực đơn cho khung giờ này để thêm món.</div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </Modal>
  );
}

export { MANAGER_MENU_CATALOG };