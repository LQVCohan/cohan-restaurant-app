from pathlib import Path


def replace(path, old, new, expected=1):
    file_path = Path(path)
    content = file_path.read_text(encoding="utf-8")
    count = content.count(old)
    if count != expected:
        raise RuntimeError(f"{path}: expected {expected} matches, found {count}")
    file_path.write_text(content.replace(old, new), encoding="utf-8")


manager = "src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx"
replace(
    manager,
    """  CreditCardOutlined,\n  FileTextOutlined,\n} from \"@ant-design/icons\";""",
    """  CreditCardOutlined,\n  FileTextOutlined,\n  AimOutlined,\n  UserOutlined,\n} from \"@ant-design/icons\";""",
)
replace(
    manager,
    """  story: \"\",\n  chef: \"\",\n  dressCode: \"\",""",
    """  story: \"\",\n  chef: \"\",\n  chefTitle: \"\",\n  chefBio: \"\",\n  chefStaffId: \"\",\n  dressCode: \"\",""",
)
replace(
    manager,
    """    story: (source.story || \"\").trimStart(),\n    chef: (source.chef || \"\").trimStart(),\n    dressCode: (source.dressCode || \"\").trim(),""",
    """    story: (source.story || \"\").trimStart(),\n    chef: (source.chef || \"\").trimStart(),\n    chefTitle: (source.chefTitle || \"\").trim(),\n    chefBio: (source.chefBio || \"\").trimStart(),\n    chefStaffId: String(source.chefStaffId || \"\").trim(),\n    dressCode: (source.dressCode || \"\").trim(),""",
)
replace(
    manager,
    """      { key: \"story\", label: \"Câu chuyện thương hiệu\", done: Boolean(restaurantForm.customerInfo?.story?.trim()) },\n    ];""",
    """      { key: \"story\", label: \"Câu chuyện thương hiệu\", done: Boolean(restaurantForm.customerInfo?.story?.trim()) },\n      { key: \"chef\", label: \"Bếp trưởng thương hiệu\", done: Boolean(restaurantForm.customerInfo?.chef?.trim()) },\n    ];""",
)
replace(
    manager,
    """  const onSelectChef = (staff) => {\n    if (!staff) return;\n    updateCustomerInfoField(\"chef\", staff.fullName || \"\");\n    setChefPickerOpen(false);\n    message.success(`Đã chọn bếp trưởng: ${staff.fullName}`);\n  };""",
    """  const onSelectChef = (staff) => {\n    if (!staff) return;\n    setRestaurantForm((prev) => ({\n      ...prev,\n      customerInfo: {\n        ...prev.customerInfo,\n        chef: staff.fullName || \"\",\n        chefTitle:\n          staff.positionTitle || staff.roleName || prev.customerInfo?.chefTitle || \"Bếp trưởng điều hành\",\n        chefStaffId: staff.id || \"\",\n      },\n    }));\n    setChefPickerOpen(false);\n    message.success(`Đã chọn bếp trưởng: ${staff.fullName}`);\n  };""",
)
replace(
    manager,
    """      chef: normalizedCustomerInfo.chef || \"\",\n      suitableFor: normalizedCustomerInfo.suitableFor || [],""",
    """      chef: normalizedCustomerInfo.chef || \"\",\n      chefTitle: normalizedCustomerInfo.chefTitle || \"\",\n      chefBio: normalizedCustomerInfo.chefBio || \"\",\n      suitableFor: normalizedCustomerInfo.suitableFor || [],""",
)
replace(
    manager,
    """                  <Form.Item label=\"Bếp trưởng điều hành\">\n                    <Space.Compact style={{ width: \"100%\" }}>\n                      <Input\n                        value={restaurantForm.customerInfo?.chef || \"\"}\n                        onChange={(e) =>\n                          updateCustomerInfoField(\"chef\", e.target.value)\n                        }\n                        placeholder=\"Chọn từ nhân viên hoặc nhập tên bếp trưởng\"\n                      />\n                      <Button onClick={() => setChefPickerOpen(true)}>\n                        Chọn từ nhân viên\n                      </Button>\n                    </Space.Compact>\n                  </Form.Item>""",
    """                  <Form.Item label=\"Bếp trưởng thương hiệu\" className=\"brand-chef-form-item\">\n                    <div className=\"brand-chef-editor\">\n                      <div className=\"brand-chef-editor__header\">\n                        <span className=\"brand-chef-editor__icon\" aria-hidden=\"true\">\n                          <UserOutlined />\n                        </span>\n                        <div>\n                          <strong>Gương mặt dẫn dắt gian bếp</strong>\n                          <Text type=\"secondary\">\n                            Thông tin này sẽ xuất hiện trong trang giới thiệu nhà hàng.\n                          </Text>\n                        </div>\n                        <Button\n                          icon={<UserOutlined />}\n                          onClick={() => setChefPickerOpen(true)}\n                        >\n                          Chọn từ nhân viên\n                        </Button>\n                      </div>\n\n                      <Row gutter={[12, 12]} className=\"brand-chef-editor__grid\">\n                        <Col xs={24} md={12}>\n                          <label className=\"brand-chef-editor__label\" htmlFor=\"brand-chef-name\">\n                            Họ và tên\n                          </label>\n                          <Input\n                            id=\"brand-chef-name\"\n                            value={restaurantForm.customerInfo?.chef || \"\"}\n                            onChange={(e) => updateCustomerInfoField(\"chef\", e.target.value)}\n                            placeholder=\"Ví dụ: Nguyễn Minh An\"\n                          />\n                        </Col>\n                        <Col xs={24} md={12}>\n                          <label className=\"brand-chef-editor__label\" htmlFor=\"brand-chef-title\">\n                            Chức danh hiển thị\n                          </label>\n                          <Input\n                            id=\"brand-chef-title\"\n                            value={restaurantForm.customerInfo?.chefTitle || \"\"}\n                            onChange={(e) => updateCustomerInfoField(\"chefTitle\", e.target.value)}\n                            placeholder=\"Bếp trưởng điều hành\"\n                          />\n                        </Col>\n                      </Row>\n\n                      <label className=\"brand-chef-editor__label\" htmlFor=\"brand-chef-bio\">\n                        Dấu ấn ẩm thực / giới thiệu ngắn\n                      </label>\n                      <TextArea\n                        id=\"brand-chef-bio\"\n                        rows={3}\n                        maxLength={420}\n                        showCount\n                        value={restaurantForm.customerInfo?.chefBio || \"\"}\n                        onChange={(e) => updateCustomerInfoField(\"chefBio\", e.target.value)}\n                        placeholder=\"Tóm tắt kinh nghiệm, phong cách hoặc món ăn tạo nên dấu ấn của bếp trưởng\"\n                      />\n                    </div>\n                  </Form.Item>""",
)
replace(
    manager,
    """                        icon={<EnvironmentOutlined />}\n                        onClick={fillCurrentLocation}""",
    """                        icon={<AimOutlined />}\n                        onClick={fillCurrentLocation}""",
)

