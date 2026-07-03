# Implementation plan

1. Fetch latest `CouponPage.scss`, `CouponPage.product.css` and `src/index.css`.
2. Remove the obsolete global coupon stylesheet import and delete the dead file.
3. Rewrite the component-owned SCSS using existing class names; do not change React data flow.
4. Verify no stale selectors remain and review the diff for global CSS leakage.
5. Run the coupon component test, conflict check and build; report any unavailable browser smoke test.
