import { useState, useEffect } from "react";

export const useMenuItems = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(9);

  const updateItem = (id, updates) => {
    setMenuItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const deleteItem = (id) => {
    setMenuItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addItem = (newItem) => {
    const newId = Math.max(...menuItems.map((item) => item.id)) + 1;
    setMenuItems((prev) => [...prev, { id: newId, ...newItem }]);
  };

  return {
    menuItems,
    filteredItems,
    setFilteredItems,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    updateItem,
    deleteItem,
    addItem,
  };
};