map_js = "src/utils/installRestaurantInfoMapEnhancement.js"
replace(
    map_js,
    """import L from \"leaflet\";\nimport \"leaflet/dist/leaflet.css\";\nimport markerIcon2x from \"leaflet/dist/images/marker-icon-2x.png\";\nimport markerIcon from \"leaflet/dist/images/marker-icon.png\";\nimport markerShadow from \"leaflet/dist/images/marker-shadow.png\";""",
    """import L from \"leaflet\";\nimport \"leaflet/dist/leaflet.css\";""",
)
replace(
    map_js,
    """L.Icon.Default.mergeOptions({\n  iconRetinaUrl: markerIcon2x,\n  iconUrl: markerIcon,\n  shadowUrl: markerShadow,\n});""",
    """const RESTAURANT_MARKER_ICON = L.divIcon({\n  className: \"restaurant-location-marker\",\n  html: '<span class=\"restaurant-location-marker__pin\" aria-hidden=\"true\"><span></span></span>',\n  iconSize: [38, 46],\n  iconAnchor: [19, 44],\n  popupAnchor: [0, -40],\n});""",
)
replace(
    map_js,
    """    state.marker = L.marker([pair.lat, pair.lng], { draggable: true }).addTo(\n      state.map,\n    );""",
    """    state.marker = L.marker([pair.lat, pair.lng], {\n      draggable: true,\n      icon: RESTAURANT_MARKER_ICON,\n    }).addTo(state.map);""",
)

