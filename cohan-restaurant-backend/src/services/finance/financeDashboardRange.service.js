import dayjs from "dayjs";

const dateOnly = (value) => dayjs(value).format("YYYY-MM-DD");

const badRange = (message) => {
  const error = new Error(message);
  error.code = "BAD_USER_INPUT";
  error.extensions = { code: "BAD_USER_INPUT" };
  return error;
};

const parseDate = (value) => {
  const parsed = dayjs(value);
  const datePrefix = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ""))?.[1];
  if (
    !parsed.isValid() ||
    (datePrefix && parsed.format("YYYY-MM-DD") !== datePrefix)
  ) {
    throw badRange("Khoảng ngày tài chính không hợp lệ.");
  }
  return parsed;
};

const validateExplicitRange = (dateFrom, dateTo) => {
  if (!dateFrom || !dateTo) {
    throw badRange("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.");
  }
  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);
  if (from.startOf("day").isAfter(to.startOf("day"))) {
    throw badRange("Ngày bắt đầu không được sau ngày kết thúc.");
  }
  return { from, to };
};

export function prepareFinanceDashboardRequest(input = {}, now = new Date()) {
  const range = String(input.range || "MONTH").toUpperCase();
  const hasExplicitRange = Boolean(input.dateFrom || input.dateTo);

  if (range === "CUSTOM" || hasExplicitRange) {
    const { from, to } = validateExplicitRange(input.dateFrom, input.dateTo);
    return {
      input: {
        ...input,
        range: "CUSTOM",
        dateFrom: dateOnly(from),
        dateTo: dateOnly(to),
      },
      trendMode: "day",
    };
  }

  const current = dayjs(now);
  if (range === "WEEK") {
    const monday = current
      .startOf("day")
      .subtract((current.day() + 6) % 7, "day");
    return {
      input: {
        ...input,
        range: "CUSTOM",
        dateFrom: dateOnly(monday),
        dateTo: dateOnly(monday.add(6, "day")),
      },
      trendMode: "day",
    };
  }

  if (range === "QUARTER") {
    const quarterStart = current
      .month(Math.floor(current.month() / 3) * 3)
      .startOf("month");
    return {
      input: {
        ...input,
        range: "CUSTOM",
        dateFrom: dateOnly(quarterStart),
        dateTo: dateOnly(quarterStart.add(2, "month").endOf("month")),
      },
      trendMode: "quarter",
      quarterStart: quarterStart.toDate(),
    };
  }

  return { input, trendMode: range.toLowerCase() };
}

export function normalizeFinanceDashboardResult(result, request = {}) {
  if (request.trendMode !== "quarter" || !request.quarterStart) return result;

  const start = dayjs(request.quarterStart);
  const buckets = new Map(
    [0, 1, 2].map((offset) => {
      const month = start.add(offset, "month");
      const key = month.format("MM/YYYY");
      return [key, { key, revenue: 0, expense: 0, profit: 0 }];
    }),
  );

  (result?.trend || []).forEach((point) => {
    const match = /^(\d{2})\/(\d{2})$/.exec(String(point.key || ""));
    if (!match) return;
    const key = `${match[2]}/${start.year()}`;
    const bucket = buckets.get(key);
    if (!bucket) return;
    bucket.revenue += Number(point.revenue || 0);
    bucket.expense += Number(point.expense || 0);
    bucket.profit = bucket.revenue - bucket.expense;
  });

  return { ...result, trend: Array.from(buckets.values()) };
}
