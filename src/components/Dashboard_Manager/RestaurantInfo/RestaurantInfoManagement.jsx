import React, { useEffect, useMemo, useRef, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  Card,
  Select,
  Input,
  Button,
  Tag,
  Row,
  Col,
  Form,
  Switch,
  message,
  Typography,
  Space,
  Tabs,
  Skeleton,
  Badge,
  Collapse,
  Progress,
  Divider,
  Upload,
} from "antd";
import {
  SaveOutlined,
  ReloadOutlined,
  ShopOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  CameraOutlined,
  GlobalOutlined,
  CarOutlined,
  WifiOutlined,
  CreditCardOutlined,
  CloudUploadOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useAvatarUploadLocal } from "../../../hooks/useAvatarUploadLocal";
import "./RestaurantInfoManagement.scss";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// --- GIỮ NGUYÊN PHẦN GRAPHQL QUERIES (KHÔNG THAY ĐỔI) ---
const ME_QUERY = gql`
  query Me {
    me {
      id
      roleName
    }
  }
`;
const GET_MANAGER_RESTAURANTS = gql`
  query ManagerRestaurants($managerId: ID!, $limit: Int = 100, $cursor: ID) {
    restaurantsByManager(
      managerId: $managerId
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;
const GET_ALL_RESTAURANTS = gql`
  query AllRestaurants($limit: Int = 100, $cursor: ID) {
    restaurants(limit: $limit, cursor: $cursor) {
      edges {
        node {
          id
          name
        }
      }
    }
  }
`;
const GET_CATEGORIES = gql`
  query GetCategories($restaurantId: ID!, $timeSlot: TimeSlot!) {
    categories(restaurantId: $restaurantId, timeSlot: $timeSlot) {
      id
      name
      order
      isActive
      menuItemCount
      createdAt
      updatedAt
    }
  }
`;
const GET_INDEXES = gql`
  query GetRestaurantCategoryIndexes($restaurantId: ID, $timeSlot: TimeSlot) {
    restaurantCategoryIndexes(
      restaurantId: $restaurantId
      timeSlot: $timeSlot
    ) {
      id
      restaurantId
      timeSlot
      categoryIds
      distinctCategoryCount
      orderCount
      reservationCount
      tableParticipationCount
      updatedAt
    }
  }
`;
const UPDATE_INDEX = gql`
  mutation UpdateRestaurantCategoryIndex(
    $input: UpdateRestaurantCategoryIndexInput!
  ) {
    updateRestaurantCategoryIndex(input: $input) {
      id
      restaurantId
      timeSlot
      categoryIds
      distinctCategoryCount
    }
  }
`;

const GET_RESTAURANT_DETAIL = gql`
  query GetRestaurantDetail($id: ID!) {
    restaurant(id: $id) {
      id
      name
      phone
      email
      description
      openingHours
      closingHours
      cuisineType
      priceRange
      status
      amenities
      notesOnAmenities
      avgRating
      avatar
      coverImage
      address {
        line1
        district
        city
      }
    }
  }
`;
const UPDATE_RESTAURANT = gql`
  mutation UpdateRestaurantInfo($id: ID!, $input: UpdateRestaurantInput!) {
    updateRestaurant(id: $id, input: $input) {
      id
      name
      phone
      email
      description
      openingHours
      closingHours
      cuisineType
      priceRange
      status
      amenities
      notesOnAmenities
      avgRating
      avatar
      coverImage
    }
  }
