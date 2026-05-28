import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const schema = fs.readFileSync(
  path.resolve("graphql/schema/user.graphql"),
  "utf8",
);

function typeBody(typeName) {
  const match = schema.match(new RegExp(`type ${typeName} \\{([\\s\\S]*?)\\n\\}`));
  return match?.[1] || "";
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
});
