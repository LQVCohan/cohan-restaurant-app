import React, { useContext, useMemo, useState } from "react";
import { gql, useApolloClient, useMutation, useQuery } from "@apollo/client";
import { Archive, History, RotateCcw } from "lucide-react";
import Modal from "../../common/Modal";
import { AuthContext } from "../../../context/AuthContext";
import useManagerRestaurantSelection from "../../../hooks/useManagerRestaurantSelection";
import { useNotification } from "../../../hooks/useNotification";
import {
  isAdminRole,
  isManagerRole,
} from "../../../utils/frontendRoleAccess";

const ARCHIVE_CONFIRM_TEXT = "AN TOAN BO KHACH HANG";

const GET_ARCHIVED_CUSTOMERS = gql`
  query GetArchivedCustomers($restaurantId: ID!, $limit: Int) {
    archivedCustomers(restaurantId: $restaurantId, limit: $limit) {
      totalCount
      items {
        id
        fullName
        username
        email
        phone
        loyaltyPoints
        customerType
        isGuest
      }
    }
  }
`;

const ARCHIVE_ALL_CUSTOMERS = gql`
  mutation ArchiveAllCustomers($restaurantId: ID!, $confirmText: String!) {
    archiveAllCustomers(
      restaurantId: $restaurantId
      confirmText: $confirmText
    )
  }
`;

const RESTORE_ALL_ARCHIVED_CUSTOMERS = gql`
  mutation RestoreAllArchivedCustomers($restaurantId: ID!) {
    restoreAllArchivedCustomers(restaurantId: $restaurantId)
  }
`;

const customerName = (customer) =>
  customer?.fullName || customer?.username || "Khách hàng";

