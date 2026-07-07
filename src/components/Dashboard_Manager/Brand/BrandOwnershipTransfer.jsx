import React, { useMemo, useState } from "react";
import { gql } from "@apollo/client";
import { useMutation } from "@apollo/client/react";
import { message } from "antd";
import { MY_BRANDS_QUERY } from "@/hooks/useBrandManagement";

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

const getMemberLabel = (member) => {
  const name = member?.user?.fullName || member?.user?.email || member?.userId;
  return `${name} — ${ROLE_LABELS[member?.role] || member?.role}`;
};

const getErrorMessage = (error) =>
  error?.graphQLErrors?.[0]?.message ||
  error?.message ||
  "Không thể chuyển quyền chủ chuỗi.";

export default function BrandOwnershipTransfer({
  selectedBrand,
  members = [],
  restaurants = [],
  assignedManagerByRestaurant,
  setSelectedRestaurantId,
}) {
  const [newOwnerUserId, setNewOwnerUserId] = useState("");
  const [previousOwnerRestaurantId, setPreviousOwnerRestaurantId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState("");
  const [transferOwnership, { loading }] = useMutation(
    TRANSFER_BRAND_OWNERSHIP,
    {
      refetchQueries: [MY_BRANDS_QUERY],
      awaitRefetchQueries: true,
    },
  );

  const isOwner =
    String(selectedBrand?.membership?.role || selectedBrand?.membershipRole || "") ===
    "owner";
  const eligibleMembers = useMemo(
    () =>
      members
        .filter(
          (member) =>
            member.status === "active" &&
            member.role !== "owner" &&
            member.userId,
        )
        .sort((left, right) =>
          getMemberLabel(left).localeCompare(getMemberLabel(right), "vi"),
        ),
    [members],
  );

  if (!isOwner) return null;

  const submitTransfer = async () => {
    if (!newOwnerUserId) {
      setFormError("Chọn thành viên sẽ nhận quyền chủ chuỗi.");
      return;
    }
    if (!previousOwnerRestaurantId) {
      setFormError("Chọn chi nhánh bạn sẽ quản lý sau khi chuyển quyền.");
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
            previousOwnerRestaurantId,
          },
        },
      });
      setSelectedRestaurantId?.(previousOwnerRestaurantId);
      message.success("Đã chuyển quyền chủ chuỗi");
      window.dispatchEvent(
        new CustomEvent("manager:navigate", {
          detail: { page: "dashboard", source: "brand-owner-transfer" },
        }),
      );
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <details className="brand-member-filter-panel">
      <summary className="brand-member-filter-panel__heading">
        <strong>Chuyển quyền chủ chuỗi</strong>
        <span>Chỉ chủ hiện tại</span>
      </summary>
      <div className="brand-member-filter-panel__body">
        <div className="brand-alert brand-alert--warning" role="note">
          <strong>Sau khi chuyển quyền</strong>
          <span>
            Thành viên được chọn trở thành chủ duy nhất. Tài khoản của bạn chuyển
            xuống quản lý của một chi nhánh.
          </span>
        </div>

        {eligibleMembers.length ? (
          <>
            <div className="brand-member-filters">
              <label className="brand-field brand-filter-field">
                <span>Thành viên nhận quyền</span>
                <select
                  aria-label="Thành viên nhận quyền chủ chuỗi"
                  value={newOwnerUserId}
                  onChange={(event) => {
                    setNewOwnerUserId(event.target.value);
                    setPreviousOwnerRestaurantId("");
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

              <label className="brand-field brand-filter-field">
                <span>Chi nhánh bạn sẽ quản lý</span>
                <select
                  aria-label="Chi nhánh của chủ cũ sau khi chuyển quyền"
                  value={previousOwnerRestaurantId}
                  onChange={(event) => {
                    setPreviousOwnerRestaurantId(event.target.value);
                    setFormError("");
                  }}
                >
                  <option value="">Chọn một chi nhánh</option>
                  {restaurants.map((restaurant) => {
                    const manager = assignedManagerByRestaurant?.get(
                      String(restaurant.id),
                    );
                    const managerWillBecomeOwner =
                      String(manager?.userId || "") === String(newOwnerUserId);
                    const unavailable = Boolean(manager) && !managerWillBecomeOwner;
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

              <button
                type="button"
                className="brand-button brand-button--primary"
                onClick={submitTransfer}
                disabled={loading}
              >
                {loading ? "Đang chuyển quyền..." : "Xác nhận chuyển quyền"}
              </button>
            </div>

            <fieldset className="brand-scope-fieldset">
              <legend>Xác nhận thay đổi quyền</legend>
              <div className="brand-scope-options">
                <label>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => {
                      setConfirmed(event.target.checked);
                      setFormError("");
                    }}
                  />
                  <span>
                    Tôi hiểu mình sẽ không còn là chủ chuỗi và chỉ quản lý chi
                    nhánh đã chọn.
                  </span>
                </label>
              </div>
            </fieldset>
          </>
        ) : (
          <div className="brand-inline-empty brand-inline-empty--members">
            <span aria-hidden="true">◎</span>
            <p>Hãy thêm một thành viên đang hoạt động trước khi chuyển quyền.</p>
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
