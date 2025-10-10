// src/lib/passwordPolicy.js
// Mục tiêu: kiểm tra độ mạnh mật khẩu, tôn trọng flag ENABLE_PASSWORD_POLICY

import zxcvbn from "zxcvbn";

/**
 * Validate password with zxcvbn.
 * @param {string} password
 * @param {{ minScore?: 0|1|2|3|4, minLength?: number }} options
 * @returns {{ ok: boolean, reason?: string, suggestions?: string[] }}
 */
export function validatePasswordStrong(
  password,
  { minScore = 3, minLength = 8 } = {}
) {
  // Cho phép tắt chính sách qua ENV
  if (String(process.env.ENABLE_PASSWORD_POLICY).toLowerCase() === "false") {
    if (!password || password.length < 6) {
      return {
        ok: false,
        reason: "Password length must be at least 6 characters.",
      };
    }
    return { ok: true };
  }

  if (!password || password.length < minLength) {
    return {
      ok: false,
      reason: `Password length must be at least ${minLength} characters.`,
    };
  }

  const { score, feedback } = zxcvbn(password);
  if (score < minScore) {
    return {
      ok: false,
      reason:
        feedback?.warning ||
        "Password is too weak. Use upper/lowercase, numbers and symbols.",
      suggestions: feedback?.suggestions || [],
    };
  }
  return { ok: true };
}
