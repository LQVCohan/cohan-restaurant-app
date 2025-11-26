import { useState, useMemo, useEffect } from "react";
import { MOCK_MENU_ITEMS, MOCK_CATEGORIES } from "../data/mockData";

export default function useMockMenu({ restaurantId, defaultTimeSlot }) {
  // Giả lập loading
  const [itemsLoading, setItemsLoading] = useState(true);
  const [items, setItems] = useState([]);

  // States bộ lọc
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(
    defaultTimeSlot || "lunch"
  );
  const [categoryId, setCategoryId] = useState(null);
  const [search, setSearch] = useState("");

  // Giả lập call API (delay 1s)
  useEffect(() => {
    setItemsLoading(true);
    const timer = setTimeout(() => {
      setItems(MOCK_MENU_ITEMS);
      setItemsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [restaurantId]);

  // Logic lọc dữ liệu giả (Client-side filtering)
  const filteredItems = useMemo(() => {
    let result = items;
    if (categoryId) {
      result = result.filter((i) => i.categoryId === categoryId);
    }
    if (search) {
      result = result.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    return result;
  }, [items, categoryId, search]);

  const itemsWithPrice = useMemo(
    () => filteredItems.map((i) => ({ ...i, _displayPrice: i.basePrice })),
    [filteredItems]
  );

  return {
    menus: [{ timeSlot: "lunch" }, { timeSlot: "dinner" }], // Mock menu slots
    categories: MOCK_CATEGORIES,
    selectedTimeSlot,
    setSelectedTimeSlot,
    timeSlotOptions: [
      { value: "lunch", label: "Trưa" },
      { value: "dinner", label: "Tối" },
    ],
    categoryId,
    setCategoryId,
    search,
    setSearch,
    itemsLoading,
    itemsWithPrice,
    fetchMoreItems: () => console.log("Mock fetch more"), // Mock function
  };
}
