import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

vi.mock('../../models/index.js', () => ({
  Coupon: { findOne: vi.fn() },
  Promotion: { findOne: vi.fn() },
}));

import { Coupon, Promotion } from '../../models/index.js';
import { calculateDiscountBreakdown } from '../../src/services/discountCalculation.service.js';

const chain = (doc) => ({ session: () => Promise.resolve(doc) });
const rid = new mongoose.Types.ObjectId();

beforeEach(() => vi.clearAllMocks());

describe('discount calculation business', () => {
  it('rejects expired coupon', async () => {
    Coupon.findOne.mockReturnValue(chain({ isActive: true, code: 'A', endAt: new Date('2020-01-01') }));
    await expect(calculateDiscountBreakdown({ restaurantId: rid, items:[{lineSubtotal:100000}], pricing:{voucherCode:'A'} })).rejects.toThrow(/not active/);
  });

  it('percent coupon respects maxDiscount and total not negative', async () => {
    Coupon.findOne.mockReturnValue(chain({ _id:'c1', isActive:true, discountType:'PERCENT', discountValue:50, maxDiscount:10000, minOrderValue:0, maxUsage:0 }));
    Promotion.findOne.mockReturnValue(chain(null));
    const r = await calculateDiscountBreakdown({ restaurantId: rid, items:[{lineSubtotal:100000}], pricing:{voucherCode:'A'} });
    expect(r.voucherDiscount).toBe(10000);
    expect(r.finalTotal).toBeGreaterThanOrEqual(0);
  });

  it('combinableWithPromotions=false blocks promotion stack', async () => {
    Coupon.findOne.mockReturnValue(chain({ _id:'c1', isActive:true, discountType:'AMOUNT', discountValue:10000, constraints:{combinableWithPromotions:false} }));
    Promotion.findOne.mockReturnValue(chain({ _id:'p1', isActive:true, discountType:'AMOUNT', discountValue:5000, stacking:true }));
    const r = await calculateDiscountBreakdown({ restaurantId: rid, promotionIds:['p1'], items:[{lineSubtotal:100000}], pricing:{voucherCode:'A'} });
    expect(r.promotionDiscount).toBe(0);
  });

  it('stackable + combinableWithPromotions=true allows stacking', async () => {
    Coupon.findOne.mockReturnValue(chain({ _id:'c1', isActive:true, discountType:'AMOUNT', discountValue:10000, constraints:{stackable:true, combinableWithPromotions:true} }));
    Promotion.findOne.mockReturnValue(chain({ _id:'p1', isActive:true, discountType:'AMOUNT', discountValue:5000, stacking:true }));
    const r = await calculateDiscountBreakdown({ restaurantId: rid, promotionIds:['p1'], items:[{lineSubtotal:100000}], pricing:{voucherCode:'A'} });
    expect(r.promotionDiscount).toBe(5000);
    expect(r.totalDiscount).toBe(15000);
  });

  it('exclusive promotion blocks coupon discount', async () => {
    Coupon.findOne.mockReturnValue(chain({ _id:'c1', isActive:true, discountType:'AMOUNT', discountValue:10000, constraints:{combinableWithPromotions:true} }));
    Promotion.findOne.mockReturnValueOnce(chain({ _id:'p1', isActive:true, discountType:'AMOUNT', discountValue:3000, exclusive:true, priority:10 }))
      .mockReturnValueOnce(chain({ _id:'p2', isActive:true, discountType:'AMOUNT', discountValue:5000, priority:1 }));
    const r = await calculateDiscountBreakdown({ restaurantId: rid, promotionIds:['p1','p2'], items:[{lineSubtotal:100000}], pricing:{voucherCode:'A'} });
    expect(r.appliedPromotions[0]).toBe('p1');
    expect(r.promotionDiscount).toBe(0);
  });
});