map_test = "src/utils/installRestaurantInfoMapEnhancement.test.js"
replace(
    map_test,
    """    markerFactory: vi.fn(() => marker),\n    tileAddTo: vi.fn(),\n    mergeOptions: vi.fn(),""",
    """    markerFactory: vi.fn(() => marker),\n    markerIcon: { kind: \"restaurant-location-marker\" },\n    divIconFactory: vi.fn(),\n    tileAddTo: vi.fn(),""",
)
replace(
    map_test,
    """vi.mock(\"leaflet\", () => ({\n  default: {\n    Icon: { Default: { mergeOptions: leafletState.mergeOptions } },\n    map: leafletState.mapFactory,\n    marker: leafletState.markerFactory,\n    tileLayer: vi.fn(() => ({ addTo: leafletState.tileAddTo })),\n  },\n}));""",
    """vi.mock(\"leaflet\", () => {\n  leafletState.divIconFactory.mockReturnValue(leafletState.markerIcon);\n  return {\n    default: {\n      divIcon: leafletState.divIconFactory,\n      map: leafletState.mapFactory,\n      marker: leafletState.markerFactory,\n      tileLayer: vi.fn(() => ({ addTo: leafletState.tileAddTo })),\n    },\n  };\n});""",
)
replace(
    map_test,
    """    expect(leafletState.markerFactory).toHaveBeenCalledWith(\n      [10.895109, 106.833394],\n      { draggable: true },\n    );""",
    """    expect(leafletState.divIconFactory).toHaveBeenCalledWith(\n      expect.objectContaining({ className: \"restaurant-location-marker\" }),\n    );\n    expect(leafletState.markerFactory).toHaveBeenCalledWith(\n      [10.895109, 106.833394],\n      { draggable: true, icon: leafletState.markerIcon },\n    );""",
)

