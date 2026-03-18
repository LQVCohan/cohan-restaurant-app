import React, { useState, useEffect } from "react";
import { gql, useMutation } from "@apollo/client";
import {
  ArrowLeft,
  User,
  Hash,
  Mail,
  Phone,
  Shield,
  MapPin,
  Building,
  Target,
  Edit2,
  Check,
  X,
} from "lucide-react";
import "./StaffProfileDetails.scss";

// --- GRAPHQL MUTATION (Mẫu) ---
// Bạn có thể điều chỉnh tên mutation và field cho khớp với Backend của bạn
const UPDATE_STAFF_PROFILE = gql`
  mutation UpdateStaffProfile(
    $staffId: ID!
    $fullName: String
    $phone: String
    $email: String
  ) {
    updateStaffProfile(
      staffId: $staffId
      fullName: $fullName
      phone: $phone
      email: $email
    ) {
      staffId
      fullName
      phone
      email
    }
  }
`;

export default function StaffPersonalInfo({ data, user, onBack }) {
  const [isEditing, setIsEditing] = useState(false);

  // State lưu trữ dữ liệu form
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
  });

  // Khởi tạo mutation cập nhật
  const [updateProfile, { loading }] = useMutation(UPDATE_STAFF_PROFILE, {
    onCompleted: () => {
      alert("Cập nhật thông tin thành công!");
      setIsEditing(false);
    },
    onError: (error) => {
      alert("Lỗi khi cập nhật: " + error.message);
    },
  });

  // Đồng bộ dữ liệu ban đầu vào form
  useEffect(() => {
    setFormData({
      fullName: data?.fullName || user?.fullName || user?.username || "",
      phone: data?.phone || user?.phone || "",
      email: data?.email || user?.email || "",
    });
  }, [data, user]);

  // Các trường dữ liệu chỉ đọc
  const roleLabel =
    data?.positionTitle || data?.roleName || user?.roleName || "Nhân viên";
  const employeeCode = data?.employeeCode || user?.employeeCode || "—";
  const restaurantName =
    data?.primaryRestaurant?.name || user?.primaryRestaurant?.name || "—";
  const floors = (data?.floorAssigned || []).join(", ") || "—";

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    // Gọi API cập nhật
    updateProfile({
      variables: {
        staffId: user?.id,
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
      },
    });
  };

  const handleCancel = () => {
    // Hoàn tác dữ liệu
    setFormData({
      fullName: data?.fullName || user?.fullName || user?.username || "",
      phone: data?.phone || user?.phone || "",
      email: data?.email || user?.email || "",
    });
    setIsEditing(false);
  };

  return (
    <div className="detail-page-wrapper">
      <div className="detail-header flex-between">
        <button className="btn-back" onClick={onBack} disabled={loading}>
          <ArrowLeft size={24} className="icon-back" /> Thông tin cá nhân
        </button>

        {/* Nút bật/tắt chế độ sửa */}
        {!isEditing ? (
          <button
            className="btn-action edit"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 size={18} /> Cập nhật
          </button>
        ) : (
          <div className="action-group">
            <button
              className="btn-action cancel"
              onClick={handleCancel}
              disabled={loading}
            >
              <X size={18} /> Hủy
            </button>
            <button
              className="btn-action save"
              onClick={handleSave}
              disabled={loading}
            >
              <Check size={18} /> {loading ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        )}
      </div>

      <div className="detail-content">
        <div className="info-card">
          <h3 className="card-title">Hồ sơ cơ bản</h3>

          <div className="info-row">
            <div className="label-group">
              <User size={18} /> Họ tên
            </div>
            {isEditing ? (
              <input
                type="text"
                name="fullName"
                className="edit-input"
                value={formData.fullName}
                onChange={handleInputChange}
                placeholder="Nhập họ tên"
              />
            ) : (
              <div className="value">{formData.fullName || "—"}</div>
            )}
          </div>

          <div className="info-row disabled-row">
            <div className="label-group">
              <Hash size={18} /> Mã NV
            </div>
            <div className="value text-muted">{employeeCode}</div>
          </div>

          <div className="info-row">
            <div className="label-group">
              <Phone size={18} /> Số điện thoại
            </div>
            {isEditing ? (
              <input
                type="tel"
                name="phone"
                className="edit-input"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Nhập số điện thoại"
              />
            ) : (
              <div className="value">{formData.phone || "—"}</div>
            )}
          </div>

          <div className="info-row">
            <div className="label-group">
              <Mail size={18} /> Email
            </div>
            {isEditing ? (
              <input
                type="email"
                name="email"
                className="edit-input"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Nhập email"
              />
            ) : (
              <div className="value">{formData.email || "—"}</div>
            )}
          </div>
        </div>

        {/* Thông tin công việc luôn chỉ đọc */}
        <div className="info-card">
          <h3 className="card-title">Thông tin công việc</h3>
          <div className="info-row">
            <div className="label-group">
              <Shield size={18} /> Vai trò
            </div>
            <div className="value">{roleLabel}</div>
          </div>
          <div className="info-row">
            <div className="label-group">
              <Building size={18} /> Nhà hàng
            </div>
            <div className="value">{restaurantName}</div>
          </div>
          <div className="info-row">
            <div className="label-group">
              <MapPin size={18} /> Tầng phụ trách
            </div>
            <div className="value">{floors}</div>
          </div>
          <div className="info-row">
            <div className="label-group">
              <Target size={18} /> Trạng thái
            </div>
            <div className="value" style={{ color: "#10b981" }}>
              {data?.employmentStatus || "Đang làm việc"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
