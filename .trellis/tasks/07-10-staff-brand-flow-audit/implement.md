# Kế hoạch thực hiện

1. Bổ sung field nhân sự còn thiếu vào `AdminUpdateUserInput` và thêm test schema.
2. Cập nhật domain wrapper `graphql/resolvers/staff/index.js`:
   - yêu cầu `staff.write` trong restaurant scope;
   - validate role thuộc nhánh staff và đúng department;
   - tạo BrandMembership rồi gán role bằng service hiện có;
   - rollback Staff + BrandMembership khi đồng bộ lỗi;
   - cập nhật role qua trường nội bộ đã validate;
   - bỏ `baseSalary` khỏi update khi giá trị không đổi;
   - merge `emergencyContact` để giữ `relation`.
3. Mở rộng test resolver cho Manager tạo nhân viên có role, rollback và update payload.
4. Rà lại caller AddEmployeeModal/useStaffManagement/StaffManagement sau sửa.
5. Chạy test mục tiêu khi môi trường cho phép; nếu connector không chạy được, ghi rõ chưa chạy.
