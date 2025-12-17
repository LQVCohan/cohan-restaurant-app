import React, { useState } from "react";
import {
  MapPin,
  Home,
  Briefcase,
  Plus,
  MoreVertical,
  Navigation,
  Phone,
  User,
  Trash2,
  Edit3,
  CheckCircle,
  Search,
} from "lucide-react";
import "./AddressPage.scss";

// --- MOCK DATA ---
const INITIAL_ADDRESSES = [
  {
    id: 1,
    label: "home", // home | office | other
    name: "Nguyễn Văn A",
    phone: "0909 123 456",
    address: "123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
    note: "Cổng số 2, gọi trước khi đến",
    isDefault: true,
  },
  {
    id: 2,
    label: "office",
    name: "Nguyễn Văn A",
    phone: "0909 123 456",
    address: "Tòa nhà Landmark 81, Quận Bình Thạnh, TP.HCM",
    note: "Giao tại sảnh lễ tân",
    isDefault: false,
  },
];

const AddressPage = () => {
  const [addresses, setAddresses] = useState(INITIAL_ADDRESSES);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    id: null,
    label: "home",
    name: "",
    phone: "",
    address: "",
    note: "",
    isDefault: false,
  });

  // --- ACTIONS ---

  // 1. Mở Modal Thêm mới
  const handleAddNew = () => {
    setIsEditing(false);
    setFormData({
      id: Date.now(),
      label: "home",
      name: "",
      phone: "",
      address: "",
      note: "",
      isDefault: false,
    });
    setShowModal(true);
  };

  // 2. Mở Modal Edit
  const handleEdit = (item) => {
    setIsEditing(true);
    setFormData(item);
    setShowModal(true);
  };

  // 3. Xóa địa chỉ
  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc muốn xóa địa chỉ này?")) {
      setAddresses(addresses.filter((addr) => addr.id !== id));
    }
  };

  // 4. Đặt làm mặc định
  const handleSetDefault = (id) => {
    const updated = addresses.map((addr) => ({
      ...addr,
      isDefault: addr.id === id,
    }));
    // Đưa địa chỉ mặc định lên đầu danh sách
    updated.sort((x, y) =>
      x.isDefault === y.isDefault ? 0 : x.isDefault ? -1 : 1
    );
    setAddresses(updated);
  };

  // 5. Lưu form
  const handleSave = () => {
    if (!formData.name || !formData.address || !formData.phone) {
      alert("Vui lòng điền đầy đủ thông tin!");
      return;
    }

    if (isEditing) {
      setAddresses(addresses.map((a) => (a.id === formData.id ? formData : a)));
    } else {
      // Nếu là địa chỉ đầu tiên, tự động set default
      const newAddr = {
        ...formData,
        isDefault: addresses.length === 0 ? true : formData.isDefault,
      };
      setAddresses([...addresses, newAddr]);
    }
    setShowModal(false);
  };

  // 6. TÍNH NĂNG THÔNG MINH: Lấy vị trí hiện tại (Simulation)
  const handleGetCurrentLocation = () => {
    setLoadingLoc(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Giả lập delay API Reverse Geocoding
          setTimeout(() => {
            setFormData((prev) => ({
              ...prev,
              address:
                "Vị trí hiện tại: 20 Cộng Hòa, Tân Bình, TP.HCM (Đã định vị)",
              note: `Tọa độ: ${position.coords.latitude.toFixed(
                4
              )}, ${position.coords.longitude.toFixed(4)}`,
            }));
            setLoadingLoc(false);
          }, 1500);
        },
        (error) => {
          alert("Không thể lấy vị trí. Vui lòng kiểm tra quyền truy cập.");
          setLoadingLoc(false);
        }
      );
    } else {
      alert("Trình duyệt không hỗ trợ Geolocation.");
      setLoadingLoc(false);
    }
  };

  // Helper: Chọn Icon theo nhãn
  const getIconByLabel = (label) => {
    switch (label) {
      case "home":
        return <Home size={20} />;
      case "office":
        return <Briefcase size={20} />;
      default:
        return <MapPin size={20} />;
    }
  };

  return (
    <div className="address-page">
      <div className="addr-container">
        {/* HEADER */}
        <div className="page-header">
          <div>
            <h1>Sổ địa chỉ & Giao hàng 📍</h1>
            <p>Quản lý nơi nhận món ngon của bạn</p>
          </div>
          <button className="btn-add-new" onClick={handleAddNew}>
            <Plus size={20} /> Thêm địa chỉ mới
          </button>
        </div>

        {/* LIST ADDRESSES */}
        <div className="addr-grid">
          {addresses.map((item) => (
            <div
              key={item.id}
              className={`addr-card ${item.isDefault ? "active" : ""}`}
            >
              {/* Left Icon */}
              <div className={`icon-box ${item.label}`}>
                {getIconByLabel(item.label)}
              </div>

              {/* Content */}
              <div className="addr-content">
                <div className="row-head">
                  <span className="addr-name">{item.name}</span>
                  <span className="addr-phone">| {item.phone}</span>
                  {item.isDefault && (
                    <span className="badge-default">Mặc định</span>
                  )}
                </div>
                <p className="addr-text">{item.address}</p>
                {item.note && <p className="addr-note">📝 Note: {item.note}</p>}
              </div>

              {/* Actions */}
              <div className="addr-actions">
                <button
                  className="btn-icon edit"
                  onClick={() => handleEdit(item)}
                  title="Sửa"
                >
                  <Edit3 size={18} />
                </button>
                {!item.isDefault && (
                  <button
                    className="btn-icon delete"
                    onClick={() => handleDelete(item.id)}
                    title="Xóa"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                {!item.isDefault && (
                  <button
                    className="btn-set-default"
                    onClick={() => handleSetDefault(item.id)}
                  >
                    Đặt mặc định
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- SMART MODAL FORM --- */}
      {showModal && (
        <div
          className="modal-address-overlay"
          onClick={() => setShowModal(false)}
        >
          <div className="addr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{isEditing ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}</h2>
              <p>
                Thông tin giao hàng chính xác giúp FoodHub phục vụ nhanh hơn.
              </p>
            </div>

            <div className="modal-body">
              {/* Button Định vị thông minh */}
              <button
                className={`btn-geo ${loadingLoc ? "loading" : ""}`}
                onClick={handleGetCurrentLocation}
                disabled={loadingLoc}
              >
                {loadingLoc ? (
                  "Đang định vị..."
                ) : (
                  <>
                    <Navigation size={18} /> Dùng vị trí hiện tại của tôi
                  </>
                )}
              </button>

              <div className="input-group-row">
                <div className="input-box">
                  <label>
                    <User size={14} /> Tên người nhận
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Anh Ba"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="input-box">
                  <label>
                    <Phone size={14} /> Số điện thoại
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 0909..."
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="input-box">
                <label>
                  <MapPin size={14} /> Địa chỉ chi tiết
                </label>
                <textarea
                  rows="3"
                  placeholder="Số nhà, tên đường, phường/xã..."
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                ></textarea>
              </div>

              <div className="input-box">
                <label>Ghi chú cho tài xế (Tùy chọn)</label>
                <input
                  type="text"
                  placeholder="VD: Cổng sau, bấm chuông..."
                  value={formData.note}
                  onChange={(e) =>
                    setFormData({ ...formData, note: e.target.value })
                  }
                />
              </div>

              <div className="label-selector">
                <span className="lbl">Loại địa chỉ:</span>
                <div className="options">
                  {["home", "office", "other"].map((type) => (
                    <button
                      key={type}
                      className={`type-pill ${
                        formData.label === type ? "selected" : ""
                      }`}
                      onClick={() => setFormData({ ...formData, label: type })}
                    >
                      {type === "home" ? (
                        <Home size={14} />
                      ) : type === "office" ? (
                        <Briefcase size={14} />
                      ) : (
                        <MapPin size={14} />
                      )}
                      {type === "home"
                        ? "Nhà riêng"
                        : type === "office"
                        ? "Văn phòng"
                        : "Khác"}
                    </button>
                  ))}
                </div>
              </div>

              {!isEditing && (
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) =>
                      setFormData({ ...formData, isDefault: e.target.checked })
                    }
                  />
                  Đặt làm địa chỉ mặc định
                </label>
              )}
            </div>

            <div className="modal-foot">
              <button
                className="btn-cancel"
                onClick={() => setShowModal(false)}
              >
                Hủy bỏ
              </button>
              <button className="btn-save" onClick={handleSave}>
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressPage;
