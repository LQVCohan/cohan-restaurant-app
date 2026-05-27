import { describe, it, expect } from "vitest";
import { generateRandomPassword } from "../../models/user.model.js";

describe("generateRandomPassword", () => {
  it("meets length and complexity requirements", () => {
    const password = generateRandomPassword(12);
    expect(password).toHaveLength(12);
    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
    expect(/[!@#$%^&*()\-_=+\[\]{};:,.<>/?]/.test(password)).toBe(true);
  });
});
