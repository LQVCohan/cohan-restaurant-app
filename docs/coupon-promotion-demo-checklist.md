# Coupon/Promotion Demo Checklist (Step-by-step)

1. **Manager creates/edits Promotion**
   - Open promotion management.
   - Verify Lunch 10%, Fixed 20k, BOGO, Freeship, Family Combo rules exist and are active.

2. **Customer saves Coupon**
   - Open coupon list.
   - Save ACTIVE10 and USERONLY into account wallet/list.

3. **POS/Checkout payment applies Coupon/Promotion**
   - Place order subtotal >= threshold.
   - Apply ACTIVE10, validate discount in payment summary.
   - Run BOGO order (contains Pho + Tea), confirm gift/discount logic.
   - Run Freeship order, confirm shipping discount.
   - Run Combo order, confirm combo condition discount.

4. **Invoice metadata verification**
   - Open created invoice record.
   - Confirm `meta.appliedPromotionBreakdown` includes applied rule and amount.

5. **Dashboard analytics verification**
   - Open coupon/promotion analytics dashboard.
   - Confirm metrics reflect completed paid invoices from demo scenarios.

6. **Negative/validation checks**
   - Try EXPIRED10 -> expected reject.
   - Redeem USERONLY twice on same user -> second attempt reject.
   - Push LIMIT5 until usage cap -> expected limit rejection.
