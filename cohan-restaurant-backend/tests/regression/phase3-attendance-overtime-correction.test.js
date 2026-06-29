import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => {
  const TimesheetCtor = vi.fn(function Timesheet(doc) {
    return {
      ...doc,
      _id: doc._id || '507f1f77bcf86cd799439031',
      save: vi.fn().mockResolvedValue(undefined),
      toObject() { return this; },
    };
  });

  return {
    Staff: { findById: vi.fn(), find: vi.fn() },
    Timesheet: Object.assign(TimesheetCtor, { findOne: vi.fn(), findById: vi.fn(), find: vi.fn() }),
    Shift: { findOne: vi.fn(), find: vi.fn() },
    PerformanceIncident: { findOneAndUpdate: vi.fn() },
    EventLog: { create: vi.fn() },
    LeaveRequest: { find: vi.fn() },
  };
});

const permissionMocks = vi.hoisted(() => ({ userCanAccessRestaurant: vi.fn() }));

vi.mock('../../models/index.js', () => modelMocks);
vi.mock('../../graphql/guards.js', () => ({
  requireAuth: vi.fn((ctx) => { if (!ctx?.user) throw new Error('UNAUTHENTICATED'); }),
  requireRoles: vi.fn((ctx, allowed) => {
    const role = String(ctx?.user?.roleName || ctx?.user?.userType || '').toUpperCase();
    if (!allowed.includes(role)) throw new Error('FORBIDDEN');
  }),
  requireRestaurantAccess: vi.fn(async (ctx, restaurantId) => {
    if (!permissionMocks.userCanAccessRestaurant(ctx?.user, restaurantId)) throw new Error('RESTAURANT_SCOPE_FORBIDDEN');
    return true;
  }),
  requireRestaurantScope: vi.fn(),
}));
vi.mock('../../src/services/payroll/payrollLockGuard.service.js', () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../src/services/scheduling/schedulingPermission.service.js', () => ({
  ATTENDANCE_READ_ROLES: ['ADMIN', 'MANAGER', 'HR', 'ACCOUNTANT'],
  ATTENDANCE_REVIEW_ROLES: ['ADMIN', 'MANAGER', 'HR'],
  ATTENDANCE_OPERATION_ROLES: ['ADMIN', 'MANAGER'],
  ATTENDANCE_SELF_ROLES: ['STAFF'],
  normalizeRole: vi.fn((role) => String(role || '').trim().toUpperCase()),
  resolveUserRoles: vi.fn((user) => [String(user?.roleName || user?.userType || '').toUpperCase()]),
  userHasAnyRole: vi.fn((user, roles) => roles.includes(String(user?.roleName || user?.userType || '').toUpperCase())),
  userCanAccessRestaurant: permissionMocks.userCanAccessRestaurant,
}));

import Mutation from '../../graphql/resolvers/staff/mutation.js';
import Query from '../../graphql/resolvers/staff/query.js';

const RESTAURANT_ID = '507f1f77bcf86cd799439011';
const EMPLOYEE_ID = '507f1f77bcf86cd799439012';

function ctx(id, roleName, restaurantId = RESTAURANT_ID) {
  return { user: { id, roleName, userType: roleName, primaryRestaurant: restaurantId } };
}

