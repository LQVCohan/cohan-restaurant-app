import React, { useMemo } from "react";
import ShiftCardBase from "./ShiftCardBase";
import {
  filterStaffForScheduleScope,
  useScheduleEmploymentScope,
  useScheduleStaffShiftTypes,
} from "../ScheduleEmploymentScope";

export { getEmploymentMixMeta, getShiftDurationMeta } from "./ShiftCardBase";

const idString = (value) => String(value?.id || value?._id || value || "");

const ShiftCard = ({ shift, staffList = [], onClick }) => {
  const employmentScope = useScheduleEmploymentScope();
  const shiftTypeByStaffId = useScheduleStaffShiftTypes();
  const scopedStaff = useMemo(
    () =>
      filterStaffForScheduleScope(
        staffList,
        employmentScope,
        shiftTypeByStaffId,
      ),
    [staffList, employmentScope, shiftTypeByStaffId],
  );
  const scopedStaffIds = useMemo(
    () => new Set(scopedStaff.map((person) => idString(person.id))),
    [scopedStaff],
  );

  if (employmentScope === "all") {
    return <ShiftCardBase shift={shift} staffList={staffList} onClick={onClick} />;
  }

  const records = (shift?.records || []).filter((record) =>
    scopedStaffIds.has(idString(record.employeeId)),
  );
  const staffIds = Array.from(
    new Set(
      (shift?.staffIds || [])
        .map(idString)
        .filter((staffId) => scopedStaffIds.has(staffId)),
    ),
  );

  if (!staffIds.length) return null;

  const scopedShift = {
    ...shift,
    records,
    staffIds,
    employmentScope,
  };

  return (
    <ShiftCardBase
      shift={scopedShift}
      staffList={scopedStaff}
      onClick={(selectedShift) => onClick?.({ ...selectedShift, employmentScope })}
    />
  );
};

export default ShiftCard;
