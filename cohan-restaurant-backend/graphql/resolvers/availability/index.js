import Query from "./query.js";
import BaseMutation from "./mutation.js";
import WindowLifecycleMutation from "./windowLifecycle.mutation.js";
import { resolveAvailabilityWindowEffectiveStatus } from "../../../src/services/availability/availabilityRegistrationSchedule.service.js";

const Mutation = {
  ...BaseMutation,
  ...WindowLifecycleMutation,
};

const AvailabilityWindow = {
  effectiveStatus: (windowDoc) =>
    resolveAvailabilityWindowEffectiveStatus(windowDoc),
  registrationMode: (windowDoc) =>
    String(windowDoc?.registrationModeSnapshot || "manual"),
};

export default { Query, Mutation, AvailabilityWindow };
