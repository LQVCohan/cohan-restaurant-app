export const MenuItemFieldResolvers = {
  servingVariants(parent) {
    console.log("MenuItem.servingVariants parent.recipe = ", parent.recipe);
    return parent?.recipe?.servingVariants || [];
  },
};
