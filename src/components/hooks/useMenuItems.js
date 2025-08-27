import { useState, useCallback } from "react";

const initialMenuItems = [
  {
    id: 1,
    name: "Phở Bò Tái",
    category: "main",
    price: 65000,
    description:
      "Phở bò truyền thống với thịt bò tái, nước dùng đậm đà từ xương bò ninh nhiều giờ",
    status: "available",
    prepTime: 10,
    ingredients: "Thịt bò tái, bánh phở, hành tây, ngò gai, hành lá",
    emoji: "🍜",
    cookingMethods: [
      { name: "Tái", price: 65000 },
      { name: "Chín", price: 65000 },
      { name: "Tái chín", price: 70000 },
    ],
  },
  {
    id: 2,
    name: "Gỏi Cuốn Tôm",
    category: "appetizer",
    price: 45000,
    description:
      "Gỏi cuốn tươi với tôm luộc, rau sống và bún tươi, chấm nước mắm chua ngọt",
    status: "available",
    prepTime: 15,
    ingredients: "Tôm tươi, bánh tráng, rau sống, bún tươi, nước mắm",
    emoji: "🥬",
    cookingMethods: [
      { name: "Tôm luộc", price: 45000 },
      { name: "Tôm nướng", price: 55000 },
    ],
  },
  {
    id: 7,
    name: "Bạch Tuột",
    category: "main",
    price: 0,
    description: "Bạch tuột tươi ngon, chế biến theo nhiều cách khác nhau",
    status: "available",
    prepTime: 20,
    ingredients: "Bạch tuột tươi, gia vị, rau thơm",
    emoji: "🦑",
    cookingMethods: [
      { name: "Nướng", price: 120000 },
      { name: "Hấp", price: 100000 },
      { name: "Chiên", price: 110000 },
      { name: "Xào", price: 115000 },
    ],
  },
  // ... thêm các món khác
];

export const useMenuItems = () => {
  const [menuItems, setMenuItems] = useState(initialMenuItems);

  const addItem = useCallback((item) => {
    const newItem = {
      ...item,
      id: Date.now(),
    };
    setMenuItems((prev) => [...prev, newItem]);
  }, []);

  const updateItem = useCallback((id, updatedItem) => {
    setMenuItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updatedItem } : item))
    );
  }, []);

  const deleteItem = useCallback((id) => {
    setMenuItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toggleStatus = useCallback((id) => {
    setMenuItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === "available" ? "unavailable" : "available",
            }
          : item
      )
    );
  }, []);

  const bulkUpdatePrices = useCallback(
    (category, adjustmentType, value, direction) => {
      setMenuItems((prev) =>
        prev.map((item) => {
          if (category && item.category !== category) return item;

          let newPrice;
          if (adjustmentType === "percent") {
            newPrice =
              direction === "increase"
                ? item.price * (1 + value / 100)
                : item.price * (1 - value / 100);
          } else {
            newPrice =
              direction === "increase"
                ? item.price + value
                : item.price - value;
          }

          return {
            ...item,
            price: Math.max(0, Math.round(newPrice)),
          };
        })
      );
    },
    []
  );

  return {
    menuItems,
    addItem,
    updateItem,
    deleteItem,
    toggleStatus,
    bulkUpdatePrices,
  };
};
