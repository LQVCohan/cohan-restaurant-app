# Kế hoạch triển khai

1. Sửa `payrollCalculator.service.js` tại biên tính BH: chỉ phát sinh khoản khấu trừ khi phiếu có thu nhập dương.
2. Sửa `payrollRuntime.service.js`: KPI không cộng thực lĩnh âm và thêm cảnh báo BH chưa khấu trừ khi chưa có thu nhập.
3. Bổ sung hai kiểm thử runtime: phiếu 0 thu nhập và phiếu có thu nhập của nhân viên thuộc diện BH.
4. Sửa `PayrollManagement.jsx`: tách nguồn dữ liệu kỳ/range, nhãn bộ lọc, cảnh báo chất lượng dữ liệu, chi tiết dòng và live status.
5. Bổ sung SCSS cho trạng thái nguồn dữ liệu, cảnh báo, drilldown, focus và responsive.
6. Bổ sung component tests cho range preview và chi tiết khấu trừ.

## Kiểm chứng hẹp nhất

- `vitest run cohan-restaurant-backend/tests/services/payroll-correctness.test.js`
- `vitest run src/components/Dashboard_Manager/PayrollPage/PayrollManagement.test.jsx`
- `npm run build`
- kiểm tra thủ công desktop 1440px và mobile 430/390px nếu có runtime checkout.
