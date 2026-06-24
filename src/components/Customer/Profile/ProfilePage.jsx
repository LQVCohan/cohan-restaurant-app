import React, { useCallback, useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import ProfileSidebar from "./components/ProfileSidebar";
import ProfileInfo from "./components/ProfileInfo";
import OrderHistory from "./components/OrderHistory";
import SecuritySettings from "./components/SecuritySettings";
import FoodPreferences from "./components/FoodPreferences";
import LoyaltyWalletCard from "./components/LoyaltyWalletCard";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import "./ProfilePage.scss";

// GraphQL Main Query
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

const ProfilePage = () => {
  const { data, loading, error, refetch } = useQuery(ME_QUERY);
  const [activeTab, setActiveTab] = useState("info");
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempAvatarFile, setTempAvatarFile] = useState(null);

  const user = useMemo(() => data?.me, [data]);

  const handleAvatarChange = useCallback((file) => {
    setTempAvatarFile(file);
  }, []);

  const handleRefetchUser = useCallback(async () => {
    const result = await refetch();
    setTempAvatarFile(null);
    return result;
  }, [refetch]);

  if (loading)
    return (
      <div className="profile-loading">
        <LoadingSpinner size="large" />
      </div>
    );
  if (error)
    return <div className="profile-error">Lỗi tải trang: {error.message}</div>;

  return (
    <div className="profile-page">
      <div className="profile-container">
        <ProfileSidebar
          user={user}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsEditMode(false);
          }}
          isEditMode={isEditMode}
          onAvatarChange={handleAvatarChange}
        />

        <main className="profile-content">
          <LoyaltyWalletCard user={user} />
          {activeTab === "info" && (
            <ProfileInfo
              user={user}
              isEditMode={isEditMode}
              setIsEditMode={setIsEditMode}
              refetchUser={handleRefetchUser}
              newAvatarFile={tempAvatarFile}
            />
          )}
          {activeTab === "preferences" && <FoodPreferences />}
          {activeTab === "orders" && <OrderHistory user={user} />}
          {activeTab === "security" && <SecuritySettings />}
        </main>
      </div>
    </div>
  );
};

export default ProfilePage;
