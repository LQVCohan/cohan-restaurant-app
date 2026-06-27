import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildASTSchema, parse, validate } from "graphql";

const schemaPath = path.resolve("graphql/schema/user.graphql");
const schema = fs.readFileSync(schemaPath, "utf8");

function typeBody(typeName) {
  const match = schema.match(new RegExp(`type ${typeName} \\{([\\s\\S]*?)\\n\\}`));
  return match?.[1] || "";
}

async function executableSchema() {
  const { default: typeDefs } = await import("../../graphql/schema/index.js");
  return buildASTSchema(typeDefs, { assumeValidSDL: true });
}

async function expectValidOperation(source) {
  const errors = validate(await executableSchema(), parse(source));
  expect(errors.map((error) => error.message)).toEqual([]);
}

describe("GraphQL user privacy schema", () => {
  it("does not expose HR/payroll/bank/identity fields on general User", () => {
    const userType = typeBody("User");
    for (const field of [
      "taxCode",
      "baseSalary",
      "nationalId",
      "nationalIdIssuedAt",
      "nationalIdIssuedPlace",
      "bankName",
      "bankAccountNumber",
      "bankAccountHolder",
      "socialInsuranceNumber",
      "healthInsuranceNumber",
      "unemploymentInsuranceNumber",
      "noteInternal",
      "lastLoginIp",
      "forcePasswordChange",
      "contractCode",
      "contractType",
      "hourlyRate",
      "allowanceAmount",
    ]) {
      expect(userType).not.toMatch(new RegExp(`\\b${field}\\s*:`));
    }
  });

  it("moves private staff fields to StaffPrivateProfile", () => {
    const privateType = typeBody("StaffPrivateProfile");
    expect(privateType).toMatch(/\bbaseSalary\s*:/);
    expect(privateType).toMatch(/\bnationalId\s*:/);
    expect(privateType).toMatch(/\bbankAccountNumber\s*:/);
    expect(privateType).toMatch(/\bnoteInternal\s*:/);
  });

  it("keeps staff private fragments only on StaffPrivateProfile-returning staff operations", async () => {
    await expectValidOperation(`
      fragment StaffFields on StaffPrivateProfile {
        id
        fullName
        email
        phone
        roleName
        baseSalary
        noteInternal
        role { id slug }
      }
      mutation SetStaffEmploymentStatus($userId: ID!, $employmentStatus: EmploymentStatus!) {
        setStaffEmploymentStatus(userId: $userId, employmentStatus: $employmentStatus) {
          ...StaffFields
        }
      }
      mutation SetUserStatus($userId: ID!, $status: String!) {
        setUserStatus(userId: $userId, status: $status) {
          id
          status
          roleName
          updatedAt
        }
      }
    `);
  });

  it("validates RBAC staff role assignment against StaffPrivateProfile", async () => {
    await expectValidOperation(`
      fragment RbacStaffRoleFields on StaffPrivateProfile {
        id
        fullName
        email
        phone
        employeeCode
        restaurantForStaff
        roleName
        role { id name slug department }
      }
      mutation AssignStaffRole($input: AssignStaffRoleInput!) {
        assignStaffRole(input: $input) {
          ...RbacStaffRoleFields
        }
      }
    `);
  });

  it("validates customer table lookup without noteInternal on User", async () => {
    await expectValidOperation(`
      query GetCustomersForTableInfo($search: String, $includeGuests: Boolean) {
        customers(search: $search, includeGuests: $includeGuests) {
          name: fullName
          phone
          email
        }
      }
    `);
  });
});
