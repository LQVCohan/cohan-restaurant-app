import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { gql } from "@apollo/client";
import { useMutation, useQuery } from "@apollo/client/react";
import { message } from "antd";
import useBrandManagement from "@/hooks/useBrandManagement";
import BrandManagement from "./BrandManagement";
import "./BrandMemberDirectory.css";

const BRAND_MEMBERS_PAGE = gql`
  query BrandMembersPage(
    $brandId: ID!
    $search: String
    $role: String
    $restaurantId: ID
    $status: String
    $page: Int!
    $pageSize: Int!
  ) {
    brandMembersPage(
      brandId: $brandId
      search: $search
      role: $role
      restaurantId: $restaurantId
      status: $status
      page: $page
      pageSize: $pageSize
    ) {
      items {
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
      pageInfo {
        page
        pageSize
        totalCount
        totalPages
        hasNextPage
        hasPreviousPage
      }
      summary {
        total
        active
        inactive
        invited
      }
    }
  }
`;

const UPDATE_MEMBER = gql`
  mutation UpdateBrandMemberFromDirectory($input: UpdateBrandMemberInput!) {
    updateBrandMember(input: $input) {
      id
      role
      status
      restaurantIds
    }
  }
`;

const ROLE_LABELS = {
  owner: "Chủ chuỗi nhà hàng",
  admin: "Quản trị chuỗi",
  manager: "Quản lý chi nhánh",
  staff: "Nhân viên chi nhánh",
};

const STATUS_LABELS = {
  active: "Đang hoạt động",
  inactive: "Tạm ngưng",
  invited: "Đang chờ tham gia",
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

const getInitials = (value = "") =>
  String(value)
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "CH";

const getErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message || error?.message || fallback;

const getScopeLabel = (membership, restaurants, brandName) => {
  const role = String(membership?.role || "").toLowerCase();
  if (["owner", "admin"].includes(role)) {
    return brandName ? `Toàn bộ chuỗi ${brandName}` : "Toàn bộ chuỗi";
  }

  const restaurantById = new Map(
    (restaurants || []).map((restaurant) => [String(restaurant.id), restaurant.name]),
  );
  const names = (membership?.restaurantIds || [])
    .map((restaurantId) => restaurantById.get(String(restaurantId)))
    .filter(Boolean);

  if (role === "manager") return names[0] || "Chưa gán chi nhánh";
  return names.length ? names.join(", ") : "Chưa gán chi nhánh";
};

function useMemberDirectoryHost(selectedBrandId) {
  const [host, setHost] = useState(null);

  useEffect(() => {
    setHost(null);
    let hostNode = null;
    let panelNode = null;

    const attach = () => {
      const panel = document.querySelector(".brand-members-panel");
      if (!panel) return;

      if (panelNode && panelNode !== panel) {
        panelNode.classList.remove("brand-members-panel--server-paged");
        hostNode?.remove();
        hostNode = null;
      }

      panelNode = panel;
      panel.classList.add("brand-members-panel--server-paged");

      if (!hostNode || !panel.contains(hostNode)) {
        hostNode = Array.from(panel.children).find((child) =>
          child.classList?.contains("brand-member-directory-host"),
        );

        if (!hostNode) {
          hostNode = document.createElement("div");
          hostNode.className = "brand-member-directory-host";
          const operations = Array.from(panel.children).find((child) =>
            child.classList?.contains("brand-member-operations"),
          );
          panel.insertBefore(hostNode, operations || null);
        }
      }

      setHost(hostNode);
    };

    attach();
    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      panelNode?.classList.remove("brand-members-panel--server-paged");
      hostNode?.remove();
    };
  }, [selectedBrandId]);

  return host;
}

