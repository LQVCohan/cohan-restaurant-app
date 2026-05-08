import { getAttendanceActionErrorMessage } from './AttendancePage';

describe('getAttendanceActionErrorMessage', () => {
  it('returns permission message for FORBIDDEN', () => {
    const error = { graphQLErrors: [{ extensions: { code: 'FORBIDDEN' } }] };
    expect(getAttendanceActionErrorMessage(error, 'fallback')).toBe(
      'Bạn không có quyền thực hiện thao tác chấm công/chỉnh công này.'
    );
  });

  it('returns session message for UNAUTHENTICATED', () => {
    const error = {
      networkError: {
        result: { errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] },
      },
    };
    expect(getAttendanceActionErrorMessage(error, 'fallback')).toBe(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
    );
  });

  it('returns fallback for non-auth errors', () => {
    const error = { graphQLErrors: [{ extensions: { code: 'BAD_USER_INPUT' } }] };
    expect(getAttendanceActionErrorMessage(error, 'fallback')).toBe('fallback');
  });
});
