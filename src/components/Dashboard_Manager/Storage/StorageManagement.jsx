import React, { useState } from "react";
import Header from "./layout/Header/Header";
import Tabs from "./layout/Tabs/Tabs";
import IngredientList from "./components/ingredients/IngredientList";
import SupplyList from "./components/supplies/SupplyList";
import RecipeList from "./components/recipes/RecipeList";
import AlertSystem from "./components/alerts/AlertSystem";
// import "./styles/globals.scss";

const StorageManagement = () => {
  const [activeTab, setActiveTab] = useState("ingredients");

  const tabs = [
    {
      id: "ingredients",
      label: "🥬 Nguyên liệu",
      component: <IngredientList />,
    },
    { id: "supplies", label: "🧴 Vật phẩm khác", component: <SupplyList /> },
    { id: "recipes", label: "📋 Công thức", component: <RecipeList /> },
    {
      id: "allocation",
      label: "🎯 Phân bổ nguyên liệu",
      component: <div>Allocation</div>,
    },
    { id: "inventory", label: "📊 Kiểm kê", component: <div>Inventory</div> },
  ];

  return (
    <div className="app">
      <div className="container">
        <Header />
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
