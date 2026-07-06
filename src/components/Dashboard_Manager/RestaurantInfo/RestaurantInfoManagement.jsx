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
  Modal,
  List,
  Alert,
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
  FileTextOutlined,
} from "@ant-design/icons";
import { useAvatarUploadLocal } from "../../../hooks/useAvatarUploadLocal";
import "./RestaurantInfoManagement.scss";
import ManagementPageHeader from "../shared/ManagementPageHeader";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const COVER_PLACEHOLDER = "linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)";
const AVATAR_PLACEHOLDER = "/default-avatar.png";
const DEFAULT_RESTAURANT_CAPABILITIES = {
  acceptsReservations: true,
  acceptsOrders: true,
  acceptsTableOrders: true,
  acceptsDelivery: false,
  acceptsPickup: false,
};

// --- GIỮ NGUYÊN PHẦN GRAPHQL QUERIES (KHÔNG THAY ĐỔI) ---
const ME_QUERY = gql`
  query Me {
    me {
      id
      roleName
    }
  }
`;
const GET_SCOPED_RESTAURANTS = gql`
  query ScopedRestaurants($limit: Int = 100, $cursor: ID) {
    scopedRestaurants(
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        node {
          id
          name
          brandId
          brand { id name slug }
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
          brandId
          brand { id name slug }
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
      brandId
      brand { id name slug }
      phone
      email
      description
      openingHours
      closingHours
      notesOnHours
      cuisineType
      priceRange
      status
      businessStatus
      operationalStatus
      capabilities
      orderPolicy
      amenities
      notesOnAmenities
      avgRating
      seatingCapacity
      avatar
      coverImage
      address {
        line1
        line2
        ward
        district
        city
        country
        postalCode
        lat
        lng
      }
      reservationSettings {
        baseDepositAmount
        menuDepositPercent
        changeTimeFee
        changeTableFee
        vatRate
        serviceFee
      }
      paymentSettings {
        defaultProvider
        providers {
          provider
          label
          active
          priority
          mode
        }
      }
    }
  }
`;
const GET_RESTAURANT_LAYOUT_METRICS = gql`
  query GetRestaurantLayoutMetrics($restaurantId: ID!) {
    floors(restaurantId: $restaurantId) {
      id
    }
    tables(restaurantId: $restaurantId) {
      id
    }
  }
`;
const UPDATE_RESTAURANT = gql`
  mutation UpdateRestaurantInfo($id: ID!, $input: UpdateRestaurantInput!) {
    updateRestaurant(id: $id, input: $input) {
      id
      name
      brandId
      brand { id name slug }
      phone
      email
      description
      openingHours
      closingHours
      notesOnHours
      cuisineType
      priceRange
      status
      businessStatus
      operationalStatus
      capabilities
      orderPolicy
      amenities
      notesOnAmenities
      avgRating
      seatingCapacity
      avatar
      coverImage
      address {
        line1
        line2
        ward
        district
        city
        country
        postalCode
        lat
        lng
      }
      reservationSettings {
        baseDepositAmount
        menuDepositPercent
        changeTimeFee
        changeTableFee
        vatRate
        serviceFee
      }
      paymentSettings {
        defaultProvider
        providers {
          provider
          label
          active
          priority
          mode
        }
      }
    }
  }
`;

