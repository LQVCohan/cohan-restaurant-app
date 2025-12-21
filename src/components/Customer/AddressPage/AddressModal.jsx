import React, { useState, useEffect } from "react";
import {
  X,
  MapPin,
  User,
  Phone,
  Briefcase,
  Home,
  Navigation,
  Check,
  ChevronDown,
} from "lucide-react";
import "./AddressModal.scss";

// --- MOCK DATA ĐỊA LÝ VIỆT NAM (Rút gọn để demo) ---
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

const AddressModal = ({ isOpen, onClose, onSave, initialData }) => {
  // --- STATE ---
  const [form, setForm] = useState({
    name: "",
    phone: "",
    specificAddress: "", // Số nhà, tên đường
    note: "",
    label: "home", // home | office | other
    isDefault: false,
  });

  // State riêng cho Địa lý (Cascading Dropdowns)
  const [geo, setGeo] = useState({
    province: "", // ID tỉnh
    district: "", // ID huyện
    ward: "", // Tên xã
  });

  // Load dữ liệu khi Edit
  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        phone: initialData.phone || "",
        specificAddress: initialData.specificAddress || "",
        note: initialData.note || "",
        label: initialData.label || "home",
        isDefault: initialData.isDefault || false,
      });
      // (Lưu ý: Logic map lại ID tỉnh/huyện từ data cũ sẽ phức tạp hơn,
      // ở đây ta giả định là form thêm mới cho đơn giản)
    }
  }, [initialData]);

  // --- HANDLERS ---

  // Xử lý chọn Tỉnh -> Reset Huyện & Xã
  const handleProvinceChange = (e) => {
    setGeo({ province: e.target.value, district: "", ward: "" });
  };

  // Xử lý chọn Huyện -> Reset Xã
  const handleDistrictChange = (e) => {
    setGeo({ ...geo, district: e.target.value, ward: "" });
  };

  const handleSubmit = () => {
    // Validate cơ bản
    if (
      !form.name ||
      !form.phone ||
      !geo.province ||
      !geo.district ||
      !geo.ward ||
      !form.specificAddress
    ) {
      alert("Vui lòng điền đầy đủ thông tin địa chỉ!");
      return;
    }

    // Ghép địa chỉ đầy đủ để hiển thị
    const provinceName = LOCATION_DATA[geo.province].name;
    const districtName =
      LOCATION_DATA[geo.province].districts[geo.district].name;
    const fullAddress = `${form.specificAddress}, ${geo.ward}, ${districtName}, ${provinceName}`;

    onSave({
      ...form,
      ...geo,
      fullAddress, // Trường này dùng để hiển thị trên Card
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className="modal-header">
          <h3>Thông tin địa chỉ</h3>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="modal-body">
          {/* Row 1: Thông tin cá nhân */}
          <div className="form-section">
            <h4 className="section-title">Người nhận</h4>
            <div className="row-grid">
              <div className="input-group">
                <div className="input-wrapper">
                  <User size={18} />
                  <input
                    type="text"
                    placeholder="Họ và tên"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>
              <div className="input-group">
                <div className="input-wrapper">
                  <Phone size={18} />
                  <input
                    type="text"
                    placeholder="Số điện thoại"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Địa chỉ hành chính (Cascading Selects) */}
          <div className="form-section">
            <h4 className="section-title">Địa chỉ nhận hàng</h4>

            <div className="geo-grid">
              {/* TỈNH / THÀNH PHỐ */}
              <div className="select-wrapper">
                <select value={geo.province} onChange={handleProvinceChange}>
                  <option value="">-- Tỉnh/Thành phố --</option>
                  {Object.keys(LOCATION_DATA).map((key) => (
                    <option key={key} value={key}>
                      {LOCATION_DATA[key].name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="select-arrow" />
              </div>

              {/* QUẬN / HUYỆN */}
              <div
                className={`select-wrapper ${!geo.province ? "disabled" : ""}`}
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

              {/* PHƯỜNG / XÃ */}
              <div
                className={`select-wrapper ${!geo.district ? "disabled" : ""}`}
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
                <MapPin size={18} className="icon-top" />
                <textarea
                  rows="2"
                  placeholder="Số nhà, tên đường, tòa nhà, khu dân cư..."
                  value={form.specificAddress}
                  onChange={(e) =>
                    setForm({ ...form, specificAddress: e.target.value })
                  }
                ></textarea>
              </div>
            </div>

            {/* NÚT ĐỊNH VỊ NHANH */}
            <button className="btn-locate">
              <Navigation size={14} /> Chọn vị trí trên bản đồ
            </button>
          </div>

          {/* Row 3: Cài đặt thêm */}
          <div className="form-section">
            <div className="row-grid align-center">
              <div className="label-selector">
                <span>Loại địa chỉ:</span>
                <div className="tags">
                  {["home", "office", "other"].map((type) => (
                    <button
                      key={type}
                      className={`tag ${form.label === type ? "active" : ""}`}
                      onClick={() => setForm({ ...form, label: type })}
                    >
                      {type === "home" && <Home size={14} />}
                      {type === "office" && <Briefcase size={14} />}
                      {type === "other" && <MapPin size={14} />}
                      {type === "home"
                        ? "Nhà riêng"
                        : type === "office"
                        ? "Văn phòng"
                        : "Khác"}
                    </button>
                  ))}
                </div>
              </div>

              <label className="switch-wrapper">
                <div className="switch">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) =>
                      setForm({ ...form, isDefault: e.target.checked })
                    }
                  />
                  <span className="slider round"></span>
                </div>
                <span>Đặt làm mặc định</span>
              </label>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Trở lại
          </button>
          <button className="btn-save" onClick={handleSubmit}>
            Hoàn thành
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddressModal;
