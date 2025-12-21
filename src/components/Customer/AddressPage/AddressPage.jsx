import React, { useState, useEffect } from "react";
import {
  MapPin,
  Home,
  Briefcase,
  Plus,
  Navigation,
  Phone,
  User,
  Trash2,
  Edit3,
  CheckCircle,
  Star,
  ChevronDown,
  X,
} from "lucide-react";
import "./AddressPage.scss";

// --- MOCK DATA ĐỊA LÝ (Rút gọn demo) ---
const LOCATION_DATA = {
  79: {
    name: "TP. Hồ Chí Minh",
    districts: {
      760: {
        name: "Quận 1",
        wards: ["Phường Bến Nghé", "Phường Bến Thành", "Phường Đa Kao"],
      },
      761: {
        name: "Quận Bình Thạnh",
        wards: ["Phường 25", "Phường 19", "Phường 12"],
      },
      762: {
        name: "TP. Thủ Đức",
        wards: ["Phường Thảo Điền", "Phường An Phú", "Phường Hiệp Bình Chánh"],
      },
    },
  },
  "01": {
    name: "TP. Hà Nội",
    districts: {
      "001": {
        name: "Quận Ba Đình",
        wards: ["Phường Phúc Xá", "Phường Trúc Bạch"],
      },
      "002": {
        name: "Quận Hoàn Kiếm",
        wards: ["Phường Hàng Bạc", "Phường Hàng Gai"],
      },
    },
  },
  48: {
    name: "TP. Đà Nẵng",
    districts: {
      490: {
        name: "Quận Hải Châu",
        wards: ["Phường Thạch Thang", "Phường Hải Châu I"],
      },
    },
  },
};

