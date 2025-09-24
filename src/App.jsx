// src/App.jsx
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import AppRouter from "./routes/AppRouter";
import { AuthProvider } from "./context/AuthContext";
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "./apollo/client";
import "./styles/globals.scss";

function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <Router>
          <AppRouter />
        </Router>
      </AuthProvider>
    </ApolloProvider>
  );
}

export default App;
