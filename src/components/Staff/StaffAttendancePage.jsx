import React from "react";
import StaffAttendancePageBase from "./StaffAttendancePageBase";
import StaffOvertimeConfirmation from "./StaffOvertimeConfirmation";

export * from "./StaffAttendancePageBase";

const StaffAttendancePage = () => (
  <>
    <StaffOvertimeConfirmation />
    <StaffAttendancePageBase />
  </>
);

export default StaffAttendancePage;
