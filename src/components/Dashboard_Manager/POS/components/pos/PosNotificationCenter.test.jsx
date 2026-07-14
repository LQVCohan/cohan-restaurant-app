import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./TablePaymentRequestNotice", () => ({
  default: () => <div>Payment notice</div>,
}));
vi.mock("./CustomerRequestQueuePanel", () => ({
  default: () => <div>Customer requests</div>,
}));
vi.mock("./PosIncomingTableOrderQueue", () => ({
  default: () => <div>QR requests</div>,
}));
vi.mock("./EligibleGiftSuggestionPanel", () => ({
  default: () => <div>Gift suggestions</div>,
}));

import PosNotificationCenter from "./PosNotificationCenter";

afterEach(() => cleanup());

describe("PosNotificationCenter", () => {
  it("keeps operational notices inside a single collapsible bell", () => {
    render(
      <PosNotificationCenter
        restaurantId="restaurant-1"
        onOpenPayment={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Mở trung tâm thông báo POS",
    });
    const popover = document.getElementById("pos-notification-center-popover");

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popover.hidden).toBe(true);

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popover.hidden).toBe(false);
    expect(screen.getByText("QR requests")).toBeTruthy();
    expect(screen.getByText("Gift suggestions")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popover.hidden).toBe(true);
  });
});
