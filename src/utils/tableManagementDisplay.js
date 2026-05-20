export const getTableDisplayCode = (targetTable) =>
  String(targetTable?.code ?? targetTable?.number ?? "").trim();

export const getTableDisplayCapacity = (targetTable) =>
  Number(targetTable?.capacity ?? targetTable?.seats ?? 0);

export const getTableDisplayType = (targetTable) =>
  targetTable?.type ?? targetTable?.area ?? "standard";

export const getTableFloorId = (targetTable) =>
  targetTable?.floorId?.id ||
  targetTable?.floorId?._id ||
  targetTable?.floorId ||
  targetTable?.floor?.id ||
  targetTable?.floor?._id ||
  null;

export const getRawTableById = (tablesRaw, tableId) =>
  (tablesRaw || []).find((raw) => String(raw.id) === String(tableId)) || null;

export const normalizeTableSearch = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

export const filterTableRows = (tables, filters = {}) => {
  const { searchQuery, status, area } = filters;
  let filtered = [...(tables || [])];
  const normalizedQuery = normalizeTableSearch(searchQuery);

  if (normalizedQuery) {
    const compactQuery = normalizedQuery.replace(/\s+/g, "");
    filtered = filtered.filter((t) => {
      const normalizedNumber = normalizeTableSearch(t.number);
      const compactNumber = normalizedNumber.replace(/\s+/g, "");
      return (
        normalizedNumber.includes(normalizedQuery) ||
        compactNumber.includes(compactQuery)
      );
    });
  }

  if (status) {
    filtered = filtered.filter((t) => t.status === status);
  }

  if (area) {
    filtered = filtered.filter((t) => t.area === area);
  }

  return filtered;
};

export const sortTableRowsByNumber = (tables) =>
  [...(tables || [])].sort((a, b) =>
    String(a.number || "").localeCompare(String(b.number || ""), "vi", {
      numeric: true,
      sensitivity: "base",
    })
  );

export const filterTablesByFloor = (tables, floorId) =>
  (tables || []).filter(
    (t) => String(getTableFloorId(t)) === String(floorId)
  );
