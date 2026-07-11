import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import StaffKitchenFocusLauncher, {
  STAFF_KITCHEN_FOCUS_BODY_CLASS,
} from "./StaffKitchenFocusLauncher";

const renderLauncher = (path = "/staff/kitchen") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <aside className="staff-kitchen-page__venue" aria-label="Cơ sở đang làm việc" />
      <StaffKitchenFocusLauncher />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  document.body.classList.remove(STAFF_KITCHEN_FOCUS_BODY_CLASS);
  document.body.style.overflow = "";
});

describe("StaffKitchenFocusLauncher", () => {
  it("enters and exits focus mode with the button and Escape", async () => {
    renderLauncher();

    fireEvent.click(
      await screen.findByRole("button", { name: "Mở chế độ tập trung" }),
    );

    expect(document.body).toHaveClass(STAFF_KITCHEN_FOCUS_BODY_CLASS);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(
      screen.getByRole("button", { name: "Thoát chế độ tập trung" }),
    );

    expect(document.body).not.toHaveClass(STAFF_KITCHEN_FOCUS_BODY_CLASS);
    expect(document.body.style.overflow).toBe("");

    fireEvent.click(
      screen.getByRole("button", { name: "Mở chế độ tập trung" }),
    );
    fireEvent.keyDown(window, { key: "Escape" });

    expect(document.body).not.toHaveClass(STAFF_KITCHEN_FOCUS_BODY_CLASS);
    expect(document.body.style.overflow).toBe("");
  });

  it("restores the previous body overflow when unmounted", async () => {
    document.body.style.overflow = "auto";
    const { unmount } = renderLauncher();

    fireEvent.click(
      await screen.findByRole("button", { name: "Mở chế độ tập trung" }),
    );
    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body).not.toHaveClass(STAFF_KITCHEN_FOCUS_BODY_CLASS);
    expect(document.body.style.overflow).toBe("auto");
  });

  it("does not render outside the staff kitchen route", () => {
    renderLauncher("/staff/orders");

    expect(
      screen.queryByRole("button", { name: "Mở chế độ tập trung" }),
    ).not.toBeInTheDocument();
  });
});
