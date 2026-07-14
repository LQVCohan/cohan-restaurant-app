import React, { useMemo } from "react";
import AddShiftModalBase from "./AddShiftModalBase";
import {
  filterStaffForScheduleScope,
  useScheduleEmploymentScope,
  useScheduleStaffShiftTypes,
} from "../ScheduleEmploymentScope";

const AddShiftModal = (props) => {
  const employmentScope = useScheduleEmploymentScope();
  const shiftTypeByStaffId = useScheduleStaffShiftTypes();
  const scopedStaffList = useMemo(
    () =>
      filterStaffForScheduleScope(
        props.staffList || [],
        employmentScope,
        shiftTypeByStaffId,
      ),
    [props.staffList, employmentScope, shiftTypeByStaffId],
  );

  return <AddShiftModalBase {...props} staffList={scopedStaffList} />;
};

export default AddShiftModal;
