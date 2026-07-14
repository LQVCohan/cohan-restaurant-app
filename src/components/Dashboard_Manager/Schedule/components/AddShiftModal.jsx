import React, { useMemo } from "react";
import AddShiftModalBase from "./AddShiftModalBase";
import {
  filterStaffForScheduleScope,
  resolveStaffShiftType,
  useScheduleEmploymentScope,
  useScheduleStaffShiftTypes,
} from "../ScheduleEmploymentScope";

const ROTATING_WORKING_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const AddShiftModal = (props) => {
  const employmentScope = useScheduleEmploymentScope();
  const shiftTypeByStaffId = useScheduleStaffShiftTypes();
  const scopedStaffList = useMemo(
    () =>
      filterStaffForScheduleScope(
        props.staffList || [],
        employmentScope,
        shiftTypeByStaffId,
      ).map((staff) => {
        const shiftType = resolveStaffShiftType(staff, shiftTypeByStaffId);
        if (shiftType !== "rotating") return staff;

        // Nhân viên xoay ca không có ngày làm cố định. Chuẩn hóa danh sách ngày ở
        // lớp hiển thị để modal không loại họ trước khi backend kiểm tra xung đột.
        return {
          ...staff,
          shiftType,
          workingDays: ROTATING_WORKING_DAYS,
        };
      }),
    [props.staffList, employmentScope, shiftTypeByStaffId],
  );

  return <AddShiftModalBase {...props} staffList={scopedStaffList} />;
};

export default AddShiftModal;
