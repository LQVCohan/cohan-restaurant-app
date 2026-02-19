import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { PrivateRoute } from '../AppRouter';

describe('PrivateRoute guard', () => {
  const renderRoute = (authState, options = {}) =>
    render(
      <MemoryRouter initialEntries={[options.path || '/private']}>
        <Routes>
          <Route
            path="/private"
            element={
              <PrivateRoute
                allowedRoles={options.allowedRoles}
                requireVerifiedEmail={options.requireVerifiedEmail}
                authState={authState}
              >
                <div>private-content</div>
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<div>login-page</div>} />
          <Route path="/403" element={<div>forbidden-page</div>} />
          <Route path="/verify-email" element={<div>verify-email-page</div>} />
        </Routes>
      </MemoryRouter>
    );

  it('redirects unauthenticated users to /login', () => {
    renderRoute({ token: null, role: null, emailVerified: false, loading: false });
    expect(screen.getByText('login-page')).toBeInTheDocument();
  });

  it('redirects unauthorized role to /403', () => {
    renderRoute(
      { token: 'token', role: 'customer', emailVerified: true, loading: false },
      { allowedRoles: ['staff'] }
    );
    expect(screen.getByText('forbidden-page')).toBeInTheDocument();
  });

  it('redirects user to verify email when requireVerifiedEmail=true', () => {
    renderRoute(
      { token: 'token', role: 'staff', emailVerified: false, loading: false },
      { allowedRoles: ['staff'], requireVerifiedEmail: true }
    );
    expect(screen.getByText('verify-email-page')).toBeInTheDocument();
  });

  it('renders children when all checks pass', () => {
    renderRoute(
      { token: 'token', role: 'staff', emailVerified: true, loading: false },
      { allowedRoles: ['staff'], requireVerifiedEmail: true }
    );
    expect(screen.getByText('private-content')).toBeInTheDocument();
  });
});
