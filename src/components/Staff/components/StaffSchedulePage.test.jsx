import React from "react";
import { describe, it, expect } from "vitest";
import { MockedProvider } from "@apollo/client/testing";
import { render, screen } from "@testing-library/react";
import StaffSchedulePage from "./StaffSchedulePage";
import { AuthContext } from "@/context/AuthContext";

function renderWithAuth(user) {
  return render(
    <AuthContext.Provider value={{ user, restaurants: [{ id: "r1" }] }}>
      <MockedProvider mocks={[]} addTypename={false}>
        <StaffSchedulePage />
      </MockedProvider>
    </AuthContext.Provider>,
  );
}

describe("StaffSchedulePage", () => {
  it("shows page title", async () => {
    renderWithAuth({ id: "e1", employmentType: "part_time", restaurantForStaff: "r1" });
    expect(await screen.findByText("Lịch làm việc của tôi")).toBeInTheDocument();
  });

  it("shows full-time unavailable copy", async () => {
    renderWithAuth({ id: "e1", employmentType: "full_time", restaurantForStaff: "r1" });
    expect(await screen.findByText(/Đăng ký availability/i)).toBeInTheDocument();
  });

  it("does not render manager controls", async () => {
    renderWithAuth({ id: "e1", employmentType: "part_time", restaurantForStaff: "r1" });
    expect(screen.queryByText(/Tạo cửa đăng ký/i)).not.toBeInTheDocument();
  });
});
