import * as core from "./overtimeRequest.core.service.js";
import {
  ATTENDANCE_REVIEW_ROLES,
  userHasAnyRole,
} from "../scheduling/schedulingPermission.service.js";
import { notifyUser } from "../notification/notificationWorkflow.service.js";

function isReviewer(ctx) {
  return userHasAnyRole(ctx?.user, ATTENDANCE_REVIEW_ROLES);
}

function isStaffSelfServiceActor(ctx) {
  // ponytail: userType=STAFF is stable; roleName may be server/cashier/chef/etc.
  return !isReviewer(ctx) && userHasAnyRole(ctx?.user, ["STAFF"]);
}

function normalizeStaffContext(ctx) {
  if (!isStaffSelfServiceActor(ctx)) return ctx;
  return {
    ...ctx,
    user: {
      ...ctx.user,
      roleName: "STAFF",
    },
  };
}

function withNormalizedStaffContext(fn) {
  return (args = {}) => fn({
    ...args,
    ctx: normalizeStaffContext(args.ctx),
  });
}

export const listOvertimeRequests = withNormalizedStaffContext(
  core.listOvertimeRequests,
);
export const getOvertimeRequest = withNormalizedStaffContext(
  core.getOvertimeRequest,
);

export async function createOvertimeRequest(args = {}) {
  const reviewerCreatesForEmployee = isReviewer(args.ctx);
  const result = await core.createOvertimeRequest({
    ...args,
    input: reviewerCreatesForEmployee
      ? { ...args.input, employeeConfirmationRequired: true }
      : args.input,
    ctx: normalizeStaffContext(args.ctx),
  });

  if (result?.status === "pending_employee_confirmation" && reviewerCreatesForEmployee) {
    try {
      await notifyUser({
        userId: result.employeeId,
        restaurantId: result.restaurantId,
        type: "overtime_employee_confirmation_required",
        sourceType: "overtime_request",
        sourceId: result.id,
        actionUrl: "/staff/attendance",
        payload: {
          title: "Có đề nghị tăng ca cần xác nhận",
          message: "Quản lý đã tạo một đề nghị tăng ca và đang chờ bạn xác nhận.",
        },
      });
    } catch (error) {
      console.warn("Failed to notify overtime employee:", error.message);
    }
  }

  return result;
}

export async function confirmOvertimeRequest(args = {}) {
  if (!isStaffSelfServiceActor(args.ctx)) {
    throw new Error("Bạn không có quyền xác nhận yêu cầu tăng ca này.");
  }
  return core.confirmOvertimeRequest({
    ...args,
    ctx: normalizeStaffContext(args.ctx),
  });
}

export const cancelOvertimeRequest = withNormalizedStaffContext(
  core.cancelOvertimeRequest,
);
export const approveOvertimeRequest = core.approveOvertimeRequest;
export const rejectOvertimeRequest = core.rejectOvertimeRequest;
export const completeOvertimeRequest = core.completeOvertimeRequest;
export const isBlockingOvertimeStatus = core.isBlockingOvertimeStatus;
