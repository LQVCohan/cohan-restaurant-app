export const MenuItemFieldResolvers = {
  servingVariants(parent) {
    return parent?.recipe?.servingVariants || [];
  },
};
