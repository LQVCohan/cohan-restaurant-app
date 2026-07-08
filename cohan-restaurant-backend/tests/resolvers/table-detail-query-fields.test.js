import { describe, expect, it } from "vitest";
import { TABLE_SELECT } from "../../graphql/resolvers/table/query.js";

const TABLE_DETAIL_FIELDS = [
  "type",
  "tags",
  "zone",
  "vrUrl",
  "deposit",
  "promotionIds",
  "bookingPerks",
  "reservationHoldMinutes",
  "minSpend",
  "cancelPolicy",
];

describe("table detail query projection", () => {
  it("returns every persisted field used by the table detail modal", () => {
    expect(TABLE_SELECT).toMatchObject(
      Object.fromEntries(TABLE_DETAIL_FIELDS.map((field) => [field, 1])),
    );
  });
});
