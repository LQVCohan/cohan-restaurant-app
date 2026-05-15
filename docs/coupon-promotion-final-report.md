# Coupon/Promotion Module – Final Report (Graduation Demo)

## 1) Naming convention (final)
- **Promotion** = campaign configured by restaurant/manager.
- **Coupon** = customer-facing discount code.
- **CouponPackage** = bundle/grouping of coupons for distribution.
- **No new UI/documentation should use "Voucher" wording** for this module.

## 2) Main entities in scope
- `Coupon`
- `UserCoupon`
- `CouponRedemption`
- `Promotion`
- `Invoice.meta.appliedPromotionBreakdown`

## 3) Business flows
1. **Customer views Coupon**
   - Customer browses available coupons from restaurant/customer channels.
2. **Customer saves Coupon**
   - Save action creates/updates `UserCoupon` relation for that customer.
3. **Customer uses Coupon at checkout/payment**
   - Coupon code is submitted with checkout payload.
4. **Manager creates Promotion**
   - Restaurant manager configures campaign rule in `Promotion`.
5. **Payment applies Promotion/Coupon server-side**
   - Discount validation + calculation happens in backend payment flow.
6. **Invoice stores discount metadata**
   - `Invoice.meta.appliedPromotionBreakdown` stores applied rules and amounts.
7. **Dashboard analytics reads invoice/payment data**
   - Coupon/promotion performance is sourced from actual paid transactions.

## 4) Promotion types covered
- `PERCENTAGE` / `FIXED`
- `BOGO`
- `FREESHIP`
- `COMBO`

## 5) Demo seed scenarios and expected totals
> Assumption for examples: subtotal 200,000 VND, shipping 30,000 VND, no tax/service fee.

1. **Coupon ACTIVE10** (10% percentage coupon, cap 50,000)
   - Discount: 20,000
   - Total: 210,000
2. **Coupon FIXED20K** (fixed 20,000 coupon)
   - Discount: 20,000
   - Total: 210,000
3. **Coupon EXPIRED10**
   - Expected: validation reject (expired)
4. **Coupon LIMIT5** (near global max usage)
   - Expected: mostly still valid for one redemption, then easily reaches limit in demo testing.
5. **Coupon USERONLY** (per-user limit)
   - Expected: first redemption success, second redemption by same user blocked.
6. **Promotion Lunch 10% percentage**
   - Discount: 20,000
   - Total: 210,000
7. **Promotion Fixed 20k order discount**
   - Discount: 20,000
   - Total: 210,000
8. **Promotion Buy Pho get Tea BOGO**
   - Expected: gift/discount equivalent for one tea item when Pho trigger condition is met.
9. **Promotion Freeship order promotion**
   - Discount: 30,000 shipping
   - Total: 200,000
10. **Promotion Family Combo promotion**
   - Expected: combo bundle condition applies configured combo discount.

## 6) Manual QA checklist
- [ ] Manager can create/edit/activate/deactivate promotions for one restaurant.
- [ ] Customer can view and save coupons.
- [ ] Checkout accepts coupon code input and sends to backend payment API.
- [ ] Backend rejects invalid/expired/over-limit coupon with clear reason.
- [ ] Backend applies valid coupon/promotion and computes final total server-side.
- [ ] Invoice stores `meta.appliedPromotionBreakdown` after payment success.
- [ ] Dashboard analytics metrics change after paid invoices with discounts.
- [ ] BOGO flow verifies trigger item + gift item behavior.
- [ ] Freeship flow only affects shipping component.
- [ ] Combo flow verifies required combo items and quantity thresholds.

## 7) Thesis report notes
Include these artifacts and align terminology with **Coupon/Promotion**:
- **ERD**: `Coupon`, `UserCoupon`, `CouponRedemption`, `Promotion`, `Invoice` (meta breakdown), `Payment`.
- **Use case diagram**: Manager (configure promotion), Customer (save/use coupon), System (validate/apply), Dashboard (analyze).
- **Sequence diagram**: Checkout -> Payment service -> Coupon/Promotion validation -> Invoice write -> Analytics read.
- **Activity diagram**: discount eligibility + conflict/priority + final amount calculation path.

## 8) Demo execution quick start
1. Run demo seed script in backend:
   ```bash
   npm run seed:demo:coupon-promotion --prefix cohan-restaurant-backend
   ```
2. Start with **ACTIVE10** scenario first (simple, deterministic).
3. Continue with **BOGO**, **FREESHIP**, **COMBO**, then dashboard analytics verification.
