import Query from "./query.js";
import Mutation from "./mutation.js";
import { resolveAvailabilityWindowEffectiveStatus } from "../../../src/services/availability/availabilityRegistrationSchedule.service.js";

const AvailabilityWindow = {
  effectiveStatus: (windowDoc) => resolveAvailabilityWindowEffectiveStatus(windowDoc),
  registrationMode: (windowDoc) => String(windowDoc?.registrationModeSnapshot || "manual"),
};

export default { Query, Mutation, AvailabilityWindow };
