import React, { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { message } from "antd";
import ManagementPageHeader from "../shared/ManagementPageHeader";
import useBrandManagement, { MY_BRANDS_QUERY } from "@/hooks/useBrandManagement";
import BrandOwnershipTransfer from "./BrandOwnershipTransfer";
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
      revokedFromStatus
      user {
        id
        fullName
        email
      }
      restaurantIds
    }
  }
`;

const MEMBER_CANDIDATES = gql`
  query BrandMemberCandidates($brandId: ID!, $search: String!, $limit: Int) {
    brandMemberCandidates(brandId: $brandId, search: $search, limit: $limit) {
      id
      fullName
      username
      email
      userType
      status
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

const getCandidateLabel = (candidate) => {
  const name =
    candidate?.fullName || candidate?.username || candidate?.email || "Tài khoản";
  const identity = candidate?.email || candidate?.username || candidate?.id;
  const source = String(candidate?.id || "").startsWith("invite:")
    ? "Tài khoản mới"
    : candidate?.userType === "CUSTOMER"
      ? "Khách hàng hiện có"
      : "Tài khoản quản lý";
  return `${name} — ${identity} · ${source} · ID: ${candidate?.id}`;
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
  const [memberRoleFilter, setMemberRoleFilter] = useState("all");
  const [memberRestaurantFilter, setMemberRestaurantFilter] = useState("all");
  const [memberFiltersOpen, setMemberFiltersOpen] = useState(true);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateSearchTerm, setCandidateSearchTerm] = useState("");
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

  const candidateSearchReady =
    Boolean(selectedBrandId) && candidateSearchTerm.length >= 2;
  const {
    data: candidateData,
    loading: candidatesLoading,
    error: candidateQueryError,
  } = useQuery(MEMBER_CANDIDATES, {
    variables: {
      brandId: selectedBrandId,
      search: candidateSearchTerm,
      limit: 20,
    },
    skip: !candidateSearchReady,
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
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
    setMemberRoleFilter("all");
    setMemberRestaurantFilter("all");
    setCandidateSearch("");
    setCandidateSearchTerm("");
  }, [selectedBrandId]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setCandidateSearchTerm(candidateSearch.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [candidateSearch]);

  const members = memberData?.brandMembers || [];
  const restaurants = selectedBrand?.restaurants || [];
  const rawCandidates = candidateSearchReady
    ? candidateData?.brandMemberCandidates || []
    : [];
  const candidates = rawCandidates.filter((candidate) =>
    member.role === "staff"
      ? candidate.userType !== "CUSTOMER"
      : ["CUSTOMER", "MANAGER"].includes(candidate.userType),
  );
  const selectedCandidate = candidates.find(
    (candidate) => String(candidate.id) === String(member.userId),
  );
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

    return members.filter((currentMember) => {
      const role = normalizeChainRole(currentMember);
      const matchesKeyword =
        !keyword ||
        [
          currentMember.user?.fullName,
          currentMember.userId,
          currentMember.user?.id,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword));
      const matchesRole =
        memberRoleFilter === "all" || role === memberRoleFilter;
      const matchesRestaurant =
        memberRestaurantFilter === "all" ||
        ["owner", "admin"].includes(role) ||
        (currentMember.restaurantIds || [])
          .map(String)
          .includes(memberRestaurantFilter);

      return matchesKeyword && matchesRole && matchesRestaurant;
    });
  }, [memberRestaurantFilter, memberRoleFilter, memberSearch, members]);

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
    if (!member.userId.trim()) return "Chọn tài khoản cần thêm.";
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
      setCandidateSearch("");
      setCandidateSearchTerm("");
      await refetchMembers?.();
      message.success(
        member.role === "staff"
          ? "Đã cập nhật thành viên trong chuỗi"
          : "Đã gửi lời mời tham gia chuỗi",
      );
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
        title="Quản lý chuỗi"
        subtitle="Quản lý thông tin, chi nhánh và thành viên."
        icon="🏢"
        stats={[
          {
            id: "chains",
            label: "Chuỗi",
            value: brands.length,
            icon: "◫",
          },
          {
            id: "branches",
            label: "Chi nhánh",
            value: totalBranchCount,
            icon: "⌂",
          },
          {
            id: "members",
            label: "Thành viên",
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
        footerLeft={selectedRoleLabel ? `Vai trò: ${selectedRoleLabel}` : null}
        footerRight={`Trạng thái: ${selectedStatusLabel}`}
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
          <section className="brand-workspace">
            <form className="brand-panel brand-settings-panel" onSubmit={saveBrand}>
              <div className="brand-panel__header">
                <div>
                  <span className="brand-panel__eyebrow">HỒ SƠ CHUỖI</span>
                  <h3>Thông tin doanh nghiệp</h3>
                  <p>Áp dụng cho toàn chuỗi.</p>
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
                  <p>Chọn để mở dashboard chi nhánh.</p>
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
                          onClick={() => setSelectedRestaurantId(String(restaurant.id))}
                        >
                          Chọn
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
                <p>Tìm thành viên hiện có hoặc thêm tài khoản mới bên dưới.</p>
              </div>
            </div>

            <details
              className="brand-member-filter-panel"
              open={memberFiltersOpen}
              onToggle={(event) => setMemberFiltersOpen(event.currentTarget.open)}
            >
              <summary className="brand-member-filter-panel__heading">
                <strong>Tìm và lọc thành viên</strong>
                <span>{filteredMembers.length}/{members.length} kết quả</span>
              </summary>
              <div className="brand-member-filter-panel__body">
                <div className="brand-member-filters">
                  <label className="brand-field brand-filter-field brand-filter-field--search">
                    <span>Tìm tài khoản</span>
                    <div className="brand-member-search">
                      <span aria-hidden="true">⌕</span>
                      <input
                        type="search"
                        aria-label="Tìm tài khoản theo tên nhân viên hoặc mã tài khoản"
                        value={memberSearch}
                        onChange={(event) => setMemberSearch(event.target.value)}
                        placeholder="Tên nhân viên hoặc mã tài khoản"
                      />
                    </div>
                  </label>

                  <label className="brand-field brand-filter-field">
                    <span>Vai trò</span>
                    <select
                      aria-label="Lọc theo vai trò"
                      value={memberRoleFilter}
                      onChange={(event) => setMemberRoleFilter(event.target.value)}
                    >
                      <option value="all">Tất cả vai trò</option>
                      {Object.entries(CHAIN_ROLE_LABELS).map(([role, label]) => (
                        <option key={role} value={role}>{label}</option>
                      ))}
                    </select>
                  </label>

                  <label className="brand-field brand-filter-field">
                    <span>Chi nhánh</span>
                    <select
                      aria-label="Lọc theo chi nhánh"
                      value={memberRestaurantFilter}
                      onChange={(event) => setMemberRestaurantFilter(event.target.value)}
                    >
                      <option value="all">Tất cả chi nhánh</option>
                      {restaurants.map((restaurant) => (
                        <option key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </details>

            <div className="brand-member-create">
              <div className="brand-member-create__grid">
                <div className="brand-account-picker">
                  <label className="brand-field">
                    <span>Tìm người cần thêm</span>
                    <input
                      type="search"
                      aria-label="Tìm người cần thêm theo tên, email hoặc mã tài khoản"
                      value={candidateSearch}
                      onChange={(event) => {
                        setCandidateSearch(event.target.value);
                        setMember((current) => ({ ...current, userId: "" }));
                        setMemberFormError("");
                      }}
                      placeholder="Nhập tên hoặc email"
                    />
                  </label>

                  <label className="brand-field">
                    <span>Chọn tài khoản</span>
                    <select
                      aria-label="Chọn tài khoản cần thêm"
                      value={member.userId}
                      onChange={(event) => {
                        setMember((current) => ({
                          ...current,
                          userId: event.target.value,
                        }));
                        setMemberFormError("");
                      }}
                      disabled={
                        !candidateSearchReady ||
                        candidatesLoading ||
                        Boolean(candidateQueryError) ||
                        !candidates.length
                      }
                    >
                      <option value="">
                        {candidateSearch.trim().length < 2
                          ? "Nhập ít nhất 2 ký tự"
                          : candidatesLoading
                            ? "Đang tìm tài khoản..."
                            : candidates.length
                              ? "Chọn một tài khoản"
                              : "Không có kết quả"}
                      </option>
                      {candidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {getCandidateLabel(candidate)}
                        </option>
                      ))}
                    </select>
                    <small
                      className={candidateQueryError ? "brand-field__error" : undefined}
                    >
                      {candidateQueryError
                        ? "Không thể tìm tài khoản. Vui lòng thử lại."
                        : selectedCandidate
                          ? `Đã chọn: ${getCandidateLabel(selectedCandidate)}`
                          : candidateSearch.trim().length < 2
                            ? "Nhập ít nhất 2 ký tự để tìm."
                            : candidatesLoading
                              ? "Đang tìm tài khoản phù hợp..."
                              : candidates.length
                                ? `${candidates.length} tài khoản có thể thêm.`
                                : "Không tìm thấy tài khoản chưa thuộc chuỗi."}
                    </small>
                  </label>
                  {selectedCandidate?.userType === "CUSTOMER" && member.role !== "staff" && (
                    <div className="brand-scope-note">
                      <strong>Tài khoản khách hàng hiện có</strong>
                      <span>
                        Quyền chỉ chuyển sang Manager sau khi người này xác nhận lời mời qua email.
                      </span>
                    </div>
                  )}
                </div>

                <label className="brand-field">
                  <span>Vai trò trong chuỗi</span>
                  <select
                    aria-label="Vai trò trong chuỗi"
                    value={member.role}
                    onChange={(event) => {
                      setMember((current) => ({
                        ...current,
                        role: event.target.value,
                        userId: "",
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
                  {addingMember
                    ? member.role === "staff"
                      ? "Đang thêm..."
                      : "Đang gửi..."
                    : member.role === "staff"
                      ? "Thêm thành viên"
                      : "Gửi lời mời"}
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

            <BrandOwnershipTransfer
              selectedBrand={selectedBrand}
              members={members}
              restaurants={restaurants}
              assignedManagerByRestaurant={assignedManagerByRestaurant}
              setSelectedRestaurantId={setSelectedRestaurantId}
            />

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
                      ? "Không có thành viên phù hợp với bộ lọc."
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
