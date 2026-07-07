import React, { useCallback, useEffect, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import ProfileSidebar from "./components/ProfileSidebar";
import ProfileInfo from "./components/ProfileInfo";
import ProfileWallet from "./components/ProfileWallet";
import OrderHistory from "./components/OrderHistory";
import SecuritySettings from "./components/SecuritySettings";
import FoodPreferences from "./components/FoodPreferences";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import useBrandManagement from "@/hooks/useBrandManagement";
import { getCombinedRoleLabel } from "@/lib/userRoleDisplay";
import {
  canAccessRoute,
  getDefaultPathForRole,
  isCustomerRole,
} from "@/utils/frontendRoleAccess";
import "./ProfilePage.scss";
import "./ProfileVisibilityPolish.scss";

const ME_QUERY = gql`
  query Me {
    me {
      id
      fullName
      username
      email
      phone
      avatarUrl
      address {
        line1
        line2
        ward
        district
        city
        country
      }
      roleName
      emailVerified
      phoneVerified
      loyaltyPoints
      totalOrders
      totalSpending
      foodPreferences {
        diet
        allergies
        habits {
          noOnion
          noCilantro
          sugar
          spice
          ice
        }
        autoNote
        updatedAt
      }
      createdAt
      wallet {
        provider
        status
        balance
        currency
        createdAt
        updatedAt
      }
    }
  }
`;

const EMPTY_RESTAURANTS = [];

const ProfilePage = () => {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery(ME_QUERY);
  const [activeTab, setActiveTab] = useState("info");
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempAvatarFile, setTempAvatarFile] = useState(null);

  const user = useMemo(() => data?.me, [data]);
  const brandState = useBrandManagement(EMPTY_RESTAURANTS, { skip: !user?.id });
  const activeBrand = brandState.selectedBrand || brandState.brands[0] || null;
  const activeMembership = activeBrand?.membership || (
    activeBrand?.membershipRole
      ? { role: activeBrand.membershipRole, restaurantIds: activeBrand.restaurantIds || [] }
      : null
  );
  const roleLabel = useMemo(
    () => getCombinedRoleLabel({
      user,
      activeBrand,
      membership: activeMembership,
      compact: true,
    }),
    [activeBrand, activeMembership, user],
  );
  const showCustomerFeatures = isCustomerRole(user);
  const showOrderHistory = Boolean(user && canAccessRoute(user, "/orders"));
  const managementPath = getDefaultPathForRole(user);
  const showManagementShortcut = Boolean(
    user
      && !showCustomerFeatures
      && canAccessRoute(user, managementPath)
      && (managementPath === "/manager" || managementPath.startsWith("/staff/")),
  );

  useEffect(() => {
    const allowedTabs = new Set([
      "info",
      "security",
      ...(showCustomerFeatures ? ["preferences", "wallet"] : []),
      ...(showOrderHistory ? ["orders"] : []),
    ]);
    if (!allowedTabs.has(activeTab)) setActiveTab("info");
  }, [activeTab, showCustomerFeatures, showOrderHistory]);

  const handleAvatarChange = useCallback((file) => {
    setTempAvatarFile(file);
  }, []);

  const handleRefetchUser = useCallback(async () => {
    const result = await refetch();
    setTempAvatarFile(null);
    return result;
  }, [refetch]);

  if (loading) {
    return (
      <div className="profile-loading" role="status" aria-live="polite" aria-label="Đang tải hồ sơ cá nhân">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (error) return <div className="profile-error" role="alert">Lỗi tải trang: {error.message}</div>;

  return (
    <main className="profile-page" aria-label="Hồ sơ cá nhân">
      <div className="profile-container">
        <ProfileSidebar
          user={user}
          roleLabel={roleLabel}
          showCustomerFeatures={showCustomerFeatures}
          showOrderHistory={showOrderHistory}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsEditMode(false);
          }}
          isEditMode={isEditMode}
          onAvatarChange={handleAvatarChange}
        />

        <section className="profile-content" aria-live="polite">
          {activeTab === "info" && (
            <>
              {showManagementShortcut && (
                <aside className="profile-management-shortcut" aria-label="Chuyển đến trang quản lý">
                  <div>
                    <span>Khu vực nội bộ</span>
                    <strong>Tiếp tục tại trang quản lý</strong>
                    <p>Mở bảng điều khiển phù hợp với vai trò của tài khoản này.</p>
                  </div>
                  <button type="button" onClick={() => navigate(managementPath)}>
                    Chuyển đến trang quản lý
                  </button>
                </aside>
              )}
              <ProfileInfo
                user={user}
                isEditMode={isEditMode}
                setIsEditMode={setIsEditMode}
                refetchUser={handleRefetchUser}
                newAvatarFile={tempAvatarFile}
              />
            </>
          )}
          {showCustomerFeatures && activeTab === "preferences" && <FoodPreferences />}
          {showOrderHistory && activeTab === "orders" && <OrderHistory user={user} />}
          {showCustomerFeatures && activeTab === "wallet" && <ProfileWallet user={user} refetchUser={handleRefetchUser} />}
          {activeTab === "security" && <SecuritySettings />}
        </section>
      </div>
    </main>
  );
};

export default ProfilePage;