function BrandMemberDirectory({ brandId, brandName, restaurants }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [restaurantId, setRestaurantId] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [changingMemberId, setChangingMemberId] = useState("");

  useEffect(() => {
    setSearchInput("");
    setSearch("");
    setRole("all");
    setRestaurantId("all");
    setStatus("all");
    setPage(1);
  }, [brandId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const variables = useMemo(
    () => ({
      brandId,
      search: search || null,
      role: role === "all" ? null : role,
      restaurantId: restaurantId === "all" ? null : restaurantId,
      status: status === "all" ? null : status,
      page,
      pageSize,
    }),
    [brandId, page, pageSize, restaurantId, role, search, status],
  );

  const { data, loading, error, refetch } = useQuery(BRAND_MEMBERS_PAGE, {
    variables,
    skip: !brandId,
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const [updateMember] = useMutation(UPDATE_MEMBER);
  const payload = data?.brandMembersPage;
  const members = payload?.items || [];
  const pageInfo = payload?.pageInfo || {
    page,
    pageSize,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  const summary = payload?.summary || {
    total: 0,
    active: 0,
    inactive: 0,
    invited: 0,
  };

  useEffect(() => {
    if (pageInfo.page && pageInfo.page !== page) setPage(pageInfo.page);
  }, [page, pageInfo.page]);

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setRole("all");
    setRestaurantId("all");
    setStatus("all");
    setPage(1);
  };

  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const toggleMemberStatus = async (member) => {
    if (member.role === "owner") return;
    const cancellingInvitation = member.status === "invited";
    if (
      cancellingInvitation &&
      !window.confirm("Hủy lời mời này? Liên kết trong email sẽ không còn hiệu lực.")
    ) {
      return;
    }

    const nextStatus =
      member.status === "active" || cancellingInvitation ? "inactive" : "active";
    setChangingMemberId(member.id);
    try {
      await updateMember({
        variables: { input: { id: member.id, status: nextStatus } },
        refetchQueries: ["BrandMembers", "BrandMembersPage"],
        awaitRefetchQueries: true,
      });
      await refetch();
      message.success(
        cancellingInvitation
          ? "Đã hủy lời mời"
          : nextStatus === "active"
            ? "Đã kích hoạt thành viên"
            : "Đã tạm ngưng thành viên",
      );
    } catch (mutationError) {
      message.error(
        getErrorMessage(mutationError, "Không thể cập nhật trạng thái thành viên."),
      );
    } finally {
      setChangingMemberId("");
    }
  };

  const rangeStart = pageInfo.totalCount
    ? (pageInfo.page - 1) * pageInfo.pageSize + 1
    : 0;
  const rangeEnd = pageInfo.totalCount
    ? Math.min(pageInfo.page * pageInfo.pageSize, pageInfo.totalCount)
    : 0;

  return (
    <section className="brand-member-directory" aria-label="Danh sách thành viên phân trang từ máy chủ">
      <div className="brand-member-directory__summary" aria-label="Thống kê thành viên">
        <span><strong>{summary.total}</strong> tổng</span>
        <span><strong>{summary.active}</strong> hoạt động</span>
        <span><strong>{summary.invited}</strong> đang mời</span>
        <span><strong>{summary.inactive}</strong> tạm ngưng</span>
      </div>

      <div className="brand-member-directory__toolbar">
        <label className="brand-field brand-filter-field brand-filter-field--search">
          <span>Tìm tài khoản</span>
          <div className="brand-member-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              autoComplete="off"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tên, email hoặc mã tài khoản…"
              aria-label="Tìm thành viên theo tên, email hoặc mã tài khoản"
            />
          </div>
        </label>

        <label className="brand-field brand-filter-field">
          <span>Vai trò</span>
          <select value={role} onChange={changeFilter(setRole)} aria-label="Lọc thành viên theo vai trò">
            <option value="all">Tất cả vai trò</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="brand-field brand-filter-field">
          <span>Chi nhánh</span>
          <select
            value={restaurantId}
            onChange={changeFilter(setRestaurantId)}
            aria-label="Lọc thành viên theo chi nhánh"
          >
            <option value="all">Tất cả chi nhánh</option>
            {(restaurants || []).map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>
            ))}
          </select>
        </label>

        <label className="brand-field brand-filter-field">
          <span>Trạng thái</span>
          <select value={status} onChange={changeFilter(setStatus)} aria-label="Lọc thành viên theo trạng thái">
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="invited">Đang chờ tham gia</option>
            <option value="inactive">Tạm ngưng</option>
          </select>
        </label>

        <label className="brand-field brand-filter-field brand-member-directory__page-size">
          <span>Số dòng/trang</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            aria-label="Chọn số lượng thành viên trên mỗi trang"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size} dòng</option>
            ))}
          </select>
        </label>

        <button type="button" className="brand-button brand-button--secondary brand-member-directory__reset" onClick={resetFilters}>
          Xóa bộ lọc
        </button>
      </div>

      {error && (
        <div className="brand-alert brand-alert--danger" role="alert">
          <strong>Không tải được danh sách thành viên.</strong>
          <span>{getErrorMessage(error, "Vui lòng thử lại sau.")}</span>
        </div>
      )}

      <div className="brand-member-list-heading" aria-hidden="true">
        <span>Tài khoản</span>
        <span>Vai trò &amp; phạm vi</span>
        <span>Trạng thái</span>
      </div>

      <div className="brand-member-list" role="list" aria-busy={loading}>
        {loading && !members.length ? (
          [1, 2, 3].map((item) => <div key={item} className="brand-member-skeleton" />)
        ) : members.length ? (
          members.map((member) => {
            const displayName =
              member.user?.fullName || member.user?.email || member.userId || "Tài khoản chưa có tên";
            const cancelledInvitation =
              member.status === "inactive" && member.revokedFromStatus === "invited";
            const statusLabel = cancelledInvitation
              ? "Lời mời đã hủy"
              : STATUS_LABELS[member.status] || "Không xác định";

            return (
              <article className="brand-member-card" key={member.id} role="listitem">
                <div className="brand-member-card__avatar" aria-hidden="true">{getInitials(displayName)}</div>
                <div className="brand-member-card__identity">
                  <strong>{displayName}</strong>
                  {member.user?.email && <span>{member.user.email}</span>}
                </div>
                <div className="brand-member-card__meta">
                  <span className="brand-role-badge">{ROLE_LABELS[member.role] || "Chưa có vai trò"}</span>
                  <span>{getScopeLabel(member, restaurants, brandName)}</span>
                </div>
                <div className="brand-member-card__status">
                  <span className={`brand-status brand-status--${member.status}`}>{statusLabel}</span>
                  {member.role !== "owner" && !cancelledInvitation && (
                    <button
                      type="button"
                      className="brand-link-button"
                      onClick={() => toggleMemberStatus(member)}
                      disabled={changingMemberId === member.id}
                    >
                      {changingMemberId === member.id
                        ? "Đang xử lý…"
                        : member.status === "active"
                          ? "Tạm ngưng"
                          : member.status === "invited"
                            ? "Hủy lời mời"
                            : "Kích hoạt"}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <div className="brand-inline-empty brand-inline-empty--members">
            <span aria-hidden="true">◎</span>
            <p>Không có thành viên phù hợp với bộ lọc hiện tại.</p>
          </div>
        )}
      </div>

      <div className="brand-member-directory__pagination" aria-label="Phân trang danh sách thành viên">
        <span>
          Hiển thị <strong>{rangeStart}–{rangeEnd}</strong> trên <strong>{pageInfo.totalCount}</strong> kết quả
        </span>
        <div>
          <button
            type="button"
            className="brand-button brand-button--secondary"
            onClick={() => setPage(1)}
            disabled={!pageInfo.hasPreviousPage || loading}
            aria-label="Trang đầu"
          >
            «
          </button>
          <button
            type="button"
            className="brand-button brand-button--secondary"
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
            disabled={!pageInfo.hasPreviousPage || loading}
          >
            Trước
          </button>
          <span className="brand-member-directory__page-indicator">
            Trang <strong>{pageInfo.page}</strong> / <strong>{Math.max(pageInfo.totalPages, 1)}</strong>
          </span>
          <button
            type="button"
            className="brand-button brand-button--secondary"
            onClick={() => setPage((current) => current + 1)}
            disabled={!pageInfo.hasNextPage || loading}
          >
            Sau
          </button>
          <button
            type="button"
            className="brand-button brand-button--secondary"
            onClick={() => setPage(Math.max(pageInfo.totalPages, 1))}
            disabled={!pageInfo.hasNextPage || loading}
            aria-label="Trang cuối"
          >
            »
          </button>
        </div>
      </div>
    </section>
  );
}

export default function BrandManagementEnhanced() {
  const { selectedBrandId, selectedBrand } = useBrandManagement();
  const host = useMemberDirectoryHost(selectedBrandId);

  return (
    <>
      <BrandManagement />
      {host && selectedBrandId
        ? createPortal(
            <BrandMemberDirectory
              brandId={selectedBrandId}
              brandName={selectedBrand?.name || ""}
              restaurants={selectedBrand?.restaurants || []}
            />,
            host,
          )
        : null}
    </>
  );
}
