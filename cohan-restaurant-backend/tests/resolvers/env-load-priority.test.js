const existsSyncMock = vi.hoisted(() => vi.fn(() => true));
const dotenvConfigMock = vi.hoisted(() => vi.fn(() => ({ parsed: {} })));

vi.mock('node:fs', () => ({
  default: {
    existsSync: existsSyncMock,
  },
}));

vi.mock('dotenv', () => ({
  default: {
    config: dotenvConfigMock,
  },
}));

describe('loadEnv priority', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('loads env files with override=true and backend file last', async () => {
    const { loadEnv } = await import('../../src/config/env.js');
    const loaded = loadEnv();

    expect(dotenvConfigMock).toHaveBeenCalled();
    for (const call of dotenvConfigMock.mock.calls) {
      expect(call[0]?.override).toBe(true);
    }

    const calledPaths = dotenvConfigMock.mock.calls.map((c) => c[0]?.path);
    expect(calledPaths[calledPaths.length - 1]).toMatch(/cohan-restaurant-backend[\\/]\.env$/);
    expect(loaded.length).toBe(calledPaths.length);
  });
});
