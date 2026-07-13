import React, { useMemo } from "react";
import ShiftDetailModalBase from "./ShiftDetailModalBase";
import {
  filterStaffForScheduleScope,
  useScheduleEmploymentScope,
} from "../ScheduleEmploymentScope";

const idString = (value) => String(value?.id || value?._id || value || "");

const ShiftDetailModal = (props) => {
  const employmentScope = useScheduleEmploymentScope();
  const scopedStaffList = useMemo(
    () => filterStaffForScheduleScope(props.staffList || [], employmentScope),
    [props.staffList, employmentScope],
  );
  const scopedStaffIds = useMemo(
    () => new Set(scopedStaffList.map((person) => idString(person.id))),
    [scopedStaffList],
  );

  const scopedShift = useMemo(() => {
    if (!props.shift || employmentScope === "all") return props.shift;
    return {
      ...props.shift,
      employmentScope,
      staffIds: (props.shift.staffIds || [])
        .map(idString)
        .filter((staffId) => scopedStaffIds.has(staffId)),
      records: (props.shift.records || []).filter((record) =>
        scopedStaffIds.has(idString(record.employeeId)),
      ),
    };
  }, [props.shift, employmentScope, scopedStaffIds]);

  return (
    <ShiftDetailModalBase
      {...props}
      shift={scopedShift}
      staffList={scopedStaffList}
    />
  );
};

export default ShiftDetailModal;
