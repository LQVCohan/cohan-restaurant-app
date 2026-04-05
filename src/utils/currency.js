const FALLBACK_USD_TO_VND = 26000;
const SUPPORTED_CURRENCIES = ["VND", "USD"];

let cachedRate = null;
let cachedAt = 0;
const RATE_CACHE_MS = 10 * 60 * 1000;

export function normalizeCurrency(value, fallback = "VND") {
  const cur = String(value || fallback).trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(cur) ? cur : fallback;
}

export function convertCurrencyAmount(
  amount,
  fromCurrency,
  toCurrency,
  usdToVndRate = FALLBACK_USD_TO_VND,
) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;

  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) return n;

  const rate = Number(usdToVndRate);
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_USD_TO_VND;

  if (from === "USD" && to === "VND") return n * safeRate;
  if (from === "VND" && to === "USD") return n / safeRate;
  return n;
}

export function formatCurrencyAmount(amount, currency = "VND", options = {}) {
  const cur = normalizeCurrency(currency);
  const maximumFractionDigits =
    options.maximumFractionDigits ??
    (cur === "USD" ? 2 : 0);
  return new Intl.NumberFormat(cur === "USD" ? "en-US" : "vi-VN", {
    style: "currency",
    currency: cur,
    maximumFractionDigits,
    minimumFractionDigits: cur === "USD" ? 2 : 0,
  }).format(Number(amount) || 0);
}

export async function getUsdToVndRate({
  manualRate,
  timeoutMs = 1000,
  forceRefresh = false,
} = {}) {
  const manual = Number(manualRate);
  if (Number.isFinite(manual) && manual > 0) {
    return { rate: manual, source: "manual", fallback: false };
  }

  const now = Date.now();
  if (
    !forceRefresh &&
    cachedRate &&
    now - cachedAt <= RATE_CACHE_MS
  ) {
    return { rate: cachedRate, source: "cache", fallback: false };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      method: "GET",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error("Exchange API not ok");
    const data = await res.json();
    const liveRate = Number(data?.rates?.VND);
    if (!Number.isFinite(liveRate) || liveRate <= 0) {
      throw new Error("Malformed exchange response");
    }
    cachedRate = liveRate;
    cachedAt = Date.now();
    return { rate: liveRate, source: "network", fallback: false };
  } catch {
    return {
      rate: FALLBACK_USD_TO_VND,
      source: "fallback",
      fallback: true,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export { FALLBACK_USD_TO_VND, SUPPORTED_CURRENCIES };
