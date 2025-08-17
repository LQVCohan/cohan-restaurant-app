import { useState, useEffect } from "react";

export const useTableManagement = () => {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeArea, setActiveArea] = useState("outdoor");

  // Mock data
  const mockTables = [
    { id: "O1", area: "outdoor", seats: 4, status: "available" },
    {
      id: "O2",
      area: "outdoor",
      seats: 2,
      status: "occupied",
      time: "15 phút",
    },
    { id: "O3", area: "outdoor", seats: 6, status: "reserved", time: "19:00" },
    // ... more tables
  ];

  useEffect(() => {
    setTables(mockTables);
  }, []);

  const filteredTables = tables.filter((table) => {
    const matchesSearch = table.id
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || table.status === statusFilter;
    const matchesArea = table.area === activeArea;

    return matchesSearch && matchesStatus && matchesArea;
  });

  const getStatusCounts = () => {
    return {
      all: tables.length,
      available: tables.filter((t) => t.status === "available").length,
      occupied: tables.filter((t) => t.status === "occupied").length,
      reserved: tables.filter((t) => t.status === "reserved").length,
      cleaning: tables.filter((t) => t.status === "cleaning").length,
    };
  };

  const updateTableStatus = (tableId, newStatus) => {
    setTables((prev) =>
      prev.map((table) =>
        table.id === tableId ? { ...table, status: newStatus } : table
      )
    );
  };

  return {
    tables: filteredTables,
    selectedTable,
    setSelectedTable,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    activeArea,
    setActiveArea,
    getStatusCounts,
    updateTableStatus,
  };
};
