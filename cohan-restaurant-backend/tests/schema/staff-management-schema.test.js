import { describe, expect, it } from "vitest";
import { graphql } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";
import typeDefs from "../../graphql/schema/index.js";
import baseResolvers from "../../graphql/resolvers/base.js";

const createSchema = () =>
  makeExecutableSchema({
    typeDefs,
    resolvers: baseResolvers,
    resolverValidationOptions: {
      requireResolversForResolveType: "ignore",
    },
  });

describe("staff management GraphQL contract", () => {
  it("accepts every staff field sent by the employee edit modal", () => {
    const schema = createSchema();
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

  it("accepts the emergency contact sent by the add-employee modal", () => {
    const schema = createSchema();
    const fields = schema.getType("CreateUserInput").getFields();

    expect(String(fields.emergencyContact.type)).toBe("EmergencyContactInput");
  });

  it("exposes a staff-scoped account status mutation", () => {
    const schema = createSchema();
    const mutationFields = schema.getMutationType().getFields();

    expect(mutationFields.setStaffAccountStatus).toBeDefined();
    expect(
      String(mutationFields.setStaffAccountStatus.type),
    ).toBe("StaffPrivateProfile!");
  });

  it("serializes lowercase staff profile values as GraphQL enums", async () => {
    const result = await graphql({
      schema: createSchema(),
      source: `
        query StaffProfileEnumContract {
          staff(id: "staff-1") {
            id
            gender
            maritalStatus
            contractType
            salaryType
            trainingStatus
          }
        }
      `,
      rootValue: {
        staff: {
          id: "staff-1",
          gender: "female",
          maritalStatus: "single",
          contractType: "fixed_term",
          salaryType: "monthly",
          trainingStatus: "in_progress",
        },
      },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data?.staff).toEqual({
      id: "staff-1",
      gender: "FEMALE",
      maritalStatus: "SINGLE",
      contractType: "FIXED_TERM",
      salaryType: "MONTHLY",
      trainingStatus: "IN_PROGRESS",
    });
  });
});
