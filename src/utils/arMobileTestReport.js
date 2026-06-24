const safeText = (value, fallback = "-") => {
  if (value == null || value === "") return fallback;
  return String(value);
};

const getScreenInfo = () => {
  if (typeof window === "undefined") return {};
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    orientation: window.screen?.orientation?.type || "unknown",
  };
};

const getNavigatorInfo = () => {
  if (typeof navigator === "undefined") return {};
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    maxTouchPoints: navigator.maxTouchPoints,
    mediaDevices: Boolean(navigator.mediaDevices?.getUserMedia),
    geolocation: Boolean(navigator.geolocation),
    webxr: Boolean(navigator.xr),
  };
};

export const buildArMobileTestReport = ({
  selectedModel,
  table,
  restaurant,
  floor,
  capabilities,
  arStatus,
  extra = {},
} = {}) => {
  const report = {
    title: "COHAN AR/3D mobile test report",
    createdAt: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : "unknown",
    secureContext: typeof window !== "undefined" ? window.isSecureContext : false,
    screen: getScreenInfo(),
    browser: getNavigatorInfo(),
    appState: {
      restaurant: safeText(restaurant?.name || restaurant?.restaurantName),
      floor: safeText(floor?.name),
      table: safeText(table?.code || table?.number || table?.id),
      selectedModel: safeText(selectedModel?.label || selectedModel?.key),
      modelUrl: safeText(selectedModel?.modelUrl),
      modelType: safeText(selectedModel?.tableType),
      arStatusLabel: safeText(arStatus?.label),
      arStatusDescription: safeText(arStatus?.description),
    },
    capabilities: {
      secureContext: Boolean(capabilities?.secureContext),
      camera: Boolean(capabilities?.camera),
      webxr: capabilities?.webxr,
    },
    expectedResult: {
      desktopOrLanHttp: "Xem 3D trong modal; AR/camera có thể bị chặn nếu không phải secure context.",
      mobileHttps: "Cho phép camera, mở AR native hoặc AR placement nếu thiết bị hỗ trợ WebXR/Scene Viewer/Quick Look.",
    },
    extra,
  };

  return JSON.stringify(report, null, 2);
};

export const copyTextToClipboard = async (text) => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
  return copied;
};
