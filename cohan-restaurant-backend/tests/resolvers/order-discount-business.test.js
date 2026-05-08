import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('order resolver uses centralized discount service', () => {
  it('imports calculateDiscountBreakdown', () => {
    const src = fs.readFileSync('graphql/resolvers/order/mutation.js', 'utf8');
    expect(src).toMatch(/calculateDiscountBreakdown/);
    expect(src).not.toMatch(/resolveVoucherDiscount\(/);
  });
});