manager_css = "src/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoPremiumLayout.css"
Path(manager_css).write_text(
    Path(manager_css).read_text(encoding="utf-8")
    + """\n\n/* Brand chef editor */\n.manager-layout .restaurant-management-container .brand-chef-form-item {\n  margin-top: 2px;\n}\n\n.manager-layout .restaurant-management-container .brand-chef-editor {\n  display: grid;\n  gap: 14px;\n  padding: 18px;\n  border: 1px solid var(--ri-qc-line);\n  border-radius: 18px;\n  background:\n    radial-gradient(circle at 100% 0, rgba(47, 125, 104, 0.1), transparent 16rem),\n    rgba(255, 255, 255, 0.82);\n  box-shadow: 0 10px 24px rgba(48, 72, 61, 0.07);\n}\n\n.manager-layout .restaurant-management-container .brand-chef-editor__header {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr) auto;\n  align-items: center;\n  gap: 12px;\n}\n\n.manager-layout .restaurant-management-container .brand-chef-editor__header > div {\n  display: grid;\n  gap: 2px;\n}\n\n.manager-layout .restaurant-management-container .brand-chef-editor__header strong {\n  color: var(--ri-qc-ink);\n  font-size: 0.9rem;\n  font-weight: 800;\n}\n\n.manager-layout .restaurant-management-container .brand-chef-editor__header .ant-typography {\n  margin: 0;\n  line-height: 1.45;\n}\n\n.manager-layout .restaurant-management-container .brand-chef-editor__icon {\n  width: 40px;\n  height: 40px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  border-radius: 13px;\n  background: var(--ri-qc-accent-soft);\n  color: var(--ri-qc-accent);\n  font-size: 1.1rem;\n}\n\n.manager-layout .restaurant-management-container .brand-chef-editor__label {\n  display: block;\n  margin-bottom: 6px;\n  color: var(--ri-qc-ink);\n  font-size: 0.78rem;\n  font-weight: 720;\n}\n\n.manager-layout .restaurant-management-container .brand-chef-editor__grid {\n  margin-bottom: 0;\n}\n\n.manager-layout .restaurant-management-container .restaurant-location-marker.leaflet-div-icon {\n  border: 0;\n  background: transparent;\n}\n\n.manager-layout .restaurant-management-container .restaurant-location-marker__pin {\n  position: relative;\n  display: block;\n  width: 34px;\n  height: 34px;\n  border: 3px solid #fff;\n  border-radius: 50% 50% 50% 0;\n  background: var(--ri-qc-accent);\n  box-shadow: 0 10px 20px rgba(27, 74, 62, 0.32);\n  transform: rotate(-45deg);\n}\n\n.manager-layout .restaurant-management-container .restaurant-location-marker__pin > span {\n  position: absolute;\n  width: 10px;\n  height: 10px;\n  inset: 50% auto auto 50%;\n  border-radius: 50%;\n  background: #fff;\n  transform: translate(-50%, -50%);\n}\n\n@media (max-width: 640px) {\n  .manager-layout .restaurant-management-container .brand-chef-editor__header {\n    grid-template-columns: auto minmax(0, 1fr);\n  }\n\n  .manager-layout .restaurant-management-container .brand-chef-editor__header > .ant-btn {\n    grid-column: 1 / -1;\n    width: 100%;\n  }\n}\n""",
    encoding="utf-8",
)

public_detail = "src/components/Customer/RestaurantDetail/RestaurantDetail.jsx"
replace(
    public_detail,
    """      description\n      cuisineType""",
    """      description\n      openingHours\n      amenities\n      notesOnAmenities\n      cuisineType""",
)

public_info = "src/components/Customer/RestaurantDetail/components/RestaurantInfo/RestaurantInfo.jsx"
replace(
    public_info,
    """import { Clock, Info, MapPin, Phone, ShieldCheck, Sparkles } from \"lucide-react\";""",
    """import { ChefHat, Clock, Info, MapPin, Phone, ShieldCheck, Sparkles } from \"lucide-react\";""",
)
replace(
    public_info,
    """const getDirectionsUrl = (address, addressText) => {\n  if (address?.lat && address?.lng) {\n    return `${MAPS_BASE_URL}${address.lat},${address.lng}`;\n  }\n  if (!addressText) return \"\";\n  return `${MAPS_BASE_URL}${encodeURIComponent(addressText)}`;\n};\n\nconst RestaurantInfo = ({ restaurant, isPreviewMode = false }) => {""",
    """const getDirectionsUrl = (address, addressText) => {\n  if (address?.lat && address?.lng) {\n    return `${MAPS_BASE_URL}${address.lat},${address.lng}`;\n  }\n  if (!addressText) return \"\";\n  return `${MAPS_BASE_URL}${encodeURIComponent(addressText)}`;\n};\n\nconst parseCustomerInfo = (value) => {\n  if (!value) return {};\n  if (typeof value === \"object\") return value;\n  try {\n    const parsed = JSON.parse(value);\n    return parsed && typeof parsed === \"object\" ? parsed : {};\n  } catch {\n    return {};\n  }\n};\n\nconst RestaurantInfo = ({ restaurant, isPreviewMode = false }) => {""",
)
replace(
    public_info,
    """  const directionsUrl = getDirectionsUrl(restaurant?.address, addressText);\n  const tableSpaceUrl = restaurant?.id && !isPreviewMode""",
    """  const directionsUrl = getDirectionsUrl(restaurant?.address, addressText);\n  const customerInfo = parseCustomerInfo(restaurant?.notesOnAmenities);\n  const chefName = String(customerInfo.chef || restaurant?.chef || \"\").trim();\n  const chefTitle = String(customerInfo.chefTitle || restaurant?.chefTitle || \"Bếp trưởng điều hành\").trim();\n  const chefBio = String(customerInfo.chefBio || restaurant?.chefBio || \"\").trim();\n  const tableSpaceUrl = restaurant?.id && !isPreviewMode""",
)
replace(
    public_info,
    """      </section>\n\n      <section className=\"info-card\">\n        <div className=\"title-row\">\n          <span className=\"title-icon\"><Clock size={15} /></span>""",
    """      </section>\n\n      {chefName && (\n        <section className=\"info-card info-card--chef\">\n          <div className=\"title-row\">\n            <span className=\"title-icon\"><ChefHat size={16} /></span>\n            <div>\n              <span className=\"chef-eyebrow\">Gương mặt thương hiệu</span>\n              <h4>Bếp trưởng thương hiệu</h4>\n            </div>\n          </div>\n          <div className=\"chef-profile\">\n            <div className=\"chef-monogram\" aria-hidden=\"true\">\n              {chefName.charAt(0).toUpperCase()}\n            </div>\n            <div>\n              <strong>{chefName}</strong>\n              <span>{chefTitle || \"Bếp trưởng điều hành\"}</span>\n              {chefBio && <p>{chefBio}</p>}\n            </div>\n          </div>\n        </section>\n      )}\n\n      <section className=\"info-card\">\n        <div className=\"title-row\">\n          <span className=\"title-icon\"><Clock size={15} /></span>""",
)