describe('phase3 attendance/off-schedule regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMocks.userCanAccessRestaurant.mockReturnValue(true);
    modelMocks.Staff.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue({ _id: EMPLOYEE_ID, userType: 'STAFF', fullName: 'A' }) });
    modelMocks.Shift.findOne.mockReturnValue({ sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(null) });
    modelMocks.Shift.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
    modelMocks.Timesheet.findById.mockReturnValue({ populate: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439031', employeeId: EMPLOYEE_ID, restaurantId: RESTAURANT_ID, isOffSchedule: true, approved: false, offScheduleApprovalStatus: 'pending' }) });
    modelMocks.Timesheet.findOne.mockResolvedValue(null);
  });

  it('forbids staff upsert attendance for another employee', async () => {
    await expect(Mutation.upsertStaffAttendance({}, { input: { employeeId: '507f1f77bcf86cd799439099', restaurantId: RESTAURANT_ID, action: 'check_in' } }, ctx(EMPLOYEE_ID, 'STAFF'))).rejects.toThrow('FORBIDDEN');
  });

  it('forbids accountant upsert attendance', async () => {
    await expect(Mutation.upsertStaffAttendance({}, { input: { employeeId: EMPLOYEE_ID, restaurantId: RESTAURANT_ID, action: 'check_in' } }, ctx('507f1f77bcf86cd799439099', 'ACCOUNTANT'))).rejects.toThrow('FORBIDDEN');
  });

  it('allows manager in scope and creates pending off-schedule defaults', async () => {
    const out = await Mutation.upsertStaffAttendance({}, { input: { employeeId: EMPLOYEE_ID, restaurantId: RESTAURANT_ID, action: 'check_in', offScheduleReason: 'support' } }, ctx('507f1f77bcf86cd799439099', 'MANAGER'));
    expect(out.isOffSchedule).toBe(true);
    expect(out.approved).toBe(false);
    expect(out.offScheduleApprovalStatus).toBe('pending');
  });

  it('forbids manager out of restaurant scope', async () => {
    permissionMocks.userCanAccessRestaurant.mockReturnValue(false);
    await expect(Mutation.upsertStaffAttendance({}, { input: { employeeId: EMPLOYEE_ID, restaurantId: RESTAURANT_ID, action: 'check_in' } }, ctx('507f1f77bcf86cd799439099', 'MANAGER'))).rejects.toThrow('RESTAURANT_SCOPE_FORBIDDEN');
  });

  it('rejects approve/reject on non off-schedule timesheet', async () => {
    modelMocks.Timesheet.findById.mockResolvedValue({ _id: '507f1f77bcf86cd799439031', employeeId: EMPLOYEE_ID, restaurantId: RESTAURANT_ID, isOffSchedule: false });
    await expect(Mutation.approveOffScheduleAttendance({}, { timesheetId: '507f1f77bcf86cd799439031', note: 'ok' }, ctx('507f1f77bcf86cd799439099', 'MANAGER'))).rejects.toThrow('OFF_SCHEDULE_ATTENDANCE_REQUIRED');
    await expect(Mutation.rejectOffScheduleAttendance({}, { timesheetId: '507f1f77bcf86cd799439031', note: 'no' }, ctx('507f1f77bcf86cd799439099', 'MANAGER'))).rejects.toThrow('OFF_SCHEDULE_ATTENDANCE_REQUIRED');
  });

  it('approves off-schedule and records review fields', async () => {
    const save = vi.fn();
    modelMocks.Timesheet.findById.mockResolvedValue({ _id: '507f1f77bcf86cd799439031', employeeId: EMPLOYEE_ID, restaurantId: RESTAURANT_ID, isOffSchedule: true, approved: false, offScheduleApprovalStatus: 'pending', save, toObject() { return this; } });
    const out = await Mutation.approveOffScheduleAttendance({}, { timesheetId: '507f1f77bcf86cd799439031', note: 'approved' }, ctx('507f1f77bcf86cd799439099', 'MANAGER'));
    expect(out.approved).toBe(true);
    expect(out.offScheduleApprovalStatus).toBe('approved');
    expect(out.offScheduleReviewNote).toBe('approved');
    expect(save).toHaveBeenCalled();
  });

  it('staff query offScheduleAttendances is constrained to own records', async () => {
    modelMocks.Timesheet.find.mockReturnValue({ populate: vi.fn().mockReturnThis(), sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) });
    modelMocks.Staff.find.mockReturnValue({ populate: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) });
    await Query.offScheduleAttendances({}, { input: { restaurantId: RESTAURANT_ID, employeeId: '507f1f77bcf86cd799439055' } }, ctx(EMPLOYEE_ID, 'STAFF'));
    const q = modelMocks.Timesheet.find.mock.calls[0][0];
    expect(String(q.employeeId)).toBe(EMPLOYEE_ID);
  });

  it('staff query leaveRequests without employeeId is constrained to own records', async () => {
    modelMocks.LeaveRequest.find.mockReturnValue({ populate: vi.fn().mockReturnThis(), sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) });
    await Query.leaveRequests({}, { filter: { restaurantId: RESTAURANT_ID } }, ctx(EMPLOYEE_ID, 'STAFF'));
    const q = modelMocks.LeaveRequest.find.mock.calls[0][0];
    expect(String(q.employeeId)).toBe(EMPLOYEE_ID);
  });

  it('forbids staff query leaveRequests for another employee', async () => {
    await expect(Query.leaveRequests({}, { filter: { restaurantId: RESTAURANT_ID, employeeId: '507f1f77bcf86cd799439055' } }, ctx(EMPLOYEE_ID, 'STAFF'))).rejects.toThrow('FORBIDDEN');
  });

  it('allows manager query leaveRequests for restaurant scope', async () => {
    modelMocks.LeaveRequest.find.mockReturnValue({ populate: vi.fn().mockReturnThis(), sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) });
    await Query.leaveRequests({}, { filter: { restaurantId: RESTAURANT_ID } }, ctx('507f1f77bcf86cd799439099', 'MANAGER'));
    expect(modelMocks.LeaveRequest.find.mock.calls[0][0]).toEqual({ restaurantId: expect.anything() });
  });
});
