// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(
    localStorage.getItem("token") || sessionStorage.getItem("token")
  );
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const verifyToken = async () => {
    if (token) {
      try {
        const response = await axios.post(
          "http://localhost:3001/api/auth/verify",
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        // Save info User
        setUser({
          role: response.data.role,
          avatar: response.data.avatar,
          preferredRestaurant: response.data.preferredRestaurant,
        });
      } catch (error) {
        setToken(null);
        setUser(null);
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        navigate("/login");
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    verifyToken();
  }, [token]);

  const login = (newToken, role, avatar) => {
    setToken(newToken);
    setUser({ role, avatar });
    localStorage.setItem("token", newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
