export default /* GraphQL */ `
  scalar Date

  type Query {
    me: User
    restaurants(limit: Int = 20, cursor: ID): RestaurantConnection!
    restaurant(id: ID!): Restaurant
    menuItems(
      restaurantId: ID!
      categoryId: ID
      search: String
      limit: Int = 20
    ): [MenuItem!]!
    order(id: ID!): Order
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createReservation(input: CreateReservationInput!): Reservation!
    placeOrder(input: PlaceOrderInput!): Order!
    updateOrderStatus(orderId: ID!, status: OrderStatus!): Order!
    createStockMovement(input: StockMovementInput!): StockMovement!
  }

  type Subscription {
    orderUpdated(restaurantId: ID!): Order!
    tableStatusChanged(restaurantId: ID!): Table!
  }

  # ---------- Types ----------
  type User {
    id: ID!
    name: String!
    email: String
    roleNames: [String!]
  }

  type Restaurant {
    id: ID!
    name: String!
    address: Address
    manager: User
    tables: [Table!]!
    categories: [Category!]!
  }

  type Address {
    line1: String
    line2: String
    ward: String
    district: String
    city: String
    country: String
  }

  type Table {
    id: ID!
    code: String!
    capacity: Int!
    status: TableStatus!
  }
  enum TableStatus {
    available
    occupied
    reserved
    maintenance
  }

  type Category {
    id: ID!
    name: String!
    parentId: ID
    order: Int
  }

  type MenuItem {
    id: ID!
    name: String!
    description: String
    price: Float!
    isAvailable: Boolean!
    category: Category!
  }

  type Reservation {
    id: ID!
    restaurant: Restaurant!
    tableIds: [ID!]!
    timeFrom: Date!
    timeTo: Date!
    partySize: Int!
    status: ReservationStatus!
  }
  enum ReservationStatus {
    pending
    confirmed
    seated
    cancelled
    completed
    no_show
  }

  type Order {
    id: ID!
    restaurant: Restaurant!
    reservation: Reservation
    items: [OrderItem!]!
    totals: OrderTotals!
    currentStatus: OrderStatus!
    statusTimeline: [StatusEvent!]!
  }

  type OrderItem {
    menuItem: MenuItem!
    qty: Int!
    subtotal: Float!
  }

  type OrderTotals {
    subtotal: Float!
    discount: Float!
    tax: Float!
    service: Float!
    grandTotal: Float!
  }

  type StatusEvent {
    status: OrderStatus!
    at: Date!
    by: User
  }
  enum OrderStatus {
    draft
    pending
    confirmed
    preparing
    ready
    served
    completed
    cancelled
  }

  type StockMovement {
    id: ID!
    ingredientId: ID!
    restaurant: Restaurant!
    type: StockMovementType!
    qty: Float!
    createdAt: Date!
  }
  enum StockMovementType {
    IN
    OUT
    ADJ
  }

  # ---------- Inputs ----------
  input CreateReservationInput {
    restaurantId: ID!
    tableIds: [ID!]!
    timeFrom: Date!
    timeTo: Date!
    partySize: Int = 2
  }

  input PlaceOrderInput {
    restaurantId: ID!
    reservationId: ID
    items: [PlaceOrderItemInput!]!
  }

  input PlaceOrderItemInput {
    menuItemId: ID!
    qty: Int! = 1
    modifierOptionIds: [ID!]
    note: String
  }

  input StockMovementInput {
    restaurantId: ID!
    ingredientId: ID!
    type: StockMovementType!
    qty: Float!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  # ---------- Pagination ----------
  type RestaurantConnection {
    edges: [RestaurantEdge!]!
    pageInfo: PageInfo!
  }
  type RestaurantEdge {
    node: Restaurant!
    cursor: ID!
  }
  type PageInfo {
    endCursor: ID
    hasNextPage: Boolean!
  }
`;
