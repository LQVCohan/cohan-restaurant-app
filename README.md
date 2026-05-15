# Cohan Restaurant App

## Quick start (local development)

### 1) Tạo env local
```bash
npm run env:local
```

### 2) Chạy frontend
```bash
npm run dev
```

### 3) Chạy backend
```bash
npm run dev --prefix cohan-restaurant-backend
```

## Tài liệu
- Environment setup: `docs/environment/setup.md`
- Phase 4 performance scoring policy (PR8): `docs/phase4-performance-scoring-policy.md`
- Upload migration note: `cohan-restaurant-backend/docs/upload-storage-migration.md`
- Health endpoints:
  - `/health/live`
  - `/health/ready`
- Metrics endpoint:
  - `/metrics`


## Coupon/Promotion demo seed (graduation)
- Run seed data (idempotent):
```bash
npm run seed:demo:coupon-promotion --prefix cohan-restaurant-backend
```
- Expected context:
  - Existing restaurant data (or set `DEMO_RESTAURANT_ID`).
  - Existing menu items are recommended for full BOGO/Combo showcase (especially Pho/Tea naming).
- Recommended first demo scenario: `ACTIVE10` coupon, then continue with BOGO -> Freeship -> Combo -> analytics check.
- Full report: `docs/coupon-promotion-final-report.md`
- Step checklist: `docs/coupon-promotion-demo-checklist.md`
