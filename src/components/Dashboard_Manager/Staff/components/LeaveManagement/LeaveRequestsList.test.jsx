import { getLeaveActionErrorMessage } from './LeaveRequestsList';

describe('getLeaveActionErrorMessage', () => {
  it('returns permission message for FORBIDDEN', () => {
    const error = { graphQLErrors: [{ extensions: { code: 'FORBIDDEN' } }] };
    expect(getLeaveActionErrorMessage(error, 'fallback')).toBe(
      'Bạn không có quyền thực hiện thao tác đơn nghỉ phép này.'
    );
  });

  it('returns session message for UNAUTHENTICATED', () => {
    const error = {
      networkError: {
        result: { errors: [{ extensions: { code: 'UNAUTHENTICATED' } }] },
      },
    };
    expect(getLeaveActionErrorMessage(error, 'fallback')).toBe(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.'
    );
  });

  it('returns fallback for non-auth errors', () => {
    const error = { graphQLErrors: [{ extensions: { code: 'BAD_USER_INPUT' } }] };
    expect(getLeaveActionErrorMessage(error, 'fallback')).toBe('fallback');
  });
});
