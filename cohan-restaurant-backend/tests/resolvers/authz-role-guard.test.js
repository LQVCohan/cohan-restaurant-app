import { hasRole } from '../../utils/authz.js';

describe('authz hasRole staff normalization', () => {
  it('accepts staff subroles when required role is staff', () => {
    expect(hasRole({ roleName: 'cashier' }, ['staff'])).toBe(true);
    expect(hasRole({ role: { slug: 'chef' } }, ['staff'])).toBe(true);
  });

  it('keeps non-staff role behavior unchanged', () => {
    expect(hasRole({ roleName: 'manager' }, ['manager'])).toBe(true);
    expect(hasRole({ roleName: 'manager' }, ['staff'])).toBe(false);
    expect(hasRole({ roleName: 'customer' }, ['customer'])).toBe(true);
  });
});
