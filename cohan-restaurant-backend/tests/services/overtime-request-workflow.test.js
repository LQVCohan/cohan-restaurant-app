const modelMocks = vi.hoisted(() => ({
  EventLog: { create: vi.fn() },
  PerformanceIncident: { findOneAndUpdate: vi.fn() },
  OvertimeRequest: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn() },
  Shift: { findById: vi.fn() },
  Staff: { findById: vi.fn() },
  Timesheet: { findOne: vi.fn() },
}));

vi.mock('../../models/index.js', () => modelMocks);
vi.mock('../../src/services/payroll/payrollLockGuard.service.js', () => ({ assertNoLockedPayrollPeriodOverlap: vi.fn() }));
vi.mock('../../src/services/scheduling/schedulingPermission.service.js', () => ({
  ATTENDANCE_READ_ROLES: ['ADMIN','MANAGER','HR','ACCOUNTANT'],
  ATTENDANCE_REVIEW_ROLES: ['ADMIN','MANAGER','HR'],
  userCanAccessRestaurant: vi.fn(() => true),
  userHasAnyRole: vi.fn((user, roles) => roles.includes(String(user?.roleName || '').toUpperCase())),
}));

function ctx(id, roleName = 'STAFF') { return { user: { id, roleName } }; }
const EMPLOYEE_ID = '507f1f77bcf86cd799439011';
const RESTAURANT_ID = '507f1f77bcf86cd799439012';

describe('Overtime request workflow polish', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    modelMocks.Staff.findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({ _id: EMPLOYEE_ID, userType: 'STAFF', primaryRestaurant: { _id: RESTAURANT_ID }, deletedAt: null }),
    });
  });

  it('blocks duplicate open request by status/date scope', async () => {
    modelMocks.OvertimeRequest.findOne.mockResolvedValue({ _id: 'dup' });
    const { createOvertimeRequest } = await import('../../src/services/overtime/overtimeRequest.service.js');

    await expect(createOvertimeRequest({ input: {
      employeeId: '507f1f77bcf86cd799439011', restaurantId: '507f1f77bcf86cd799439012', workDate: '2026-04-10',
      plannedStartTime: '2026-04-10T10:00:00.000Z', plannedEndTime: '2026-04-10T12:00:00.000Z', reason: 'Need support'
    }, ctx: ctx(EMPLOYEE_ID, 'STAFF') })).rejects.toThrow('OVERTIME_REQUEST_PENDING_EXISTS');
  });

  it('forbids reviewer confirming for employee', async () => {
    modelMocks.OvertimeRequest.findById.mockResolvedValue({ _id:'o1', employeeId:EMPLOYEE_ID, restaurantId:RESTAURANT_ID, status:'pending_employee_confirmation' });
    const { confirmOvertimeRequest } = await import('../../src/services/overtime/overtimeRequest.service.js');

    await expect(confirmOvertimeRequest({ input: { requestId: 'o1' }, ctx: ctx('manager1', 'MANAGER') })).rejects.toThrow('Bạn không có quyền xác nhận yêu cầu tăng ca này.');
  });

  it('forbids approve minutes exceeding requested/planned', async () => {
    modelMocks.OvertimeRequest.findById.mockResolvedValue({
      _id:'o1', employeeId:'u1', restaurantId:'r1', workDate: new Date('2026-04-10'), status:'pending_approval',
      plannedOvertimeMinutes: 60, actualOvertimeMinutes: 0, auditLogs: [], save: vi.fn()
    });
    const { approveOvertimeRequest } = await import('../../src/services/overtime/overtimeRequest.service.js');

    await expect(approveOvertimeRequest({ input: { requestId:'o1', approvedOvertimeMinutes: 90 }, ctx: ctx('m1', 'MANAGER') })).rejects.toThrow('OVERTIME_APPROVED_MINUTES_EXCEED_REQUESTED');
  });

  it('allows staff cancel own pending request', async () => {
    const save = vi.fn();
    modelMocks.OvertimeRequest.findById.mockResolvedValue({ _id:'o1', employeeId:EMPLOYEE_ID, restaurantId:RESTAURANT_ID, status:'pending_approval', auditLogs: [], save });
    const { cancelOvertimeRequest } = await import('../../src/services/overtime/overtimeRequest.service.js');
    await cancelOvertimeRequest({ input: { requestId:'o1', reason:'no need' }, ctx: ctx(EMPLOYEE_ID, 'STAFF') });
    expect(save).toHaveBeenCalled();
  });

  it('blocks complete when timesheet missing', async () => {
    modelMocks.OvertimeRequest.findById.mockResolvedValue({ _id:'o1', employeeId:'u1', restaurantId:'r1', shiftId: null, workDate:new Date('2026-04-10'), status:'approved' });
    modelMocks.Timesheet.findOne.mockReturnValue({ sort: vi.fn().mockResolvedValue(null) });
    const { completeOvertimeRequest } = await import('../../src/services/overtime/overtimeRequest.service.js');
    await expect(completeOvertimeRequest({ input: { requestId:'o1' }, ctx: ctx('m1', 'MANAGER') })).rejects.toThrow('TIMESHEET_NOT_FOUND_FOR_OVERTIME');
  });
});
