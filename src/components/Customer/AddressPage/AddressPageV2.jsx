import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import { Briefcase, CheckCircle, ChevronDown, Edit3, Home, MapPin, Phone, Plus, Star, Trash2, User, X } from "lucide-react";
import { reverseGeocodeCoordinates } from "../../../lib/reverseGeocode";
import { isValidPhoneNumber, normalizePhoneNumber } from "../../../utils/phoneNumber";
import { getFallbackLocationData, loadVietnamLocationData, mapReverseGeocodeToGeo } from "../../../data/vietnamLocationData";
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
    deleteCustomerAddress(id: $id)
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

const EMPTY_FORM = {
  id: null,
  label: "home",
  receiverName: "",
  phone: "",
  note: "",
  isDefault: false,
  specificAddress: "",
};

const EMPTY_GEO = { province: "", district: "", ward: "" };

const getIconByLabel = (label) => {
  if (label === "home") return <Home size={18} aria-hidden="true" />;
  if (label === "office") return <Briefcase size={18} aria-hidden="true" />;
  return <MapPin size={18} aria-hidden="true" />;
};

const getLabelText = (label) => {
  if (label === "home") return "Nhà riêng";
  if (label === "office") return "Văn phòng";
  return "Khác";
};

const getLocationSourceMessage = (source, loading) => {
  if (loading) return "Đang tải dữ liệu tỉnh/quận/phường...";
  if (source === "remote") return "Đã tải dữ liệu địa chỉ từ nguồn chuẩn.";
  return "Đang dùng dữ liệu địa chỉ dự phòng. Nếu chưa thấy khu vực, hãy nhập địa chỉ cụ thể rõ hơn.";
};

