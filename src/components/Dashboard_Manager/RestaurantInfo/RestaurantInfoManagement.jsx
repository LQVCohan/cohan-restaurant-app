import React, { useEffect, useMemo, useState } from "react";
import { gql, useMutation, useQuery } from "@apollo/client";
import {
  Layout,
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
} from "antd";
import {
  SaveOutlined,
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ShopOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  OrderedListOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  SettingOutlined,
} from "@ant-design/icons";
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
const CREATE_CATEGORY = gql`
  mutation CreateCategory($input: CreateCategoryInput!) {
    createCategory(input: $input) {
      id
      name
    }
  }
`;
const UPDATE_CATEGORY = gql`
  mutation UpdateCategory($input: UpdateCategoryInput!) {
    updateCategory(input: $input) {
      id
      name
      order
      isActive
    }
  }
`;
const DELETE_CATEGORY = gql`
  mutation DeleteCategory($id: ID!) {
    deleteCategory(id: $id)
  }
`;
const TOP_CATEGORIES_BY_RESTAURANT = gql`
  query TopCategoriesByRestaurant(
    $restaurantId: ID!
    $timeSlot: TimeSlot!
    $limit: Int
  ) {
    topCategoriesByMenuItemCount(
      restaurantId: $restaurantId
      timeSlot: $timeSlot
      limit: $limit
    ) {
      id
      name
      menuItemCount
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
const REFRESH_INDEXES = gql`
  mutation RefreshRestaurantCategoryIndexes($timeSlot: TimeSlot!) {
    refreshRestaurantCategoryIndexes(timeSlot: $timeSlot)
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
    }
  }
