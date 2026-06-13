import React, { useContext } from "react";
import { useLocation } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import ContactsView from "./components/ContactsView";
import "./StaffCommunicationPage.scss";

const resolveStaffRestaurantId = (user, restaurants) =>
  user?.restaurantForStaff || user?.restaurantId || user?.assignedRestaurantId || restaurants?.[0]?.id || null;

const StaffCommunicationPage = () => {
  const { user, restaurants } = useContext(AuthContext) || {};
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const restaurantId = resolveStaffRestaurantId(user, restaurants);
  const focusThreadId = location.state?.threadId || params.get("threadId") || null;

  return (
    <div className="staff-communication staff-page" aria-labelledby="staff-communication-title">
      <header className="staff-communication__header">
        <div>
          <h1 id="staff-communication-title">Liên lạc</h1>
          <p>Trao đổi với khách và theo dõi các cuộc hội thoại cần nhân viên xử lý.</p>
        </div>
      </header>
      <section className="staff-communication__panel">
        {restaurantId ? (
          <ContactsView restaurantId={restaurantId} focusThreadId={focusThreadId} />
        ) : (
          <div className="staff-communication__empty" role="status">
            Chưa xác định cơ sở làm việc. Vui lòng liên hệ quản lý để cập nhật phân công.
          </div>
        )}
      </section>
    </div>
  );
};

export default StaffCommunicationPage;