export default function AddressPageV2() {
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
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [geo, setGeo] = useState(EMPTY_GEO);
  const [locationData, setLocationData] = useState(() => getFallbackLocationData());
  const [locationSource, setLocationSource] = useState("fallback");
  const [locationDataLoading, setLocationDataLoading] = useState(false);

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
  const districtOptions = useMemo(() => (geo.province ? locationData?.[geo.province]?.districts || {} : {}), [geo.province, locationData]);
  const wardOptions = useMemo(
    () => (geo.province && geo.district ? locationData?.[geo.province]?.districts?.[geo.district]?.wards || [] : []),
    [geo.district, geo.province, locationData],
  );

  const openCreateModal = () => {
    setIsEditing(false);
    setFormData({ ...EMPTY_FORM, id: Date.now() });
    setGeo(EMPTY_GEO);
    setFormError("");
    setFieldErrors({});
    setLocationMessage("");
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setIsEditing(true);
    setFormData({
      id: item.id,
      label: item.label || "home",
      receiverName: item.receiverName || item.name || "",
      phone: item.phone || "",
      note: item.note || "",
      isDefault: !!item.isDefault,
      specificAddress: item.specificAddress || "",
    });
    setGeo({ province: item.province || "", district: item.district || "", ward: item.ward || "" });
    setFormError("");
    setFieldErrors({});
    setLocationMessage("");
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
    const fullAddress = `${formData.specificAddress}, ${geo.ward}, ${districtName}, ${provinceName}`;
    const input = {
      label: formData.label,
      receiverName: formData.receiverName,
      phone: normalizedPhone,
      note: formData.note,
      isDefault: formData.isDefault,
      province: geo.province,
      district: geo.district,
      ward: geo.ward,
      fullAddress,
      specificAddress: formData.specificAddress,
    };

    try {
      if (isEditing) await updateAddress({ variables: { id: formData.id, input } });
      else await createAddress({ variables: { input } });
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
      return;
    }
    setLoadingLoc(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const latitude = Number(position?.coords?.latitude);
          const longitude = Number(position?.coords?.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error("invalid_coordinates");

          const address = await reverseGeocodeCoordinates({
            lat: latitude,
            lng: longitude,
          });
          const mapped = mapReverseGeocodeToGeo(address, locationData);
          if (mapped.province && mapped.district && mapped.ward) {
            setGeo({ province: mapped.province, district: mapped.district, ward: mapped.ward });
            if (mapped.specificAddress) setFormData((prev) => ({ ...prev, specificAddress: mapped.specificAddress }));
            setLocationMessage("Đã lấy được vị trí hiện tại và gợi ý địa chỉ từ bản đồ.");
          } else {
            setLocationMessage("Đã lấy được vị trí hiện tại. Vui lòng chọn khu vực và nhập địa chỉ cụ thể.");
          }
        } catch {
          setLocationMessage("Đã lấy được vị trí hiện tại. Vui lòng chọn khu vực và nhập địa chỉ cụ thể.");
        } finally {
          setLoadingLoc(false);
        }
      },
      (geoError) => {
        setLocationMessage(geoError?.code === geoError?.PERMISSION_DENIED ? "Bạn chưa cấp quyền truy cập vị trí." : "Không thể xác định vị trí hiện tại.");
        setLoadingLoc(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <main className="address-page" aria-labelledby="address-page-title">
      <div className="addr-container">
        <section className="page-header" aria-labelledby="address-page-title">
          <div className="header-content">
            <h1 id="address-page-title">Sổ địa chỉ 📍</h1>
            <p>Quản lý nơi nhận món ngon của bạn</p>
          </div>
          <button type="button" className="btn-add-new" onClick={openCreateModal}>
            <div className="icon-wrap" aria-hidden="true"><Plus size={20} aria-hidden="true" /></div>
            <span>Thêm địa chỉ mới</span>
          </button>
        </section>

        {formError && !showModal && <div className="address-page-error" role="alert">{formError}</div>}

        {loading ? (
          <div className="address-list-wrapper" role="status" aria-live="polite" aria-label="Đang tải sổ địa chỉ">
            {[0, 1].map((item) => <div key={item} className="address-card-item skeleton-card" />)}
          </div>
        ) : error ? (
          <div className="empty-state error-state" role="alert">
            <div className="empty-icon" aria-hidden="true"><MapPin size={48} aria-hidden="true" /></div>
            <h2>Không thể tải sổ địa chỉ</h2>
            <p>{error.message}</p>
            <button type="button" className="btn-add-new" onClick={() => refetch()}>Thử lại</button>
          </div>
        ) : addresses.length === 0 ? (
          <div className="empty-state" role="status">
            <div className="empty-icon" aria-hidden="true"><MapPin size={48} aria-hidden="true" /></div>
            <h2>Chưa có địa chỉ nào</h2>
            <p>Hãy thêm địa chỉ để chúng tôi giao hàng nhanh nhất nhé.</p>
          </div>
        ) : (
          <section className="address-list-wrapper" aria-label="Danh sách địa chỉ giao hàng">
            {addresses.map((item) => (
              <article key={item.id} className={`address-card-item ${item.isDefault ? "active" : ""}`} aria-label={`${item.receiverName}, ${item.fullAddress}`}>
                {item.isDefault && <div className="badge-corner"><Star size={12} fill="currentColor" aria-hidden="true" /> Mặc định</div>}
                <div className="address-card-body">
                  <div className={`address-icon-box ${item.label}`} aria-hidden="true">{getIconByLabel(item.label)}</div>
                  <div className="address-info-box">
                    <div className="user-line"><span className="name">{item.receiverName}</span><span className="phone">{item.phone}</span></div>
                    <p className="address-text">{item.fullAddress}</p>
                    {item.note && <p className="note-text">📝 {item.note}</p>}
                  </div>
                </div>
                <div className="address-card-footer">
                  <div className="actions-left">
                    {!item.isDefault && <button type="button" className="btn-text-default" disabled={settingDefault} onClick={() => handleSetDefault(item.id)}>Đặt làm mặc định</button>}
                  </div>
                  <div className="actions-right">
                    <button type="button" className="btn-circle edit" onClick={() => openEditModal(item)} aria-label={`Sửa địa chỉ của ${item.receiverName}`}><Edit3 size={16} aria-hidden="true" /></button>
                    {!item.isDefault && <button type="button" className="btn-circle delete" disabled={deleting} onClick={() => handleDelete(item.id)} aria-label={`Xóa địa chỉ của ${item.receiverName}`}><Trash2 size={16} aria-hidden="true" /></button>}
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" role="presentation" onClick={() => setShowModal(false)}>
          <section className="addr-modal" role="dialog" aria-modal="true" aria-labelledby="address-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="address-modal-title">{isEditing ? "Cập nhật địa chỉ" : "Thêm địa chỉ mới"}</h2>
              <button type="button" className="btn-close-icon" onClick={() => setShowModal(false)} aria-label="Đóng form địa chỉ"><X size={20} aria-hidden="true" /></button>
            </div>

            <div className="modal-body">
              <div className="form-section">
                <div className="form-grid">
                  <div className="input-group">
                    <label htmlFor="address-receiver-name">Họ và tên</label>
                    <div className="input-wrapper"><User size={18} aria-hidden="true" /><input id="address-receiver-name" type="text" placeholder="VD: Nguyễn Văn A" value={formData.receiverName} onChange={(e) => setFormData({ ...formData, receiverName: e.target.value })} /></div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="address-phone">Số điện thoại</label>
                    <div className="input-wrapper"><Phone size={18} aria-hidden="true" /><input id="address-phone" type="text" inputMode="tel" placeholder="09xx..." value={formData.phone} aria-invalid={!!fieldErrors.phone} aria-describedby={fieldErrors.phone ? "address-phone-error" : undefined} onChange={(e) => { setFieldErrors((prev) => ({ ...prev, phone: "" })); setFormData({ ...formData, phone: e.target.value }); }} /></div>
                    {fieldErrors.phone && <span className="input-error-text" id="address-phone-error" role="alert">{fieldErrors.phone}</span>}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="geo-header">
                  <label id="address-region-label">Khu vực vận chuyển</label>
                  <button type="button" className="btn-geo-sm" onClick={handleGetCurrentLocation} disabled={loadingLoc || locationDataLoading}>{loadingLoc ? "Đang tìm..." : "📍 Định vị tôi"}</button>
                </div>
                <p className="geo-inline-message" role="status" aria-live="polite">{locationMessage || getLocationSourceMessage(locationSource, locationDataLoading)}</p>
                <div className="geo-grid" aria-labelledby="address-region-label">
                  <div className="select-wrapper">
                    <select aria-label="Tỉnh hoặc thành phố" value={geo.province} onChange={(e) => setGeo({ province: e.target.value, district: "", ward: "" })} disabled={locationDataLoading}>
                      <option value="">-- Tỉnh/Thành --</option>
                      {provinceOptions.map((key) => <option key={key} value={key}>{locationData[key].name}</option>)}
                    </select>
                    <ChevronDown size={16} className="select-arrow" aria-hidden="true" />
                  </div>
                  <div className={`select-wrapper ${!geo.province ? "disabled" : ""}`}>
                    <select aria-label="Quận hoặc huyện" value={geo.district} onChange={(e) => setGeo({ ...geo, district: e.target.value, ward: "" })} disabled={!geo.province}>
                      <option value="">-- Quận/Huyện --</option>
                      {Object.keys(districtOptions).map((key) => <option key={key} value={key}>{districtOptions[key].name}</option>)}
                    </select>
                    <ChevronDown size={16} className="select-arrow" aria-hidden="true" />
                  </div>
                  <div className={`select-wrapper ${!geo.district ? "disabled" : ""}`}>
                    <select aria-label="Phường hoặc xã" value={geo.ward} onChange={(e) => setGeo({ ...geo, ward: e.target.value })} disabled={!geo.district}>
                      <option value="">-- Phường/Xã --</option>
                      {wardOptions.map((ward) => <option key={ward} value={ward}>{ward}</option>)}
                    </select>
                    <ChevronDown size={16} className="select-arrow" aria-hidden="true" />
                  </div>
                </div>
                <div className="input-group mt-3">
                  <label htmlFor="address-specific" className="sr-only">Địa chỉ cụ thể</label>
                  <div className="input-wrapper textarea-wrapper"><MapPin size={18} className="mt-1" aria-hidden="true" /><textarea id="address-specific" rows="2" placeholder="Số nhà, tên đường, tòa nhà..." value={formData.specificAddress} onChange={(e) => setFormData({ ...formData, specificAddress: e.target.value })} /></div>
                </div>
              </div>

              <div className="form-section">
                <div className="input-group">
                  <label htmlFor="address-note">Ghi chú (Tùy chọn)</label>
                  <div className="input-wrapper"><Edit3 size={18} aria-hidden="true" /><input id="address-note" type="text" placeholder="VD: Gọi trước khi giao, cổng sau..." value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} /></div>
                </div>
                <div className="label-row">
                  <div className="pills" aria-label="Loại địa chỉ">
                    {["home", "office", "other"].map((type) => (
                      <button type="button" key={type} className={`pill ${formData.label === type ? "selected" : ""}`} aria-pressed={formData.label === type} onClick={() => setFormData({ ...formData, label: type })}>{getIconByLabel(type)}<span>{getLabelText(type)}</span></button>
                    ))}
                  </div>
                  {!isEditing && <label className="checkbox-styled"><input type="checkbox" checked={formData.isDefault} onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })} /><span className="checkmark" aria-hidden="true"><CheckCircle size={14} aria-hidden="true" /></span><span>Mặc định</span></label>}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-text" onClick={() => setShowModal(false)}>Hủy bỏ</button>
              {formError && <p className="modal-error-text" role="alert">{formError}</p>}
              <button type="button" className="btn-primary" onClick={handleSave} disabled={creating || updating || locationDataLoading}>{creating || updating ? "Đang lưu..." : "Hoàn tất"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
