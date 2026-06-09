import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("useTransactions bank account field safety", () => {
  it("queries only masked/last4 bank account fields and not raw bankAccountNumber", () => {
    const source = readFileSync(join(process.cwd(), "src/hooks/useTransactions.js"), "utf8");
    const bankFields = source.match(/const BANK_FIELDS = `([\s\S]*?)`;/)?.[1] || "";

    expect(bankFields).toContain("bankAccountNumberMasked");
    expect(bankFields).toContain("bankAccountNumberLast4");
    expect(bankFields).not.toMatch(/^\s*bankAccountNumber\s*$/m);
  });
});
