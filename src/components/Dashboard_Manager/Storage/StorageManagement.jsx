import React, { useState, useEffect, useContext } from "react";
import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";
import { AuthContext } from "../../../context/AuthContext"; // Giả sử bạn đang sử dụng AuthContext để lấy thông tin user
import Header from "./layout/Header/Header";
import Tabs from "./layout/Tabs/Tabs";
import IngredientList from "./components/ingredients/IngredientList";
import SupplyList from "./components/supplies/SupplyList";
import RecipeList from "./components/recipes/RecipeList";
import AlertSystem from "./components/alerts/AlertSystem";
import "./StorageManagement.scss";

// GraphQL Query để lấy nhà hàng của Manager
const GET_MANAGER_RESTAURANTS = gql`
  query ManagerRestaurants($managerId: ID!, $limit: Int = 50, $cursor: ID) {
    restaurantsByManager(
      managerId: $managerId
      limit: $limit
      cursor: $cursor
    ) {
      edges {
        cursor
        node {
          id
          name
          avatar
          address {
            city
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
`;

const StorageManagement = () => {
  const { user } = useContext(AuthContext); // Lấy thông tin user từ AuthContext
  const managerId = user?.id; // Giả sử user.id là managerId

  const [activeTab, setActiveTab] = useState("ingredients");
  const [currentRestaurant, setCurrentRestaurant] = useState("");
  console.log("manager id", managerId);
  // GraphQL query để lấy danh sách nhà hàng của manager
  const {
    data: mgrData,
    loading: mgrLoading,
    error: mgrError,
  } = useQuery(GET_MANAGER_RESTAURANTS, {
    variables: { managerId, limit: 50 },
    skip: !managerId,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const managerRestaurants =
    mgrData?.restaurantsByManager?.edges?.map((e) => e.node) || [];
  console.log("managerRestaurants", mgrData);
  const tabs = [
    {
      id: "ingredients",
      label: "🥬 Nguyên liệu",
      component: <IngredientList restaurantId={currentRestaurant} />,
    },
    { id: "supplies", label: "🧴 Vật phẩm khác", component: <SupplyList /> },
    {
      id: "recipes",
      label: "📋 Công thức",
      component: <RecipeList restaurantId={currentRestaurant} />,
    },
    {
      id: "allocation",
      label: "🎯 Phân bổ nguyên liệu",
      component: <div>Allocation</div>,
    },
    { id: "inventory", label: "📊 Kiểm kê", component: <div>Inventory</div> },
  ];

  // Khi nhà hàng được chọn, set lại dữ liệu cho component
  useEffect(() => {
    if (managerRestaurants.length) {
      setCurrentRestaurant(managerRestaurants[0].id); // Set restaurant mặc định nếu có
    }
  }, [managerRestaurants]);
  if (mgrError) {
    console.error("Lỗi khi tải nhà hàng:", mgrError);
    return <div style={{ color: "#b91c1c" }}>Lỗi: {mgrError.message}</div>;
  }
  return (
    <div className="storage-management">
      <div className="container">
        <Header restaurantList={managerRestaurants} />
        <AlertSystem />
        <div className="main-content">
          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
          <div className="tab-content">
            {tabs.find((tab) => tab.id === activeTab)?.component}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageManagement;
