const pad2 = (value) => String(value).padStart(2, "0");

export const formatVietnamDateTimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const vnDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);

  return [
    vnDate.getUTCFullYear(),
    pad2(vnDate.getUTCMonth() + 1),
    pad2(vnDate.getUTCDate()),
  ].join("-") + `T${pad2(vnDate.getUTCHours())}:${pad2(vnDate.getUTCMinutes())}`;
};

export const toVietnamDateTimeISO = (value) => {
  if (!value) return null;
  const [datePart, timePart = "00:00"] = String(value).split("T");
  const [year, month, day] = datePart.split("-").map((item) => Number(item));
  const [hours, minutes] = timePart.split(":").map((item) => Number(item));

  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    throw new Error("Invalid Vietnam datetime-local value");
  }

  return new Date(
    Date.UTC(year, month - 1, day, hours - 7, minutes, 0, 0),
  ).toISOString();
};
