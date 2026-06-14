import { gql } from "@apollo/client";

const SUPPLY_WITH_STOCK_FIELDS = gql`
  fragment SupplyWithStockFields on SupplyWithStock {
    id
    restaurantId
    name
    sku
    category
    unit
    costPerUnit
    pricePerUnit
    minStock
    notes
    isActive
    deletedAt
    deleteExpiresAt
    createdAt
    updatedAt
    stockItem {
      id
      restaurantId
      warehouseId
      costPerUnit
      pricePerUnit
      note
      onHand
      reserved
      batches {
        id
        lot
        qty
        expiry
        costPerBaseUnit
        createdAt
        updatedAt
      }
      createdAt
      updatedAt
    }
  }
`;

const SUPPLY_FIELDS = gql`
  fragment SupplyFields on Supply {
    id
    restaurantId
    name
    sku
    category
    unit
    costPerUnit
    pricePerUnit
    minStock
    notes
    isActive
    deletedAt
    deleteExpiresAt
    createdAt
    updatedAt
  }
`;

export const Q_SUPPLIES_WITH_STOCK = gql`
  query Supplies($restaurantId: ID!, $warehouseId: ID) {
    supplies(restaurantId: $restaurantId, warehouseId: $warehouseId) {
      ...SupplyWithStockFields
    }
  }
  ${SUPPLY_WITH_STOCK_FIELDS}
`;

export const Q_SUPPLY_TRASH = gql`
  query SupplyTrash($restaurantId: ID!, $warehouseId: ID, $limit: Int = 200) {
    supplyTrash(restaurantId: $restaurantId, warehouseId: $warehouseId, limit: $limit) {
      ...SupplyWithStockFields
    }
  }
  ${SUPPLY_WITH_STOCK_FIELDS}
`;

export const M_CREATE_SUPPLY = gql`
  mutation CreateSupply($input: CreateSupplyInput!) {
    createSupply(input: $input) {
      ...SupplyFields
    }
  }
  ${SUPPLY_FIELDS}
`;

export const M_UPDATE_SUPPLY = gql`
  mutation UpdateSupply($id: ID!, $input: UpdateSupplyInput!) {
    updateSupply(id: $id, input: $input) {
      ...SupplyFields
    }
  }
  ${SUPPLY_FIELDS}
`;

export const M_DELETE_SUPPLY = gql`
  mutation DeleteSupply($id: ID!) {
    deleteSupply(id: $id)
  }
`;

export const M_RESTORE_SUPPLY = gql`
  mutation RestoreSupply($id: ID!) {
    restoreSupply(id: $id) {
      ...SupplyFields
    }
  }
  ${SUPPLY_FIELDS}
`;

export const M_ADJUST_SUPPLY = gql`
  mutation AdjustSupply($input: AdjustSupplyInput!) {
    adjustSupply(input: $input) {
      id
      supplyId
      warehouseId
      onHand
      reserved
      costPerUnit
      pricePerUnit
      note
      updatedAt
    }
  }
`;

export const M_STOCK_INBOUND = gql`
  mutation StockInbound($input: StockInboundInput!) {
    stockInbound(input: $input) {
      id
      supplyId
      warehouseId
      onHand
      reserved
      costPerUnit
      pricePerUnit
      note
      updatedAt
    }
  }
`;
export const M_STOCK_TRANSFER = gql`
  mutation StockTransfer($input: StockTransferInput!) {
    stockTransfer(input: $input)
  }
`;
export const M_STOCK_OUTBOUND = gql`
  mutation StockOutbound($input: StockOutboundInput!) {
    stockOutbound(input: $input) {
      id
      supplyId
      warehouseId
      onHand
      reserved
      costPerUnit
      pricePerUnit
      note
      updatedAt
    }
  }
`;

export const Q_SUPPLY_CATEGORIES = gql`
  query SupplyCategories(
    $restaurantId: ID!
    $search: String
    $includeInactive: Boolean = false
    $limit: Int = 200
  ) {
    supplyCategories(
      restaurantId: $restaurantId
      search: $search
      includeInactive: $includeInactive
      limit: $limit
    ) {
      id
      name
      slug
      source
      usageCount
      isActive
    }
  }
`;

export const Q_SUGGEST_SUPPLY_CATEGORY = gql`
  query SuggestSupplyCategory($restaurantId: ID!, $name: String!, $category: String) {
    suggestSupplyCategory(restaurantId: $restaurantId, name: $name, category: $category) {
      categoryId
      categoryName
      categorySlug
      reason
      confidence
      matchedKeyword
      existing
      autoSelected
    }
  }
`;
