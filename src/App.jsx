// src/App.jsx
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import AppRouter from "./routes/AppRouter";
import { AuthProvider } from "./context/AuthProvider";
import { ApolloProvider } from "@apollo/client/react";
import { apolloClient } from "./apollo/client";
import "./styles/globals.scss";
import ScrollToTop from "./components/common/ScrollToTop";
import NotificationContainer from "./components/common/NotificationContainer";
import NotificationProvider from "./context/NotificationProvider";
function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <Router>
        <AuthProvider>
          <NotificationProvider>
            <ScrollToTop />
            <AppRouter />
            <NotificationContainer />
          </NotificationProvider>
        </AuthProvider>
      </Router>
    </ApolloProvider>
  );
}

export default App;
