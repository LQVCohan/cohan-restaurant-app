import React from "react";
import OvertimePanelBase, {
  getOvertimeActionErrorMessage,
} from "./OvertimePanelBase";
import ManagerOvertimeRequestCreate from "./ManagerOvertimeRequestCreate";

export { getOvertimeActionErrorMessage };

const OvertimePanel = (props) => (
  <div className="overtime-workflow-panel">
    <ManagerOvertimeRequestCreate {...props} />
    <OvertimePanelBase {...props} />
  </div>
);

export default OvertimePanel;
