import React, { useContext } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { AuthContext } from '../AuthContext';
const navigateMock = vi.fn();
vi.mock('react-router-dom', async (i) => ({ ...(await i()), useNavigate: () => navigateMock }));
vi.mock('@apollo/client/react', () => ({ useQuery: () => ({ data: null, loading: false, error: null }) }));

function Consumer(){ const ctx=useContext(AuthContext); return <><div data-testid='is-auth'>{String(ctx?.isAuthenticated)}</div><button onClick={()=>ctx.login('abc',{roleName:'manager'})}>login</button><button onClick={()=>ctx.logout()}>logout</button></>; }

describe('AuthProvider',()=>{
  beforeEach(()=>{ localStorage.clear(); sessionStorage.clear(); navigateMock.mockReset(); global.fetch=vi.fn().mockResolvedValue({ok:false}); });

  it('startup and logout use resolved backend urls with credentials include', async ()=>{
    render(<AuthProvider><Consumer/></AuthProvider>);
    await waitFor(()=>expect(fetch).toHaveBeenCalledWith('http://localhost:4000/api/auth/refresh', expect.objectContaining({credentials:'include'})));
    fireEvent.click(screen.getByText('logout'));
    await waitFor(()=>expect(fetch).toHaveBeenCalledWith('http://localhost:4000/api/auth/logout', expect.objectContaining({credentials:'include'})));
  });

  it('login does not write token to storage', async ()=>{
    render(<AuthProvider><Consumer/></AuthProvider>);
    fireEvent.click(screen.getByText('login'));
    await waitFor(()=>expect(screen.getByTestId('is-auth')).toHaveTextContent('true'));
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });
});
