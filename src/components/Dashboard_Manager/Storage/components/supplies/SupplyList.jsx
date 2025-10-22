import React, { useState } from "react";
import { gql } from "@apollo/client";
import { useQuery, useMutation } from "@apollo/client/react";
import SupplyModal from "./SupplyModal";
import Button from "../../../../common/Button";
import "./SupplyList.scss";

// ================== GraphQL ==================
const GET_SUPPLIES = gql`
  query Supplies($restaurantId: ID!, $search: String, $limit: Int) {
    supplies(restaurantId: $restaurantId, search: $search, limit: $limit) {
      id
      name
      category
      unit
      costPerUnit
      pricePerUnit
      minStock
      isActive
      notes
    }
  }
`;

const CREATE_SUPPLY = gql`
  mutation CreateSupply($input: CreateSupplyInput!) {
    createSupply(input: $input) {
      id
      name
      unit
      isActive
    }
  }
`;

const UPDATE_SUPPLY = gql`
  mutation UpdateSupply($id: ID!, $input: UpdateSupplyInput!) {
    updateSupply(id: $id, input: $input) {
      id
      name
      unit
      isActive
    }
  }
`;

const DELETE_SUPPLY = gql`
  mutation DeleteSupply($id: ID!) {
    deleteSupply(id: $id)
  }
`;

// ================== Component ==================
const SupplyList = ({ restaurantId }) => {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data, loading, error, refetch } = useQuery(GET_SUPPLIES, {
    variables: { restaurantId, search, limit: 200 },
    skip: !restaurantId,
  });

  const [createSupply] = useMutation(CREATE_SUPPLY);
  const [updateSupply] = useMutation(UPDATE_SUPPLY);
  const [deleteSupply] = useMutation(DELETE_SUPPLY);

  const openNewModal = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEditModal = (supply) => {
    setEditing(supply);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
    setEditing(null);
  };

  // ======= SAVE (create or update) =======
  const handleSave = async ({ payload, isEditing, id }) => {
    try {
      if (isEditing) {
        await updateSupply({ variables: { id, input: payload } });
      } else {
        await createSupply({
          variables: { input: { ...payload, restaurantId } },
        });
      }
      await refetch();
    } catch (err) {
      console.error("Save supply error:", err);
    }
  };

  // ======= DELETE =======
  const handleDelete = async (id) => {
    try {
      await deleteSupply({ variables: { id } });
      await refetch();
    } catch (err) {
      console.error("Delete supply error:", err);
      alert("Không thể xóa vật phẩm: " + err.message);
    }
  };

  const supplies = data?.supplies ?? [];

  return (
    <div className="supply-list">
      <div className="toolbar">
        <div className="toolbar-left">
          <input
            className="search-input"
            placeholder="🔍 Tìm vật phẩm..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && refetch()}
          />
          <Button variant="primary" onClick={() => refetch()}>
            Làm mới
          </Button>
        </div>

        <div className="toolbar-right">
          <Button variant="success" onClick={openNewModal}>
            ➕ Thêm vật phẩm
          </Button>
        </div>
      </div>

      {loading && <div className="text-center">Đang tải...</div>}
      {error && <div className="error">Lỗi: {error.message}</div>}

      {!loading && supplies.length === 0 && (
        <div className="text-center text-muted">Chưa có vật phẩm nào</div>
      )}

      <div className="supplies-grid">
        {supplies.map((supply) => (
          <div key={supply.id} className="supply-card">
            <div className="supply-header">
              <div className="supply-info">
                <div className="supply-name">{supply.name}</div>
                <div className="supply-category">
                  {supply.category || "Không phân loại"}
                </div>
              </div>
              <span
                className={`status-badge ${
                  supply.isActive ? "status-in-stock" : "status-out-of-stock"
                }`}
              >
                {supply.isActive ? "Đang dùng" : "Ngừng"}
              </span>
            </div>

            <div className="supply-stats">
              <div className="stat-item">
                <div className="stat-value">{supply.unit}</div>
                <div className="stat-label">Đơn vị</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">
                  ₫{Number(supply.costPerUnit || 0).toLocaleString()}
                </div>
                <div className="stat-label">Giá nhập</div>
              </div>
            </div>

            <div className="supply-actions">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openEditModal(supply)}
              >
                ✏️ Sửa
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDelete(supply.id)}
              >
                🗑️ Xóa
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* ===== Modal thêm/sửa ===== */}
      <SupplyModal
        isOpen={modalOpen}
        onClose={handleClose}
        initial={editing}
        onSubmit={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default SupplyList;
