import { describe, expect, it, vi } from "vitest";
import { scrollToCustomerInsight } from "./CustomerAnalyticsPage";

describe("Customer analytics actions", () => {
  it("moves to the exact cohort panel", () => {
    const target = document.createElement("section");
    target.id = "customer-insight-dormant";
    target.scrollIntoView = vi.fn();
    target.focus = vi.fn();
    document.body.appendChild(target);
    expect(scrollToCustomerInsight(target.id)).toBe(true);
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    target.remove();
  });
});
