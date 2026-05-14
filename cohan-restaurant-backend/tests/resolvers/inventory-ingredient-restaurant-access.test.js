const modelMocks = vi.hoisted(() => ({
  Ingredient: { find: vi.fn(), deleteMany: vi.fn(), findById: vi.fn(), findOne: vi.fn(), create: vi.fn(), findByIdAndUpdate: vi.fn(), updateOne: vi.fn(), findOneAndUpdate: vi.fn(), deleteOne: vi.fn(), updateMany: vi.fn() },
  Recipe: { aggregate: vi.fn(), find: vi.fn() },
  IngredientRecent: { updateOne: vi.fn(), find: vi.fn() },
  MenuItem: { find: vi.fn() },
  StockMovement: { find: vi.fn() },
  Order: { findOne: vi.fn() },
  IngredientCategory: { find: vi.fn(), findOne: vi.fn(), findById: vi.fn(), findOneAndUpdate: vi.fn(), deleteOne: vi.fn() },
  EventLog: { find: vi.fn() },
}));
const guardMocks = vi.hoisted(() => ({ requireRestaurantAccess: vi.fn() }));
const mongooseMocks = vi.hoisted(() => ({
  isValidObjectId: vi.fn((v) => String(v).startsWith('valid-')),
  Types: { ObjectId: function ObjectId(v){ return v; } },
  startSession: vi.fn(),
}));
vi.mock('../../models/index.js', () => modelMocks);
vi.mock('../../graphql/guards.js', () => guardMocks);
vi.mock('mongoose', () => ({ default: mongooseMocks }));

const forbidden = Object.assign(new Error('FORBIDDEN_SCOPE'), { extensions: { code: 'FORBIDDEN_SCOPE' } });

describe('inventory restaurant access guards', () => {
  beforeEach(() => { vi.clearAllMocks(); guardMocks.requireRestaurantAccess.mockRejectedValue(forbidden); });
  it('ingredients denied blocks purge and find', async () => { const q=(await import('../../graphql/resolvers/inventory/ingredient.query.js')).default; await expect(q.ingredients(null,{restaurantId:'valid-r1'},{user:{id:'u',roleName:'manager'}})).rejects.toThrow('FORBIDDEN_SCOPE'); expect(modelMocks.Ingredient.deleteMany).not.toHaveBeenCalled(); expect(modelMocks.Ingredient.find).not.toHaveBeenCalled(); });
  it('ingredients allowed calls find', async () => { guardMocks.requireRestaurantAccess.mockResolvedValue(true); modelMocks.Ingredient.find.mockReturnValue({ sort:()=>({ limit:()=>({ select:()=>({ lean:async()=>[] }) }) }) }); const q=(await import('../../graphql/resolvers/inventory/ingredient.query.js')).default; await q.ingredients(null,{restaurantId:'valid-r1'},{user:{id:'u',roleName:'manager'}}); expect(modelMocks.Ingredient.find).toHaveBeenCalled(); });
  it('ingredient by id guards before full read', async () => { guardMocks.requireRestaurantAccess.mockResolvedValue(true); modelMocks.Ingredient.findById.mockReturnValueOnce({ select:()=>({ lean:async()=>({restaurantId:'valid-r1'}) }) }).mockReturnValueOnce({ select:()=>({ lean:async()=>({ _id:'valid-i1'}) }) }); const q=(await import('../../graphql/resolvers/inventory/ingredient.query.js')).default; await q.ingredient(null,{id:'valid-i1'},{user:{id:'u',roleName:'manager'}}); expect(modelMocks.Ingredient.findById).toHaveBeenCalledTimes(2); });
  it('ingredient denied no full read', async () => { modelMocks.Ingredient.findById.mockReturnValue({ select:()=>({ lean:async()=>({restaurantId:'valid-r1'}) }) }); const q=(await import('../../graphql/resolvers/inventory/ingredient.query.js')).default; await expect(q.ingredient(null,{id:'valid-i1'},{user:{id:'u',roleName:'manager'}})).rejects.toThrow('FORBIDDEN_SCOPE'); });
  it('category sync denied before session', async()=>{ const m=(await import('../../graphql/resolvers/inventory/ingredientCategory.mutation.js')).default; await expect(m.syncIngredientCategories(null,{restaurantId:'valid-r1'},{user:{id:'u',roleName:'manager'}})).rejects.toThrow('FORBIDDEN_SCOPE'); expect(mongooseMocks.startSession).not.toHaveBeenCalled(); });
});