`;

const TIME_SLOTS = ["breakfast", "lunch", "dinner", "late_night"];

const RestaurantInfoManagement = ({ role = "manager" }) => {
  const [timeSlot, setTimeSlot] = useState("lunch");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");

  const [catFormInstance] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

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
    setRestaurantForm({
      name: r.name || "",
      phone: r.phone || "",
      email: r.email || "",
      description: r.description || "",
      openingHours: r.openingHours || "",
      closingHours: r.closingHours || "",
      cuisineType: r.cuisineType || "",
      priceRange: r.priceRange || "",
      status: r.status || "active",
      line1: r.address?.line1 || "",
      district: r.address?.district || "",
      city: r.address?.city || "",
    });
  }, [restaurantDetailData]);

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
    loading: categoryLoading,
    refetch: refetchCategories,
  } = useQuery(GET_CATEGORIES, {
    variables: { restaurantId: selectedRestaurantId, timeSlot },
    skip: !selectedRestaurantId || !timeSlot,
    fetchPolicy: "network-only",
  });

  const { data: topCategoryData, refetch: refetchTopCategories } = useQuery(
    TOP_CATEGORIES_BY_RESTAURANT,
    {
      variables: { restaurantId: selectedRestaurantId, timeSlot, limit: 6 },
      skip: !selectedRestaurantId || !timeSlot,
      fetchPolicy: "network-only",
    },
  );

  const categories = categoryData?.categories || [];
  const topCategories = topCategoryData?.topCategoriesByMenuItemCount || [];

  // --- MUTATIONS ---
  const [refreshIndexes, { loading: refreshing }] =
    useMutation(REFRESH_INDEXES);
  const [updateRestaurant, { loading: savingRestaurant }] =
    useMutation(UPDATE_RESTAURANT);
  const [createCategory, { loading: creatingCategory }] =
    useMutation(CREATE_CATEGORY);
  const [updateCategory, { loading: updatingCategory }] =
    useMutation(UPDATE_CATEGORY);
  const [deleteCategory] = useMutation(DELETE_CATEGORY);

  // --- HANDLERS ---

  const onRefresh = async () => {
    try {
      await refreshIndexes({ variables: { timeSlot } });
      await refetchIndexes();
      message.success("Đã refresh index thành công");
    } catch (error) {
      message.error(error.message || "Lỗi refresh index");
    }
  };


  const onSaveRestaurantInfo = async () => {
    if (!selectedRestaurantId) return;
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
            address: {
              line1: restaurantForm.line1 || null,
              district: restaurantForm.district || null,
              city: restaurantForm.city || null,
            },
          },
        },
      });
      await refetchRestaurantDetail();
      message.success("Cập nhật thông tin nhà hàng thành công");
    } catch {
      message.error("Không thể cập nhật thông tin");
    }
  };

  const openCategoryModal = (cat = null) => {
    setEditingCategory(cat);
    if (cat) {
      catFormInstance.setFieldsValue({
        name: cat.name,
        order: cat.order,
        isActive: cat.isActive,
      });
    } else {
      catFormInstance.resetFields();
      catFormInstance.setFieldsValue({ isActive: true, order: 0 });
    }
    setIsModalVisible(true);
  };

  const handleCategoryOk = async () => {
    try {
      const values = await catFormInstance.validateFields();
      if (editingCategory) {
        await updateCategory({
          variables: {
            input: {
              id: editingCategory.id,
              name: values.name.trim(),
              order: Number(values.order) || 0,
              isActive: Boolean(values.isActive),
            },
          },
        });
        message.success("Đã cập nhật category");
      } else {
        await createCategory({
          variables: {
            input: {
              restaurantId: selectedRestaurantId,
              timeSlot,
              name: values.name.trim(),
              order: Number(values.order) || 0,
            },
          },
        });
        message.success("Đã tạo category mới");
      }
      setIsModalVisible(false);
      await Promise.all([
        refetchCategories(),
        refetchTopCategories(),
        refetchIndexes(),
      ]);
    } catch {
      // Form validation error or API error
    }
  };

  const onDeleteCategory = (id) => {
    Modal.confirm({
      title: "Xoá Category?",
      content: "Hành động này không thể hoàn tác.",
      okText: "Xoá ngay",
      okType: "danger",
      cancelText: "Huỷ",
      onOk: async () => {
        try {
          await deleteCategory({ variables: { id } });
          await Promise.all([
            refetchCategories(),
            refetchTopCategories(),
            refetchIndexes(),
          ]);
          message.success("Đã xoá category");
        } catch {
          message.error("Lỗi khi xoá category");
        }
      },
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
                    rows={3}
                    value={restaurantForm.description}
                    onChange={(e) =>
                      setRestaurantForm((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    showCount
                    maxLength={500}
                  />
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
            ),
          },
        ]}
      />
    </Form>
  );

  const categoryColumns = [
    {
      title: "Tên Category",
      dataIndex: "name",
      key: "name",
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: "SL Món",
      dataIndex: "menuItemCount",
      key: "count",
      align: "center",
      render: (c) => (
        <Badge count={c} showZero color={c > 0 ? "#52c41a" : "#d9d9d9"} />
      ),
    },
    {
      title: "Vị trí",
      dataIndex: "order",
      key: "order",
      align: "center",
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "status",
      align: "center",
      render: (active) => (
        <Badge
          status={active ? "success" : "default"}
          text={active ? "Hiện" : "Ẩn"}
        />
      ),
    },
    {
      title: "",
      key: "action",
      width: 80,
      align: "right",
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="Sửa">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openCategoryModal(record)}
            />
          </Tooltip>
          <Tooltip title="Xoá">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onDeleteCategory(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const compactCategoryColumns = [
    {
      title: "Category",
      dataIndex: "name",
      key: "name",
      render: (text) => <span style={{ fontWeight: 500 }}>{text}</span>,
    },
    {
      title: "Số món",
      dataIndex: "menuItemCount",
      key: "count",
      align: "center",
      render: (c) => (
        <Badge count={c} showZero color={c > 0 ? "#52c41a" : "#d9d9d9"} />
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "status",
      align: "center",
      render: (active) => (
        <Badge
          status={active ? "success" : "default"}
          text={active ? "Hiện" : "Ẩn"}
        />
      ),
    },
  ];

  return (
    <div className="restaurant-management-container">
      {/* HEADER SECTION */}
      <div className="page-header">
        <div className="header-title">
          <Title level={3} style={{ margin: 0 }}>
            Quản lý Nhà hàng & Menu
          </Title>
          <Text type="secondary">
            Cấu hình thông tin và hiển thị món ăn theo khung giờ
          </Text>
        </div>
        <Space>
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
        <Col xs={24} xl={16}>
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

            <Card
              title="Bản xem nhanh thông tin khách hàng nhìn thấy"
              className="saas-card customer-preview-card"
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <div className="preview-item">
                    <span className="label">Tên nhà hàng</span>
                    <strong>{restaurantForm.name || "Đang cập nhật"}</strong>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div className="preview-item">
                    <span className="label">Loại ẩm thực</span>
                    <strong>{restaurantForm.cuisineType || "Đang cập nhật"}</strong>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div className="preview-item">
                    <span className="label">Điện thoại</span>
                    <strong>{restaurantForm.phone || "Đang cập nhật"}</strong>
                  </div>
                </Col>
                <Col xs={24} md={12}>
                  <div className="preview-item">
                    <span className="label">Giờ hoạt động</span>
                    <strong>
                      {restaurantForm.openingHours || "--:--"} - {restaurantForm.closingHours || "--:--"}
                    </strong>
                  </div>
                </Col>
                <Col span={24}>
                  <div className="preview-item">
                    <span className="label">Địa chỉ</span>
                    <strong>
                      {[restaurantForm.line1, restaurantForm.district, restaurantForm.city]
                        .filter(Boolean)
                        .join(", ") || "Đang cập nhật"}
                    </strong>
                  </div>
                </Col>
                <Col span={24}>
                  <div className="preview-item">
                    <span className="label">Mô tả</span>
                    <p>{restaurantForm.description || "Chưa có mô tả hiển thị cho khách."}</p>
                  </div>
                </Col>
              </Row>
            </Card>
          </Space>
        </Col>

        <Col xs={24} xl={8}>
          <Space direction="vertical" size={20} style={{ width: "100%" }}>
            <Card
              className="saas-card"
              title={
                <span>
                  <OrderedListOutlined /> Category (gọn)
                </span>
              }
              extra={
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={onRefresh}
                  loading={refreshing}
                >
                  Cập nhật từ món ăn
                </Button>
              }
            >
              <Text type="secondary">
                Category chỉ hiển thị ở mức tóm tắt để không chiếm nhiều không gian quản lý thông tin nhà hàng.
              </Text>

              <div className="index-overview-stats compact">
                <Statistic
                  title="Tổng category"
                  value={activeIndex?.distinctCategoryCount || categories.length || 0}
                />
                <Statistic
                  title="Đơn hàng/Đặt bàn"
                  value={`${activeIndex?.orderCount || 0}/${activeIndex?.reservationCount || 0}`}
                />
              </div>

              <Table
                dataSource={categories}
                columns={compactCategoryColumns}
                rowKey="id"
                loading={categoryLoading}
                pagination={{ pageSize: 5, showSizeChanger: false }}
                size="small"
                style={{ marginTop: 12 }}
              />

              {topCategories.length > 0 && (
                <div className="top-categories-inline">
                  <Text type="secondary">Top:</Text>
                  {topCategories.slice(0, 3).map((cat) => (
                    <Tag color="geekblue" key={cat.id}>
                      {cat.name}
                    </Tag>
                  ))}
                </div>
              )}

              <Collapse
                size="small"
                style={{ marginTop: 12 }}
                items={[
                  {
                    key: "advanced-categories",
                    label: "Mở quản lý category nâng cao",
                    children: (
                      <Table
                        dataSource={categories}
                        columns={categoryColumns}
                        rowKey="id"
                        loading={categoryLoading}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                        scroll={{ y: "calc(100vh - 560px)" }}
                      />
                    ),
                  },
                ]}
              />
            </Card>
          </Space>
        </Col>
      </Row>

      {/* MODAL FORM */}
      <Modal
        title={editingCategory ? "Cập nhật Category" : "Thêm Category Mới"}
        open={isModalVisible}
        onOk={handleCategoryOk}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={creatingCategory || updatingCategory}
        centered
        destroyOnClose
      >
        <Form
          form={catFormInstance}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="name"
            label="Tên Category"
            rules={[{ required: true, message: "Vui lòng nhập tên" }]}
          >
            <Input placeholder="Ví dụ: Món khai vị" size="large" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="order"
                label="Thứ tự hiển thị"
                tooltip="Số nhỏ xếp trước"
              >
                <Input type="number" style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="isActive"
                label="Trạng thái"
                valuePropName="checked"
              >
                <Switch checkedChildren="Hiện" unCheckedChildren="Ẩn" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
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
