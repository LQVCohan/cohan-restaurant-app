import React from "react";
import { gql } from "@apollo/client";
import { MockedProvider } from "@apollo/client/testing";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import TableOrderAccessGate, {
  TABLE_ORDER_ACCESS_REQUIRED_EVENT,
} from "./TableOrderAccessGate";

const restaurantId = "507f1f77bcf86cd799439011";
const tableId = "507f1f77bcf86cd799439012";
const token = "signed.table.token";

const CONTEXT = gql`
  query PublicTableOrderAccessGate(
    $restaurantId: ID!
    $tableId: ID!
    $token: String!
  ) {
    publicActiveTableSessionOrders(
      restaurantId: $restaurantId
      tableId: $tableId
      token: $token
    ) {
      tableId
      tableCode
      canRequestOrderAccess
      orderAccessConfirmed
      orderAccessBlockedReason
      session { id }
    }
  }
`;

const mocks = [
  {
    request: {
      query: CONTEXT,
      variables: { restaurantId, tableId, token },
    },
    result: {
      data: {
        publicActiveTableSessionOrders: {
          tableId,
          tableCode: "T201",
          canRequestOrderAccess: true,
          orderAccessConfirmed: false,
          orderAccessBlockedReason: null,
          session: { id: "507f1f77bcf86cd799439013" },
        },
      },
    },
  },
];

const renderGate = () =>
  render(
    <MockedProvider mocks={mocks} addTypename={false}>
      <MemoryRouter
        initialEntries={[
          `/table/${restaurantId}/${tableId}?token=${encodeURIComponent(token)}`,
        ]}
      >
        <TableOrderAccessGate />
      </MemoryRouter>
    </MockedProvider>,
  );

describe("TableOrderAccessGate final QR flow", () => {
  it("does not open verification immediately after scanning the table QR", async () => {
    renderGate();

    await screen.findByRole("button", { name: /nhờ nhân viên xác nhận tại bàn T201/i });
    expect(
      screen.queryByRole("dialog", { name: /xác nhận gọi món tại bàn/i }),
    ).not.toBeInTheDocument();
  });

  it("opens after an item-selection action requests staff verification", async () => {
    renderGate();
    await screen.findByRole("button", { name: /nhờ nhân viên xác nhận tại bàn T201/i });

    act(() => {
      window.dispatchEvent(new CustomEvent(TABLE_ORDER_ACCESS_REQUIRED_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByText("Xác nhận gọi món tại bàn")).toBeInTheDocument();
    });
  });
});
