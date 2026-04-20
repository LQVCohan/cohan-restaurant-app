const REGION_I_WAGE_2026_ARTICLE_URL =
  "https://xaydungchinhsach.chinhphu.vn/tu-1-1-2026-muc-luong-toi-thieu-duoc-tang-bao-nhieu-119251111091442629.htm";

const DECREE_293_PDF_URL =
  "https://xdcs.cdnchinhphu.vn/446259493575335936/2025/11/10/293-2025-nd-cp-10112025-3-signed-1762770239794100377083.pdf";

const PROBATION_WAGE_LAW_URL =
  "https://datafiles.chinhphu.vn/cpp/files/vbpq/2019/12/45.signed.pdf";

const FALLBACK_WAGE_REFERENCE = {
  year: 2026,
  decreeName:
    "Nghị định số 293/2025/NĐ-CP quy định mức lương tối thiểu đối với người lao động làm việc theo hợp đồng lao động",
  officialSource: "Cổng TTĐT Chính phủ (xaydungchinhsach.chinhphu.vn)",
  decreeUrl: DECREE_293_PDF_URL,
  articleUrl: REGION_I_WAGE_2026_ARTICLE_URL,
  probationRuleName:
    "Bộ luật Lao động 2019 (quy định lương thử việc tối thiểu 85% mức lương công việc)",
  probationRuleUrl: PROBATION_WAGE_LAW_URL,
  region: "Vùng I",
  monthlyMinimum: 5_310_000,
  hourlyMinimum: 25_500,
  retrievedAt: null,
  isLive: false,
  error: null,
};

let cachedPromise = null;
let cachedValue = null;

const toNumberFromVN = (value) =>
  Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10) || 0;

const parseRegionIWageFromArticle = (html) => {
  const normalized = String(html || "").replace(/\s+/g, " ");

  const monthlyMatch = normalized.match(/Vùng I[^0-9]{1,40}([0-9.,]{7,12})/i);
  const hourlyMatch = normalized.match(
    /Vùng I[^0-9]{1,80}[0-9.,]{7,12}[^0-9]{1,20}([0-9.,]{4,8})/i,
  );

  const monthly = toNumberFromVN(monthlyMatch?.[1]);
  const hourly = toNumberFromVN(hourlyMatch?.[1]);

  if (!monthly || !hourly) {
    throw new Error("Could not parse official wage values from article.");
  }

  return { monthlyMinimum: monthly, hourlyMinimum: hourly };
};

export const getLegalSalaryReference = async () => {
  if (cachedValue) return cachedValue;
  if (!cachedPromise) {
    cachedPromise = (async () => {
      try {
        const res = await fetch(REGION_I_WAGE_2026_ARTICLE_URL);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const html = await res.text();
        const parsed = parseRegionIWageFromArticle(html);
        cachedValue = {
          ...FALLBACK_WAGE_REFERENCE,
          ...parsed,
          retrievedAt: new Date().toISOString(),
          isLive: true,
          error: null,
        };
        return cachedValue;
      } catch (error) {
        cachedValue = {
          ...FALLBACK_WAGE_REFERENCE,
          error: error?.message || "Fallback to built-in legal reference values",
        };
        return cachedValue;
      }
    })();
  }
  return cachedPromise;
};

export const parseCurrencyInputToNumber = (value) =>
  Number.parseInt(String(value || "").replace(/[^\d]/g, ""), 10) || 0;

export const formatCurrencyDisplay = (value) => {
  const numeric = parseCurrencyInputToNumber(value);
  if (!numeric) return "";
  return numeric.toLocaleString("vi-VN");
};

export const getSuggestedSalaryByEmploymentType = (employmentType, reference) => {
  const ref = reference || FALLBACK_WAGE_REFERENCE;
  const monthly = Number(ref.monthlyMinimum || FALLBACK_WAGE_REFERENCE.monthlyMinimum);
  const hourly = Number(ref.hourlyMinimum || FALLBACK_WAGE_REFERENCE.hourlyMinimum);

  switch (String(employmentType || "").toUpperCase()) {
    case "PART_TIME":
      return Math.round(hourly * 104); // giả định tham khảo 4h/ngày * 26 ngày
    case "PROBATION":
      return Math.round(monthly * 0.85);
    case "SEASONAL":
    case "CONTRACT":
    case "FULL_TIME":
    default:
      return monthly;
  }
};
