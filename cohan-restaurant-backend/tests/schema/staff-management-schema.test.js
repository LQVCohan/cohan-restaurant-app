import { describe, expect, it } from "vitest";
import { makeExecutableSchema } from "@graphql-tools/schema";
import typeDefs from "../../graphql/schema/index.js";

describe("staff management GraphQL contract", () => {
  it("accepts every staff field sent by the employee edit modal", () => {
    const schema = makeExecutableSchema({
      typeDefs,
      resolverValidationOptions: {
        requireResolversForResolveType: "ignore",
      },
    });
    const fields = schema.getType("AdminUpdateUserInput").getFields();

    expect(Object.keys(fields)).toEqual(
      expect.arrayContaining([
        "fullName",
        "email",
        "phone",
        "address",
        "roleId",
        "department",
        "positionTitle",
        "employmentType",
        "employmentStatus",
        "shiftType",
        "workingDays",
        "dateJoined",
        "dateLeft",
        "baseSalary",
        "noteInternal",
        "emergencyContact",
      ]),
    );
  });
});