public_css = "src/components/Customer/RestaurantDetail/components/RestaurantInfo/RestaurantInfo.scss"
replace(
    public_css,
    """  .info-card--intro {\n    grid-column: 1 / -1;""",
    """  .info-card--intro,\n  .info-card--chef {\n    grid-column: 1 / -1;\n  }\n\n  .info-card--intro {""",
)
replace(
    public_css,
    """  .title-row {\n    display: flex;""",
    """  .info-card--chef {\n    border-color: #c7ded3;\n    background:\n      radial-gradient(circle at 100% 0, rgba(47, 125, 104, 0.12), transparent 18rem),\n      linear-gradient(135deg, #fbfefc 0%, #edf6f1 100%);\n  }\n\n  .info-card--chef .title-icon {\n    background: #dfeee7;\n    color: #2f7d68;\n  }\n\n  .chef-eyebrow {\n    display: block;\n    margin-bottom: 1px;\n    color: #527064;\n    font-size: 0.7rem;\n    font-weight: 800;\n    letter-spacing: 0.08em;\n    text-transform: uppercase;\n  }\n\n  .chef-profile {\n    display: grid;\n    grid-template-columns: auto minmax(0, 1fr);\n    gap: 13px;\n    align-items: start;\n  }\n\n  .chef-profile > div:last-child {\n    display: grid;\n    gap: 3px;\n  }\n\n  .chef-profile strong {\n    color: #17332a;\n    font-size: 1.02rem;\n  }\n\n  .chef-profile span {\n    color: #527064;\n    font-size: 0.84rem;\n    font-weight: 700;\n  }\n\n  .chef-profile p {\n    margin-top: 6px;\n    max-width: 68ch;\n    line-height: 1.6;\n  }\n\n  .chef-monogram {\n    width: 46px;\n    height: 46px;\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    border: 1px solid #b9d3c7;\n    border-radius: 15px;\n    background: #fff;\n    color: #2f7d68;\n    font-size: 1.1rem;\n    font-weight: 850;\n    box-shadow: 0 8px 18px rgba(47, 125, 104, 0.12);\n  }\n\n  .title-row {\n    display: flex;""",
)

print("Applied restaurant chef and map polish patch")
