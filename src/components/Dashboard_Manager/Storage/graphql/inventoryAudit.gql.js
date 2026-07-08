import { gql } from "@apollo/client";

const INVENTORY_COUNT_FIELDS = gql`
  fragment InventoryCountFields on InventoryCount {
    id
    code
    title
    status
    periodStart
    periodEnd
    note
    closedAt
    createdAt
    updatedAt
    lines {
      ingredientId
      nameSnapshot
      skuSnapshot
      unit
      systemQty
      countedQty
      variance
      note
    }
  }
`;

export const INVENTORY_COUNTS_QUERY = gql`
  ${INVENTORY_COUNT_FIELDS}
  query InventoryCounts($restaurantId: ID!, $warehouseId: ID, $limit: Int = 10) {
    inventoryCounts(restaurantId: $restaurantId, warehouseId: $warehouseId, limit: $limit) {
      ...InventoryCountFields
    }
  }
`;

export const INVENTORY_DOCUMENT_MOVEMENTS_QUERY = gql`
  query InventoryDocumentMovements(
    $restaurantId: ID!
    $warehouseId: ID
    $limit: Int = 50
  ) {
    inventoryDocumentMovements(
      restaurantId: $restaurantId
      warehouseId: $warehouseId
      limit: $limit
    ) {
      id
      warehouseId
      ingredientId
      type
      qty
      reason
      meta
      createdAt
    }
  }
`;

export const CREATE_INVENTORY_COUNT = gql`
  ${INVENTORY_COUNT_FIELDS}
  mutation CreateInventoryCount($input: CreateInventoryCountInput!) {
    createInventoryCount(input: $input) {
      ...InventoryCountFields
    }
  }
`;

export const UPDATE_INVENTORY_COUNT_LINE = gql`
  ${INVENTORY_COUNT_FIELDS}
  mutation UpdateInventoryCountLine($input: UpdateInventoryCountLineInput!) {
    updateInventoryCountLine(input: $input) {
      ...InventoryCountFields
    }
  }
`;

export const CLOSE_INVENTORY_COUNT = gql`
  ${INVENTORY_COUNT_FIELDS}
  mutation CloseInventoryCount($input: CloseInventoryCountInput!) {
    closeInventoryCount(input: $input) {
      ...InventoryCountFields
    }
  }
`;

export const RECONCILE_STOCK_MOVEMENT_DOCUMENT = gql`
  mutation ReconcileStockMovementDocument($input: ReconcileStockMovementDocumentInput!) {
    reconcileStockMovementDocument(input: $input) {
      id
      meta
      updatedAt
    }
  }
`;
