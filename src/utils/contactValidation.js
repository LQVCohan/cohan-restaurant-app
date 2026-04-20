export const phoneLooksValid = (value) => {
  const digits = String(value || "").replace(/\s/g, "");
  if (!digits) return false;
  return /^[0-9]{9,11}$/.test(digits);
};

export const emailLooksValid = (value) => {
  const email = String(value || "").trim();
  if (!email) return false;
  return /\S+@\S+\.\S+/.test(email);
};

export const normalizeContactName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ");

export const getEmergencyPhoneError = ({
  emergencyName,
  emergencyPhone,
  requiredMessage,
  invalidMessage,
}) => {
  const normalizedName = normalizeContactName(emergencyName);
  const phone = String(emergencyPhone || "").trim();

  if (!normalizedName && !phone) return "";
  if (normalizedName && !phone) return requiredMessage;
  if (phone && !phoneLooksValid(phone)) return invalidMessage;
  return "";
};
