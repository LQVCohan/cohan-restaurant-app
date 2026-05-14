// src/App.jsx
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import AppRouter from "./routes/AppRouter";
import { AuthProvider } from "./context/AuthProvider";
import { ApolloProvider } from "@apollo/client/react";
import { apolloClient } from "./apollo/client";
import "./styles/Globals.scss";
import ScrollToTop from "./components/common/ScrollToTop";
import NotificationContainer from "./components/common/NotificationContainer";
import GlobalMenuAvailabilityPrompt from "./components/common/GlobalMenuAvailabilityPrompt";
import FoodDetailAvailabilityGlobalMount from "./components/Customer/Food/FoodDetailAvailabilityGlobalMount";
import NotificationProvider from "./context/NotificationProvider";
import { CartProvider } from "./context/CartProvider";
import { CustomerNotificationProvider } from "./context/CustomerNotificationContext";
function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <ScrollToTop />
            <CustomerNotificationProvider>
              <CartProvider>
                <AppRouter />
                <FoodDetailAvailabilityGlobalMount />
                <GlobalMenuAvailabilityPrompt />
              </CartProvider>
            </CustomerNotificationProvider>
            <NotificationContainer />
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </ApolloProvider>
  );
}

export default App;