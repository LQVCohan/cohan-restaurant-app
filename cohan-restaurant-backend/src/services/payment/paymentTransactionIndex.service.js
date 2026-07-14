export const PAYMENT_TRANSACTION_COLLECTION = "transactions";
export const PAYMENT_TRANSACTION_TXN_REF_INDEX = "restaurantId_1_txnRef_1";

const TXN_REF_INDEX_KEY = Object.freeze({ restaurantId: 1, txnRef: 1 });
const TXN_REF_PARTIAL_FILTER = Object.freeze({
  txnRef: Object.freeze({ $type: "string" }),
});

const hasTxnRefKey = (index = {}) => {
  const key = index?.key || {};
  const fields = Object.keys(key);
  return (
    fields.length === 2 &&
    Number(key.restaurantId) === 1 &&
    Number(key.txnRef) === 1
  );
};

export const isDesiredPaymentTransactionTxnRefIndex = (index = {}) =>
  index?.name === PAYMENT_TRANSACTION_TXN_REF_INDEX &&
  index?.unique === true &&
  index?.sparse !== true &&
  hasTxnRefKey(index) &&
  index?.partialFilterExpression?.txnRef?.$type === "string";

const isNamespaceNotFound = (error) =>
  error?.code === 26 || error?.codeName === "NamespaceNotFound";

const isIndexNotFound = (error) =>
  error?.code === 27 || error?.codeName === "IndexNotFound";

async function listIndexes(collection) {
  try {
    return await collection.indexes();
  } catch (error) {
    if (isNamespaceNotFound(error)) return [];
    throw error;
  }
}

export async function ensurePaymentTransactionTxnRefIndex(
  db,
  { logger = console } = {},
) {
  if (!db || typeof db.collection !== "function") {
    throw new Error("MongoDB connection is unavailable for transaction index migration.");
  }

  const collection = db.collection(PAYMENT_TRANSACTION_COLLECTION);
  const indexes = await listIndexes(collection);
  const relatedIndexes = indexes.filter(
    (index) =>
      index?.name === PAYMENT_TRANSACTION_TXN_REF_INDEX || hasTxnRefKey(index),
  );

  const desiredIndex = relatedIndexes.find(
    isDesiredPaymentTransactionTxnRefIndex,
  );
  if (desiredIndex) {
    return {
      changed: false,
      indexName: PAYMENT_TRANSACTION_TXN_REF_INDEX,
    };
  }

  for (const index of relatedIndexes) {
    if (!index?.name) continue;
    try {
      await collection.dropIndex(index.name);
      logger.info?.(
        `Dropped incompatible payment transaction index: ${index.name}`,
      );
    } catch (error) {
      if (!isIndexNotFound(error)) throw error;
    }
  }

  await collection.updateMany(
    {
      $or: [
        { txnRef: { $type: "null" } },
        { txnRef: { $type: "string", $regex: /^\s*$/ } },
      ],
    },
    { $unset: { txnRef: "" } },
  );

  await collection.createIndex(TXN_REF_INDEX_KEY, {
    name: PAYMENT_TRANSACTION_TXN_REF_INDEX,
    unique: true,
    partialFilterExpression: TXN_REF_PARTIAL_FILTER,
  });

  logger.info?.(
    `Ensured partial unique payment transaction index: ${PAYMENT_TRANSACTION_TXN_REF_INDEX}`,
  );

  return {
    changed: true,
    indexName: PAYMENT_TRANSACTION_TXN_REF_INDEX,
  };
}
