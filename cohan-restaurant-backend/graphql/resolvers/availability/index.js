import BaseQuery from "./query.js";
import BaseMutation from "./mutation.js";
import WindowLifecycleMutation from "./windowLifecycle.mutation.js";
import { resolveAvailabilityWindowEffectiveStatus } from "../../../src/services/availability/availabilityRegistrationSchedule.service.js";
import {
  normalizeAvailabilityWorkspaceType,
  withAvailabilityWorkspaceMutations,
  withAvailabilityWorkspaceQueries,
} from "./workspaceScope.js";

const Query = withAvailabilityWorkspaceQueries(BaseQuery);

const Mutation = withAvailabilityWorkspaceMutations({
  ...BaseMutation,
  ...WindowLifecycleMutation,
});

const AvailabilityWindow = {
  effectiveStatus: (windowDoc) =>
    resolveAvailabilityWindowEffectiveStatus(windowDoc),
  registrationMode: (windowDoc) =>
    String(windowDoc?.registrationModeSnapshot || "manual"),
  workspaceType: (windowDoc) =>
    normalizeAvailabilityWorkspaceType(windowDoc?.workspaceType),
};

export default { Query, Mutation, AvailabilityWindow };
