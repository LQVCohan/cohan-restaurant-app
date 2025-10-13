import { useState, useEffect } from "react";

const initialSupplies = [
  {
    id: 1,
    name: "Coca Cola",
    category: "beverage",
    unit: "chai",
    currentStock: 120,
    minStock: 50,
    costPrice: 15000,
    supplier: "Coca Cola VN",
    notes: "Chai 330ml",
    icon: "🥤",
  },
  {
    id: 2,
    name: "Khăn lạnh",
    category: "cleaning",
    unit: "cái",
    currentStock: 200,
    minStock: 100,
    costPrice: 2000,
    supplier: "Vệ sinh Minh Anh",
    notes: "Khăn lạnh dùng một lần",
    icon: "🧻",
  },
  {
    id: 3,
    name: "Hộp đựng thức ăn",
    category: "packaging",
    unit: "cái",
    currentStock: 500,
    minStock: 200,
    costPrice: 5000,
    supplier: "Bao bì Việt",
    notes: "Hộp giấy thân thiện môi trường",
    icon: "📦",
  },
];

export const useSupplies = () => {
  const [supplies, setSupplies] = useState(initialSupplies);
  const [filteredSupplies, setFilteredSupplies] = useState(supplies);
  const [filters, setFilters] = useState({
    search: "",
    category: "",
  });

  useEffect(() => {
    let filtered = supplies;

    if (filters.search) {
      filtered = filtered.filter((supply) =>
        supply.name.toLowerCase().includes(filters.search.toLowerCase())
      );
    }

    if (filters.category) {
      filtered = filtered.filter(
        (supply) => supply.category === filters.category
      );
    }

    setFilteredSupplies(filtered);
  }, [supplies, filters]);

  const getStockStatus = (item) => {
    if (item.currentStock === 0) {
      return {
        value: "out-of-stock",
        class: "status-out-of-stock",
        text: "Hết hàng",
      };
    } else if (item.currentStock <= item.minStock) {
      return { value: "low-stock", class: "status-low-stock", text: "Sắp hết" };
    } else {
      return { value: "in-stock", class: "status-in-stock", text: "Còn hàng" };
    }
  };

  const addSupply = (supplyData) => {
    const newId = Math.max(...supplies.map((s) => s.id)) + 1;
    setSupplies([...supplies, { id: newId, ...supplyData }]);
  };

  const updateSupply = (id, supplyData) => {
    setSupplies(
      supplies.map((supply) =>
        supply.id === id ? { ...supply, ...supplyData } : supply
      )
    );
  };

  const deleteSupply = (id) => {
    setSupplies(supplies.filter((supply) => supply.id !== id));
  };

  const addStock = (id, amount) => {
    setSupplies(
      supplies.map((supply) =>
        supply.id === id
          ? { ...supply, currentStock: supply.currentStock + amount }
          : supply
      )
    );
  };

  return {
    supplies,
    filteredSupplies,
    filters,
    setFilters,
    addSupply,
    updateSupply,
    deleteSupply,
    addStock,
    getStockStatus,
  };
};