const CustomerArchiveControls = () => {
  const { user } = useContext(AuthContext) || {};
  const {
    selectedRestaurantId,
    selectedRestaurant,
  } = useManagerRestaurantSelection();
  const { showNotification } = useNotification();
  const apolloClient = useApolloClient();
  const [isOpen, setIsOpen] = useState(false);

  const isAdmin = isAdminRole(user);
  const canArchive = isAdmin || isManagerRole(user);

  const { data, loading, error, refetch } = useQuery(
    GET_ARCHIVED_CUSTOMERS,
    {
      skip: !isOpen || !isAdmin || !selectedRestaurantId,
      variables: {
        restaurantId: selectedRestaurantId,
        limit: 100,
      },
      fetchPolicy: "network-only",
    },
  );
  const [archiveCustomers, { loading: archiving }] = useMutation(
    ARCHIVE_ALL_CUSTOMERS,
  );
  const [restoreCustomers, { loading: restoring }] = useMutation(
    RESTORE_ALL_ARCHIVED_CUSTOMERS,
  );

  const archived = data?.archivedCustomers;
  const archivedItems = archived?.items || [];
  const totalArchived = Number(archived?.totalCount || 0);
  const restaurantName = useMemo(
    () => selectedRestaurant?.name || "nhà hàng đang chọn",
    [selectedRestaurant?.name],
  );

  const refreshActiveCustomers = () =>
    apolloClient.refetchQueries({
      include: ["GetCustomerListPage", "GetCustomers"],
    });

  const handleArchiveAll = async () => {
    if (!selectedRestaurantId) return;

    const confirmText = window.prompt(
      `Ẩn toàn bộ khách hàng khỏi ${restaurantName}. Tài khoản và dữ liệu vẫn được giữ nguyên.\n\nNhập ${ARCHIVE_CONFIRM_TEXT} để xác nhận:`,
    );
    if (confirmText === null) return;

    try {
      const { data: resultData } = await archiveCustomers({
        variables: {
          restaurantId: selectedRestaurantId,
          confirmText,
        },
      });
      const count = Number(resultData?.archiveAllCustomers || 0);
      await refreshActiveCustomers();
      showNotification(
        `Đã ẩn ${count.toLocaleString("vi-VN")} khách hàng khỏi ${restaurantName}.`,
        "success",
      );
      if (isAdmin) setIsOpen(true);
    } catch (archiveError) {
      showNotification(
        archiveError?.message || "Không thể ẩn danh sách khách hàng.",
        "error",
      );
    }
  };

  const handleRestoreAll = async () => {
    if (!selectedRestaurantId || !totalArchived) return;
    if (
      !window.confirm(
        `Khôi phục ${totalArchived.toLocaleString("vi-VN")} khách hàng đã ẩn tại ${restaurantName}?`,
      )
    ) {
      return;
    }

    try {
      const { data: resultData } = await restoreCustomers({
        variables: { restaurantId: selectedRestaurantId },
      });
      const count = Number(
        resultData?.restoreAllArchivedCustomers || 0,
      );
      await Promise.all([
        refreshActiveCustomers(),
        refetch?.({
          restaurantId: selectedRestaurantId,
          limit: 100,
        }),
      ]);
      showNotification(
        `Đã khôi phục ${count.toLocaleString("vi-VN")} khách hàng.`,
        "success",
      );
    } catch (restoreError) {
      showNotification(
        restoreError?.message || "Không thể khôi phục khách hàng.",
        "error",
      );
    }
  };

  if (!canArchive) return null;

  return (
    <>
      <div className="cl-view-toggle" aria-label="Lưu trữ khách hàng">
        <button
          type="button"
          onClick={handleArchiveAll}
          disabled={archiving || !selectedRestaurantId}
          title="Ẩn toàn bộ khách hàng khỏi nhà hàng đang chọn"
        >
          <Archive size={14} />
          {archiving ? "Đang ẩn..." : "Ẩn toàn bộ"}
        </button>
        {isAdmin ? (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            disabled={!selectedRestaurantId}
            title="Xem khách hàng đã ẩn"
          >
            <History size={14} /> Đã ẩn
          </button>
        ) : null}
      </div>

      {isAdmin ? (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title={`Khách hàng đã ẩn — ${restaurantName}`}
          size="lg"
        >
          <Modal.Body>
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Các tài khoản dưới đây chỉ bị ẩn khỏi nhà hàng này. Tài khoản,
                đơn hàng và dữ liệu lịch sử vẫn còn nguyên.
              </p>

              {loading ? (
                <p className="text-sm text-slate-500">
                  Đang tải danh sách đã ẩn...
                </p>
              ) : error ? (
                <div className="text-sm text-red-600" role="alert">
                  {error.message || "Không thể tải danh sách đã ẩn."}
                </div>
              ) : totalArchived === 0 ? (
                <div className="cl-empty-state">
                  <History size={34} strokeWidth={1.3} />
                  <h3 className="cl-empty-title">Chưa có khách hàng đã ẩn</h3>
                </div>
              ) : (
                <>
                  <div className="cl-table-card" role="region">
                    <table className="cl-table">
                      <thead>
                        <tr>
                          <th>Khách hàng</th>
                          <th>Liên hệ</th>
                          <th>Hạng khách</th>
                          <th>Loại tài khoản</th>
                        </tr>
                      </thead>
                      <tbody>
                        {archivedItems.map((customer) => (
                          <tr key={customer.id}>
                            <td>
                              <strong>{customerName(customer)}</strong>
                            </td>
                            <td>
                              <div className="cl-table-contact">
                                <span>{customer.phone || "Chưa có SĐT"}</span>
                                <small>{customer.email || "Chưa có email"}</small>
                              </div>
                            </td>
                            <td>
                              <span className="cl-table-badge">
                                {customer.customerType || "NEW"}
                              </span>
                            </td>
                            <td>
                              {customer.isGuest
                                ? "Khách vãng lai"
                                : "Có tài khoản"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalArchived > archivedItems.length ? (
                    <p className="text-xs text-slate-500">
                      Đang hiển thị {archivedItems.length.toLocaleString("vi-VN")} /
                      {" "}
                      {totalArchived.toLocaleString("vi-VN")} khách hàng.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsOpen(false)}
              disabled={restoring}
            >
              Đóng
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRestoreAll}
              disabled={restoring || loading || totalArchived === 0}
            >
              <RotateCcw size={15} className="mr-2" />
              {restoring ? "Đang khôi phục..." : "Khôi phục toàn bộ"}
            </button>
          </Modal.Footer>
        </Modal>
      ) : null}
    </>
  );
};

export default CustomerArchiveControls;
