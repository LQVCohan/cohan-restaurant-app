# Hotfix: activeSessionKey index repair (local DB)

After pulling this hotfix, run in `mongosh` to rebuild the `activeSessionKey` unique index so it only applies to string keys:

```javascript
use RestaurantDB;

db.orders.dropIndex("unique_active_table_session_key");

db.orders.createIndex(
  { activeSessionKey: 1 },
  {
    unique: true,
    name: "unique_active_table_session_key",
    partialFilterExpression: {
      activeSessionKey: { $type: "string" }
    }
  }
);
```

If `dropIndex` says index not found, continue with `createIndex`.
