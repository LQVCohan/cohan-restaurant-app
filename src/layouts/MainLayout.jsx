import React from "react";
import { useLocation } from "react-router-dom";
import Header from "../components/Customer/Homepage_Client/components/Header";
import Footer from "../components/Customer/Homepage_Client/components/Footer";

export default function MainLayout({ children }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isRestaurantDetailPreview = searchParams.get("preview") === "1";

  // Các đường dẫn KHÔNG hiển thị header/footer
  const hiddenRoutes = [
    "/login",
    "/verify-email",
    "/verify-email/confirm",
    "/manager",
    "/admin",
  ];

  // Nếu đường dẫn khớp (bắt đầu bằng các path trên) → ẩn layout
  const shouldHideLayout = hiddenRoutes.some((path) =>
    location.pathname.startsWith(path)
  );

  if (shouldHideLayout || isRestaurantDetailPreview) {
    return <>{children}</>; // chỉ render nội dung con
  }

  return (
    <>
      <Header />
      <main style={{ minHeight: "80vh", width: "100vw" }}>{children}</main>
      <Footer />
    </>
  );
}
