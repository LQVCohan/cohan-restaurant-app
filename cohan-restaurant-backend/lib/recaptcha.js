// src/lib/recaptcha.js
// Mục tiêu: verify reCAPTCHA v2/v3, tương thích Fastify/Mercurius

import fetch from "node-fetch";
import process from "process";
/** Lấy IP client an toàn cho Fastify/Mercurius */
function extractIp(ctxOrReq) {
  const req =
    ctxOrReq?.request || // Mercurius context { request, reply }
    ctxOrReq?.req || // Một số context tự gán { req, res }
    ctxOrReq; // hoặc chính FastifyRequest
  const xfwd = req?.headers?.["x-forwarded-for"];
  return (Array.isArray(xfwd) ? xfwd[0] : xfwd) || req?.ip || undefined;
}

/**
 * Verify Google reCAPTCHA token on server.
 * - Trả { ok: true } nếu VERIFY tắt qua ENV (ENABLE_RECAPTCHA=false)
 * @param {string} token
 * @param {any} ctxOrReq - Mercurius context (preferred) hoặc FastifyRequest
 * @returns {Promise<{ ok: boolean, data?: any, reason?: string, skipped?: boolean }>}
 */
export async function verifyRecaptcha(token, ctxOrReq) {
  const enabled =
    String(process.env.ENABLE_RECAPTCHA || "false").toLowerCase() === "true";
  if (!enabled) return { ok: true, skipped: true }; // dev/offline mode

  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) {
    return { ok: false, reason: "Missing RECAPTCHA_SECRET on server." };
  }
  if (!token) {
    return { ok: false, reason: "Missing captcha token." };
  }

  const remoteip = extractIp(ctxOrReq);

  const params = new URLSearchParams();
  params.append("secret", secret);
  params.append("response", token);
  if (remoteip) params.append("remoteip", remoteip);

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  // Google luôn trả 200; check field success/score
  const json = await res.json(); // { success, score, action, ... }
  if (!json.success)
    return { ok: false, reason: "Failed to verify reCAPTCHA.", data: json };

  // Nếu là v3, check score
  if (typeof json.score === "number" && json.score < 0.5) {
    return { ok: false, reason: "Low reCAPTCHA score.", data: json };
  }

  return { ok: true, data: json };
}
