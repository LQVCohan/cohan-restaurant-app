const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const matchesEmployeeSearch = (employee, query) => {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;

  const fields = [
    employee?.fullName,
    employee?.name,
    employee?.phone,
    employee?.email,
    employee?.employeeCode,
    employee?.code,
    employee?.positionTitle,
    employee?.role,
    employee?.roleName,
    employee?.role?.name,
  ];

  return fields.some((field) => normalizeText(field).includes(normalizedQuery));
};

