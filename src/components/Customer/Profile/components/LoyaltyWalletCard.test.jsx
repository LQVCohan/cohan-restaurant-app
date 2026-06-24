import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoyaltyWalletCard from "./LoyaltyWalletCard";

describe("LoyaltyWalletCard", () => {
  it("shows member tier, points, spending and wallet status", () => {
    render(
      <LoyaltyWalletCard
        user={{
          loyaltyPoints: 1600,
          totalOrders: 12,
          totalSpending: 2500000,
          wallet: {
            status: "active",
            balance: 300000,
            currency: "VND",
          },
        }}
      />,
    );

    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText("1.600 điểm thưởng")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/2.500.000/)).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText(/300.000/)).toBeInTheDocument();
  });

  it("shows inactive wallet state when wallet is missing", () => {
    render(<LoyaltyWalletCard user={{ loyaltyPoints: 100, totalOrders: 0, totalSpending: 0 }} />);

    expect(screen.getByText("Member")).toBeInTheDocument();
    expect(screen.getByText("100 điểm thưởng")).toBeInTheDocument();
    expect(screen.getByText("Chưa kích hoạt")).toBeInTheDocument();
  });
});
