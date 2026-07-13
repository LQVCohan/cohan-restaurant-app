// src/App.jsx
import React from "react";
import { BrowserRouter as Router, useLocation } from "react-router-dom";
import AppRouter from "./routes/AppRouter";
import { AuthProvider } from "./context/AuthProvider";
import { ApolloProvider } from "@apollo/client/react";
import { apolloClient } from "./apollo/client";
import ManagerMenuSelectionSync from "./apollo/ManagerMenuSelectionSync";
import "./styles/Globals.scss";
import "./components/LoginPolish.scss";
import "./components/LoginAudiencePolish.scss";
import "./components/Customer/ForYou/ForYouTypographyPolish.scss";
import "./components/Customer/OrdersManagement/OrdersPagePolish.scss";
import "./components/Customer/OrdersManagement/OrdersPageA11yPolish.scss";
import "./components/Customer/RestaurantMenu/styles/MenuDetailViewPolish.scss";
import "./components/Customer/Food/FoodDetailAccessibilityPolish.scss";
import "./components/Customer/AddressPage/AddressPageA11yPolish.scss";
import "./components/Dashboard_Manager/RestaurantSetup/RestaurantCuisineOnboardingMenuPreview.scss";
import "./styles/Homepage/RestaurantGridServiceBadges.scss";
import "./styles/Homepage/HeaderNavigationPolish.scss";
import ScrollToTop from "./components/common/ScrollToTop";
import NotificationContainer from "./components/common/NotificationContainer";
import GlobalMenuAvailabilityPrompt from "./components/common/GlobalMenuAvailabilityPrompt";
import NotificationProvider from "./context/NotificationProvider";
import { CartProvider } from "./context/CartProvider";
import { CustomerNotificationProvider } from "./context/CustomerNotificationContext";
import AiChatbotWidget from "./components/common/AiChatbotWidget";
import "./components/common/AiChatbotHandoffPolish.scss";
import "./components/common/AiChatbotConversationLayout.scss";
import AppErrorBoundary from "./components/common/AppErrorBoundary";
import Table3DPreviewLauncher from "./components/Dashboard_Manager/Table/Table3DPreviewLauncher";
import StaffKitchenFocusLauncher from "./components/Staff/StaffKitchenFocusLauncher";

const isFocusedQrRoute = (pathname) =>
  pathname === "/scan-table" || pathname.startsWith("/table/");

function ScopedAiChatbotWidget() {
  const location = useLocation();
  if (
    location.pathname.startsWith("/login") ||
    location.pathname.startsWith("/business/register") ||
    location.pathname.startsWith("/manager") ||
    location.pathname.startsWith("/staff") ||
    location.pathname.startsWith("/preview/") ||
    isFocusedQrRoute(location.pathname)
  ) {
    return null;
  }
  return <AiChatbotWidget />;
}

function ScopedMenuAvailabilityPrompt() {
  const location = useLocation();
  if (isFocusedQrRoute(location.pathname)) return null;
  return <GlobalMenuAvailabilityPrompt />;
}

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <AppErrorBoundary>
              <ScrollToTop />
              <ManagerMenuSelectionSync />
              <CustomerNotificationProvider>
                <CartProvider>
                  <AppRouter />
                  <Table3DPreviewLauncher />
                  <StaffKitchenFocusLauncher />
                  <ScopedMenuAvailabilityPrompt />
                  <ScopedAiChatbotWidget />
                </CartProvider>
              </CustomerNotificationProvider>
            </AppErrorBoundary>
            <NotificationContainer />
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </ApolloProvider>
  );
}

export default App;
