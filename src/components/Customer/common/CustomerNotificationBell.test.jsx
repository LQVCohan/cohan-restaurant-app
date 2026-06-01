import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AuthContext } from "@/context/AuthContext";
import CustomerNotificationBell from "./CustomerNotificationBell";

const notificationBellProps = vi.fn();

vi.mock("@/components/common/NotificationBell", () => ({
  default: (props) => {
    notificationBellProps(props);
    return (
      <button
        type="button"
        data-testid="mock-notification-bell"
        onClick={() => props.onOpenNotification?.({ type: "review.published", restaurantId: "res-1", payload: { reviewId: "rev-1" } })}
      >
        {props.title}:{String(props.enabled)}
      </button>
    );
  },
}));

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.hash}</div>;
};

const renderBell = (authValue) => render(
  <AuthContext.Provider value={authValue}>
    <MemoryRouter initialEntries={["/"]}>
      <CustomerNotificationBell />
      <Routes><Route path="*" element={<LocationProbe />} /></Routes>
    </MemoryRouter>
  </AuthContext.Provider>,
);

describe("CustomerNotificationBell", () => {
  it("renders enabled NotificationBell for authenticated customers", () => {
    renderBell({ isAuthenticated: true, user: { id: "user-1" } });
    expect(screen.getByTestId("mock-notification-bell")).toHaveTextContent("Thông báo của tôi:true");
    expect(notificationBellProps).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, title: "Thông báo của tôi" }));
  });

  it("does not render for guests, so notification queries are not enabled", () => {
    renderBell({ isAuthenticated: false, user: null });
    expect(screen.queryByTestId("mock-notification-bell")).not.toBeInTheDocument();
  });

  it("deep-links review notifications to the restaurant reviews tab", () => {
    renderBell({ isAuthenticated: true, user: { id: "user-1" } });
    fireEvent.click(screen.getByTestId("mock-notification-bell"));
    expect(screen.getByTestId("location")).toHaveTextContent("/restaurant/res-1#reviews");
  });
});
