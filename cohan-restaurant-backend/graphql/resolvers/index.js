// src/graphql/resolvers/index.js
import baseResolvers from "./base.js";

import role from "./role/index.js";
import restaurant from "./restaurant/index.js";
import brand from "./brand/index.js";
import brandInvitationFlow from "./brand/invitationFlow.js";
import { guardBrandMemberRoleMutations } from "./brand/memberRoleConsistency.js";
import user from "./user/index.js";
import wallet from "./wallet/index.js";
import permission from "./permission/index.js";
import menu from "./menu/index.js";
import category from "./category/index.js";
import modifierGroup from "./modifier/index.js";
import table from "./table/index.js";
import floor from "./floor/index.js";
import auth from "./auth/index.js";
import order from "./order/index.js";
import reservation from "./reservation/index.js";
import inventory from "./inventory/index.js";
import supply from "./supply/index.js";
import eventLogResolvers from "./event_log/index.js";
import payment from "./payment/index.js";
import staff from "./staff/index.js";
import payrollOverviewScope from "./staff/payrollOverviewScope.query.js";
import { withStaffInvitationFlow } from "./staff/invitationFlow.js";
import attendanceOvertime from "./attendance_overtime/index.js";
import review from "./review/index.js";
import reviewComment from "./review_comment/index.js";
import cart from "./cart/index.js";
import customerFavorite from "./customerFavorite/index.js";
import shippingTracking from "./shippingTracking/index.js";
import supplier from "./supplier/index.js";
import promotion from "./promotion/index.js";
import customerCombo from "./customerCombo/index.js";
import coupon from "./coupon/index.js";
import userCoupon from "./userCoupon/index.js";
import couponRedemption from "./couponRedemption/index.js";
import posCustomer from "./posCustomer/index.js";
import eventPackage from "./event_package/index.js";
import tableEvent from "./table_event/index.js";
import * as printSetting from "./printSetting/index.js";
import search from "./search/index.js";
import communication from "./communication/index.js";
import aiChatbot from "./aiChatbot/index.js";
import availability from "./availability/index.js";
import auditLog from "./audit_log/index.js";
import { rbacAuditLogs } from "./audit_log/rbac.js";
import systemSetting from "./systemSetting/index.js";
import backup from "./backup/index.js";
import customerAddress from "./customerAddress/index.js";
import dashboard from "./dashboard/index.js";
import analytics from "./analytics/index.js";

const guardedBrandMemberMutations = guardBrandMemberRoleMutations({
  ...(brand.Mutation || {}),
  ...(brandInvitationFlow.Mutation || {}),
});
const staffMutations = withStaffInvitationFlow(staff.Mutation || {});

