import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  MapPin,
  Home,
  Briefcase,
  Plus,
  Phone,
  User,
  Trash2,
  Edit3,
  CheckCircle,
  Star,
  ChevronDown,
  X,
} from "lucide-react";
import { toApiUrl } from "../../../lib/apiBaseUrl";
import { isValidPhoneNumber, normalizePhoneNumber } from "../../../utils/phoneNumber";
import {
  getFallbackLocationData,
  loadVietnamLocationData,
  mapReverseGeocodeToGeo,
} from "../../../data/vietnamLocationData";
import "./AddressPage.scss";

const ADDRESS_FIELDS = gql`
  fragment CustomerAddressFields on CustomerAddress {
    id
    label
    receiverName
    phone
    province
    district
    ward
    specificAddress
    fullAddress
    note
    isDefault
  }
`;

const MY_ADDRESSES = gql`
  ${ADDRESS_FIELDS}
  query MyAddresses {
    myAddresses {
      ...CustomerAddressFields
    }
  }
`;

const CREATE_CUSTOMER_ADDRESS = gql`
  ${ADDRESS_FIELDS}
  mutation CreateCustomerAddress($input: CustomerAddressInput!) {
    createCustomerAddress(input: $input) {
      ...CustomerAddressFields
    }
  }
`;

const UPDATE_CUSTOMER_ADDRESS = gql`
  ${ADDRESS_FIELDS}
  mutation UpdateCustomerAddress($id: ID!, $input: CustomerAddressInput!) {
    updateCustomerAddress(id: $id, input: $input) {
      ...CustomerAddressFields
    }
  }
`;

const DELETE_CUSTOMER_ADDRESS = gql`
  mutation DeleteCustomerAddress($id: ID!) {
    deleteCustomerAddress(id: ID)
  }
`;

const SET_DEFAULT_CUSTOMER_ADDRESS = gql`
  ${ADDRESS_FIELDS}
  mutation SetDefaultCustomerAddress($id: ID!) {
    setDefaultCustomerAddress(id: $id) {
      ...CustomerAddressFields
    }
  }
`;

const getLocationSourceMessage = (source, loading) => {
  if (loading) return "Đang tải dữ liệu tỉnh/quận/phường...";
  if (source === "remote") return "Đã tải dữ liệu địa chỉ từ nguồn chuẩn.";
  return "Đang dùng dữ liệu địa chỉ dự phòng. Nếu không thấy khu vực của bạn, hãy nhập địa chỉ cụ thể rõ hơn.";
};

