import React, { useMemo } from "react";
import AddShiftModalBase from "./AddShiftModalBase";
import {
  filterStaffForScheduleScope,
  useScheduleEmploymentScope,
} from "../ScheduleEmploymentScope";

const AddShiftModal = (props) => {
  const employmentScope = useScheduleEmploymentScope();
  const scopedStaffList = useMemo(
    () => filterStaffForScheduleScope(props.staffList || [], employmentScope),
    [props.staffList, employmentScope],
  );

  return <AddShiftModalBase {...props} staffList={scopedStaffList} />;
};

export default AddShiftModal;