const GET_STAFF_LIST = gql`
  query StaffListForChefPicker($restaurantId: ID, $search: String) {
    staffList(restaurantId: $restaurantId, search: $search) {
      id
      fullName
      roleName
      positionTitle    }
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

const normalizeCustomerInfo = (value = {}) => {
  const source = value || {};

  const extraAmenities = Array.from(
    new Set(
      (source.extraAmenities || [])
        .map((item) => (item || "").trim())
        .filter(Boolean),
    ),
  );

  const incomingFaqs = Array.isArray(source.faqs) ? source.faqs : [];
  const faqs = [0, 1, 2].map((index) => {
    const row = incomingFaqs[index] || {};
    return {
      q: (row.q || "").trim(),
      a: (row.a || "").trim(),
    };
  });

  return {
    ...DEFAULT_CUSTOMER_INFO,
    ...source,
    story: (source.story || "").trimStart(),
    chef: (source.chef || "").trimStart(),
    dressCode: (source.dressCode || "").trim(),
    website: (source.website || "").trim(),
    parkingDetail: (source.parkingDetail || "").trim(),
    suitableFor: Array.isArray(source.suitableFor) ? source.suitableFor : [],
    extraAmenities,
    faqs,
  };
};

const parseCustomerInfo = (value) => {
  if (!value) return DEFAULT_CUSTOMER_INFO;
  try {
    const parsed = JSON.parse(value);
    return normalizeCustomerInfo(parsed);
  } catch {
    return normalizeCustomerInfo({ story: value });
  }
};

const parseOptionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const RestaurantInfoManagement = ({ role = "manager" }) => {
  const { upload: uploadAsset } = useAvatarUploadLocal();
  const [timeSlot, setTimeSlot] = useState("lunch");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [_draftName, _setDraftName] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [extraAmenityInput, setExtraAmenityInput] = useState("");
  const [uploadingType, setUploadingType] = useState("");
  const [uploadProgress, setUploadProgress] = useState({
    avatar: 0,
    coverImage: 0,
  });
  const [chefPickerOpen, setChefPickerOpen] = useState(false);
  const [chefSearch, setChefSearch] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const baselineRef = useRef("");
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const previewIframeRef = useRef(null);

  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    brandId: "",
    brandName: "",
    phone: "",
    email: "",
    description: "",
    openingHours: "",
    closingHours: "",
    cuisineType: "",
    priceRange: "",
    status: "active",
    capabilities: DEFAULT_RESTAURANT_CAPABILITIES,
    avgRating: 0,
    amenities: {
      wifi: false,
      parking: false,
      card: false,
    },
    notesOnAmenities: "",
    notesOnHours: "",
    seatingCapacity: 0,
    customerInfo: DEFAULT_CUSTOMER_INFO,
    avatar: "",
    coverImage: "",
    line1: "",
    line2: "",
    ward: "",
    district: "",
    city: "",
    country: "",
    postalCode: "",
    lat: "",
    lng: "",
    reservationSettings: {
      baseDepositAmount: 0,
      menuDepositPercent: 50,
      changeTimeFee: 0,
      changeTableFee: 0,
      vatRate: 0,
      serviceFee: 0,
    },
    paymentSettings: {
      defaultProvider: "momo",
      providers: [
        { provider: "momo", label: "MoMo", active: true, priority: 1, mode: "sandbox" },
        { provider: "vnpay", label: "VNPAY", active: true, priority: 2, mode: "sandbox" },
      ],
    },
  });

  const profileChecklist = useMemo(() => {
    const checks = [
      { key: "name", label: "Tên nhà hàng", done: Boolean(restaurantForm.name?.trim()) },
      { key: "cover", label: "Ảnh bìa", done: Boolean(restaurantForm.coverImage) },
      { key: "avatar", label: "Logo / ảnh đại diện", done: Boolean(restaurantForm.avatar) },
      { key: "contact", label: "Liên hệ", done: Boolean(restaurantForm.phone?.trim() && restaurantForm.email?.trim()) },
      { key: "hours", label: "Giờ mở cửa", done: Boolean(restaurantForm.openingHours?.trim() && restaurantForm.closingHours?.trim()) },
      { key: "address", label: "Địa chỉ", done: Boolean(restaurantForm.line1?.trim() && restaurantForm.city?.trim()) },
      { key: "story", label: "Câu chuyện thương hiệu", done: Boolean(restaurantForm.customerInfo?.story?.trim()) },
    ];
    const completed = checks.filter((item) => item.done).length;
    return { checks, percent: Math.round((completed / checks.length) * 100) };
  }, [restaurantForm]);

  const quickProfileFacts = useMemo(() => [
    { label: "Trạng thái", value: restaurantForm.status === "active" ? "Đang hoạt động" : "Tạm ngưng" },
    { label: "Ẩm thực", value: restaurantForm.cuisineType || "Chưa chọn" },
    {
      label: "Giờ phục vụ",
      value: restaurantForm.openingHours && restaurantForm.closingHours
        ? `${restaurantForm.openingHours}–${restaurantForm.closingHours}`
        : "Chưa cập nhật",
    },
  ], [restaurantForm.closingHours, restaurantForm.cuisineType, restaurantForm.openingHours, restaurantForm.status]);

  // --- QUERY HOOKS ---
  const { data: meData } = useQuery(ME_QUERY, { fetchPolicy: "network-only" });
  const me = meData?.me;

  const { data: scopedRestaurantsData, loading: scopedRestaurantsLoading } =
    useQuery(GET_SCOPED_RESTAURANTS, {
      variables: { limit: 100 },
      skip: !me?.id || (role === "admin" || me?.roleName === "admin"),
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

  const { data: staffListData, loading: staffListLoading } = useQuery(
    GET_STAFF_LIST,
    {
      variables: {
        restaurantId: selectedRestaurantId || undefined,
        search: chefSearch.trim() || undefined,
      },
      skip: !selectedRestaurantId,
      fetchPolicy: "network-only",
    },
  );

  const restaurantOptions = useMemo(() => {
    if (role === "admin" || me?.roleName === "admin") {
      return (allRestaurantsData?.restaurants?.edges || []).map((e) => e.node);
    }
    return (scopedRestaurantsData?.scopedRestaurants?.edges || []).map(
      (e) => e.node,
    );
  }, [role, me, allRestaurantsData, scopedRestaurantsData]);

  useEffect(() => {
    if (!selectedRestaurantId && restaurantOptions.length > 0) {
      setSelectedRestaurantId(restaurantOptions[0].id);
    }
  }, [restaurantOptions, selectedRestaurantId]);

  const {
    data: restaurantDetailData,
    loading: restaurantDetailLoading,
    error: restaurantDetailError,
    refetch: refetchRestaurantDetail,
  } = useQuery(GET_RESTAURANT_DETAIL, {
    variables: { id: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });
  const { data: layoutMetricsData } = useQuery(GET_RESTAURANT_LAYOUT_METRICS, {
    variables: { restaurantId: selectedRestaurantId },
    skip: !selectedRestaurantId,
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    const r = restaurantDetailData?.restaurant;
    if (!r) return;
    const parsedCustomerInfo = parseCustomerInfo(r.notesOnAmenities);
    const nextState = {
      name: r.name || "",
      brandId: r.brandId || "",
      brandName: r.brand?.name || "Nhà hàng chưa gán chuỗi",
      phone: r.phone || "",
      email: r.email || "",
      description: r.description || "",
      openingHours: r.openingHours || "",
      closingHours: r.closingHours || "",
      notesOnHours: r.notesOnHours || "",
      cuisineType: r.cuisineType || "",
      priceRange: r.priceRange || "",
      status: r.status || "active",
      capabilities: {
        ...DEFAULT_RESTAURANT_CAPABILITIES,
        ...(r.capabilities || {}),
      },
      avgRating: r.avgRating || 0,
      seatingCapacity: Number(r.seatingCapacity || 0),
      amenities: {
        wifi: Array.isArray(r.amenities) ? r.amenities.includes("wifi") : false,
        parking: Array.isArray(r.amenities)
          ? r.amenities.includes("parking")
          : false,
        card: Array.isArray(r.amenities) ? r.amenities.includes("card") : false,
      },
      notesOnAmenities: r.notesOnAmenities || "",
      avatar: r.avatar || "",
      coverImage: r.coverImage || "",
      customerInfo: normalizeCustomerInfo({
        ...parsedCustomerInfo,
        story: parsedCustomerInfo?.story || r.description || "",
      }),
      line1: r.address?.line1 || "",
      line2: r.address?.line2 || "",
      ward: r.address?.ward || "",
      district: r.address?.district || "",
      city: r.address?.city || "",
      country: r.address?.country || "",
      postalCode: r.address?.postalCode || "",
      lat: r.address?.lat ?? "",
      lng: r.address?.lng ?? "",
      reservationSettings: {
        baseDepositAmount: Number(r.reservationSettings?.baseDepositAmount || 0),
        menuDepositPercent: Number(r.reservationSettings?.menuDepositPercent || 50),
        changeTimeFee: Number(r.reservationSettings?.changeTimeFee || 0),
        changeTableFee: Number(r.reservationSettings?.changeTableFee || 0),
        vatRate: Number(r.reservationSettings?.vatRate || 0),
        serviceFee: Number(r.reservationSettings?.serviceFee || 0),
      },
      paymentSettings: {
        defaultProvider: r.paymentSettings?.defaultProvider || "momo",
        providers: (r.paymentSettings?.providers || [
          { provider: "momo", label: "MoMo", active: true, priority: 1, mode: "sandbox" },
          { provider: "vnpay", label: "VNPAY", active: true, priority: 2, mode: "sandbox" },
        ]).map((x, idx) => ({
          provider: x.provider,
          label: x.label || (x.provider === "momo" ? "MoMo" : "VNPAY"),
          active: x.active !== false,
          priority: Number(x.priority ?? idx + 1),
          mode: x.mode || "sandbox",
        })),
      },
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

  const chefCandidates = useMemo(() => {
    const rows = staffListData?.staffList || [];
    const isChef = (staff) => {
      const roleText = `${staff?.roleName || ""} ${staff?.positionTitle || ""}`
        .toLowerCase()
        .trim();
      return (
        roleText.includes("chef") ||
        roleText.includes("bếp") ||
        roleText.includes("bep")
      );
    };

    const picked = rows.filter(isChef);
    return picked.length > 0 ? picked : rows;
  }, [staffListData]);

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
    setRestaurantForm((prev) => ({
      ...prev,
      description,
      customerInfo: {
        ...prev.customerInfo,
        story: description,
      },
    }));
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

  const previewRestaurantData = useMemo(() => {
    const normalizedCustomerInfo = normalizeCustomerInfo(restaurantForm.customerInfo);
    const normalizedStatus = restaurantForm.status === "active" ? "open" : "closed";
    const district = restaurantForm.district || "";
    const city = restaurantForm.city || "";
    const line1 = restaurantForm.line1 || "";
    const ward = restaurantForm.ward || "";
    const line2 = restaurantForm.line2 || "";
    return {
      id: selectedRestaurantId || null,
      name: restaurantForm.name || "",
      avatar: restaurantForm.avatar || "",
      coverImage: restaurantForm.coverImage || "",
      cuisine: restaurantForm.cuisineType || "",
      cuisineType: restaurantForm.cuisineType || "",
      status: normalizedStatus,
      rating: Number(restaurantForm.avgRating) || 0,
      avgRating: Number(restaurantForm.avgRating) || 0,
      district,
      addressText: [line1, line2, ward, district, city].filter(Boolean).join(", "),
      address: {
        line1,
        line2,
        ward,
        district,
        city,
        country: restaurantForm.country || "",
        postalCode: restaurantForm.postalCode || "",
        lat: parseOptionalNumber(restaurantForm.lat),
        lng: parseOptionalNumber(restaurantForm.lng),
      },
      phone: restaurantForm.phone || "",
      email: restaurantForm.email || "",
      description:
        normalizeCustomerInfo(restaurantForm.customerInfo).story || "",
      about: normalizedCustomerInfo.story || "",
      chef: normalizedCustomerInfo.chef || "",
      suitableFor: normalizedCustomerInfo.suitableFor || [],
      amenities: {
        wifi: Boolean(restaurantForm.amenities?.wifi),
        parking: Boolean(restaurantForm.amenities?.parking),
        card: Boolean(restaurantForm.amenities?.card),
      },
      notesOnAmenities: JSON.stringify(normalizedCustomerInfo),
    };
  }, [restaurantForm, selectedRestaurantId]);

  const pushPreviewUpdate = (payload) => {
    const iframeWindow = previewIframeRef.current?.contentWindow;
    if (!iframeWindow || !payload) return;
    iframeWindow.postMessage(
      {
        type: "restaurant-preview:update",
        payload,
      },
      window.location.origin,
    );
  };

  useEffect(() => {
    if (!selectedRestaurantId) return;
    pushPreviewUpdate(previewRestaurantData);
  }, [previewRestaurantData, selectedRestaurantId]);

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

    const normalizedCustomerInfo = normalizeCustomerInfo(
      restaurantForm.customerInfo,
    );
    const capabilities = {
      ...DEFAULT_RESTAURANT_CAPABILITIES,
      ...(restaurantForm.capabilities || {}),
    };

    const amenityList = [
      restaurantForm.amenities?.wifi ? "wifi" : null,
      restaurantForm.amenities?.parking ? "parking" : null,
      restaurantForm.amenities?.card ? "card" : null,
      ...normalizedCustomerInfo.extraAmenities,
    ].filter(Boolean);

    try {
      const updateResult = await updateRestaurant({
        variables: {
          id: selectedRestaurantId,
          input: {
            name: restaurantForm.name,
            phone: restaurantForm.phone || null,
            email: restaurantForm.email || null,
            description: normalizedCustomerInfo.story || null,
            openingHours: restaurantForm.openingHours || null,
            closingHours: restaurantForm.closingHours || null,
            notesOnHours: restaurantForm.notesOnHours || null,
            cuisineType: restaurantForm.cuisineType || null,
            priceRange: restaurantForm.priceRange || null,
            status: restaurantForm.status || "active",
            capabilities,
            avatar: restaurantForm.avatar || null,
            coverImage: restaurantForm.coverImage || null,
            seatingCapacity: parseOptionalNumber(restaurantForm.seatingCapacity) ?? 0,
            amenities: amenityList,
            notesOnAmenities: JSON.stringify(normalizedCustomerInfo),
            address: {
              line1: restaurantForm.line1 || null,
              line2: restaurantForm.line2 || null,
              ward: restaurantForm.ward || null,
              district: restaurantForm.district || null,
              city: restaurantForm.city || null,
              country: restaurantForm.country || null,
              postalCode: restaurantForm.postalCode || null,
              lat: parseOptionalNumber(restaurantForm.lat),
              lng: parseOptionalNumber(restaurantForm.lng),
            },
            reservationSettings: {
              baseDepositAmount: Number(restaurantForm.reservationSettings?.baseDepositAmount || 0),
              menuDepositPercent: Number(restaurantForm.reservationSettings?.menuDepositPercent || 50),
              changeTimeFee: Number(restaurantForm.reservationSettings?.changeTimeFee || 0),
              changeTableFee: Number(restaurantForm.reservationSettings?.changeTableFee || 0),
              vatRate: Number(restaurantForm.reservationSettings?.vatRate || 0),
              serviceFee: Number(restaurantForm.reservationSettings?.serviceFee || 0),
            },
            paymentSettings: {
              defaultProvider: restaurantForm.paymentSettings?.defaultProvider || "momo",
              providers: (restaurantForm.paymentSettings?.providers || [])
                .filter((p) => ["momo", "vnpay"].includes(String(p.provider || "").toLowerCase()))
                .map((p, idx) => ({
                  provider: String(p.provider || "").toLowerCase(),
                  label: p.label || (String(p.provider || "").toLowerCase() === "momo" ? "MoMo" : "VNPAY"),
                  active: p.active !== false,
                  priority: Number(p.priority ?? idx + 1),
                  mode: p.mode === "production" ? "production" : "sandbox",
                })),
            },
          },
        },
      });

      const gqlError = updateResult?.errors?.[0]?.message;
      const updatedRestaurant = updateResult?.data?.updateRestaurant;
      if (gqlError || !updatedRestaurant) {
        throw new Error(gqlError || "Mutation updateRestaurant không trả về dữ liệu");
      }

      const latest = await refetchRestaurantDetail();
      const latestRestaurant = latest?.data?.restaurant;
      const expectedNotes = JSON.stringify(normalizedCustomerInfo);
      const expectedAmenities = Array.from(new Set(amenityList)).sort();
      const actualAmenities = Array.isArray(latestRestaurant?.amenities)
        ? Array.from(new Set(latestRestaurant.amenities)).sort()
        : [];
      const hasMismatch = latestRestaurant
        ? [
            ["name", restaurantForm.name?.trim(), latestRestaurant.name || ""],
            ["phone", restaurantForm.phone?.trim() || "", latestRestaurant.phone || ""],
            ["email", restaurantForm.email?.trim() || "", latestRestaurant.email || ""],
            [
              "description",
              normalizedCustomerInfo.story || "",
              latestRestaurant.description || "",
            ],
            ["openingHours", restaurantForm.openingHours || "", latestRestaurant.openingHours || ""],
            ["closingHours", restaurantForm.closingHours || "", latestRestaurant.closingHours || ""],
            ["notesOnHours", restaurantForm.notesOnHours || "", latestRestaurant.notesOnHours || ""],
            ["cuisineType", restaurantForm.cuisineType || "", latestRestaurant.cuisineType || ""],
            ["priceRange", restaurantForm.priceRange || "", latestRestaurant.priceRange || ""],
            ["status", restaurantForm.status || "", latestRestaurant.status || ""],
            [
              "capabilities.acceptsOrders",
              String(capabilities.acceptsOrders),
              String(
                latestRestaurant.capabilities?.acceptsOrders ??
                  DEFAULT_RESTAURANT_CAPABILITIES.acceptsOrders,
              ),
            ],
            ["avatar", restaurantForm.avatar || "", latestRestaurant.avatar || ""],
            ["coverImage", restaurantForm.coverImage || "", latestRestaurant.coverImage || ""],
            [
              "seatingCapacity",
              String(Number(restaurantForm.seatingCapacity || 0)),
              String(Number(latestRestaurant.seatingCapacity || 0)),
            ],
            ["address.line1", restaurantForm.line1 || "", latestRestaurant.address?.line1 || ""],
            ["address.line2", restaurantForm.line2 || "", latestRestaurant.address?.line2 || ""],
            ["address.ward", restaurantForm.ward || "", latestRestaurant.address?.ward || ""],
            ["address.district", restaurantForm.district || "", latestRestaurant.address?.district || ""],
            ["address.city", restaurantForm.city || "", latestRestaurant.address?.city || ""],
            ["address.country", restaurantForm.country || "", latestRestaurant.address?.country || ""],
            ["address.postalCode", restaurantForm.postalCode || "", latestRestaurant.address?.postalCode || ""],
            [
              "address.lat",
              parseOptionalNumber(restaurantForm.lat) == null
                ? ""
                : String(parseOptionalNumber(restaurantForm.lat)),
              latestRestaurant.address?.lat == null ? "" : String(latestRestaurant.address.lat),
            ],
            [
              "address.lng",
              parseOptionalNumber(restaurantForm.lng) == null
                ? ""
                : String(parseOptionalNumber(restaurantForm.lng)),
              latestRestaurant.address?.lng == null ? "" : String(latestRestaurant.address.lng),
            ],
            ["notesOnAmenities", expectedNotes, latestRestaurant.notesOnAmenities || ""],
            ["amenities", JSON.stringify(expectedAmenities), JSON.stringify(actualAmenities)],
          ].some(([, expected, actual]) => (expected || "") !== (actual || ""))
        : false;

      if (hasMismatch) {
        message.warning(
          "Đã gửi yêu cầu lưu nhưng dữ liệu trả về chưa đồng bộ. Vui lòng tải lại trang hoặc kiểm tra lại API.",
        );
        setIsDirty(true);
        return;
      }

      setIsDirty(false);
      message.success("Cập nhật thông tin nhà hàng thành công");
    } catch (error) {
      saveDraftToLocal("Bản nháp tự động khi lỗi mạng");
      message.error(
        error?.message || "Không thể cập nhật thông tin. Đã lưu bản nháp cục bộ.",
      );
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

  const onSelectChef = (staff) => {
    if (!staff) return;
    updateCustomerInfoField("chef", staff.fullName || "");
    setChefPickerOpen(false);
    message.success(`Đã chọn bếp trưởng: ${staff.fullName}`);
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
        style={{ display: "none" }}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) =>
          handleUploadRestaurantImage("coverImage", e.target.files?.[0])
        }
      />
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        hidden
        style={{ display: "none" }}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) =>
          handleUploadRestaurantImage("avatar", e.target.files?.[0])
        }
      />

      {/* Cover Image Area */}
      <div
        className="cover-image-area"
        style={{
          backgroundImage: restaurantForm.coverImage
            ? `url(${restaurantForm.coverImage})`
            : COVER_PLACEHOLDER,
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
            src={restaurantForm.avatar || AVATAR_PLACEHOLDER}
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
          <div><Tag color={restaurantForm.brandId ? "blue" : "default"}>{restaurantForm.brandName || "Nhà hàng chưa gán chuỗi"}</Tag></div>
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
                    <Col span={12}>
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
                    <Col span={6}>
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
                    <Col span={6}>
                      <Form.Item label="Nhận đơn từ xa">
                        <Space direction="vertical" size={2}>
                          <Switch
                            aria-label="Nhận đơn từ xa"
                            checked={restaurantForm.capabilities?.acceptsOrders !== false}
                            checkedChildren="Bật"
                            unCheckedChildren="Tắt"
                            onChange={(checked) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                capabilities: {
                                  ...DEFAULT_RESTAURANT_CAPABILITIES,
                                  ...(p.capabilities || {}),
                                  acceptsOrders: checked,
                                },
                              }))
                            }
                          />
                          <Text type="secondary">Áp dụng cho đơn khách đặt ngoài bàn.</Text>
                        </Space>
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

                  <Form.Item label="Mô tả ngắn hiển thị">
                    <div className="ai-textarea-wrapper">
                      <TextArea
                        rows={4}
                        value={restaurantForm.customerInfo?.story}
                        onChange={(e) =>
                          updateCustomerInfoField("story", e.target.value)
                        }
                        showCount
                        maxLength={1200}
                        placeholder="Nhập câu chuyện thương hiệu hiển thị ở phần 'Về chúng tôi'"
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

                  <Form.Item label="Bếp trưởng điều hành">
                    <Space.Compact style={{ width: "100%" }}>
                      <Input
                        value={restaurantForm.customerInfo?.chef || ""}
                        onChange={(e) =>
                          updateCustomerInfoField("chef", e.target.value)
                        }
                        placeholder="Chọn từ nhân viên hoặc nhập tên bếp trưởng"
                      />
                      <Button onClick={() => setChefPickerOpen(true)}>
                        Chọn từ nhân viên
                      </Button>
                    </Space.Compact>
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
                      <Col span={12}>
                        <Form.Item label="Địa chỉ bổ sung (line2)">
                          <Input
                            value={restaurantForm.line2}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                line2: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Phường / Xã">
                          <Input
                            value={restaurantForm.ward}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                ward: e.target.value,
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
                      <Col span={8}>
                        <Form.Item label="Quốc gia">
                          <Input
                            value={restaurantForm.country}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                country: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Mã bưu chính">
                          <Input
                            value={restaurantForm.postalCode}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                postalCode: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item label="Lat">
                          <Input
                            value={restaurantForm.lat}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                lat: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item label="Lng">
                          <Input
                            value={restaurantForm.lng}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                lng: e.target.value,
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
                      <Col span={8}>
                        <Form.Item label="Sức chứa (khách)">
                          <Input
                            value={restaurantForm.seatingCapacity}
                            onChange={(e) =>
                              setRestaurantForm((p) => ({
                                ...p,
                                seatingCapacity: e.target.value,
                              }))
                            }
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item label="Ghi chú giờ hoạt động">
                      <TextArea
                        rows={2}
                        value={restaurantForm.notesOnHours}
                        onChange={(e) =>
                          setRestaurantForm((p) => ({
                            ...p,
                            notesOnHours: e.target.value,
                          }))
                        }
                        placeholder="Ví dụ: nghỉ thứ 2 hàng tuần, lễ tết mở cửa theo lịch thông báo"
                      />
                    </Form.Item>
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
                      <button
                        type="button"
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
                      </button>
                      <button
                        type="button"
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
                      </button>
                      <button
                        type="button"
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
                      </button>
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
                              key={tag}
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
            {
              key: "4",
              label: (
                <span>
                  <CreditCardOutlined /> Thanh toán realtime
                </span>
              ),
              children: (
                <>
                  <Alert type="info" showIcon message="Chỉ hỗ trợ provider callback realtime: MoMo và VNPAY." style={{ marginBottom: 16 }} />
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="Provider mặc định">
                        <Select
                          value={restaurantForm.paymentSettings?.defaultProvider || "momo"}
                          onChange={(v) =>
                            setRestaurantForm((p) => ({
                              ...p,
                              paymentSettings: {
                                ...(p.paymentSettings || {}),
                                defaultProvider: v,
                              },
                            }))
                          }
                          options={[
                            { value: "momo", label: "MoMo" },
                            { value: "vnpay", label: "VNPAY" },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  {(restaurantForm.paymentSettings?.providers || []).map((provider, idx) => (
                    <Card key={provider.provider} size="small" style={{ marginBottom: 12 }} title={provider.provider === "momo" ? "MoMo" : "VNPAY"}>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item label="Label hiển thị">
                            <Input
                              value={provider.label}
                              onChange={(e) =>
                                setRestaurantForm((p) => {
                                  const providers = [...(p.paymentSettings?.providers || [])];
                                  providers[idx] = { ...providers[idx], label: e.target.value };
                                  return { ...p, paymentSettings: { ...(p.paymentSettings || {}), providers } };
                                })
                              }
                            />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item label="Ưu tiên">
                            <Input
                              type="number"
                              value={provider.priority}
                              onChange={(e) =>
                                setRestaurantForm((p) => {
                                  const providers = [...(p.paymentSettings?.providers || [])];
                                  providers[idx] = { ...providers[idx], priority: Number(e.target.value || 0) };
                                  return { ...p, paymentSettings: { ...(p.paymentSettings || {}), providers } };
                                })
                              }
                            />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item label="Môi trường">
                            <Select
                              value={provider.mode || "sandbox"}
                              onChange={(v) =>
                                setRestaurantForm((p) => {
                                  const providers = [...(p.paymentSettings?.providers || [])];
                                  providers[idx] = { ...providers[idx], mode: v };
                                  return { ...p, paymentSettings: { ...(p.paymentSettings || {}), providers } };
                                })
                              }
                              options={[
                                { value: "sandbox", label: "Sandbox" },
                                { value: "production", label: "Production" },
                              ]}
                            />
                          </Form.Item>
                        </Col>
                        <Col span={6}>
                          <Form.Item label="Kích hoạt">
                            <Switch
                              checked={provider.active !== false}
                              onChange={(checked) =>
                                setRestaurantForm((p) => {
                                  const providers = [...(p.paymentSettings?.providers || [])];
                                  providers[idx] = { ...providers[idx], active: checked };
                                  return { ...p, paymentSettings: { ...(p.paymentSettings || {}), providers } };
                                })
                              }
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ))}
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
      <ManagementPageHeader
        density="compact"
        showTimeWidget={false}
        eyebrow="RESTAURANT INFO"
        title="Hồ sơ nhà hàng"
        subtitle="Quản lý hình ảnh và thông tin hiển thị trên ứng dụng khách hàng"
        icon="🏪"
        selectedRestaurant={selectedRestaurantId}
        onRestaurantChange={setSelectedRestaurantId}
        restaurantList={restaurantOptions.map((r) => ({ id: r.id, name: r.name }))}
        restaurantDisabled={scopedRestaurantsLoading || allRestaurantsLoading}
        customFilters={(
          <select
            className="mph-select"
            value=""
            onChange={(e) => e.target.value && loadDraft(e.target.value)}
          >
            <option value="">Lịch sử bản nháp</option>
            {drafts.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        )}
        secondaryActions={[{ icon: "📝", label: "Lưu nháp", onClick: () => saveDraftToLocal() }]}
        primaryAction={{
          icon: "💾",
          label: "Lưu thay đổi",
          onClick: onSaveRestaurantInfo,
          loading: savingRestaurant,
          disabled: savingRestaurant,
        }}
        footerLeft={<span>{restaurantForm.status === "active" ? "Đang hoạt động" : "Tạm ngưng"}</span>}
        footerRight={<span>{isDirty ? "Có thay đổi chưa lưu" : "Đã đồng bộ"}</span>}
      />

      <section className="profile-focus-panel" aria-labelledby="restaurant-profile-focus-title">
        <div className="profile-focus-panel__copy">
          <span className="profile-focus-panel__eyebrow">Mặt tiền số của nhà hàng</span>
          <h2 id="restaurant-profile-focus-title">
            {restaurantForm.name || "Chọn nhà hàng để bắt đầu hoàn thiện hồ sơ"}
          </h2>
          <p>Ưu tiên các thông tin khách nhìn thấy đầu tiên: hình ảnh, địa chỉ, giờ phục vụ và câu chuyện thương hiệu.</p>
          <div className="profile-focus-panel__facts" aria-label="Tóm tắt hồ sơ">
            {quickProfileFacts.map((item) => (
              <span key={item.label}><strong>{item.label}</strong>{item.value}</span>
            ))}
          </div>
        </div>

        <div className="profile-completion-card" aria-label="Tiến độ hoàn thiện hồ sơ">
          <div className="profile-completion-card__header">
            <span>Hoàn thiện hồ sơ</span>
            <strong>{profileChecklist.percent}%</strong>
          </div>
          <Progress percent={profileChecklist.percent} showInfo={false} strokeColor="#8f6a42" trailColor="#eadfce" />
          <ul>
            {profileChecklist.checks.map((item) => (
              <li key={item.key} className={item.done ? "is-done" : ""}>
                <span aria-hidden="true">{item.done ? "✓" : "•"}</span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="quick-metrics-grid">
        <Card variant="borderless" className="metric-card">
          <Badge color="#6366f1" />
          <Text type="secondary" className="metric-subtitle">Đánh giá trung bình</Text>
          <Title level={4} className="metric-value">{Number(restaurantForm.avgRating || 0).toFixed(1)} / 5</Title>
        </Card>
        <Card variant="borderless" className="metric-card">
          <Badge color="#0ea5e9" />
          <Text type="secondary" className="metric-subtitle">Danh mục hiển thị</Text>
          <Title level={4} className="metric-value">
            {activeIndex?.distinctCategoryCount || categories.length || 0}
          </Title>
        </Card>
        <Card variant="borderless" className="metric-card">
          <Badge color="#f59e0b" />
          <Text type="secondary" className="metric-subtitle">Số tầng / số bàn</Text>
          <Title level={4} className="metric-value">
            {(layoutMetricsData?.floors || []).length} / {(layoutMetricsData?.tables || []).length}
          </Title>
        </Card>
      </div>

      <Row gutter={[24, 24]} className="main-layout">
        <Col xs={24} xl={14} xxl={15}>
          <Card
            className="saas-card edit-card"
            variant="borderless"
            styles={{ body: { padding: 0 } }}
          >
            {restaurantDetailLoading ? (
              <div style={{ padding: 24 }}>
                <Skeleton active paragraph={{ rows: 8 }} />
              </div>
            ) : restaurantDetailError ? (
              <div style={{ padding: 24 }}>
                <Text type="danger">
                  Không tải được thông tin nhà hàng. Vui lòng thử lại.
                </Text>
              </div>
            ) : (
              renderRestaurantForm()
            )}
          </Card>

          {/* Category Status Section */}
          <Card
            className="saas-card category-card"
            title="Trạng thái thực đơn"
            variant="borderless"
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
          {/* LIVE PREVIEW */}
          <div className="preview-wrapper">
            <div className="preview-header">
              <div className="preview-label">
                <FileTextOutlined /> Xem trước (Live Preview)
              </div>
            </div>

            <div className="preview-stage">
              <div className="desktop-preview-card">
                {selectedRestaurantId ? (
                  <iframe
                    ref={previewIframeRef}
                    title="RestaurantDetail Preview"
                    src={`/preview/restaurant/${selectedRestaurantId}?preview=1`}
                    className="desktop-iframe"
                    onLoad={() => pushPreviewUpdate(previewRestaurantData)}
                  />
                ) : (
                  <div className="empty-preview">
                    <ShopOutlined style={{ fontSize: 32, color: "#ccc" }} />
                    <p>Vui lòng chọn nhà hàng</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Col>
      </Row>

      <Modal
        title="Chọn bếp trưởng từ danh sách nhân viên"
        open={chefPickerOpen}
        onCancel={() => setChefPickerOpen(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Input.Search
            allowClear
            placeholder="Tìm theo tên, vai trò, chức danh"
            value={chefSearch}
            onChange={(e) => setChefSearch(e.target.value)}
          />

          <List
            loading={staffListLoading}
            locale={{
              emptyText: "Không có nhân viên phù hợp trong nhà hàng này",
            }}
            dataSource={chefCandidates}
            renderItem={(staff) => (
              <List.Item
                actions={[
                  <Button
                    key={staff.id}
                    type="primary"
                    onClick={() => onSelectChef(staff)}
                  >
                    Chọn
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={staff.fullName}
                  description={`${staff.positionTitle || "Nhân viên"} · ${
                    staff.roleName || "Không rõ vai trò"
                  }`}
                />
              </List.Item>
            )}
          />
        </Space>
      </Modal>
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
