import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("AddCustomerModal primary action styles", () => {
  it("defines the primary token in the footer ancestor and has a literal fallback", () => {
    const styles = readFileSync(
      resolve(
        process.cwd(),
        "src/components/Dashboard_Manager/Customer/AddCustomerModal.scss",
      ),
      "utf8",
    );

    const containerStart = styles.indexOf(
      ".modal-container:has(.add-customer-modal) {",
    );
    const containerEnd = styles.indexOf("}", containerStart);
    const containerRule = styles.slice(containerStart, containerEnd);
    expect(containerRule).toContain("--acm-primary-dark: #214f49");
    expect(styles).toContain(
      "background: var(--acm-primary-dark, #214f49) !important",
    );
    expect(styles).toContain("-webkit-text-fill-color: #ffffff !important");
  });
});