const INITIAL_ADDRESSES = [
  {
    id: 1,
    label: "home",
    name: "Nguyễn Văn A",
    phone: "0909 123 456",
    fullAddress:
      "123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    // Lưu trữ các trường riêng lẻ để Edit lại được
    specificAddress: "123 Đường Nguyễn Huệ",
    province: "79",
    district: "760",
    ward: "Phường Bến Nghé",
    note: "Cổng số 2, gọi trước khi đến",
    isDefault: true,
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
    note: "",
    isDefault: false,
    specificAddress: "", // Số nhà, đường
  });

  // State riêng cho Địa lý
  const [geo, setGeo] = useState({
    province: "",
    district: "",
    ward: "",
  });

  // --- HANDLERS ---
  const handleProvinceChange = (e) => {
    setGeo({ province: e.target.value, district: "", ward: "" });
  };

  const handleDistrictChange = (e) => {
    setGeo({ ...geo, district: e.target.value, ward: "" });
  };

  const handleAddNew = () => {
    setIsEditing(false);
    setFormData({
      id: Date.now(),
      label: "home",
      name: "",
      phone: "",
      note: "",
      isDefault: false,
      specificAddress: "",
    });
    setGeo({ province: "", district: "", ward: "" });
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setIsEditing(true);
    setFormData({
      id: item.id,
      label: item.label,
      name: item.name,
      phone: item.phone,
      note: item.note,
      isDefault: item.isDefault,
      specificAddress: item.specificAddress || "",
    });
    // Load lại geo nếu có, nếu không để trống
    setGeo({
      province: item.province || "",
      district: item.district || "",
      ward: item.ward || "",
    });
    setShowModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Bạn có chắc muốn xóa địa chỉ này?")) {
      setAddresses(addresses.filter((addr) => addr.id !== id));
    }
  };

  const handleSetDefault = (id) => {
    const updated = addresses.map((addr) => ({
      ...addr,
      isDefault: addr.id === id,
    }));
    updated.sort((x, y) =>
      x.isDefault === y.isDefault ? 0 : x.isDefault ? -1 : 1
    );
    setAddresses(updated);
  };

  const handleSave = () => {
    // Validate
    if (!formData.name || !formData.phone || !formData.specificAddress) {
      alert("Vui lòng điền tên, số điện thoại và địa chỉ cụ thể!");
      return;
    }
    if (!geo.province || !geo.district || !geo.ward) {
      alert("Vui lòng chọn đầy đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã!");
      return;
    }

    // Ghép địa chỉ hiển thị
    const provinceName = LOCATION_DATA[geo.province]?.name || "";
    const districtName =
      LOCATION_DATA[geo.province]?.districts[geo.district]?.name || "";
    const fullAddressString = `${formData.specificAddress}, ${geo.ward}, ${districtName}, ${provinceName}`;

    const newAddressObj = {
      ...formData,
      ...geo, // Lưu lại ID để sau này edit
      fullAddress: fullAddressString, // Chuỗi hiển thị
    };

    if (isEditing) {
      setAddresses(
        addresses.map((a) => (a.id === formData.id ? newAddressObj : a))
      );
    } else {
      const isFirst = addresses.length === 0;
      setAddresses([
        ...addresses,
        { ...newAddressObj, isDefault: isFirst ? true : formData.isDefault },
      ]);
    }
    setShowModal(false);
  };

  const handleGetCurrentLocation = () => {
    setLoadingLoc(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setTimeout(() => {
            // Demo fill dữ liệu giả định
            setFormData((prev) => ({
              ...prev,
              specificAddress: "20 Cộng Hòa",
            }));
            setGeo({ province: "79", district: "761", ward: "Phường 12" }); // Fill TP.HCM, Bình Thạnh...
            setLoadingLoc(false);
          }, 1000);
        },
        () => {
          alert("Không thể lấy vị trí.");
          setLoadingLoc(false);
        }
      );
    } else {
      setLoadingLoc(false);
    }
  };

  const getIconByLabel = (label) => {
    switch (label) {
      case "home":
        return <Home size={18} />;
      case "office":
        return <Briefcase size={18} />;
      default:
        return <MapPin size={18} />;
    }
  };

  return (
    <div className="address-page">
      <div className="addr-container">
        {/* HEADER */}
        <div className="page-header">
          <div className="header-content">
            <h1>Sổ địa chỉ 📍</h1>
            <p>Quản lý nơi nhận món ngon của bạn</p>
          </div>
          <button className="btn-add-new" onClick={handleAddNew}>
            <div className="icon-wrap">
              <Plus size={20} />
            </div>
            <span>Thêm địa chỉ mới</span>
          </button>
        </div>

        {/* LIST ADDRESSES */}
        {addresses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <MapPin size={48} />
            </div>
            <h3>Chưa có địa chỉ nào</h3>
            <p>Hãy thêm địa chỉ để chúng tôi giao hàng nhanh nhất nhé!</p>
          </div>
        ) : (
          <div className="addr-grid">
            {addresses.map((item) => (
              <div
                key={item.id}
                className={`addr-card ${item.isDefault ? "active" : ""}`}
              >
                {item.isDefault && (
                  <div className="badge-corner">
                    <Star size={12} fill="currentColor" /> Mặc định
                  </div>
                )}
                <div className="card-body">
                  <div className={`icon-box ${item.label}`}>
                    {getIconByLabel(item.label)}
                  </div>
                  <div className="info-box">
                    <div className="user-line">
                      <span className="name">{item.name}</span>
                      <span className="phone">{item.phone}</span>
                    </div>
                    <p className="address-text">{item.fullAddress}</p>
                    {item.note && <p className="note-text">📝 {item.note}</p>}
                  </div>
                </div>
                <div className="card-footer">
                  <div className="actions-left">
                    {!item.isDefault && (
                      <button
                        className="btn-text-default"
                        onClick={() => handleSetDefault(item.id)}
                      >
                        Đặt làm mặc định
                      </button>
                    )}
                  </div>
                  <div className="actions-right">
                    <button
                      className="btn-circle edit"
                      onClick={() => handleEdit(item)}
                    >
                      <Edit3 size={16} />
                    </button>
                    {!item.isDefault && (
                      <button
                        className="btn-circle delete"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- PROFESSIONAL MODAL --- */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="addr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditing ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}</h2>
              <button
                className="btn-close-icon"
                onClick={() => setShowModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Row 1: Thông tin cá nhân */}
              <div className="form-section">
                <div className="form-grid">
                  <div className="input-group">
                    <label>Họ và tên</label>
                    <div className="input-wrapper">
                      <User size={18} />
                      <input
                        type="text"
                        placeholder="VD: Nguyễn Văn A"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Số điện thoại</label>
                    <div className="input-wrapper">
                      <Phone size={18} />
                      <input
                        type="text"
                        placeholder="09xx..."
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Địa chỉ hành chính (Cascading Selects) */}
              <div className="form-section">
                <div className="geo-header">
                  <label>Khu vực vận chuyển</label>
                  <button
                    className="btn-geo-sm"
                    onClick={handleGetCurrentLocation}
                    disabled={loadingLoc}
                  >
                    {loadingLoc ? "Đang tìm..." : "📍 Định vị tôi"}
                  </button>
                </div>

                <div className="geo-grid">
                  {/* TỈNH/THÀNH */}
                  <div className="select-wrapper">
                    <select
                      value={geo.province}
                      onChange={handleProvinceChange}
                    >
                      <option value="">-- Tỉnh/Thành --</option>
                      {Object.keys(LOCATION_DATA).map((key) => (
                        <option key={key} value={key}>
                          {LOCATION_DATA[key].name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-arrow" />
                  </div>

                  {/* QUẬN/HUYỆN */}
                  <div
                    className={`select-wrapper ${
                      !geo.province ? "disabled" : ""
                    }`}
                  >
                    <select
                      value={geo.district}
                      onChange={handleDistrictChange}
                      disabled={!geo.province}
                    >
                      <option value="">-- Quận/Huyện --</option>
                      {geo.province &&
                        Object.keys(LOCATION_DATA[geo.province].districts).map(
                          (key) => (
                            <option key={key} value={key}>
                              {LOCATION_DATA[geo.province].districts[key].name}
                            </option>
                          )
                        )}
                    </select>
                    <ChevronDown size={16} className="select-arrow" />
                  </div>

                  {/* PHƯỜNG/XÃ */}
                  <div
                    className={`select-wrapper ${
                      !geo.district ? "disabled" : ""
                    }`}
                  >
                    <select
                      value={geo.ward}
                      onChange={(e) => setGeo({ ...geo, ward: e.target.value })}
                      disabled={!geo.district}
                    >
                      <option value="">-- Phường/Xã --</option>
                      {geo.district &&
                        LOCATION_DATA[geo.province].districts[
                          geo.district
                        ].wards.map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="select-arrow" />
                  </div>
                </div>

                {/* ĐỊA CHỈ CỤ THỂ */}
                <div className="input-group mt-3">
                  <div className="input-wrapper textarea-wrapper">
                    <MapPin size={18} className="mt-1" />
                    <textarea
                      rows="2"
                      placeholder="Số nhà, tên đường, tòa nhà..."
                      value={formData.specificAddress}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          specificAddress: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Ghi chú & Loại */}
              <div className="form-section">
                <div className="input-group">
                  <label>Ghi chú (Tùy chọn)</label>
                  <div className="input-wrapper">
                    <Edit3 size={18} />
                    <input
                      type="text"
                      placeholder="VD: Gọi trước khi giao, cổng sau..."
                      value={formData.note}
                      onChange={(e) =>
                        setFormData({ ...formData, note: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="label-row">
                  <div className="pills">
                    {["home", "office", "other"].map((type) => (
                      <button
                        key={type}
                        className={`pill ${
                          formData.label === type ? "selected" : ""
                        }`}
                        onClick={() =>
                          setFormData({ ...formData, label: type })
                        }
                      >
                        {getIconByLabel(type)}
                        <span>
                          {type === "home"
                            ? "Nhà riêng"
                            : type === "office"
                            ? "Văn phòng"
                            : "Khác"}
                        </span>
                      </button>
                    ))}
                  </div>
                  {!isEditing && (
                    <label className="checkbox-styled">
                      <input
                        type="checkbox"
                        checked={formData.isDefault}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            isDefault: e.target.checked,
                          })
                        }
                      />
                      <span className="checkmark">
                        <CheckCircle size={14} />
                      </span>
                      <span>Mặc định</span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-text" onClick={() => setShowModal(false)}>
                Hủy bỏ
              </button>
              <button className="btn-primary" onClick={handleSave}>
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
