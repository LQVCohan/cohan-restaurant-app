import process from "process";
import mongoose from "mongoose";
import { loadEnv, validateEnv } from "../src/config/env.js";
import { connectDB } from "../config/db.js";
import { User } from "../models/index.js";
import { safeDbInfo } from "./lib/scriptSafety.js";

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const ZERO_WIDTH_CHARS = "​‌‍﻿";
const ZERO_WIDTH_OR_WS_CLASS = `[\\s${ZERO_WIDTH_CHARS}]`;

const buildTrimmedExactRegex = (value = "") =>
  new RegExp(
    `^${ZERO_WIDTH_OR_WS_CLASS}*${escapeRegex(value)}${ZERO_WIDTH_OR_WS_CLASS}*$`,
    "i"
  );

const buildNormalizedFieldExpr = (field) => ({
  $toLower: {
    $trim: {
      input: {
        $replaceAll: {
          input: {
            $replaceAll: {
              input: {
                $replaceAll: {
                  input: { $ifNull: [field, ""] },
                  find: "\u200B",
                  replacement: "",
                },
              },
              find: "\u200C",
              replacement: "",
            },
          },
          find: "\uFEFF",
          replacement: "",
        },
      },
    },
  },
});

async function main() {
  const loadedFrom = loadEnv();
  validateEnv();

  const rawEmail = process.argv[2] || process.env.CHECK_USER_EMAIL;
  const normalizedEmail = rawEmail?.toLowerCase().trim();

  if (!normalizedEmail) {
    console.error(
      "❌ Missing email. Usage: node scripts/check-user-by-email.js <email>"
    );
    process.exitCode = 1;
    return;
  }

  console.log("ℹ️ Loaded env files:", loadedFrom);
  const dbInfo = safeDbInfo();
  console.log("ℹ️ Target DB:", {
    mongoUri: dbInfo.mongoUri,
    mongoDb: dbInfo.mongoDb,
    normalizedEmail,
  });

  await connectDB();

  const baseLookupOr = [
    { email: normalizedEmail },
    { email: { $regex: buildTrimmedExactRegex(normalizedEmail) } },
  ];

  const primaryUser = await User.findOne({ $or: baseLookupOr })
    .populate("role")
    .lean({ virtuals: true });

  console.log("🔎 Primary lookup result:",
    primaryUser
      ? {
          id: String(primaryUser._id),
          email: primaryUser.email,
          status: primaryUser.status,
          username: primaryUser.username,
          hasPassword: Boolean(primaryUser.passwordHash),
          role: primaryUser.role?.slug || primaryUser.role?.name || null,
        }
      : null
  );

  if (!primaryUser) {
    const fallbackUser = await User.findOne({
      $expr: {
        $eq: [buildNormalizedFieldExpr("$email"), normalizedEmail],
      },
    })
      .populate("role")
      .lean({ virtuals: true });

    console.log("🔎 Fallback normalized lookup result:",
      fallbackUser
        ? {
            id: String(fallbackUser._id),
            email: fallbackUser.email,
            status: fallbackUser.status,
            username: fallbackUser.username,
            hasPassword: Boolean(fallbackUser.passwordHash),
            role: fallbackUser.role?.slug || fallbackUser.role?.name || null,
          }
        : null
    );
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("❌ check-user-by-email failed:", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exitCode = 1;
});