export default {
  ...baseResolvers,

  Query: {
    ...(role.Query || {}),
    ...(restaurant.Query || {}),
    ...(brand.Query || {}),
    ...(brandInvitationFlow.Query || {}),
    ...(user.Query || {}),
    ...(wallet.Query || {}),
    ...(permission.Query || {}),
    ...(menu.Query || {}),
    ...(category.Query || {}),
    ...(modifierGroup.Query || {}),
    ...(table.Query || {}),
    ...(floor.Query || {}),
    ...(order.Query || {}),
    ...(inventory.Query || {}),
    ...(supply.Query || {}),
    ...(reservation.Query || {}),
    ...(eventLogResolvers.Query || {}),
    ...(payment.Query || {}),
    ...(staff.Query || {}),
    ...payrollOverviewScope,
    ...(review.Query || {}),
    ...(reviewComment.Query || {}),
    ...(cart.Query || {}),
    ...(customerFavorite.Query || {}),
    ...(shippingTracking.Query || {}),
    ...(search.Query || {}),
    ...(supplier.Query || {}),
    ...(promotion.Query || {}),
    ...(customerCombo.Query || {}),
    ...(coupon.Query || {}),
    ...(userCoupon.Query || {}),
    ...(couponRedemption.Query || {}),
    ...(posCustomer.Query || {}),
    ...(eventPackage.Query || {}),
    ...(tableEvent.Query || {}),
    ...(printSetting.Query || {}),
    ...(communication.Query || {}),
    ...(aiChatbot.Query || {}),
    ...(availability.Query || {}),
    ...(auditLog.Query || {}),
    ...(systemSetting.Query || {}),
    ...(backup.Query || {}),
    ...(customerAddress.Query || {}),
    ...(dashboard.Query || {}),
    ...(analytics.Query || {}),
    rbacAuditLogs,
  },

  Mutation: {
    ...(role.Mutation || {}),
    ...(restaurant.Mutation || {}),
    ...(brand.Mutation || {}),
    ...(brandInvitationFlow.Mutation || {}),
    ...(user.Mutation || {}),
    ...(wallet.Mutation || {}),
    ...(permission.Mutation || {}),
    ...(category.Mutation || {}),
    ...(menu.Mutation || {}),
    ...(modifierGroup.Mutation || {}),
    ...(table.Mutation || {}),
    ...(floor.Mutation || {}),
    ...(inventory.Mutation || {}),
    ...(supply.Mutation || {}),
    ...(auth.Mutation || {}),
    ...(customerCombo.Mutation || {}),
    ...(order.Mutation || {}),
    ...(reservation.Mutation || {}),
    ...(eventLogResolvers.Mutation || {}),
    ...(payment.Mutation || {}),
    ...staffMutations,
    ...(attendanceOvertime.Mutation || {}),
    ...(review.Mutation || {}),
    ...(reviewComment.Mutation || {}),
    ...(cart.Mutation || {}),
    ...(customerFavorite.Mutation || {}),
    ...(shippingTracking.Mutation || {}),
    ...(supplier.Mutation || {}),
    ...(eventPackage.Mutation || {}),
    ...(tableEvent.Mutation || {}),
    ...(printSetting.Mutation || {}),
    ...(communication.Mutation || {}),
    ...(aiChatbot.Mutation || {}),
    ...(availability.Mutation || {}),
    ...(posCustomer.Mutation || {}),
    ...(userCoupon.Mutation || {}),
    ...(systemSetting.Mutation || {}),
    ...(backup.Mutation || {}),
    ...(customerAddress.Mutation || {}),
    ...guardedBrandMemberMutations,
  },

  ...(role.Role ? { Role: role.Role } : {}),
  ...(role.ParentRole ? { ParentRole: role.ParentRole } : {}),
  ...(restaurant.Restaurant ? { Restaurant: restaurant.Restaurant } : {}),
  ...(brand.Brand ? { Brand: brand.Brand } : {}),
  ...(brand.BrandMembership ? { BrandMembership: brand.BrandMembership } : {}),
  ...(user.User ? { User: user.User } : {}),
  ...(permission.Permission ? { Permission: permission.Permission } : {}),
  ...(availability.AvailabilityWindow
    ? { AvailabilityWindow: availability.AvailabilityWindow }
    : {}),
  ...(menu.Menu ? { Menu: menu.Menu } : {}),
  ...(category.Category ? { Category: category.Category } : {}),
  ...(modifierGroup.Modifier ? { Modifier: modifierGroup.Modifier } : {}),
  ...(inventory.IngredientsComponent
    ? { IngredientsComponent: inventory.IngredientsComponent }
    : {}),
  ...(supply.Supply ? { Supply: supply.Supply } : {}),
  ...(order.Order ? { Order: order.Order } : {}),
  ...(menu.MenuItem ? { MenuItem: menu.MenuItem } : {}),
  ...(menu.Menu ? { Menu: menu.Menu } : {}),
  ...(cart.Cart ? { Cart: cart.Cart } : {}),
  ...(cart.CartItem ? { CartItem: cart.CartItem } : {}),
  ...(customerFavorite.CustomerFavorite
    ? { CustomerFavorite: customerFavorite.CustomerFavorite }
    : {}),
  ...(userCoupon.UserCoupon ? { UserCoupon: userCoupon.UserCoupon } : {}),
  ...(couponRedemption.CouponRedemption
    ? { CouponRedemption: couponRedemption.CouponRedemption }
    : {}),
  ...(search.SearchResult ? { SearchResult: search.SearchResult } : {}),
  ...(communication.ChatThread ? { ChatThread: communication.ChatThread } : {}),
};
