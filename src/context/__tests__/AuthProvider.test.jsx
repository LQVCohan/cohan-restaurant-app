import React, { useContext, StrictMode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { AuthContext } from '../AuthContext';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (i) => ({ ...(await i()), useNavigate: () => navigateMock }));
vi.mock('@apollo/client/react', () => ({ useQuery: () => ({ data: null, loading: false, error: null, refetch: vi.fn().mockResolvedValue({}) }) }));

function Consumer(){ const ctx=useContext(AuthContext); return <><div data-testid='is-auth'>{String(ctx?.isAuthenticated)}</div><button onClick={()=>ctx.login('abc',{roleName:'manager'})}>login</button><button onClick={()=>ctx.logout()}>logout</button></>; }

describe('AuthProvider',()=>{
  beforeEach(()=>{ localStorage.clear(); sessionStorage.clear(); navigateMock.mockReset(); global.fetch=vi.fn().mockResolvedValue({ok:false}); vi.useFakeTimers(); });
  afterEach(()=>vi.useRealTimers());

  it('startup refresh is single-flight in strict mode and uses credentials include', async ()=>{
    global.fetch.mockResolvedValueOnce({ok:true,json:async()=>({token:'t1',user:{roleName:'customer',emailVerified:true}})});
    render(<StrictMode><AuthProvider><Consumer/></AuthProvider></StrictMode>);
    await waitFor(()=>expect(fetch).toHaveBeenCalledWith('http://localhost:4000/api/auth/refresh', expect.objectContaining({credentials:'include'})));
    expect(fetch.mock.calls.filter(([url])=>url.includes('/api/auth/refresh')).length).toBe(1);
  });

  it('login does not write token to storage', async ()=>{
    render(<AuthProvider><Consumer/></AuthProvider>);
    fireEvent.click(screen.getByText('login'));
    await waitFor(()=>expect(screen.getByTestId('is-auth')).toHaveTextContent('true'));
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(sessionStorage.getItem('token')).toBeNull();
  });

  it('refresh timer keeps session refreshed', async ()=>{
    global.fetch
      .mockResolvedValueOnce({ok:true,json:async()=>({token:'a.b.c',user:{roleName:'customer'}})})
      .mockResolvedValueOnce({ok:true,json:async()=>({token:'next.token.value',user:{roleName:'customer'}})});
    render(<AuthProvider><Consumer/></AuthProvider>);
    await waitFor(()=>expect(screen.getByTestId('is-auth')).toHaveTextContent('true'));
    await vi.runOnlyPendingTimersAsync();
    expect(fetch.mock.calls.filter(([url])=>url.includes('/api/auth/refresh')).length).toBeGreaterThanOrEqual(2);
  });
});
