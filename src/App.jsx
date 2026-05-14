// src/App.jsx
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import AppRouter from "./routes/AppRouter";
import { AuthProvider } from "./context/AuthProvider";
import { ApolloProvider } from "@apollo/client/react";
import { apolloClient } from "./apollo/client";
import "./styles/Globals.scss";
import "./styles/schedule-insights-polish.css";
import "./styles/add-shift-modal-polish.css";
import "./styles/schedule-board-polish.css";
import "./styles/schedule-publish-polish.css";
import "./styles/availability-registration-polish.css";
import "./styles/schedule-toolbar-polish.css";
import ScrollToTop from "./components/common/ScrollToTop";
import NotificationContainer from "./components/common/NotificationContainer";
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