`;

const TIME_SLOTS = ["breakfast", "lunch", "dinner", "late_night"];
const DEFAULT_CUSTOMER_INFO = {
  story: "",
  chef: "",
  dressCode: "",
  website: "",
  extraAmenities: [],
  parkingDetail: "",
  suitableFor: [],
  faqs: [
    { q: "", a: "" },
    { q: "", a: "" },
    { q: "", a: "" },
  ],
};

const DRAFT_STORAGE_KEY = "restaurant_info_drafts_v1";

const parseCustomerInfo = (value) => {
  if (!value) return DEFAULT_CUSTOMER_INFO;
  try {
    const parsed = JSON.parse(value);
    return {
      ...DEFAULT_CUSTOMER_INFO,
      ...parsed,
      suitableFor: Array.isArray(parsed?.suitableFor) ? parsed.suitableFor : [],
      faqs:
        Array.isArray(parsed?.faqs) && parsed.faqs.length > 0
          ? parsed.faqs.slice(0, 3)
          : DEFAULT_CUSTOMER_INFO.faqs,
    };
  } catch {
    return { ...DEFAULT_CUSTOMER_INFO, story: value };
  }
};

const RestaurantInfoManagement = ({ role = "manager" }) => {
  const { upload: uploadAsset } = useAvatarUploadLocal();
  const [timeSlot, setTimeSlot] = useState("lunch");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [draftName, setDraftName] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [extraAmenityInput, setExtraAmenityInput] = useState("");
  const [uploadingType, setUploadingType] = useState("");
  const [uploadProgress, setUploadProgress] = useState({
    avatar: 0,
    coverImage: 0,
  });
  const [isDirty, setIsDirty] = useState(false);
  const baselineRef = useRef("");
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    phone: "",
    email: "",
    description: "",
    openingHours: "",
    closingHours: "",
    cuisineType: "",
    priceRange: "",
    status: "active",
    avgRating: 0,
    amenities: {
      wifi: false,
      parking: false,
      card: false,
    },
    notesOnAmenities: "",
    customerInfo: DEFAULT_CUSTOMER_INFO,
    avatar: "",
    coverImage: "",
    line1: "",
    district: "",
    city: "",
  });

  // --- QUERY HOOKS ---
  const { data: meData } = useQuery(ME_QUERY, { fetchPolicy: "network-only" });
  const me = meData?.me;

  const { data: managerRestaurantsData, loading: managerRestaurantsLoading } =
    useQuery(GET_MANAGER_RESTAURANTS, {
      variables: { managerId: me?.id, limit: 100 },
      skip: !me?.id || (role !== "manager" && me?.roleName !== "manager"),
      fetchPolicy: "network-only",
    });

  const { data: allRestaurantsData, loading: allRestaurantsLoading } = useQuery(
    GET_ALL_RESTAURANTS,
    {
      variables: { limit: 100 },
      skip: role !== "admin" && me?.roleName !== "admin",
      fetchPolicy: "network-only",
    },
  );

  const restaurantOptions = useMemo(() => {
    if (role === "admin" || me?.roleName === "admin") {
      return (allRestaurantsData?.restaurants?.edges || []).map((e) => e.node);
    }
    return (managerRestaurantsData?.restaurantsByManager?.edges || []).map(
      (e) => e.node,
    );
  }, [role, me, allRestaurantsData, managerRestaurantsData]);

  useEffect(() => {
    if (!selectedRestaurantId && restaurantOptions.length > 0) {
      setSelectedRestaurantId(restaurantOptions[0].id);
    }
  }, [restaurantOptions, selectedRestaurantId]);

  const {
    data: restaurantDetailData,
    loading: restaurantDetailLoading,
    refetch: refetchRestaurantDetail,
  } = useQuery(GET_RESTAURANT_DETAIL, {
    variables: { id: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    const r = restaurantDetailData?.restaurant;
    if (!r) return;
    const parsedCustomerInfo = parseCustomerInfo(r.notesOnAmenities);
    const nextState = {
      name: r.name || "",
      phone: r.phone || "",
      email: r.email || "",
      description: r.description || "",
      openingHours: r.openingHours || "",
      closingHours: r.closingHours || "",
      cuisineType: r.cuisineType || "",
      priceRange: r.priceRange || "",
      status: r.status || "active",
      avgRating: r.avgRating || 0,
      amenities: {
        wifi: Boolean(r.amenities?.wifi),
        parking: Boolean(r.amenities?.parking),
        card: Boolean(r.amenities?.card),
      },
      notesOnAmenities: r.notesOnAmenities || "",
      avatar: r.avatar || "",
      coverImage: r.coverImage || "",
      customerInfo: {
        ...parsedCustomerInfo,
        website: parsedCustomerInfo?.website || "",
        extraAmenities: Array.isArray(parsedCustomerInfo?.extraAmenities)
          ? parsedCustomerInfo.extraAmenities
          : [],
      },
      line1: r.address?.line1 || "",
      district: r.address?.district || "",
      city: r.address?.city || "",
    };
    setRestaurantForm(nextState);
    baselineRef.current = JSON.stringify(nextState);
    setIsDirty(false);
  }, [restaurantDetailData]);

  useEffect(() => {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return;
    try {
      setDrafts(JSON.parse(raw));
    } catch {
      setDrafts([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    if (!baselineRef.current) return;
    setIsDirty(JSON.stringify(restaurantForm) !== baselineRef.current);
  }, [restaurantForm]);

  useEffect(() => {
    const handler = (event) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "Bạn có thay đổi chưa lưu. Bạn có chắc muốn thoát?";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const { data: indexData, refetch: refetchIndexes } = useQuery(GET_INDEXES, {
    variables: { restaurantId: selectedRestaurantId || undefined, timeSlot },
    skip: !timeSlot,
    fetchPolicy: "network-only",
  });

  const activeIndex = useMemo(() => {
    const rows = indexData?.restaurantCategoryIndexes || [];
    return rows.find(
      (row) => String(row.restaurantId) === String(selectedRestaurantId),
    );
  }, [indexData, selectedRestaurantId]);

  const { data: categoryData, refetch: refetchCategories } = useQuery(
    GET_CATEGORIES,
    {
      variables: { restaurantId: selectedRestaurantId, timeSlot },
      skip: !selectedRestaurantId || !timeSlot,
      fetchPolicy: "network-only",
    },
  );

  const categories = categoryData?.categories || [];

  // --- MUTATIONS ---
  const [updateIndex, { loading: syncingIndex }] = useMutation(UPDATE_INDEX);
  const [updateRestaurant, { loading: savingRestaurant }] =
    useMutation(UPDATE_RESTAURANT);

  // --- HANDLERS ---

  const saveDraftToLocal = (label = "Bản nháp thủ công") => {
    const payload = {
      id: `${Date.now()}`,
      label,
      restaurantId: selectedRestaurantId,
      savedAt: new Date().toISOString(),
      data: restaurantForm,
    };
    setDrafts((prev) => [payload, ...prev].slice(0, 20));
    message.success("Đã lưu bản nháp");
  };

  const loadDraft = (id) => {
    const found = drafts.find((item) => item.id === id);
    if (!found) return;
    setRestaurantForm(found.data);
    setIsDirty(true);
    message.success(`Đã nạp bản nháp: ${found.label}`);
  };

  const validateRestaurantForm = () => {
    if (!restaurantForm.name?.trim()) return "Tên nhà hàng không được để trống";
    if (
      restaurantForm.phone &&
      !/^\+?[0-9]{9,12}$/.test(restaurantForm.phone)
    ) {
      return "Số điện thoại không hợp lệ";
    }
    if (
      restaurantForm.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(restaurantForm.email)
    ) {
      return "Email không hợp lệ";
    }
    if (
      restaurantForm.customerInfo?.website &&
      !/^https?:\/\//i.test(restaurantForm.customerInfo.website)
    ) {
      return "Website phải bắt đầu bằng http:// hoặc https://";
    }
    return null;
  };

  const generateAIDescription = () => {
    const name = restaurantForm.name || "Nhà hàng";
    const cuisine = restaurantForm.cuisineType || "ẩm thực phong phú";
    const story =
      restaurantForm.customerInfo?.story || "hành trình ẩm thực đầy cảm hứng";
    const chef = restaurantForm.customerInfo?.chef
      ? `Dưới bàn tay dẫn dắt của ${restaurantForm.customerInfo.chef},`
      : "";
    const description = `${name} là điểm hẹn ${cuisine}, nơi thực khách không chỉ thưởng thức món ngon mà còn cảm nhận được ${story}. ${chef} mỗi chi tiết trong trải nghiệm đều được nâng niu để tạo nên dấu ấn tinh tế, sang trọng và đáng nhớ.`;
    setRestaurantForm((prev) => ({ ...prev, description }));
    setIsDirty(true);
    message.success("A.I đã tạo mô tả văn hoa mỹ từ");
  };

  const fillCurrentLocation = () => {
    if (!navigator.geolocation) {
      message.error("Trình duyệt không hỗ trợ định vị");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lat = coords.latitude.toFixed(6);
        const lng = coords.longitude.toFixed(6);
        setRestaurantForm((prev) => ({
          ...prev,
          line1: prev.line1 || `Vị trí hiện tại (${lat}, ${lng})`,
        }));
        setIsDirty(true);
        message.success(
          "Đã lấy vị trí hiện tại, vui lòng bổ sung địa chỉ chi tiết",
        );
      },
      () => message.error("Không thể lấy vị trí hiện tại"),
    );
  };

  const handleUploadRestaurantImage = async (type, file) => {
    if (!file) return;
    const fieldName = type === "avatar" ? "avatar" : "coverImage";
    setUploadingType(fieldName);
    setUploadProgress((prev) => ({ ...prev, [fieldName]: 0 }));
    try {
      const uploadedUrl = await uploadAsset(file, (percent) => {
        setUploadProgress((prev) => ({ ...prev, [fieldName]: percent }));
      });
      setRestaurantForm((prev) => ({ ...prev, [fieldName]: uploadedUrl }));
      setIsDirty(true);
      message.success(
        `Tải ${fieldName === "avatar" ? "avatar" : "ảnh bìa"} thành công`,
      );
    } catch (error) {
      message.error(error.message || "Upload ảnh thất bại");
    } finally {
      setUploadingType("");
    }
  };

  const onRefresh = async () => {
    if (!selectedRestaurantId) return;
    try {
      const allCategoryIds = categories.map((item) => String(item.id));
      await updateIndex({
        variables: {
          input: {
            restaurantId: selectedRestaurantId,
            timeSlot,
            categoryIds: allCategoryIds,
          },
        },
      });
      await Promise.all([refetchIndexes(), refetchCategories()]);
      message.success("Đã cập nhật số lượng category theo món ăn");
    } catch (error) {
      message.error(error.message || "Lỗi cập nhật category");
    }
  };

  const onSaveRestaurantInfo = async () => {
    if (!selectedRestaurantId) return;

    const validationError = validateRestaurantForm();
    if (validationError) {
      message.error(validationError);
      return;
    }

    const amenityList = [
      restaurantForm.amenities?.wifi ? "wifi" : null,
      restaurantForm.amenities?.parking ? "parking" : null,
      restaurantForm.amenities?.card ? "card" : null,
      ...(restaurantForm.customerInfo?.extraAmenities || []),
    ].filter(Boolean);

    try {
      await updateRestaurant({
        variables: {
          id: selectedRestaurantId,
          input: {
            name: restaurantForm.name,
            phone: restaurantForm.phone || null,
            email: restaurantForm.email || null,
            description: restaurantForm.description || null,
            openingHours: restaurantForm.openingHours || null,
            closingHours: restaurantForm.closingHours || null,
            cuisineType: restaurantForm.cuisineType || null,
            priceRange: restaurantForm.priceRange || null,
            status: restaurantForm.status || "active",
            avatar: restaurantForm.avatar || null,
            coverImage: restaurantForm.coverImage || null,
            amenities: amenityList,
            notesOnAmenities: JSON.stringify(restaurantForm.customerInfo),
            address: {
              line1: restaurantForm.line1 || null,
              district: restaurantForm.district || null,
              city: restaurantForm.city || null,
            },
          },
        },
      });
      await refetchRestaurantDetail();
      setIsDirty(false);
      message.success("Cập nhật thông tin nhà hàng thành công");
    } catch {
      saveDraftToLocal("Bản nháp tự động khi lỗi mạng");
      message.error("Không thể cập nhật thông tin. Đã lưu bản nháp cục bộ.");
    }
  };

  const updateCustomerInfoField = (field, value) => {
    setRestaurantForm((prev) => ({
      ...prev,
      customerInfo: {
        ...prev.customerInfo,
        [field]: value,
      },
    }));
  };

  const updateFaqField = (index, field, value) => {
    setRestaurantForm((prev) => {
      const nextFaqs = [
        ...(prev.customerInfo?.faqs || DEFAULT_CUSTOMER_INFO.faqs),
      ];
      nextFaqs[index] = {
        ...(nextFaqs[index] || { q: "", a: "" }),
        [field]: value,
      };
      return {
        ...prev,
        customerInfo: {
          ...prev.customerInfo,
          faqs: nextFaqs,
        },
      };
    });
  };

  // --- RENDER HELPERS ---

  // New Visual Image Uploader
  const renderVisualImageUploader = () => (
    <div className="hero-uploader-section">
      {/* Hidden Inputs */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) =>
          handleUploadRestaurantImage("coverImage", e.target.files?.[0])
        }
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) =>
          handleUploadRestaurantImage("avatar", e.target.files?.[0])
        }
      />

      {/* Cover Image Area */}
      <div
        className="cover-image-area"
        style={{
          backgroundImage: `url(${restaurantForm.coverImage || "https://via.placeholder.com/800x250?text=Cover+Image"})`,
        }}
      >
        <div className="cover-overlay">
          <Button
            type="primary"
            ghost
            icon={<CameraOutlined />}
            onClick={() => coverInputRef.current?.click()}
            loading={uploadingType === "coverImage"}
          >
            Thay ảnh bìa
          </Button>
        </div>
        {uploadingType === "coverImage" && (
          <Progress
            percent={uploadProgress.coverImage}
            showInfo={false}
            className="upload-progress-bar"
            strokeColor="#52c41a"
          />
        )}
      </div>

      {/* Avatar Area */}
      <div className="avatar-image-area">
        <div className="avatar-wrapper">
          <img
            src={restaurantForm.avatar || "https://via.placeholder.com/150"}
            alt="avatar"
          />
          <div
            className="avatar-overlay"
            onClick={() => avatarInputRef.current?.click()}
          >
            <CameraOutlined style={{ fontSize: 20, color: "#fff" }} />
          </div>
          {uploadingType === "avatar" && (
            <div className="avatar-progress">
              <Progress
                type="circle"
                percent={uploadProgress.avatar}
                width={40}
              />
            </div>
          )}
        </div>
        <div className="restaurant-title-preview">
          <Title level={4}>{restaurantForm.name || "Tên Nhà Hàng"}</Title>
          <Text type="secondary">
            {restaurantForm.cuisineType || "Loại ẩm thực"}
          </Text>
        </div>
      </div>
    </div>
  );

  const renderRestaurantForm = () => (
    <Form layout="vertical" className="saas-form modern-form">
      {renderVisualImageUploader()}

      <div className="form-content-padding">
        <Tabs
          defaultActiveKey="1"
          type="line"
          className="modern-tabs"
          items={[
            {
              key: "1",
              label: (
                <span>
                  <InfoCircleOutlined /> Thông tin chính
                </span>
              ),
              children: (
                <>
                  <Row gutter={24}>
                    <Col span={16}>
                      <Form.Item label="Tên nhà hàng" required>
                        <Input
                          size="large"
                          value={restaurantForm.name}
                          onChange={(e) =>
                            setRestaurantForm((p) => ({
                              ...p,
                              name: e.target.value,
                            }))
                          }
                          prefix={<ShopOutlined />}
                          placeholder="Nhập tên nhà hàng"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Trạng thái kinh doanh">
                        <Select
                          size="large"
                          value={restaurantForm.status}
                          onChange={(v) =>
                            setRestaurantForm((p) => ({ ...p, status: v }))
                          }
                        >
                          <Option value="active">
                            <Badge status="success" text="Đang hoạt động" />
                          </Option>
                          <Option value="inactive">
                            <Badge status="error" text="Tạm đóng cửa" />
                          </Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={24}>
                    <Col span={8}>
                      <Form.Item label="Số điện thoại">
                        <Input
                          value={restaurantForm.phone}
                          onChange={(e) =>
                            setRestaurantForm((p) => ({
                              ...p,
                              phone: e.target.value,
                            }))
                          }
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Email liên hệ">
                        <Input
                          value={restaurantForm.email}
                          onChange={(e) =>
                            setRestaurantForm((p) => ({
                              ...p,
                              email: e.target.value,
                            }))
                          }
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Website">
                        <Input
                          prefix={<GlobalOutlined />}
                          value={restaurantForm.customerInfo?.website}
                          onChange={(e) =>
                            updateCustomerInfoField("website", e.target.value)
                          }
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item label="Câu chuyện thương hiệu (Story)">
                    <div className="ai-textarea-wrapper">
                      <TextArea
                        rows={4}
                        value={restaurantForm.description}
                        onChange={(e) =>
                          setRestaurantForm((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        showCount
                        maxLength={1000}
                        placeholder="Mô tả về nhà hàng của bạn..."
                      />
                      <Button
                        type="dashed"
                        size="small"
                        className="ai-btn"
                        onClick={generateAIDescription}
                      >
                        ✨ AI Rewrite
                      </Button>
                    </div>
                  </Form.Item>
                </>
              ),
            },
            {
              key: "2",
              label: (
                <span>
                  <EnvironmentOutlined /> Địa điểm & Thời gian
                </span>
              ),
              children: (
                <>
                  <Card
                    size="small"
                    title="Địa chỉ hiển thị"
                    extra={
                      <Button
                        type="link"
                        size="small"
                        onClick={fillCurrentLocation}
                      >
                        Lấy vị trí hiện tại
                      </Button>
                    }
                  >
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Số nhà / Đường">
                          <Input
                            value={restaurantForm.line1}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                line1: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item label="Quận / Huyện">
                          <Input
                            value={restaurantForm.district}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                district: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item label="Tỉnh / Thành phố">
                          <Input
                            value={restaurantForm.city}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                city: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>

                  <div style={{ marginTop: 20 }}>
                    <Row gutter={24}>
                      <Col span={8}>
                        <Form.Item label="Giờ mở cửa">
                          <Input
                            prefix={<ClockCircleOutlined />}
                            value={restaurantForm.openingHours}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                openingHours: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Giờ đóng cửa">
                          <Input
                            prefix={<ClockCircleOutlined />}
                            value={restaurantForm.closingHours}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                closingHours: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Khoảng giá trung bình">
                          <Input
                            prefix="₫"
                            value={restaurantForm.priceRange}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                priceRange: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                </>
              ),
            },
            {
              key: "3",
              label: (
                <span>
                  <SettingOutlined /> Tiện ích & FAQ
                </span>
              ),
              children: (
                <>
                  <Form.Item label="Tiện ích cơ bản">
                    <div className="amenities-grid">
                      <div
                        className={`amenity-card ${restaurantForm.amenities?.wifi ? "active" : ""}`}
                        onClick={() =>
                          setRestaurantForm((p) => ({
                            ...p,
                            amenities: {
                              ...p.amenities,
                              wifi: !p.amenities.wifi,
                            },
                          }))
                        }
                      >
                        <WifiOutlined /> <span>Free Wifi</span>
                      </div>
                      <div
                        className={`amenity-card ${restaurantForm.amenities?.parking ? "active" : ""}`}
                        onClick={() =>
                          setRestaurantForm((p) => ({
                            ...p,
                            amenities: {
                              ...p.amenities,
                              parking: !p.amenities.parking,
                            },
                          }))
                        }
                      >
                        <CarOutlined /> <span>Đỗ xe</span>
                      </div>
                      <div
                        className={`amenity-card ${restaurantForm.amenities?.card ? "active" : ""}`}
                        onClick={() =>
                          setRestaurantForm((p) => ({
                            ...p,
                            amenities: {
                              ...p.amenities,
                              card: !p.amenities.card,
                            },
                          }))
                        }
                      >
                        <CreditCardOutlined /> <span>Thẻ VISA/Master</span>
                      </div>
                    </div>
                  </Form.Item>

                  <Row gutter={24}>
                    <Col span={12}>
                      <Form.Item label="Tiện ích mở rộng (Nhập & Enter)">
                        <Input
                          placeholder="VD: Ghế trẻ em, Phòng riêng..."
                          value={extraAmenityInput}
                          onChange={(e) => setExtraAmenityInput(e.target.value)}
                          onPressEnter={() => {
                            const val = extraAmenityInput.trim();
                            if (!val) return;
                            updateCustomerInfoField("extraAmenities", [
                              ...(restaurantForm.customerInfo?.extraAmenities ||
                                []),
                              val,
                            ]);
                            setExtraAmenityInput("");
                          }}
                        />
                        <div className="tags-container">
                          {(
                            restaurantForm.customerInfo?.extraAmenities || []
                          ).map((tag) => (
                            <Tag
                              closable
                              onClose={() =>
                                updateCustomerInfoField(
                                  "extraAmenities",
                                  restaurantForm.customerInfo.extraAmenities.filter(
                                    (t) => t !== tag,
                                  ),
                                )
                              }
                            >
                              {tag}
                            </Tag>
                          ))}
                        </div>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="Dress Code & Note">
                        <Input
                          value={restaurantForm.customerInfo?.dressCode}
                          onChange={(e) =>
                            updateCustomerInfoField("dressCode", e.target.value)
                          }
                          placeholder="VD: Smart Casual"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider orientation="left">FAQ - Câu hỏi thường gặp</Divider>
                  <Collapse
                    ghost
                    items={[0, 1, 2].map((idx) => ({
                      key: idx,
                      label:
                        restaurantForm.customerInfo?.faqs?.[idx]?.q ||
                        `Câu hỏi ${idx + 1}`,
                      children: (
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Input
                            placeholder="Câu hỏi"
                            value={restaurantForm.customerInfo?.faqs?.[idx]?.q}
                            onChange={(e) =>
                              updateFaqField(idx, "q", e.target.value)
                            }
                          />
                          <TextArea
                            placeholder="Trả lời"
                            rows={2}
                            value={restaurantForm.customerInfo?.faqs?.[idx]?.a}
                            onChange={(e) =>
                              updateFaqField(idx, "a", e.target.value)
                            }
                          />
                        </Space>
                      ),
                    }))}
                  />
                </>
              ),
            },
          ]}
        />
      </div>
    </Form>
  );

  return (
    <div className="restaurant-management-container">
      {/* HEADER SECTION - Modern Style */}
      <div className="page-header-modern">
        <div className="header-left">
          <Title level={2}>Hồ sơ nhà hàng</Title>
          <Text type="secondary">
            Quản lý hình ảnh và thông tin hiển thị trên ứng dụng khách hàng
          </Text>
        </div>

        <div className="header-actions">
          <Space size="middle">
            <div className="draft-control">
              <Select
                placeholder="Lịch sử bản nháp"
                style={{ width: 180 }}
                allowClear
                bordered={false}
                options={drafts.map((item) => ({
                  value: item.id,
                  label: `${item.label}`,
                }))}
                onChange={(id) => id && loadDraft(id)}
              />
              <Button
                type="text"
                icon={<SaveOutlined />}
                onClick={() => saveDraftToLocal()}
              >
                Lưu nháp
              </Button>
            </div>

            <Divider type="vertical" style={{ height: 24 }} />

            <Select
              value={selectedRestaurantId}
              onChange={setSelectedRestaurantId}
              style={{ width: 200 }}
              loading={managerRestaurantsLoading || allRestaurantsLoading}
              placeholder="Chọn chi nhánh"
              options={restaurantOptions.map((r) => ({
                label: r.name,
                value: r.id,
              }))}
            />

            <Button
              type="primary"
              size="large"
              icon={<SaveOutlined />}
              loading={savingRestaurant}
              onClick={onSaveRestaurantInfo}
              className="save-btn-gradient"
            >
              Lưu thay đổi
            </Button>
          </Space>
        </div>
      </div>

      <Row gutter={[24, 24]} className="main-layout">
        <Col xs={24} xl={14} xxl={15}>
          <Card
            className="saas-card edit-card"
            bordered={false}
            bodyStyle={{ padding: 0 }}
          >
            {restaurantDetailLoading ? (
              <div style={{ padding: 24 }}>
                <Skeleton active paragraph={{ rows: 8 }} />
              </div>
            ) : (
              renderRestaurantForm()
            )}
          </Card>

          {/* Category Status Section */}
          <Card
            className="saas-card category-card"
            title="Trạng thái thực đơn"
            bordered={false}
          >
            <Row justify="space-between" align="middle">
              <Col>
                <Space>
                  <Select
                    value={timeSlot}
                    onChange={setTimeSlot}
                    style={{ width: 120 }}
                    options={TIME_SLOTS.map((t) => ({ value: t, label: t }))}
                  />
                  <Text>
                    Đang có{" "}
                    <strong>
                      {activeIndex?.distinctCategoryCount ||
                        categories.length ||
                        0}
                    </strong>{" "}
                    danh mục
                  </Text>
                </Space>
              </Col>
              <Col>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={onRefresh}
                  loading={syncingIndex}
                >
                  Đồng bộ
                </Button>
              </Col>
            </Row>
            <div className="category-chips">
              {categories.map((cat) => (
                <Tag key={cat.id} color="blue">
                  {cat.name}{" "}
                  <span style={{ opacity: 0.7 }}>({cat.menuItemCount})</span>
                </Tag>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={10} xxl={9}>
          {/* MOBILE PREVIEW MOCKUP */}
          <div className="mobile-preview-wrapper">
            <div className="preview-label">
              <FileTextOutlined /> Xem trước (Live Preview)
            </div>
            <div className="mock-phone">
              <div className="camera-notch"></div>
              <div className="screen-content">
                {selectedRestaurantId ? (
                  <iframe
                    title="RestaurantDetail Preview"
                    src={`/restaurant/${selectedRestaurantId}?preview=1`}
                    className="app-iframe"
                  />
                ) : (
                  <div className="empty-preview">
                    <ShopOutlined style={{ fontSize: 48, color: "#ccc" }} />
                    <p>Vui lòng chọn nhà hàng</p>
                  </div>
                )}
              </div>
            </div>
            <div className="phone-reflection"></div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export const AdminRestaurantInfoManagement = () => (
  <RestaurantInfoManagement role="admin" />
);
export const ManagerRestaurantInfoManagement = () => (
  <RestaurantInfoManagement role="manager" />
);
export default RestaurantInfoManagement;
