import React, { useState, useEffect } from "react";
import { useMutation, useQuery, gql } from "@apollo/client";
import { useVnAddressLazy } from "@/hooks/useVnAddressLazy"; // Đảm bảo đường dẫn đúng
import "./ProfileInfo.scss";

// --- GRAPHQL MUTATION ---
const UPDATE_USER = gql`
  mutation UpdateUser($input: UpdateUserInput!) {
    updateUser(input: $input) {
      id
      fullName
      phone
      avatarUrl
      address {
        line1
        line2
        ward
        district
        city
        country
      }
    }
  }
`;

const CREATE_WALLET = gql`
  mutation CreateMyWallet($input: CreateWalletInput!) {
    createMyWallet(input: $input) {
      id
      wallet {
        provider
        status
        balance
        currency
        createdAt
        updatedAt
      }
    }
  }
`;


const MY_WALLET_TRANSACTIONS = gql`
  query MyWalletTransactions($limit: Int, $offset: Int) {
    myWalletTransactions(limit: $limit, offset: $offset) {
      id
      type
      amount
      currency
      balanceBefore
      balanceAfter
      status
      referenceType
      createdAt
    }
  }
`;

const ProfileInfo = ({ user, isEditMode, setIsEditMode, refetchUser }) => {
  const [updateUser, { loading: updating }] = useMutation(UPDATE_USER);
  const [createWallet, { loading: creatingWallet }] =
    useMutation(CREATE_WALLET);
  const { data: txData, refetch: refetchTx } = useQuery(MY_WALLET_TRANSACTIONS, {
    variables: { limit: 10, offset: 0 },
    skip: !user?.wallet,
    fetchPolicy: "network-only",
  });

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    line1: "",
    city: "",
    district: "",
    ward: "",
  });
  const [topupAmount, setTopupAmount] = useState("100000");
  const toppingUp = false;

  // Address Hook
  const {
    provinces,
    districts,
    wards,
    provinceKey,
    districtKey,
    wardKey,
    setProvince,
    setDistrict,
    setWard,
    loading: loadingAddress,
  } = useVnAddressLazy({ enabled: true });

  // 1. SYNC DATA TỪ PROPS USER
  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || "",
        phone: user.phone || "",
        line1: user.address?.line1 || "",
        city: user.address?.city || "",
        district: user.address?.district || "",
        ward: user.address?.ward || "",
      });
    }
  }, [user]);

  // 2. LOGIC MAP NGƯỢC (TÊN -> MÃ) CHO ĐỊA CHỈ
  // Khi user bấm Edit, hệ thống sẽ tìm mã tỉnh/huyện tương ứng với tên đang lưu để hiển thị đúng
  useEffect(() => {
    if (isEditMode && formData.city && provinces?.length > 0 && !provinceKey) {
      const found = provinces.find((p) => p.name === formData.city);
      if (found) setProvince(found.code);
    }
  }, [isEditMode, formData.city, provinces, provinceKey, setProvince]);

  useEffect(() => {
    if (
      isEditMode &&
      formData.district &&
      districts?.length > 0 &&
      !districtKey
    ) {
      const found = districts.find((d) => d.name === formData.district);
      if (found) setDistrict(found.code);
    }
  }, [isEditMode, formData.district, districts, districtKey, setDistrict]);

  useEffect(() => {
    if (isEditMode && formData.ward && wards?.length > 0 && !wardKey) {
      const found = wards.find((w) => w.name === formData.ward);
      if (found) setWard(found.code);
    }
  }, [isEditMode, formData.ward, wards, wardKey, setWard]);

  // 3. HANDLERS
  const handleAddressChange = (type, e) => {
    const code = e.target.value;

    if (type === "city") {
      const found = provinces?.find((p) => String(p.code) === code);
      setProvince(code); // Cập nhật mã cho hook load quận
      setFormData((p) => ({
        ...p,
        city: found?.name || "",
        district: "",
        ward: "",
      })); // Lưu tên
    } else if (type === "district") {
      const found = districts?.find((d) => String(d.code) === code);
      setDistrict(code);
      setFormData((p) => ({ ...p, district: found?.name || "", ward: "" }));
    } else if (type === "ward") {
      const found = wards?.find((w) => String(w.code) === code);
      setWard(code);
      setFormData((p) => ({ ...p, ward: found?.name || "" }));
    }
  };

  const handleSave = async () => {
    try {
      await updateUser({
        variables: {
          input: {
            fullName: formData.fullName,
            phone: formData.phone,
            avatarUrl: user.avatarUrl, // Giữ nguyên avatar cũ (Sidebar xử lý upload riêng)
            address: {
              line1: formData.line1,
              city: formData.city,
              district: formData.district,
              ward: formData.ward,
              country: "Vietnam",
            },
          },
        },
      });
      alert("Cập nhật hồ sơ thành công!");
      setIsEditMode(false);
      refetchUser();
    } catch (err) {
      console.error(err);
      alert("Lỗi cập nhật: " + err.message);
    }
  };

  const handleTopupWallet = async () => {
    alert("Nạp ví tự động đang tạm tắt cho đến khi hoàn tất xác minh thanh toán.");
  };

  const handleCreateWallet = async () => {
    try {
      await createWallet({
        variables: {
          input: {
            provider: "internal",
            currency: "VND",
          },
        },
      });
      alert("Đã tạo ví điện tử thành công!");
      refetchUser();
    } catch (err) {
      console.error(err);
      alert("Không thể tạo ví: " + err.message);
    }
  };

  return (
    <div className="content-card fade-in">
      <div className="card-header">
        <h2 className="card-title">Hồ sơ cá nhân</h2>
        {!isEditMode ? (
          <button className="btn-edit" onClick={() => setIsEditMode(true)}>
            ✏️ Chỉnh sửa
          </button>
        ) : (
          <div className="action-group">
            <button className="btn-cancel" onClick={() => setIsEditMode(false)}>
              Hủy
            </button>
            <button
              className="btn-save"
              onClick={handleSave}
              disabled={updating}
            >
              {updating ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        )}
      </div>

      <div className="form-grid">
        {/* --- CƠ BẢN --- */}
        <div className="form-group">
          <label>Họ và tên</label>
          <input
            type="text"
            className="form-input"
            disabled={!isEditMode}
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
          />
        </div>

        <div className="form-group">
          <label>Số điện thoại</label>
          <input
            type="text"
            className="form-input"
            disabled={!isEditMode}
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <div className="input-with-icon">
            <input
              type="text"
              disabled
              value={user.email}
              className="form-input disabled"
            />
            {user.emailVerified && (
              <span className="verified-badge" title="Đã xác thực">
                ✅
              </span>
            )}
          </div>
        </div>

        {/* --- ĐỊA CHỈ --- */}
        <div className="form-divider">
          <span>📍 Địa chỉ giao hàng</span>
        </div>

        <div className="form-group full">
          <label>Số nhà, Tên đường</label>
          <input
            type="text"
            className="form-input"
            disabled={!isEditMode}
            value={formData.line1}
            onChange={(e) =>
              setFormData({ ...formData, line1: e.target.value })
            }
            placeholder="VD: 123 Đường Nguyễn Huệ..."
          />
        </div>

        <div className="form-group">
          <label>Tỉnh / Thành phố</label>
          <select
            className="form-select"
            disabled={!isEditMode || loadingAddress}
            value={provinceKey}
            onChange={(e) => handleAddressChange("city", e)}
          >
            <option value="">-- Chọn Tỉnh/Thành --</option>
            {provinces?.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Quận / Huyện</label>
          <select
            className="form-select"
            disabled={!isEditMode || !provinceKey}
            value={districtKey}
            onChange={(e) => handleAddressChange("district", e)}
          >
            <option value="">-- Chọn Quận/Huyện --</option>
            {districts?.map((d) => (
              <option key={d.code} value={d.code}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Phường / Xã</label>
          <select
            className="form-select"
            disabled={!isEditMode || !districtKey}
            value={wardKey}
            onChange={(e) => handleAddressChange("ward", e)}
          >
            <option value="">-- Chọn Phường/Xã --</option>
            {wards?.map((w) => (
              <option key={w.code} value={w.code}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="wallet-panel">
        <div className="wallet-info">
          <h3>Ví điện tử</h3>
          {user?.wallet ? (
            <div className="wallet-meta">
              <div>
                Trạng thái:{" "}
                <strong>{user.wallet.status || "chưa kích hoạt"}</strong>
              </div>
              <div>
                Số dư:{" "}
                <strong>
                  {Number(user.wallet.balance || 0).toLocaleString()}{" "}
                  {user.wallet.currency || "VND"}
                </strong>
              </div>
              <div>Nhà cung cấp: {user.wallet.provider || "Nội bộ"}</div>
            </div>
          ) : (
            <p className="wallet-empty">
              Bạn chưa có ví điện tử. Hãy tạo ví để thanh toán nhanh hơn.
            </p>
          )}
        </div>
        <div className="wallet-actions">
          <button
            className="btn-save"
            onClick={handleCreateWallet}
            disabled={creatingWallet || Boolean(user?.wallet)}
          >
            {user?.wallet
              ? "Ví đã sẵn sàng"
              : creatingWallet
                ? "Đang tạo ví..."
                : "Tạo ví điện tử"}
          </button>
          {user?.wallet && (
            <div className="wallet-topup">
              <input
                type="text"
                className="form-input"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="Số tiền nạp"
              />
              <button
                className="btn-edit"
                onClick={handleTopupWallet}
                disabled={toppingUp}
              >
                {toppingUp ? "Đang nạp..." : "Nạp tiền"}
              </button>
            </div>
          )}
        </div>
      </div>

      {user?.wallet && (
        <div className="wallet-panel">
          <div className="wallet-info">
            <h3>Lịch sử giao dịch ví</h3>
            <div className="wallet-meta">
              {(txData?.myWalletTransactions || []).length === 0 && (
                <div>Chưa có giao dịch nào.</div>
              )}
              {(txData?.myWalletTransactions || []).map((tx) => (
                <div key={tx.id}>
                  <strong>{tx.type}</strong> ·{" "}
                  {Number(tx.amount || 0).toLocaleString()} {tx.currency || "VND"} ·{" "}
                  {new Date(tx.createdAt).toLocaleString("vi-VN")} · Số dư sau:{" "}
                  {Number(tx.balanceAfter || 0).toLocaleString()}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileInfo;
