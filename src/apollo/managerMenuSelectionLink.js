import { ApolloLink } from "@apollo/client";
import { getManagerMenuSelection } from "@/utils/managerMenuSelection";

const isManagerMenuPage = () =>
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/manager") &&
  ["#menu", "#menus"].includes(window.location.hash || "#menu");

const matchesSelection = (selection, value) =>
  selection &&
  String(value?.restaurantId || "") === selection.restaurantId &&
  (!value?.timeSlot || String(value.timeSlot) === selection.timeSlot);

export const managerMenuSelectionLink = new ApolloLink((operation, forward) => {
  if (!isManagerMenuPage()) return forward(operation);

  const selection = getManagerMenuSelection();
  const operationName = operation?.operationName || "";
  const variables = operation?.variables || {};

  if (
    operationName === "MenuItemsConnection" &&
    matchesSelection(selection, variables.filter)
  ) {
    operation.variables = {
      ...variables,
      filter: { ...variables.filter, menuId: selection.menuId },
    };
  } else if (
    ["CreateMenuItem", "SyncMenuItemInventoryStatuses"].includes(operationName) &&
    matchesSelection(selection, variables.input)
  ) {
    operation.variables = {
      ...variables,
      input: { ...variables.input, menuId: selection.menuId },
    };
  }

  return forward(operation);
});