const AddressPage = () => {
  const { data, loading, error, refetch } = useQuery(MY_ADDRESSES, { fetchPolicy: "cache-and-network" });
  const [createAddress, { loading: creating }] = useMutation(CREATE_CUSTOMER_ADDRESS);
  const [updateAddress, { loading: updating }] = useMutation(UPDATE_CUSTOMER_ADDRESS);
  const [deleteAddress, { loading: deleting }] = useMutation(DELETE_CUSTOMER_ADDRESS);
  const [setDefaultAddress, { loading: settingDefault }] = useMutation(SET_DEFAULT_CUSTOMER_ADDRESS);
  const addresses = useMemo(() => data?.myAddresses || [], [data?.myAddresses]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [locationData, setLocationData] = useState(() => getFallbackLocationData());
  const [locationSource, setLocationSource] = useState("fallback");
  const [locationDataLoading, setLocationDataLoading] = useState(false);

  const [formData, setFormData] = useState({
    id: null,
    label: "home",
    receiverName: "",
    phone: "",
    note: "",
    isDefault: false,
    specificAddress: "",
  });

  const [geo, setGeo] = useState({
    province: "",
    district: "",
    ward: "",
  });

  useEffect(() => {
    let mounted = true;
    setLocationDataLoading(true);
    loadVietnamLocationData()
      .then(({ data: nextData, source }) => {
        if (!mounted) return;
        setLocationData(nextData);
        setLocationSource(source);
      })
      .finally(() => {
        if (mounted) setLocationDataLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const provinceOptions = useMemo(() => Object.keys(locationData || {}), [locationData]);
  const districtOptions = useMemo(
    () => (geo.province ? locationData?.[geo.province]?.districts || {} : {}),
    [geo.province, locationData],
  );
  const wardOptions = useMemo(
    () => (geo.province && geo.district ? locationData?.[geo.province]?.districts?.[geo.district]?.wards || [] : []),
    [geo.district, geo.province, locationData],
  );

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
      receiverName: "",
      phone: "",
      note: "",
      isDefault: false,
      specificAddress: "",
    });
    setGeo({ province: "", district: "", ward: "" });
    setLocationMessage("");
    setFieldErrors({});
    setFormError("");
    setShowModal(true);
  };

  const handleEdit = (item) => {
    setIsEditing(true);
    setFormData({
      id: item.id,
      label: item.label,
      receiverName: item.receiverName || item.name || "",
      phone: item.phone,
      note: item.note,
      isDefault: item.isDefault,
      specificAddress: item.specificAddress || "",
    });
    setGeo({
      province: item.province || "",
      district: item.district || "",
      ward: item.ward || "",
    });
    setLocationMessage("");
    setFieldErrors({});
    setFormError("");
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa địa chỉ này?")) return;
    setFormError("");
    try {
      await deleteAddress({ variables: { id } });
      await refetch();
    } catch (err) {
      setFormError(err?.message || "Không thể xóa địa chỉ.");
    }
  };

  const handleSetDefault = async (id) => {
    setFormError("");
    try {
      await setDefaultAddress({ variables: { id } });
      await refetch();
    } catch (err) {
      setFormError(err?.message || "Không thể đặt địa chỉ mặc định.");
    }
  };

  const handleSave = async () => {
    setFormError("");
    setFieldErrors({});
    const normalizedPhone = normalizePhoneNumber(formData.phone);
    if (!formData.receiverName || !formData.phone || !formData.specificAddress) {
      setFormError("Vui lòng điền tên, số điện thoại và địa chỉ cụ thể.");
      return;
    }
    if (!isValidPhoneNumber(normalizedPhone)) {
      setFieldErrors({ phone: "Số điện thoại không hợp lệ." });
      return;
    }
    if (!geo.province || !geo.district || !geo.ward) {
      setFormError("Vui lòng chọn đầy đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã.");
      return;
    }

    const provinceName = locationData[geo.province]?.name || "";
    const districtName = locationData[geo.province]?.districts?.[geo.district]?.name || "";
    const fullAddressString = `${formData.specificAddress}, ${geo.ward}, ${districtName}, ${provinceName}`;

    const input = {
      label: formData.label,
      receiverName: formData.receiverName,
      phone: normalizedPhone,
      note: formData.note,
      isDefault: formData.isDefault,
      ...geo,
      fullAddress: fullAddressString,
      specificAddress: formData.specificAddress,
    };

    try {
      if (isEditing) {
        await updateAddress({ variables: { id: formData.id, input } });
      } else {
        await createAddress({ variables: { input } });
      }
      await refetch();
      setShowModal(false);
    } catch (err) {
      setFormError(err?.message || "Không thể lưu địa chỉ.");
    }
  };

  const handleGetCurrentLocation = () => {
    setFormError("");
    setLocationMessage("");

    if (!("geolocation" in navigator)) {
      setLocationMessage("Trình duyệt không hỗ trợ lấy vị trí hiện tại.");
      setLoadingLoc(false);
      return;
    }

    setLoadingLoc(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = Number(position?.coords?.latitude);
          const longitude = Number(position?.coords?.longitude);
          const validCoordinates =
            Number.isFinite(latitude) &&
            Number.isFinite(longitude) &&
            latitude >= -90 &&
            latitude <= 90 &&
            longitude >= -180 &&
            longitude <= 180;

          if (!validCoordinates) {
            setLocationMessage("Không thể xác định vị trí hiện tại. Vui lòng nhập địa chỉ thủ công.");
            return;
          }

          const query = new URLSearchParams({
            lat: String(latitude),
            lng: String(longitude),
          });
          const reverseGeocodeUrl = toApiUrl(`/api/reverse-geocode?${query.toString()}`);
          const response = await fetch(reverseGeocodeUrl, {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result?.ok) {
            throw new Error(result?.message || "reverse_geocode_failed");
          }

          const mapped = mapReverseGeocodeToGeo(result.address || {}, locationData);
          if (mapped.province && mapped.district && mapped.ward && mapped.specificAddress) {
            setGeo({ province: mapped.province, district: mapped.district, ward: mapped.ward });
            setFormData((prev) => ({ ...prev, specificAddress: mapped.specificAddress }));
            setLocationMessage("Đã lấy được vị trí hiện tại và gợi ý địa chỉ từ bản đồ.");
            return;
          }

          setLocationMessage("Đã lấy được vị trí hiện tại. Vui lòng chọn tỉnh, quận/huyện, phường/xã và nhập địa chỉ cụ thể.");
        } catch {
          setLocationMessage("Đã lấy được vị trí hiện tại. Vui lòng chọn tỉnh, quận/huyện, phường/xã và nhập địa chỉ cụ thể.");
        } finally {
          setLoadingLoc(false);
        }
      },
      (geoError) => {
        const denied = geoError?.code === geoError?.PERMISSION_DENIED;
        setLocationMessage(
          denied ? "Bạn chưa cấp quyền truy cập vị trí." : "Không thể xác định vị trí hiện tại. Vui lòng nhập địa chỉ thủ công.",
        );
        setLoadingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
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
        <div className="page-header">
          <div className="header-content">
            <h1>Sổ địa chỉ 📍</h1>
            <p>Quản lý nơi nhận món ngon của bạn</p>
          </div>
          <button className="btn-add-new" onClick={handleAddNew}>
            <div className="icon-wrap"><Plus size={20} /></div>
            <span>Thêm địa chỉ mới</span>
          </button>
        </div>

        {formError && !showModal && <div className="address-page-error" role="alert">{formError}</div>}

        {loading ? (
          <div className="address-list-wrapper">
            {[0, 1].map((item) => <div key={item} className="address-card-item skeleton-card" />)}
          </div>
        ) : error ? (
          <div className="empty-state error-state">
            <div className="empty-icon"><MapPin size={48} /></div>
            <h3>Không thể tải sổ địa chỉ</h3>
            <p>{error.message}</p>
            <button className="btn-add-new" onClick={() => refetch()}>Thử lại</button>
          </div>
        ) : addresses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><MapPin size={48} /></div>
            <h3>Chưa có địa chỉ nào</h3>
            <p>Hãy thêm địa chỉ để chúng tôi giao hàng nhanh nhất nhé!</p>
          </div>
        ) : (
          <div className="address-list-wrapper">
            {addresses.map((item) => (
              <div key={item.id} className={`address-card-item ${item.isDefault ? "active" : ""}`}>
                {item.isDefault && <div className="badge-corner"><Star size={12} fill="currentColor" /> Mặc định</div>}

                <div className="address-card-body">
                  <div className={`address-icon-box ${item.label}`}>{getIconByLabel(item.label)}</div>
                  <div className="address-info-box">
                    <div className="user-line">
                      <span className="name">{item.receiverName}</span>
                      <span className="phone">{item.phone}</span>
                    </div>
                    <p className="address-text">{item.fullAddress}</p>
                    {item.note && <p className="note-text">📝 {item.note}</p>}
                  </div>
                </div>

                <div className="address-card-footer">
                  <div className="actions-left">
                    {!item.isDefault && (
                      <button className="btn-text-default" disabled={settingDefault} onClick={() => handleSetDefault(item.id)}>
                        Đặt làm mặc định
                      </button>
                    )}
                  </div>
                  <div className="actions-right">
                    <button className="btn-circle edit" onClick={() => handleEdit(item)}><Edit3 size={16} /></button>
                    {!item.isDefault && (
                      <button className="btn-circle delete" disabled={deleting} onClick={() => handleDelete(item.id)}><Trash2 size={16} /></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="addr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditing ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}</h2>
              <button className="btn-close-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>

            <div className="modal-body">
              <div className="form-section">
                <div className="form-grid">
                  <div className="input-group">
                    <label>Họ và tên</label>
                    <div className="input-wrapper">
                      <User size={18} />
                      <input
                        type="text"
                        placeholder="VD: Nguyễn Văn A"
                        value={formData.receiverName}
                        onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })}
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
                        onChange={(e) => {
                          setFieldErrors((prev) => ({ ...prev, phone: "" }));
                          setFormData({ ...formData, phone: e.target.value });
                        }}
                      />
                    </div>
                    {fieldErrors.phone && <span className="input-error-text">{fieldErrors.phone}</span>}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="geo-header">
                  <label>Khu vực vận chuyển</label>
                  <button type="button" className="btn-geo-sm" onClick={handleGetCurrentLocation} disabled={loadingLoc || locationDataLoading}>
                    {loadingLoc ? "Đang tìm..." : "📍 Định vị tôi"}
                  </button>
                </div>

                <p className="geo-inline-message" role="status">
                  {locationMessage || getLocationSourceMessage(locationSource, locationDataLoading)}
                </p>

                <div className="geo-grid">
                  <div className="select-wrapper">
                    <select value={geo.province} onChange={handleProvinceChange} disabled={locationDataLoading}>
                      <option value="">-- Tỉnh/Thành --</option>
                      {provinceOptions.map((key) => (
                        <option key={key} value={key}>{locationData[key].name}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-arrow" />
                  </div>

                  <div className={`select-wrapper ${!geo.province ? "disabled" : ""}`}>
                    <select value={geo.district} onChange={handleDistrictChange} disabled={!geo.province}>
                      <option value="">-- Quận/Huyện --</option>
                      {Object.keys(districtOptions).map((key) => (
                        <option key={key} value={key}>{districtOptions[key].name}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="select-arrow" />
                  </div>

                  <div className={`select-wrapper ${!geo.district ? "disabled" : ""}`}>
                    <select value={geo.ward} onChange={(e) => setGeo({ ...geo, ward: e.target.value })} disabled={!geo.district}>
                      <option value="">-- Phường/Xã --</option>
                      {wardOptions.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                    <ChevronDown size={16} className="select-arrow" />
                  </div>
                </div>

                <div className="input-group mt-3">
                  <div className="input-wrapper textarea-wrapper">
                    <MapPin size={18} className="mt-1" />
                    <textarea
                      rows="2"
                      placeholder="Số nhà, tên đường, tòa nhà..."
                      value={formData.specificAddress}
                      onChange={(e) => setFormData({ ...formData, specificAddress: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="input-group">
                  <label>Ghi chú (Tùy chọn)</label>
                  <div className="input-wrapper">
                    <Edit3 size={18} />
                    <input
                      type="text"
                      placeholder="VD: Gọi trước khi giao, cổng sau..."
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    />
                  </div>
                </div>

                <div className="label-row">
                  <div className="pills">
                    {["home", "office", "other"].map((type) => (
                      <button key={type} className={`pill ${formData.label === type ? "selected" : ""}`} onClick={() => setFormData({ ...formData, label: type })}>
                        {getIconByLabel(type)}
                        <span>{type === "home" ? "Nhà riêng" : type === "office" ? "Văn phòng" : "Khác"}</span>
                      </button>
                    ))}
                  </div>
                  {!isEditing && (
                    <label className="checkbox-styled">
                      <input type="checkbox" checked={formData.isDefault} onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })} />
                      <span className="checkmark"><CheckCircle size={14} /></span>
                      <span>Mặc định</span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-text" onClick={() => setShowModal(false)}>Hủy bỏ</button>
              {formError && <p className="modal-error-text">{formError}</p>}
              <button className="btn-primary" onClick={handleSave} disabled={creating || updating || locationDataLoading}>
                {creating || updating ? "Đang lưu..." : "Hoàn tất"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressPage;
