const mongooseMock = vi.hoisted(() => ({
  connect: vi.fn(async () => undefined),
  connection: {
    db: { databaseName: 'RestaurantDB' },
  },
}));

vi.mock('mongoose', () => ({
  default: mongooseMock,
}));

describe('connectDB', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/appdb';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not force fallback dbName when MONGO_DB is missing', async () => {
    delete process.env.MONGO_DB;

    const { connectDB } = await import('../../config/db.js');
    await connectDB();

    expect(mongooseMock.connect).toHaveBeenCalledWith(
      'mongodb://127.0.0.1:27017/appdb',
      { retryWrites: false },
    );
  });

  it('uses explicit dbName when MONGO_DB is provided', async () => {
    process.env.MONGO_DB = 'customdb';

    const { connectDB } = await import('../../config/db.js');
    await connectDB();

    expect(mongooseMock.connect).toHaveBeenCalledWith(
      'mongodb://127.0.0.1:27017/appdb',
      { dbName: 'customdb', retryWrites: false },
    );
  });
});
