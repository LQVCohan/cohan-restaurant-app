import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { gql } from "@apollo/client";
import { describe, expect, it, vi } from "vitest";

const orderManagementSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/hooks/useOrderManagement.js"),
  "utf8",
);

describe("POS selected-order payment idempotency", () => {
  it("uses the registered PayOrdersByOrderIds operation name", () => {
    expect(orderManagementSource).toContain(
      "mutation PayOrdersByOrderIds($input: PayOrdersByOrderIdsInput!)",
    );
    expect(orderManagementSource).not.toContain(
      "mutation PaySelectedTableOrders($input: PayOrdersByOrderIdsInput!)",
    );
  });

  it("injects the required idempotencyKey before sending selected order payment", async () => {
    sessionStorage.clear();
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            data: {
              payOrdersByOrderIds: {
                warning: false,
                pendingOrderCodes: [],
                invoice: { id: "invoice-1" },
              },
            },
          }),
        headers: { get: () => "application/json" },
      }),
    );

    const { apolloClient } = await import("./client.js");
    await apolloClient.mutate({
      mutation: gql`
        mutation PayOrdersByOrderIds($input: PayOrdersByOrderIdsInput!) {
          payOrdersByOrderIds(input: $input) {
            warning
            pendingOrderCodes
            invoice {
              id
            }
          }
        }
      `,
      variables: {
        input: {
          restaurantId: "restaurant-1",
          orderIds: ["order-1", "order-2"],
          paidAmount: 229000,
          method: "cash",
        },
      },
    });

    const [, request] = global.fetch.mock.calls[0];
    const body = JSON.parse(request.body);
    expect(body.variables.input.idempotencyKey).toMatch(
      /^PayOrdersByOrderIds:v1:/,
    );
  });
});
