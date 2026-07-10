import React, { useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { message } from "antd";
import { MY_BRANDS_QUERY } from "@/hooks/useBrandManagement";

const UPDATE_BRAND_MEMBER = gql`
  mutation UpdateBrandMemberAccess($input: UpdateBrandMemberInput!) {
    updateBrandMember(input: $input) {
      id
      role
      status
      restaurantIds
    }
  }
`;

const REMOVE_BRAND_MEMBER = gql`
  mutation RemoveBrandMemberAccess($id: ID!, $reason: String) {
    removeBrandMember(id: $id, reason: $reason)
  }
`;

const RESEND_BRAND_INVITATION = gql`
  mutation ResendBrandInvitationAccess($id: ID!) {
    resendBrandInvitation(id: $id) {
      id
      role
      status
      restaurantIds
      revokedFromStatus
    }
  }
`;

const TRANSFER_BRAND_OWNERSHIP = gql`
  mutation TransferBrandOwnership($input: TransferBrandOwnershipInput!) {
    transferBrandOwnership(input: $input) {
      brand {
        id
        ownerId
      }
      previousOwnerMembership {
        id
        role
        restaurantIds
      }
      newOwnerMembership {
        id
        role
        restaurantIds
      }
    }
  }
`;

const ROLE_LABELS = {
  admin: "Quản trị chuỗi",
  manager: "Quản lý chi nhánh",
  staff: "Nhân viên chi nhánh",
};
const ACCESS_ROLE_OPTIONS = ["admin", "manager"];

const normalizeIds = (ids = []) => [...new Set(ids.filter(Boolean).map(String))];

const getMemberLabel = (member) => {
  const name = member?.user?.fullName || member?.user?.email || member?.userId;
  return `${name} — ${ROLE_LABELS[member?.role] || member?.role}`;
};

const getMemberStatusSuffix = (member) => {
  if (member?.status === "invited") return " — đang chờ xác nhận";
  if (member?.status === "inactive" && member?.revokedFromStatus === "invited") {
    return " — lời mời đã hủy";
  }
  if (member?.status === "inactive") return " — đã tháo quyền";
  return "";
};

const getErrorMessage = (error, fallback) =>
  error?.graphQLErrors?.[0]?.message || error?.message || fallback;

function BrandMembershipAccessForm({
  members,
  restaurants,
  assignedManagerByRestaurant,
}) {
  const [membershipId, setMembershipId] = useState("");
  const [role, setRole] = useState("");
  const [restaurantIds, setRestaurantIds] = useState([]);
  const [formError, setFormError] = useState("");
  const [updateMember, { loading }] = useMutation(UPDATE_BRAND_MEMBER, {
    refetchQueries: ["BrandMembers"],
    awaitRefetchQueries: true,
  });
  const [removeMember, { loading: removing }] = useMutation(
    REMOVE_BRAND_MEMBER,
    {
      refetchQueries: ["BrandMembers"],
      awaitRefetchQueries: true,
    },
  );
  const [resendInvitation, { loading: resending }] = useMutation(
    RESEND_BRAND_INVITATION,
    {
      refetchQueries: ["BrandMembers"],
      awaitRefetchQueries: true,
    },
  );

  const editableMembers = useMemo(
    () =>
      members
        .filter((member) => member.role !== "owner")
        .sort((left, right) =>
          getMemberLabel(left).localeCompare(getMemberLabel(right), "vi"),
        ),
    [members],
  );

  const selectedMember = editableMembers.find(
    (member) => String(member.id) === membershipId,
  );
  const cancelledInvitation =
    selectedMember?.status === "inactive" &&
    selectedMember?.revokedFromStatus === "invited";
  const actionLoading = loading || removing || resending;

  const selectMember = (nextMembershipId) => {
    const nextMember = editableMembers.find(
      (member) => String(member.id) === String(nextMembershipId),
    );
    setMembershipId(String(nextMembershipId || ""));
    setRole(
      ACCESS_ROLE_OPTIONS.includes(nextMember?.role) ? nextMember.role : "",
    );
    setRestaurantIds(normalizeIds(nextMember?.restaurantIds));
    setFormError("");
  };

  const changeRole = (nextRole) => {
    const normalizedRole = ACCESS_ROLE_OPTIONS.includes(nextRole) ? nextRole : "";
    setRole(normalizedRole);
    setRestaurantIds((currentIds) => {
      if (normalizedRole === "admin") return [];
      if (normalizedRole === "manager") return currentIds.slice(0, 1);
      return currentIds;
    });
    setFormError("");
  };

  const saveAccess = async () => {
    if (!selectedMember) {
      setFormError("Chọn thành viên cần đổi quyền.");
      return;
    }
    if (!ACCESS_ROLE_OPTIONS.includes(role)) {
      setFormError("Chọn Quản trị chuỗi hoặc Quản lý chi nhánh.");
      return;
    }
    if (role === "manager" && restaurantIds.length !== 1) {
      setFormError("Quản lý chi nhánh phải phụ trách đúng một chi nhánh.");
      return;
    }

    setFormError("");
    try {
      const result = await updateMember({
        variables: {
          input: {
            id: selectedMember.id,
            role,
            restaurantIds: role === "admin" ? [] : restaurantIds,
          },
        },
      });
      const updated = result?.data?.updateBrandMember;
      if (updated) {
        setRole(updated.role);
        setRestaurantIds(normalizeIds(updated.restaurantIds));
      }
      message.success("Đã cập nhật quyền thành viên");
    } catch (error) {
      setFormError(getErrorMessage(error, "Không thể cập nhật quyền thành viên."));
    }
  };

  const revokeAccess = async () => {
    if (!selectedMember) {
      setFormError("Chọn thành viên cần tháo quyền.");
      return;
    }
    if (selectedMember.status === "inactive") {
      setFormError("Thành viên này đã được tháo quyền.");
      return;
    }

    const cancellingInvitation = selectedMember.status === "invited";
    const confirmed = window.confirm(
      cancellingInvitation
        ? "Hủy lời mời này? Liên kết trong email sẽ không còn hiệu lực."
        : "Tháo quyền Brand của thành viên này? Tài khoản và dữ liệu lịch sử vẫn được giữ.",
    );
    if (!confirmed) return;

    setFormError("");
    try {
      await removeMember({
        variables: {
          id: selectedMember.id,
          reason: cancellingInvitation
            ? "Hủy lời mời từ trang quản lý chuỗi"
            : "Tháo quyền từ trang quản lý chuỗi",
        },
      });
      setMembershipId("");
      setRole("");
      setRestaurantIds([]);
      message.success(
        cancellingInvitation ? "Đã hủy lời mời" : "Đã tháo quyền Brand",
      );
    } catch (error) {
      setFormError(getErrorMessage(error, "Không thể tháo quyền Brand."));
    }
  };

  const resendCancelledInvitation = async () => {
    if (!cancelledInvitation) return;
    setFormError("");
    try {
      await resendInvitation({ variables: { id: selectedMember.id } });
      message.success("Đã gửi lại lời mời tham gia chuỗi");
    } catch (error) {
      setFormError(getErrorMessage(error, "Không thể gửi lại lời mời."));
    }
  };

  return (
    <details className="brand-member-filter-panel brand-membership-actions">
      <summary className="brand-member-filter-panel__heading">
        <strong>Đổi vai trò và phạm vi</strong>
        <span>Chủ chuỗi / quản trị chuỗi</span>
      </summary>
      <div className="brand-member-filter-panel__body">
        {editableMembers.length ? (
          <>
            <div className="brand-membership-actions__grid">
              <label className="brand-field">
                <span>Thành viên cần chỉnh</span>
                <select
                  aria-label="Thành viên cần đổi quyền"
                  value={membershipId}
                  onChange={(event) => selectMember(event.target.value)}
                >
                  <option value="">Chọn một thành viên</option>
                  {editableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {getMemberLabel(member)}
                      {getMemberStatusSuffix(member)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="brand-field">
                <span>Vai trò mới</span>
                <select
                  aria-label="Vai trò mới của thành viên"
                  value={role}
                  onChange={(event) => changeRole(event.target.value)}
                  disabled={!selectedMember}
                >
                  <option value="">Chọn vai trò mới</option>
                  {ACCESS_ROLE_OPTIONS.map((value) => (
                    <option key={value} value={value}>{ROLE_LABELS[value]}</option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="brand-button brand-button--primary"
                onClick={saveAccess}
                disabled={actionLoading || !selectedMember || !role}
              >
                {loading ? "Đang lưu quyền…" : "Lưu quyền thành viên"}
              </button>

              {cancelledInvitation ? (
                <button
                  type="button"
                  className="brand-button brand-button--secondary"
                  onClick={resendCancelledInvitation}
                  disabled={actionLoading}
                >
                  {resending ? "Đang gửi lại…" : "Mời lại"}
                </button>
              ) : selectedMember?.status !== "inactive" ? (
                <button
                  type="button"
                  className="brand-button brand-button--secondary"
                  onClick={revokeAccess}
                  disabled={actionLoading}
                >
                  {removing
                    ? "Đang xử lý…"
                    : selectedMember?.status === "invited"
                      ? "Hủy lời mời"
                      : "Tháo quyền Brand"}
                </button>
              ) : null}
            </div>

            {selectedMember && role === "admin" && (
              <div className="brand-scope-note">
                <strong>Phạm vi toàn chuỗi</strong>
                <span>Quản trị chuỗi có thể thao tác ở tất cả chi nhánh.</span>
              </div>
            )}

            {selectedMember && role === "manager" && (
              <label className="brand-field brand-scope-control">
                <span>Chi nhánh phụ trách</span>
                <select
                  aria-label="Chi nhánh quản lý mới"
                  value={restaurantIds[0] || ""}
                  onChange={(event) => {
                    setRestaurantIds(event.target.value ? [event.target.value] : []);
                    setFormError("");
                  }}
                >
                  <option value="">Chọn một chi nhánh</option>
                  {restaurants.map((restaurant) => {
                    const assignedManager = assignedManagerByRestaurant?.get(
                      String(restaurant.id),
                    );
                    const belongsToSelectedMember =
                      String(assignedManager?.id || "") === String(selectedMember.id);
                    const unavailable = Boolean(assignedManager) && !belongsToSelectedMember;
                    return (
                      <option
                        key={restaurant.id}
                        value={restaurant.id}
                        disabled={unavailable}
                      >
                        {restaurant.name}
                        {unavailable ? " — đã có quản lý" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
            )}

            {selectedMember?.role === "staff" && !role && (
              <div className="brand-scope-note" role="note">
                <strong>Vai trò hiện tại: Nhân viên chi nhánh</strong>
                <span>
                  Chọn Quản lý chi nhánh hoặc Quản trị chuỗi để nâng quyền.
                </span>
              </div>
            )}

            <p className="brand-membership-actions__hint">
              Hủy lời mời hoặc tháo quyền tại đây. Lời mời đã hủy phải được gửi lại;
              thành viên đã từng tham gia có thể được khôi phục bằng nút Kích hoạt
              trên thẻ thành viên. Quyền chủ chuỗi chỉ thay đổi ở phần bên dưới.
            </p>
          </>
        ) : (
          <div className="brand-inline-empty brand-inline-empty--members">
            <span aria-hidden="true">◎</span>
            <p>Chưa có thành viên nào có thể chỉnh quyền.</p>
          </div>
        )}

        {formError && (
          <div className="brand-alert brand-alert--danger" role="alert">
            {formError}
          </div>
        )}
      </div>
    </details>
  );
}

function BrandOwnershipTransferForm({ selectedBrand, members }) {
  const [newOwnerUserId, setNewOwnerUserId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState("");
  const [transferOwnership, { loading }] = useMutation(
    TRANSFER_BRAND_OWNERSHIP,
    {
      refetchQueries: [MY_BRANDS_QUERY, "BrandMembers"],
      awaitRefetchQueries: true,
    },
  );

  const eligibleMembers = useMemo(
    () =>
      members
        .filter(
          (member) =>
            member.status === "active" &&
            ["admin", "manager"].includes(member.role) &&
            member.userId,
        )
        .sort((left, right) =>
          getMemberLabel(left).localeCompare(getMemberLabel(right), "vi"),
        ),
    [members],
  );

  const submitTransfer = async () => {
    if (!newOwnerUserId) {
      setFormError("Chọn thành viên sẽ nhận quyền chủ chuỗi.");
      return;
    }
    if (!confirmed) {
      setFormError("Xác nhận việc chuyển quyền trước khi tiếp tục.");
      return;
    }

    setFormError("");
    try {
      await transferOwnership({
        variables: {
          input: {
            brandId: selectedBrand.id,
            newOwnerUserId,
          },
        },
      });
      message.success("Đã chuyển quyền chủ chuỗi");
      window.dispatchEvent(
        new CustomEvent("manager:navigate", {
          detail: { page: "dashboard", source: "brand-owner-transfer" },
        }),
      );
    } catch (error) {
      setFormError(getErrorMessage(error, "Không thể chuyển quyền chủ chuỗi."));
    }
  };

  return (
    <details className="brand-member-filter-panel brand-membership-actions brand-membership-actions--transfer">
      <summary className="brand-member-filter-panel__heading">
        <strong>Chuyển quyền chủ chuỗi</strong>
        <span>Chỉ chủ hiện tại</span>
      </summary>
      <div className="brand-member-filter-panel__body">
        <div className="brand-membership-actions__transfer-note" role="note">
          <strong>Sau khi chuyển quyền</strong>
          <span>
            Thành viên được chọn trở thành chủ duy nhất. Tài khoản của bạn chuyển
            thành quản trị chuỗi và vẫn có quyền quản lý toàn bộ chi nhánh.
          </span>
        </div>

        {eligibleMembers.length ? (
          <>
            <div className="brand-membership-actions__transfer-grid">
              <label className="brand-field">
                <span>Thành viên nhận quyền</span>
                <select
                  aria-label="Thành viên nhận quyền chủ chuỗi"
                  value={newOwnerUserId}
                  onChange={(event) => {
                    setNewOwnerUserId(event.target.value);
                    setConfirmed(false);
                    setFormError("");
                  }}
                >
                  <option value="">Chọn một thành viên</option>
                  {eligibleMembers.map((member) => (
                    <option key={member.id} value={member.userId}>
                      {getMemberLabel(member)}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="brand-button brand-button--primary"
                onClick={submitTransfer}
                disabled={loading}
              >
                {loading ? "Đang chuyển quyền…" : "Xác nhận chuyển quyền"}
              </button>
            </div>

            <label className="brand-membership-actions__confirmation">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => {
                  setConfirmed(event.target.checked);
                  setFormError("");
                }}
              />
              <span>
                Tôi hiểu mình sẽ không còn là chủ chuỗi và sẽ chuyển thành quản trị chuỗi.
              </span>
            </label>
          </>
        ) : (
          <div className="brand-inline-empty brand-inline-empty--members">
            <span aria-hidden="true">◎</span>
            <p>
              Hãy thêm một quản lý hoặc quản trị viên đang hoạt động trước khi
              chuyển quyền.
            </p>
          </div>
        )}

        {formError && (
          <div className="brand-alert brand-alert--danger" role="alert">
            {formError}
          </div>
        )}
      </div>
    </details>
  );
}

export default function BrandOwnershipTransfer({
  selectedBrand,
  members = [],
  restaurants = [],
  assignedManagerByRestaurant,
}) {
  const currentRole = String(
    selectedBrand?.membership?.role || selectedBrand?.membershipRole || "",
  ).toLowerCase();
  const canManageMembers = ["owner", "admin"].includes(currentRole);
  if (!canManageMembers) return null;

  return (
    <div className="brand-membership-actions-stack">
      <BrandMembershipAccessForm
        members={members}
        restaurants={restaurants}
        assignedManagerByRestaurant={assignedManagerByRestaurant}
      />
      {currentRole === "owner" && (
        <BrandOwnershipTransferForm
          selectedBrand={selectedBrand}
          members={members}
        />
      )}
    </div>
  );
}
