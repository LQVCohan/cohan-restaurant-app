import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { toGraphqlDateTime, toLocalDateInputValue } from "./useTransactions";

describe("useTransactions bank account field safety", () => {
  it("queries only masked/last4 bank account fields and not raw bankAccountNumber", () => {
    const source = readFileSync(join(process.cwd(), "src/hooks/useTransactions.js"), "utf8");
    const bankFields = source.match(/const BANK_FIELDS = `([\s\S]*?)`;/)?.[1] || "";

    expect(bankFields).toContain("bankAccountNumberMasked");
    expect(bankFields).toContain("bankAccountNumberLast4");
    expect(bankFields).not.toMatch(/^\s*bankAccountNumber\s*$/m);
  });

  it("keeps input dates local and sends GraphQL DateTime strings", () => {
    expect(toLocalDateInputValue(new Date(2026, 5, 1))).toBe("2026-06-01");
    expect(toGraphqlDateTime("2026-05-31")).toBe("2026-05-31T00:00:00.000Z");
    expect(toGraphqlDateTime("2026-06-29", { endOfDay: true })).toBe("2026-06-29T23:59:59.999Z");
  });
});
