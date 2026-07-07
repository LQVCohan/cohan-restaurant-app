import React, { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { message } from "antd";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import useBrandManagement, { MY_BRANDS_QUERY } from "@/hooks/useBrandManagement";
import "./BrandManagement.css";

const UPDATE_BRAND = gql`
  mutation UpdateBrand($id: ID!, $input: UpdateBrandInput!) {
    updateBrand(id: $id, input: $input) {
      id
      name
      slug
      businessName
      businessEmail
      businessPhone
      status
    }
  }
`;

const CREATE_RESTAURANT = gql`
  mutation CreateRestaurant($input: CreateRestaurantInput!) {
    createRestaurant(input: $input) {
      id
      name
      brandId
    }
  }
`;

const MEMBERS = gql`
  query BrandMembers($brandId: ID!) {
    brandMembers(brandId: $brandId) {
      id
      userId
      role
      status
      user {
        id
        fullName
        email
      }
      restaurantIds
    }
  }
`;

const ADD_MEMBER = gql`
  mutation AddBrandMember($input: AddBrandMemberInput!) {
    addBrandMember(input: $input) {
      id
      role
      status
      restaurantIds
    }
  }
`;

const UPDATE_MEMBER = gql`
  mutation UpdateBrandMember($input: UpdateBrandMemberInput!) {
    updateBrandMember(input: $input) {
      id
      role
      status
      restaurantIds
    }
  }
`;

const BRAND_STATUS_LABELS = {
  active: "Đang hoạt động",
  inactive: "Tạm ngưng",
  suspended: "Bị đình chỉ",
};

const MEMBER_STATUS_LABELS = {
  active: "Đang hoạt động",
  inactive: "Tạm ngưng",
  invited: "Đang chờ tham gia",
};

const ROLE_OPTIONS = ["admin", "manager", "staff"];
const CHAIN_ROLE_LABELS = {
  owner: "Chủ chuỗi nhà hàng",
  admin: "Quản trị chuỗi",
  manager: "Quản lý chi nhánh",
  staff: "Nhân viên chi nhánh",
};

const normalizeChainRole = (value) =>
  String(typeof value === "string" ? value : value?.role || "")
    .trim()
    .toLowerCase();

const getChainRoleLabel = (value) =>
  CHAIN_ROLE_LABELS[normalizeChainRole(value)] || null;

const getChainScopeLabel = (membership, restaurants = [], chainName = "") => {
  const role = normalizeChainRole(membership);
  if (["owner", "admin"].includes(role)) {
    return chainName ? `Toàn bộ chuỗi ${chainName}` : "Toàn bộ chuỗi";
  }

  const restaurantIds = [...new Set((membership?.restaurantIds || []).map(String))];
  const restaurantById = new Map(
    restaurants.map((restaurant) => [String(restaurant.id), restaurant.name]),
  );
  const names = restaurantIds
    .map((restaurantId) => restaurantById.get(restaurantId) || restaurantId)
    .filter(Boolean);

  if (role === "manager") return names[0] || "Chưa gán chi nhánh";
  if (role === "staff") return names.length ? names.join(", ") : "Chưa gán chi nhánh";
  return "Chưa có phạm vi";
};

const emptyBrandForm = {
  name: "",
  slug: "",
  businessName: "",
  businessEmail: "",
  businessPhone: "",
};

const emptyMemberForm = {
  userId: "",
  role: "manager",
  restaurantIds: [],
};

const getAssignedManagerByRestaurant = (members = []) =>
  new Map(
    members
      .filter(
        (member) =>
          member.role === "manager" &&
          member.status === "active" &&
          member.restaurantIds?.[0],
      )
      .map((member) => [String(member.restaurantIds[0]), member]),
  );

const getInitials = (value = "") =>
  String(value)
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "CH";

const trimOrNull = (value) => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const getErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message || error?.message || fallback;

const isValidEmail = (value) =>
  !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

export default function BrandManagement() {
  const {
    brands,
    selectedBrandId,
    setSelectedBrandId,
    selectedBrand,
    setSelectedRestaurantId,
    refetch,
    loading,
    error,
  } = useBrandManagement();

  const [brandForm, setBrandForm] = useState(emptyBrandForm);
  const [brandErrors, setBrandErrors] = useState({});
  const [branchName, setBranchName] = useState("");
  const [branchError, setBranchError] = useState("");
  const [member, setMember] = useState(emptyMemberForm);
  const [memberFormError, setMemberFormError] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [changingMemberId, setChangingMemberId] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: memberData,
    loading: membersLoading,
    error: memberQueryError,
    refetch: refetchMembers,
  } = useQuery(MEMBERS, {
    variables: { brandId: selectedBrandId },
    skip: !selectedBrandId,
    fetchPolicy: "cache-and-network",
  });

  const [updateBrand, { loading: savingBrand }] = useMutation(UPDATE_BRAND, {
    refetchQueries: [MY_BRANDS_QUERY],
    awaitRefetchQueries: true,
  });
  const [createRestaurant, { loading: creatingBranch }] = useMutation(
    CREATE_RESTAURANT,
    {
      refetchQueries: [MY_BRANDS_QUERY],
      awaitRefetchQueries: true,
    },
  );
  const [addMember, { loading: addingMember }] = useMutation(ADD_MEMBER);
  const [updateMember] = useMutation(UPDATE_MEMBER);

  useEffect(() => {
    if (!selectedBrand) {
      setBrandForm(emptyBrandForm);
      return;
    }

    setBrandForm({
      name: selectedBrand.name || "",
      slug: selectedBrand.slug || "",
      businessName: selectedBrand.businessName || "",
      businessEmail: selectedBrand.businessEmail || "",
      businessPhone: selectedBrand.businessPhone || "",
    });
    setBrandErrors({});
  }, [selectedBrand]);

  useEffect(() => {
    setBranchName("");
    setBranchError("");
    setMember(emptyMemberForm);
    setMemberFormError("");
    setMemberSearch("");
  }, [selectedBrandId]);

  const members = memberData?.brandMembers || [];
  const restaurants = selectedBrand?.restaurants || [];
  const assignedManagerByRestaurant = useMemo(
    () => getAssignedManagerByRestaurant(members),
    [members],
  );

  const totalBranchCount = useMemo(
    () =>
      brands.reduce(
        (total, brand) =>
          total + Number(brand.restaurantCount ?? brand.restaurants?.length ?? 0),
        0,
      ),
    [brands],
  );

  const activeMemberCount = members.filter(
    (currentMember) => currentMember.status === "active",
  ).length;

  const filteredMembers = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase();
    if (!keyword) return members;

    return members.filter((currentMember) => {
      const roleLabel = getChainRoleLabel(currentMember) || "";
      const scopeLabel = getChainScopeLabel(
        currentMember,
        restaurants,
        selectedBrand?.name,
      );
      const statusLabel = MEMBER_STATUS_LABELS[currentMember.status] || "";
      return [
        currentMember.user?.fullName,
        currentMember.user?.email,
        currentMember.userId,
        roleLabel,
        scopeLabel,
        statusLabel,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [memberSearch, members, restaurants, selectedBrand?.name]);

  const validateBrand = () => {
    const nextErrors = {};
    if (!brandForm.name.trim()) nextErrors.name = "Nhập tên chuỗi nhà hàng.";
    if (!brandForm.slug.trim()) {
      nextErrors.slug = "Nhập đường dẫn định danh cho chuỗi.";
    }
    if (!isValidEmail(brandForm.businessEmail)) {
      nextErrors.businessEmail = "Email doanh nghiệp chưa đúng định dạng.";
    }
    setBrandErrors(nextErrors);
    return !Object.keys(nextErrors).length;
  };

  const saveBrand = async (event) => {
    event.preventDefault();
    if (!selectedBrand || !validateBrand()) return;

    try {
      await updateBrand({
        variables: {
          id: selectedBrand.id,
          input: {
            name: brandForm.name.trim(),
            slug: brandForm.slug.trim(),
            businessName: trimOrNull(brandForm.businessName),
            businessEmail: trimOrNull(brandForm.businessEmail),
            businessPhone: trimOrNull(brandForm.businessPhone),
          },
        },
      });
      message.success("Đã lưu thông tin chuỗi nhà hàng");
    } catch (mutationError) {
      message.error(
        getErrorMessage(mutationError, "Không thể lưu thông tin chuỗi nhà hàng."),
      );
    }
  };

  const addBranch = async () => {
    const normalizedName = branchName.trim();
    if (!selectedBrandId) return;
    if (!normalizedName) {
      setBranchError("Nhập tên chi nhánh mới.");
      return;
    }

    setBranchError("");
    try {
      const result = await createRestaurant({
        variables: {
          input: { name: normalizedName, brandId: selectedBrandId },
        },
      });
      const newRestaurantId = result?.data?.createRestaurant?.id;
      if (newRestaurantId) setSelectedRestaurantId(newRestaurantId);
      setBranchName("");
      message.success(`Đã thêm chi nhánh ${normalizedName}`);
    } catch (mutationError) {
      setBranchError(
        getErrorMessage(mutationError, "Không thể thêm chi nhánh mới."),
      );
    }
  };

  const validateMember = () => {
    if (!member.userId.trim()) return "Nhập mã tài khoản của thành viên.";
    if (member.role === "manager" && member.restaurantIds.length !== 1) {
      return "Quản lý chi nhánh phải phụ trách đúng một chi nhánh.";
    }
    if (member.role === "staff" && !member.restaurantIds.length) {
      return "Nhân viên phải được gán ít nhất một chi nhánh.";
    }
    return "";
  };

  const saveMember = async () => {
    if (!selectedBrandId) return;
    const validationError = validateMember();
    if (validationError) {
      setMemberFormError(validationError);
      return;
    }

    setMemberFormError("");
    try {
      await addMember({
        variables: {
          input: {
            brandId: selectedBrandId,
            userId: member.userId.trim(),
            role: member.role,
            restaurantIds:
              member.role === "admin" ? [] : member.restaurantIds,
          },
        },
      });
      setMember(emptyMemberForm);
      await refetchMembers?.();
      message.success("Đã cập nhật thành viên trong chuỗi");
    } catch (mutationError) {
      setMemberFormError(
        getErrorMessage(mutationError, "Không thể cập nhật thành viên."),
      );
    }
  };

  const toggleMemberRestaurant = (restaurantId) => {
    setMember((current) => ({
      ...current,
      restaurantIds: current.restaurantIds.includes(restaurantId)
        ? current.restaurantIds.filter((id) => id !== restaurantId)
        : [...current.restaurantIds, restaurantId],
    }));
    setMemberFormError("");
  };

  const toggleMemberStatus = async (currentMember) => {
    const nextStatus = currentMember.status === "active" ? "inactive" : "active";
    setChangingMemberId(currentMember.id);
    try {
      await updateMember({
        variables: {
          input: { id: currentMember.id, status: nextStatus },
        },
      });
      await refetchMembers?.();
      message.success(
        nextStatus === "active"
          ? "Đã kích hoạt thành viên"
          : "Đã tạm ngưng thành viên",
      );
    } catch (mutationError) {
      message.error(
        getErrorMessage(mutationError, "Không thể đổi trạng thái thành viên."),
      );
    } finally {
      setChangingMemberId("");
    }
  };

  const refreshPage = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch?.(),
        selectedBrandId ? refetchMembers?.() : Promise.resolve(),
      ]);
      message.success("Đã cập nhật dữ liệu mới nhất");
    } catch (refreshError) {
      message.error(getErrorMessage(refreshError, "Không thể làm mới dữ liệu."));
    } finally {
      setRefreshing(false);
    }
  };

  const updateBrandField = (field, value) => {
    setBrandForm((current) => ({ ...current, [field]: value }));
    if (brandErrors[field]) {
      setBrandErrors((current) => ({ ...current, [field]: "" }));
    }
  };

  const openBranchDashboard = (restaurantId) => {
    const nextRestaurantId = String(restaurantId);
    setSelectedRestaurantId(nextRestaurantId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("manager:navigate", {
        detail: {
          page: "dashboard",
          query: { restaurantId: nextRestaurantId },
          source: "brand-management",
        },
      }));
    }
  };

  const selectedRoleLabel = selectedBrand
    ? getChainRoleLabel(
      selectedBrand.membership?.role || selectedBrand.membershipRole,
    )
    : null;
  const selectedStatusLabel = selectedBrand
    ? BRAND_STATUS_LABELS[selectedBrand.status] || "Không xác định"
    : "Chưa chọn chuỗi";

  return (
    <main className="brand-management">
      <ManagementPageHeader
        density="compact"
        showTimeWidget={false}
        eyebrow="QUẢN TRỊ CHUỖI"
        title="Quản lý chuỗi nhà hàng"
        subtitle="Cập nhật thông tin chuỗi, tổ chức chi nhánh và phân phạm vi cho từng thành viên."
        icon="🏢"
        stats={[
          {
            id: "chains",
            label: "Chuỗi đang quản lý",
            value: brands.length,
            icon: "◫",
          },
          {
            id: "branches",
            label: "Tổng chi nhánh",
            value: totalBranchCount,
            icon: "⌂",
          },
          {
            id: "members",
            label: "Thành viên hoạt động",
            value: activeMemberCount,
            icon: "◎",
          },
        ]}
        loading={loading}
        customFilters={(
          <select
            className="mph-select"
            aria-label="Chọn chuỗi nhà hàng"
            value={selectedBrandId || ""}
            onChange={(event) => setSelectedBrandId(event.target.value)}
            disabled={loading || !brands.length}
          >
            {!brands.length && <option value="">Chưa có chuỗi nhà hàng</option>}
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        )}
        secondaryActions={[
          {
            icon: "↻",
            label: "Làm mới",
            onClick: refreshPage,
            loading: refreshing,
          },
        ]}
        footerLeft={selectedRoleLabel ? `Quyền hiện tại: ${selectedRoleLabel}` : null}
        footerRight={`Trạng thái chuỗi: ${selectedStatusLabel}`}
      />

      {error && (
        <div className="brand-alert brand-alert--danger" role="alert">
          <strong>Không tải được danh sách chuỗi.</strong>
          <span>{getErrorMessage(error, "Vui lòng thử lại sau.")}</span>
        </div>
      )}

      {loading && !brands.length && (
        <div className="brand-loading-grid" aria-label="Đang tải dữ liệu chuỗi">
          <div className="brand-skeleton brand-skeleton--hero" />
          <div className="brand-skeleton" />
          <div className="brand-skeleton" />
        </div>
      )}

      {!loading && !brands.length && !error && (
        <section className="brand-empty-state">
          <span className="brand-empty-state__icon" aria-hidden="true">🏢</span>
          <h2>Chưa có chuỗi nhà hàng</h2>
          <p>
            Tài khoản doanh nghiệp cần tạo chuỗi từ luồng đăng ký thương hiệu
            trước khi quản lý chi nhánh và thành viên tại đây.
          </p>
        </section>
      )}

      {selectedBrand && (
        <>
          <section className="brand-identity-panel" aria-labelledby="selected-chain-title">
            <div className="brand-identity-panel__logo" aria-hidden={!selectedBrand.logoUrl}>
              {selectedBrand.logoUrl ? (
                <img src={selectedBrand.logoUrl} alt={`Logo ${selectedBrand.name}`} />
              ) : (
                <span>{getInitials(selectedBrand.name)}</span>
              )}
            </div>
            <div className="brand-identity-panel__copy">
              <span className="brand-kicker">Chuỗi đang được cấu hình</span>
              <h2 id="selected-chain-title">{selectedBrand.name}</h2>
              <p>
                Quản lý tập trung thông tin doanh nghiệp, chi nhánh và thành viên
                trong cùng một không gian vận hành.
              </p>
            </div>
            <div className="brand-identity-panel__facts" aria-label="Tóm tắt chuỗi">
              <span>
                <strong>{restaurants.length}</strong>
                Chi nhánh
              </span>
              <span>
                <strong>{activeMemberCount}</strong>
                Thành viên hoạt động
              </span>
              <span>
                <strong>{selectedBrand.slug}</strong>
                Định danh
              </span>
            </div>
          </section>

          <section className="brand-workspace">
            <form className="brand-panel brand-settings-panel" onSubmit={saveBrand}>
              <div className="brand-panel__header">
                <div>
                  <span className="brand-panel__eyebrow">HỒ SƠ CHUỖI</span>
                  <h3>Thông tin doanh nghiệp</h3>
                  <p>Dữ liệu dùng chung cho toàn bộ chi nhánh trong chuỗi.</p>
                </div>
                <span className={`brand-status brand-status--${selectedBrand.status}`}>
                  {selectedStatusLabel}
                </span>
              </div>

              <div className="brand-form-grid">
                <label className="brand-field">
                  <span>Tên chuỗi <b>*</b></span>
                  <input
                    value={brandForm.name}
                    onChange={(event) => updateBrandField("name", event.target.value)}
                    aria-invalid={Boolean(brandErrors.name)}
                    aria-describedby={brandErrors.name ? "brand-name-error" : undefined}
                    placeholder="Ví dụ: Cohan Restaurant"
                  />
                  {brandErrors.name && (
                    <small id="brand-name-error" className="brand-field__error">
                      {brandErrors.name}
                    </small>
                  )}
                </label>

                <label className="brand-field">
                  <span>Đường dẫn định danh <b>*</b></span>
                  <input
                    value={brandForm.slug}
                    onChange={(event) => updateBrandField("slug", event.target.value)}
                    aria-invalid={Boolean(brandErrors.slug)}
                    aria-describedby={brandErrors.slug ? "brand-slug-error" : "brand-slug-help"}
                    placeholder="cohan-restaurant"
                  />
                  {brandErrors.slug ? (
                    <small id="brand-slug-error" className="brand-field__error">
                      {brandErrors.slug}
                    </small>
                  ) : (
                    <small id="brand-slug-help">Dùng trong đường dẫn và tích hợp hệ thống.</small>
                  )}
                </label>

                <label className="brand-field">
                  <span>Tên pháp lý</span>
                  <input
                    value={brandForm.businessName}
                    onChange={(event) => updateBrandField("businessName", event.target.value)}
                    placeholder="Tên doanh nghiệp trên giấy phép"
                  />
                </label>

                <label className="brand-field">
                  <span>Email doanh nghiệp</span>
                  <input
                    type="email"
                    value={brandForm.businessEmail}
                    onChange={(event) => updateBrandField("businessEmail", event.target.value)}
                    aria-invalid={Boolean(brandErrors.businessEmail)}
                    aria-describedby={
                      brandErrors.businessEmail ? "brand-email-error" : undefined
                    }
                    placeholder="contact@restaurant.vn"
                  />
                  {brandErrors.businessEmail && (
                    <small id="brand-email-error" className="brand-field__error">
                      {brandErrors.businessEmail}
                    </small>
                  )}
                </label>

                <label className="brand-field">
                  <span>Số điện thoại doanh nghiệp</span>
                  <input
                    inputMode="tel"
                    value={brandForm.businessPhone}
                    onChange={(event) => updateBrandField("businessPhone", event.target.value)}
                    placeholder="Ví dụ: 0908 000 000"
                  />
                </label>
              </div>

              <div className="brand-panel__footer">
                <span>Để trống trường không bắt buộc để xóa dữ liệu cũ.</span>
                <button
                  type="submit"
                  className="brand-button brand-button--primary"
                  disabled={savingBrand}
                >
                  {savingBrand ? "Đang lưu..." : "Lưu thông tin chuỗi"}
                </button>
              </div>
            </form>

            <section className="brand-panel brand-branches-panel" aria-labelledby="branches-title">
              <div className="brand-panel__header">
                <div>
                  <span className="brand-panel__eyebrow">MẠNG LƯỚI VẬN HÀNH</span>
                  <h3 id="branches-title">Chi nhánh</h3>
                  <p>Chọn chi nhánh để chuyển nhanh phạm vi quản lý trên dashboard.</p>
                </div>
                <span className="brand-count-badge">{restaurants.length}</span>
              </div>

              <div className="brand-branch-list">
                {restaurants.length ? (
                  restaurants.map((restaurant) => {
                    const assignedManager = assignedManagerByRestaurant.get(
                      String(restaurant.id),
                    );
                    return (
                      <article className="brand-branch-card" key={restaurant.id}>
                        <div className="brand-branch-card__avatar">
                          {restaurant.avatar ? (
                            <img src={restaurant.avatar} alt={`Ảnh ${restaurant.name}`} />
                          ) : (
                            <span>{getInitials(restaurant.name)}</span>
                          )}
                        </div>
                        <div className="brand-branch-card__body">
                          <strong>{restaurant.name}</strong>
                          <span>
                            {assignedManager?.user?.fullName
                              ? `Quản lý: ${assignedManager.user.fullName}`
                              : "Chưa phân công quản lý"}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="brand-link-button"
                          onClick={() => openBranchDashboard(restaurant.id)}
                        >
                          Mở dashboard
                        </button>
                      </article>
                    );
                  })
                ) : (
                  <div className="brand-inline-empty">
                    <span aria-hidden="true">⌂</span>
                    <p>Chuỗi này chưa có chi nhánh.</p>
                  </div>
                )}
              </div>

              <div className="brand-create-row">
                <label className="brand-field">
                  <span>Tên chi nhánh mới</span>
                  <input
                    value={branchName}
                    onChange={(event) => {
                      setBranchName(event.target.value);
                      setBranchError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addBranch();
                      }
                    }}
                    aria-invalid={Boolean(branchError)}
                    aria-describedby={branchError ? "branch-name-error" : undefined}
                    placeholder="Ví dụ: Cohan Nguyễn Huệ"
                  />
                  {branchError && (
                    <small id="branch-name-error" className="brand-field__error">
                      {branchError}
                    </small>
                  )}
                </label>
                <button
                  type="button"
                  className="brand-button brand-button--secondary"
                  onClick={addBranch}
                  disabled={creatingBranch}
                >
                  {creatingBranch ? "Đang thêm..." : "Thêm chi nhánh"}
                </button>
              </div>
            </section>
          </section>

          <section className="brand-panel brand-members-panel" aria-labelledby="members-title">
            <div className="brand-panel__header brand-panel__header--members">
              <div>
                <span className="brand-panel__eyebrow">PHÂN QUYỀN THEO PHẠM VI</span>
                <h3 id="members-title">Thành viên trong chuỗi</h3>
                <p>Gán vai trò và giới hạn đúng chi nhánh mà từng người phụ trách.</p>
              </div>
              <label className="brand-member-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  aria-label="Tìm thành viên trong chuỗi"
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  placeholder="Tìm theo tên, email hoặc vai trò"
                />
              </label>
            </div>

            <div className="brand-member-create">
              <div className="brand-member-create__grid">
                <label className="brand-field">
                  <span>Mã tài khoản</span>
                  <input
                    value={member.userId}
                    onChange={(event) => {
                      setMember((current) => ({
                        ...current,
                        userId: event.target.value,
                      }));
                      setMemberFormError("");
                    }}
                    placeholder="Nhập mã tài khoản cần thêm"
                  />
                  <small>Lấy mã tại hồ sơ nhân viên hoặc trang quản lý người dùng.</small>
                </label>

                <label className="brand-field">
                  <span>Vai trò trong chuỗi</span>
                  <select
                    aria-label="Vai trò trong chuỗi"
                    value={member.role}
                    onChange={(event) => {
                      setMember((current) => ({
                        ...current,
                        role: event.target.value,
                        restaurantIds: [],
                      }));
                      setMemberFormError("");
                    }}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {getChainRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="brand-button brand-button--primary brand-member-create__button"
                  onClick={saveMember}
                  disabled={addingMember}
                >
                  {addingMember ? "Đang thêm..." : "Thêm thành viên"}
                </button>
              </div>

              {member.role === "admin" && (
                <div className="brand-scope-note">
                  <strong>Phạm vi toàn chuỗi</strong>
                  <span>Quản trị chuỗi có thể làm việc với tất cả chi nhánh.</span>
                </div>
              )}

              {member.role === "manager" && (
                <label className="brand-field brand-scope-control">
                  <span>Chi nhánh phụ trách</span>
                  <select
                    aria-label="Chi nhánh phụ trách"
                    value={member.restaurantIds[0] || ""}
                    onChange={(event) => {
                      setMember((current) => ({
                        ...current,
                        restaurantIds: event.target.value
                          ? [event.target.value]
                          : [],
                      }));
                      setMemberFormError("");
                    }}
                  >
                    <option value="">Chọn một chi nhánh</option>
                    {restaurants.map((restaurant) => {
                      const assigned = assignedManagerByRestaurant.get(
                        String(restaurant.id),
                      );
                      return (
                        <option
                          key={restaurant.id}
                          value={restaurant.id}
                          disabled={Boolean(assigned)}
                        >
                          {restaurant.name}
                          {assigned ? " — đã có quản lý" : ""}
                        </option>
                      );
                    })}
                  </select>
                </label>
              )}

              {member.role === "staff" && (
                <fieldset className="brand-scope-fieldset">
                  <legend>Chi nhánh được làm việc</legend>
                  <div className="brand-scope-options">
                    {restaurants.map((restaurant) => (
                      <label key={restaurant.id}>
                        <input
                          type="checkbox"
                          checked={member.restaurantIds.includes(String(restaurant.id))}
                          onChange={() =>
                            toggleMemberRestaurant(String(restaurant.id))
                          }
                        />
                        <span>{restaurant.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {memberFormError && (
                <div className="brand-alert brand-alert--warning" role="alert">
                  {memberFormError}
                </div>
              )}
            </div>

            {memberQueryError && (
              <div className="brand-alert brand-alert--danger" role="alert">
                <strong>Không tải được thành viên.</strong>
                <span>
                  {getErrorMessage(memberQueryError, "Vui lòng làm mới và thử lại.")}
                </span>
              </div>
            )}

            <div className="brand-member-list" aria-busy={membersLoading}>
              {membersLoading && !members.length ? (
                [1, 2, 3].map((item) => (
                  <div key={item} className="brand-member-skeleton" />
                ))
              ) : filteredMembers.length ? (
                filteredMembers.map((currentMember) => {
                  const displayName =
                    currentMember.user?.fullName ||
                    currentMember.user?.email ||
                    currentMember.userId ||
                    "Tài khoản chưa có tên";
                  const roleLabel =
                    getChainRoleLabel(currentMember) || "Chưa có vai trò";
                  const scopeLabel = getChainScopeLabel(
                    currentMember,
                    restaurants,
                    selectedBrand.name,
                  );
                  const statusLabel =
                    MEMBER_STATUS_LABELS[currentMember.status] || "Không xác định";

                  return (
                    <article className="brand-member-card" key={currentMember.id}>
                      <div className="brand-member-card__avatar" aria-hidden="true">
                        {getInitials(displayName)}
                      </div>
                      <div className="brand-member-card__identity">
                        <strong>{displayName}</strong>
                        {currentMember.user?.email && (
                          <span>{currentMember.user.email}</span>
                        )}
                      </div>
                      <div className="brand-member-card__meta">
                        <span className="brand-role-badge">{roleLabel}</span>
                        <span>{scopeLabel}</span>
                      </div>
                      <div className="brand-member-card__status">
                        <span
                          className={`brand-status brand-status--${currentMember.status}`}
                        >
                          {statusLabel}
                        </span>
                        <button
                          type="button"
                          className="brand-link-button"
                          onClick={() => toggleMemberStatus(currentMember)}
                          disabled={changingMemberId === currentMember.id}
                        >
                          {changingMemberId === currentMember.id
                            ? "Đang xử lý..."
                            : currentMember.status === "active"
                              ? "Tạm ngưng"
                              : "Kích hoạt"}
                        </button>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="brand-inline-empty brand-inline-empty--members">
                  <span aria-hidden="true">◎</span>
                  <p>
                    {members.length
                      ? "Không có thành viên phù hợp với từ khóa tìm kiếm."
                      : "Chuỗi này chưa có thành viên nào ngoài tài khoản chủ sở hữu."}
                  </p>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
