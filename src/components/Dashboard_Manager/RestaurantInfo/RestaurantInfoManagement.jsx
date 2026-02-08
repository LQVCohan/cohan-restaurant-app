import React, { useEffect, useMemo, useRef, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  Card,
  Select,
  Input,
  Button,
  Table,
  Tag,
  Row,
  Col,
  Form,
  Switch,
  Modal,
  message,
  Typography,
  Space,
  Statistic,
  Tabs,
  Skeleton,
  Badge,
  Tooltip,
  Collapse,
  Progress,
} from "antd";
import {
  SaveOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ShopOutlined,
  ClockCircleOutlined,
  OrderedListOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import RestaurantInfo from "../../Customer/RestaurantDetail/components/RestaurantInfo/RestaurantInfo";
import { useAvatarUploadLocal } from "../../../hooks/useAvatarUploadLocal";
import "./RestaurantInfoManagement.scss";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// --- GIỮ NGUYÊN PHẦN GRAPHQL QUERIES ---
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
      faqs: Array.isArray(parsed?.faqs) && parsed.faqs.length > 0
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
  const [uploadProgress, setUploadProgress] = useState({ avatar: 0, coverImage: 0 });
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

  const {
    data: indexData,
    refetch: refetchIndexes,
  } = useQuery(GET_INDEXES, {
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


  const {
    data: categoryData,
    refetch: refetchCategories,
  } = useQuery(GET_CATEGORIES, {
    variables: { restaurantId: selectedRestaurantId, timeSlot },
    skip: !selectedRestaurantId || !timeSlot,
    fetchPolicy: "network-only",
  });


  const categories = categoryData?.categories || [];

  const customerPreviewData = useMemo(() => {
    const customerInfo = restaurantForm.customerInfo || DEFAULT_CUSTOMER_INFO;
    return {
      name: restaurantForm.name,
      cuisineType: restaurantForm.cuisineType,
      phone: restaurantForm.phone,
      website: customerInfo.website,
      address: {
        line1: restaurantForm.line1,
        district: restaurantForm.district,
        city: restaurantForm.city,
      },
      about: restaurantForm.description,
      amenities: restaurantForm.amenities,
      dressCode: customerInfo.dressCode,
      chef: customerInfo.chef,
      suitableFor: customerInfo.suitableFor,
      parkingDetail: customerInfo.parkingDetail,
      ratings: {
        food: Number(restaurantForm.avgRating || 0),
        service: Number(restaurantForm.avgRating || 0),
        ambience: Number(restaurantForm.avgRating || 0),
        value: Number(restaurantForm.avgRating || 0),
      },
      faqs: customerInfo.faqs,
    };
  }, [restaurantForm]);

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
    if (restaurantForm.phone && !/^\+?[0-9]{9,12}$/.test(restaurantForm.phone)) {
      return "Số điện thoại không hợp lệ";
    }
    if (restaurantForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(restaurantForm.email)) {
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
    const story = restaurantForm.customerInfo?.story || "hành trình ẩm thực đầy cảm hứng";
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
        message.success("Đã lấy vị trí hiện tại, vui lòng bổ sung địa chỉ chi tiết");
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
      message.success(`Tải ${fieldName === "avatar" ? "avatar" : "ảnh bìa"} thành công`);
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
      const nextFaqs = [...(prev.customerInfo?.faqs || DEFAULT_CUSTOMER_INFO.faqs)];
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
  const renderRestaurantForm = () => (
    <Form layout="vertical" className="saas-form">
      <Tabs
        defaultActiveKey="1"
        items={[
          {
            key: "1",
            label: (
              <span>
                <InfoCircleOutlined />
                Thông tin chung
              </span>
            ),
            children: (
              <>
                <Row gutter={16}>
                  <Col span={16}>
                    <Form.Item label="Tên nhà hàng">
                      <Input
                        value={restaurantForm.name}
                        onChange={(e) =>
                          setRestaurantForm((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                        prefix={<ShopOutlined className="text-gray-400" />}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Trạng thái">
                      <Select
                        value={restaurantForm.status}
                        onChange={(v) =>
                          setRestaurantForm((p) => ({ ...p, status: v }))
                        }
                      >
                        <Option value="active">
                          <Badge status="success" text="Hoạt động" />
                        </Option>
                        <Option value="inactive">
                          <Badge status="error" text="Tạm dừng" />
                        </Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Điện thoại">
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
                  <Col span={12}>
                    <Form.Item label="Loại ẩm thực">
                      <Input
                        value={restaurantForm.cuisineType}
                        onChange={(e) =>
                          setRestaurantForm((p) => ({
                            ...p,
                            cuisineType: e.target.value,
                          }))
                        }
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Mô tả">
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
                  />
                  <Button size="small" style={{ marginTop: 8 }} onClick={generateAIDescription}>
                    Viết mô tả A.I văn hoa
                  </Button>
                </Form.Item>
              </>
            ),
          },
          {
            key: "2",
            label: (
              <span>
                <EnvironmentOutlined />
                Địa chỉ
              </span>
            ),
            children: (
              <Form.Item
                label="Địa chỉ chi tiết"
                help="Nhập số nhà, tên đường, quận/huyện và thành phố"
                extra={
                  <Button size="small" onClick={fillCurrentLocation}>
                    Lấy địa chỉ hiện tại tự động
                  </Button>
                }
              >
                {/* FIX: Sử dụng Space.Compact thay cho Input.Group */}
                <Space.Compact block>
                  <Input
                    style={{ width: "40%" }}
                    placeholder="Số nhà/Đường"
                    value={restaurantForm.line1}
                    onChange={(e) =>
                      setRestaurantForm((p) => ({
                        ...p,
                        line1: e.target.value,
                      }))
                    }
                  />
                  <Input
                    style={{ width: "30%" }}
                    placeholder="Quận/Huyện"
                    value={restaurantForm.district}
                    onChange={(e) =>
                      setRestaurantForm((p) => ({
                        ...p,
                        district: e.target.value,
                      }))
                    }
                  />
                  <Input
                    style={{ width: "30%" }}
                    placeholder="Thành phố"
                    value={restaurantForm.city}
                    onChange={(e) =>
                      setRestaurantForm((p) => ({ ...p, city: e.target.value }))
                    }
                  />
                </Space.Compact>
              </Form.Item>
            ),
          },
          {
            key: "3",
            label: (
              <span>
                <SettingOutlined />
                Cấu hình
              </span>
            ),
            children: (
              <>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="Giờ mở cửa">
                      <Input
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
                    <Form.Item label="Khoảng giá">
                      <Input
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
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Avatar nhà hàng">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Input
                          value={restaurantForm.avatar || ""}
                          placeholder="URL avatar"
                          onChange={(e) =>
                            setRestaurantForm((p) => ({ ...p, avatar: e.target.value }))
                          }
                        />
                        <Space>
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) =>
                              handleUploadRestaurantImage("avatar", e.target.files?.[0])
                            }
                          />
                          <Button
                            onClick={() => avatarInputRef.current?.click()}
                            loading={uploadingType === "avatar"}
                          >
                            Tải avatar
                          </Button>
                          {restaurantForm.avatar ? (
                            <img
                              src={restaurantForm.avatar}
                              alt="avatar preview"
                              style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }}
                            />
                          ) : null}
                        </Space>
                        {uploadProgress.avatar > 0 && uploadingType === "avatar" ? (
                          <Progress percent={uploadProgress.avatar} size="small" />
                        ) : null}
                      </Space>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Ảnh bìa nhà hàng">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Input
                          value={restaurantForm.coverImage || ""}
                          placeholder="URL ảnh bìa"
                          onChange={(e) =>
                            setRestaurantForm((p) => ({ ...p, coverImage: e.target.value }))
                          }
                        />
                        <Space>
                          <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={(e) =>
                              handleUploadRestaurantImage("coverImage", e.target.files?.[0])
                            }
                          />
                          <Button
                            onClick={() => coverInputRef.current?.click()}
                            loading={uploadingType === "coverImage"}
                          >
                            Tải ảnh bìa
                          </Button>
                        </Space>
                        {restaurantForm.coverImage ? (
                          <img
                            src={restaurantForm.coverImage}
                            alt="cover preview"
                            style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 8 }}
                          />
                        ) : null}
                        {uploadProgress.coverImage > 0 && uploadingType === "coverImage" ? (
                          <Progress percent={uploadProgress.coverImage} size="small" />
                        ) : null}
                      </Space>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Website khi khách bấm icon Globe">
                      <Input
                        placeholder="https://..."
                        value={restaurantForm.customerInfo?.website || ""}
                        onChange={(e) =>
                          setRestaurantForm((p) => ({
                            ...p,
                            customerInfo: { ...p.customerInfo, website: e.target.value },
                          }))
                        }
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Dress code">
                      <Input
                        value={restaurantForm.customerInfo?.dressCode}
                        onChange={(e) =>
                          updateCustomerInfoField("dressCode", e.target.value)
                        }
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Tiện ích hiển thị cho khách">
                  <Space size={24} wrap>
                    <Space>
                      <Switch
                        checked={restaurantForm.amenities?.wifi}
                        onChange={(checked) =>
                          setRestaurantForm((p) => ({
                            ...p,
                            amenities: { ...p.amenities, wifi: checked },
                          }))
                        }
                      />
                      Wifi
                    </Space>
                    <Space>
                      <Switch
                        checked={restaurantForm.amenities?.parking}
                        onChange={(checked) =>
                          setRestaurantForm((p) => ({
                            ...p,
                            amenities: { ...p.amenities, parking: checked },
                          }))
                        }
                      />
                      Parking
                    </Space>
                    <Space>
                      <Switch
                        checked={restaurantForm.amenities?.card}
                        onChange={(checked) =>
                          setRestaurantForm((p) => ({
                            ...p,
                            amenities: { ...p.amenities, card: checked },
                          }))
                        }
                      />
                      Thanh toán thẻ
                    </Space>
                  </Space>
                  <div style={{ marginTop: 10 }}>
                    <Space.Compact style={{ width: "100%" }}>
                      <Input
                        placeholder="Thêm tiện ích tùy chỉnh"
                        value={extraAmenityInput}
                        onChange={(e) => setExtraAmenityInput(e.target.value)}
                      />
                      <Button
                        onClick={() => {
                          const value = extraAmenityInput.trim();
                          if (!value) return;
                          if ((restaurantForm.customerInfo?.extraAmenities || []).includes(value)) {
                            message.warning("Tiện ích này đã tồn tại");
                            return;
                          }
                          updateCustomerInfoField("extraAmenities", [
                            ...(restaurantForm.customerInfo?.extraAmenities || []),
                            value,
                          ]);
                          setExtraAmenityInput("");
                          setIsDirty(true);
                        }}
                      >
                        Thêm
                      </Button>
                    </Space.Compact>
                    <div className="preview-tags" style={{ marginTop: 8 }}>
                      {(restaurantForm.customerInfo?.extraAmenities || []).map((item) => (
                        <Tag
                          key={item}
                          closable
                          onClose={() => {
                            updateCustomerInfoField(
                              "extraAmenities",
                              (restaurantForm.customerInfo?.extraAmenities || []).filter(
                                (name) => name !== item,
                              ),
                            );
                            setIsDirty(true);
                          }}
                        >
                          {item}
                        </Tag>
                      ))}
                    </div>
                  </div>
                </Form.Item>
              </>
            ),
          },
          {
            key: "4",
            label: (
              <span>
                <InfoCircleOutlined />
                Nội dung RestaurantInfo
              </span>
            ),
            children: (
              <>
                <Form.Item label="Câu chuyện về chúng tôi">
                  <TextArea
                    rows={3}
                    value={restaurantForm.customerInfo?.story}
                    onChange={(e) => updateCustomerInfoField("story", e.target.value)}
                    maxLength={700}
                    showCount
                  />
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="Tên bếp trưởng">
                      <Input
                        value={restaurantForm.customerInfo?.chef}
                        onChange={(e) => updateCustomerInfoField("chef", e.target.value)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Thông tin bãi đỗ xe">
                      <Input
                        value={restaurantForm.customerInfo?.parkingDetail}
                        onChange={(e) =>
                          updateCustomerInfoField("parkingDetail", e.target.value)
                        }
                      />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Phù hợp cho (mỗi dòng 1 mục)">
                  <TextArea
                    rows={3}
                    value={(restaurantForm.customerInfo?.suitableFor || []).join("\n")}
                    onChange={(e) =>
                      updateCustomerInfoField(
                        "suitableFor",
                        e.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </Form.Item>
                <Form.Item label="Thông tin hữu ích (FAQ)">
                  <Space direction="vertical" style={{ width: "100%" }} size={10}>
                    {[0, 1, 2].map((idx) => (
                      <Card key={idx} size="small" title={`FAQ ${idx + 1}`}>
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Input
                            placeholder="Câu hỏi"
                            value={restaurantForm.customerInfo?.faqs?.[idx]?.q || ""}
                            onChange={(e) => updateFaqField(idx, "q", e.target.value)}
                          />
                          <TextArea
                            rows={2}
                            placeholder="Câu trả lời"
                            value={restaurantForm.customerInfo?.faqs?.[idx]?.a || ""}
                            onChange={(e) => updateFaqField(idx, "a", e.target.value)}
                          />
                        </Space>
                      </Card>
                    ))}
                  </Space>
                </Form.Item>
              </>
            ),
          },
        ]}
      />
    </Form>
  );


  return (
    <div className="restaurant-management-container">
      {/* HEADER SECTION */}
      <div className="page-header">
        <div className="header-title">
          <Title level={3} style={{ margin: 0 }}>
            Quản lý Thông tin nhà hàng
          </Title>
          <Text type="secondary">
            Cấu hình thông tin và hiển thị cho khách hàng
          </Text>
        </div>
        <Space wrap>
          <Input
            placeholder="Tên bản nháp"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            style={{ width: 170 }}
          />
          <Button size="small" onClick={() => saveDraftToLocal(draftName || "Bản nháp thủ công")}>
            Lưu bản nháp
          </Button>
          <Select
            placeholder="Nạp bản nháp"
            style={{ width: 240 }}
            allowClear
            options={drafts.map((item) => ({
              value: item.id,
              label: `${item.label} - ${new Date(item.savedAt).toLocaleString("vi-VN")}`,
            }))}
            onChange={(id) => id && loadDraft(id)}
          />
          <Select
            value={timeSlot}
            onChange={setTimeSlot}
            style={{ width: 140 }}
            suffixIcon={<ClockCircleOutlined />}
            options={TIME_SLOTS.map((s) => ({ label: s, value: s }))}
          />
          <Select
            showSearch
            value={selectedRestaurantId}
            onChange={setSelectedRestaurantId}
            style={{ width: 220 }}
            loading={managerRestaurantsLoading || allRestaurantsLoading}
            placeholder="Chọn nhà hàng"
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
            options={restaurantOptions.map((r) => ({
              label: r.name,
              value: r.id,
            }))}
          />
        </Space>
      </div>

      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} xl={15}>
          <Space direction="vertical" size={20} style={{ width: "100%" }}>
            <Card
              title={
                <span>
                  <ShopOutlined /> Thông tin nhà hàng hiển thị cho khách
                </span>
              }
              extra={
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={savingRestaurant}
                  onClick={onSaveRestaurantInfo}
                >
                  Lưu hồ sơ
                </Button>
              }
              className="saas-card"
            >
              {restaurantDetailLoading ? (
                <Skeleton active paragraph={{ rows: 8 }} />
              ) : (
                renderRestaurantForm()
              )}
            </Card>

            <Card className="saas-card" title="Danh mục (tóm gọn)">
              <div className="category-compact-row">
                <span>
                  Tổng category hiện có: <strong>{activeIndex?.distinctCategoryCount || categories.length || 0}</strong>
                </span>
                <Button
                  type="primary"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={onRefresh}
                  loading={syncingIndex}
                >
                  Cập nhật số lượng category
                </Button>
              </div>

              <Collapse
                size="small"
                className="category-dropdown"
                items={[
                  {
                    key: "category-list",
                    label: "Mở danh sách category theo chiều dọc",
                    children: (
                      <div className="category-vertical-list">
                        {categories.length === 0 ? (
                          <Text type="secondary">Chưa có category.</Text>
                        ) : (
                          categories.map((cat) => (
                            <div className="category-item" key={cat.id}>
                              <span>{cat.name}</span>
                              <Tag>{cat.menuItemCount || 0} món</Tag>
                            </div>
                          ))
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={9}>
          <div className="customer-preview-sticky">
            <Card
              title="Bản xem nhanh thông tin khách hàng nhìn thấy"
              className="saas-card customer-preview-card"
            >
              <div className="customer-preview-embedded">
                <RestaurantInfo restaurant={customerPreviewData} />
              </div>
            </Card>
          </div>
        </Col>
      </Row>

      <Card
        style={{ marginTop: 20 }}
        className="saas-card restaurant-detail-full-preview"
        title="Xem trước toàn bộ trang RestaurantDetail"
      >
        {selectedRestaurantId ? (
          <iframe
            title="RestaurantDetail Preview"
            src={`/restaurant/${selectedRestaurantId}`}
            className="restaurant-detail-preview-frame"
          />
        ) : (
          <Text type="secondary">Chọn nhà hàng để xem trước trang RestaurantDetail.</Text>
        )}
      </Card>
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
