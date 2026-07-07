import { describe, it, expect, vi, beforeEach } from 'vitest';

const restaurantScopeMocks = vi.hoisted(() => ({
  canAccessRestaurant: vi.fn(async () => true),
}));
const modelMocks = vi.hoisted(() => ({
  Staff: { find: vi.fn(), findById: vi.fn() },
  Timesheet: { find: vi.fn(), findOne: vi.fn(), findById: vi.fn() },
  Shift: { find: vi.fn(), findOne: vi.fn() },
  LeaveRequest: { find: vi.fn() },
  LeaveBalance: {}, Order: {}, Table: {}, Category: {}, Promotion: {}, Restaurant: { exists: vi.fn() }, PayrollPeriod: { findOne: vi.fn() }, PayrollItem: {}, SchedulePublication: {}, EventLog: {}, ShiftAcknowledgement: {}, PerformanceIncident: { findOneAndUpdate: vi.fn() },
  Role: {}, PayrollSetting: {}, PayrollAdjustment: {}, EmployeeCodeCounter: {}, Notification: {},
}));
vi.mock('../../models/index.js', () => modelMocks);
vi.mock('../../src/services/auth/restaurantScope.service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  canAccessRestaurant: restaurantScopeMocks.canAccessRestaurant,
}));
vi.mock('../../src/services/attendance/attendanceCorrectionWorkflow.service.js', () => ({ getAttendanceCorrectionRequest: vi.fn(), listAttendanceCorrectionRequests: vi.fn() }));
vi.mock('../../src/services/overtime/overtimeRequest.service.js', () => ({ getOvertimeRequest: vi.fn(), listOvertimeRequests: vi.fn() }));

import Query from '../../graphql/resolvers/staff/query.js';
import Mutation from '../../graphql/resolvers/staff/mutation.js';

describe('off-schedule workflow visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restaurantScopeMocks.canAccessRestaurant.mockResolvedValue(true);
    modelMocks.PayrollPeriod.findOne.mockReturnValue({ sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(null) });
    modelMocks.Restaurant.exists.mockResolvedValue(true);
  });

  it("keeps existing attendance/performance query resolvers registered", () => {
    expect(Query.attendanceCorrectionRequests).toBeTypeOf("function");
    expect(Query.attendanceCorrectionRequest).toBeTypeOf("function");
    expect(Query.staffPerformanceSummary).toBeTypeOf("function");
    expect(Query.staffPerformanceSummaries).toBeTypeOf("function");
    expect(Query.staffPerformanceScoreAdjustments).toBeTypeOf("function");
    expect(Query.staffPerformanceScoreTimeline).toBeTypeOf("function");
    expect(Query.performanceIncidents).toBeTypeOf("function");
    expect(Query.performanceIncidentAppeals).toBeTypeOf("function");
    expect(Query.managerIncidentReviewQueue).toBeTypeOf("function");
    expect(Query.managerIncidentReviewQueueSummary).toBeTypeOf("function");
    expect(Query.managerPerformanceDashboard).toBeTypeOf("function");
  });

  it('staff query only returns own off-schedule records', async () => {
    modelMocks.Timesheet.find.mockReturnValue({ populate: vi.fn().mockReturnThis(), sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([{ _id: 't1', employeeId: '507f1f77bcf86cd799439012', restaurantId: 'r1', workDate: new Date(), isOffSchedule: true, approved: false }]) });
    modelMocks.Staff.find.mockReturnValue({ populate: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([{ _id: '507f1f77bcf86cd799439012', fullName: 'Staff One' }]) });

    const rows = await Query.offScheduleAttendances({}, { input: { restaurantId: '507f1f77bcf86cd799439011', onlyPending: true, employeeId: '507f1f77bcf86cd799439012' } }, { user: { id: '507f1f77bcf86cd799439012', userType: 'STAFF', restaurantForStaff: '507f1f77bcf86cd799439011' } });
    expect(rows[0].offScheduleApprovalStatus).toBe('pending');
  });

  it('maps legacy approved off-schedule status as approved when approved flag is false', async () => {
    modelMocks.Timesheet.find.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: 't-legacy-approved',
          employeeId: '507f1f77bcf86cd799439012',
          workDate: new Date(),
          isOffSchedule: true,
          approved: false,
          offScheduleApprovalStatus: 'approved',
        },
      ]),
    });
    modelMocks.Staff.find.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { _id: '507f1f77bcf86cd799439012', fullName: 'Staff One' },
      ]),
    });

    const rows = await Query.offScheduleAttendances(
      {},
      {
        input: {
          restaurantId: '507f1f77bcf86cd799439011',
          approvalStatus: 'approved',
          employeeId: '507f1f77bcf86cd799439012',
        },
      },
      {
        user: {
          id: '507f1f77bcf86cd799439015',
          userType: 'MANAGER',
        },
      },
    );

    expect(rows[0].offScheduleApprovalStatus).toBe('approved');
  });

  it('manager can approve off-schedule attendance', async () => {
    const save = vi.fn();
    modelMocks.Timesheet.findById.mockResolvedValue({ _id: 't1', employeeId: '507f1f77bcf86cd799439012', restaurantId: '507f1f77bcf86cd799439011', isOffSchedule: true, approved: false, offScheduleApprovalStatus: 'pending', save, toObject() { return this; } });
    modelMocks.Staff.findById.mockReturnValue({ populate: vi.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439012', fullName: 'A' }) });
    const result = await Mutation.approveOffScheduleAttendance({}, { timesheetId: '507f1f77bcf86cd799439014', note: 'ok' }, { user: { id: '507f1f77bcf86cd799439015', userType: 'MANAGER' } });
    expect(result.approved).toBe(true);
    expect(result.offScheduleApprovalStatus).toBe('approved');
    expect(save).toHaveBeenCalled();
  });
});
