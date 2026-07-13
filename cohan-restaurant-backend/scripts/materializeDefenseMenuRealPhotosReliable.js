import "dotenv/config.js";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

import { MenuItem, Restaurant } from "../models/index.js";
import { DISH_DEFS, SEED_KEY } from "./seedDefenseMenuCatalog.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const scriptPath = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptsDir, "../..");
const outputDir = path.join(repoRoot, "public", "images", "menu", "dishes");
const attributionPath = path.join(outputDir, "attribution.json");
const PRIMARY_RESTAURANT_NAME = "Nhà hàng COHAN Thủ Đức";
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const REFRESH = String(process.env.DEFENSE_MENU_PHOTO_REFRESH || "").toLowerCase() === "true";
const FETCH_TIMEOUT_MS = 25_000;
const MIN_IMAGE_BYTES = 8_000;
const MAX_IMAGE_BYTES = 18 * 1024 * 1024;
const USER_AGENT = "COHAN-Restaurant-Defense-Seed/2.1";

const PEXELS_BY_GROUP = {
  breakfast: "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1400",
  noodle: "https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=1400",
  drink: "https://images.pexels.com/photos/96974/pexels-photo-96974.jpeg?auto=compress&cs=tinysrgb&w=1400",
  vietnamese: "https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=1400",
  seafood: "https://images.pexels.com/photos/262959/pexels-photo-262959.jpeg?auto=compress&cs=tinysrgb&w=1400",
  grill: "https://images.pexels.com/photos/769289/pexels-photo-769289.jpeg?auto=compress&cs=tinysrgb&w=1400",
  chicken: "https://images.pexels.com/photos/2338407/pexels-photo-2338407.jpeg?auto=compress&cs=tinysrgb&w=1400",
  vegetable: "https://images.pexels.com/photos/1640770/pexels-photo-1640770.jpeg?auto=compress&cs=tinysrgb&w=1400",
  soup: "https://images.pexels.com/photos/539451/pexels-photo-539451.jpeg?auto=compress&cs=tinysrgb&w=1400",
  dessert: "https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&w=1400",
  spread: "https://images.pexels.com/photos/1640772/pexels-photo-1640772.jpeg?auto=compress&cs=tinysrgb&w=1400"
};

function fail(message) {
  throw new Error(`DEFENSE_MENU_PHOTO_FAILED: ${message}`);
}

function extensionFromBuffer(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

function assertPhotoBuffer(buffer, label) {
  if (!Buffer.isBuffer(buffer)) fail(`${label} did not return binary data`);
  if (buffer.length < MIN_IMAGE_BYTES) fail(`${label} is too small (${buffer.length} bytes)`);
  if (buffer.length > MAX_IMAGE_BYTES) fail(`${label} is too large (${buffer.length} bytes)`);
  const extension = extensionFromBuffer(buffer);
  if (!extension) fail(`${label} is not a supported raster photograph`);
  return extension;
}

function slugify(value) {
  return String(value || "dish")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function photoGroupForDish(dish) {
  if (dish.category === "Đồ uống") return "drink";
  if (dish.category === "Hải sản") return "seafood";
  if (dish.category === "Món nướng") return "grill";
  if (dish.category === "Lẩu") return "spread";
  if (dish.category === "Rau và món phụ") return "vegetable";
  if (dish.category === "Tráng miệng") return "dessert";
  if (dish.category === "Món ăn khuya") return dish.name.toLowerCase().includes("cháo") || dish.name.toLowerCase().includes("súp") ? "soup" : "noodle";
  if (dish.name.toLowerCase().includes("phở") || dish.name.toLowerCase().includes("bún") || dish.name.toLowerCase().includes("mì")) return "noodle";
  if (dish.name.toLowerCase().includes("gà")) return "chicken";
  if (dish.timeSlot === "breakfast") return "breakfast";
  return "vietnamese";
}

async function fetchWithRetry(url, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "image/avif,image/webp,image/jpeg,image/png,*/*;q=0.5"
        }
      });
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : attempt * 1200;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.startsWith("image/") || contentType.includes("svg")) {
        throw new Error(`invalid content-type ${contentType || "unknown"}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      return { buffer, extension: assertPhotoBuffer(buffer, url), contentType };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error("photo download failed");
}

async function findCachedPhoto(slug) {
  for (const extension of ["jpg", "jpeg", "png", "webp"]) {
    const absolutePath = path.join(outputDir, `${slug}.${extension}`);
    try {
      const details = await stat(absolutePath);
      if (!details.isFile() || details.size < MIN_IMAGE_BYTES) continue;
      const buffer = await readFile(absolutePath);
      if (!extensionFromBuffer(buffer)) continue;
      return { absolutePath, publicPath: `/images/menu/dishes/${slug}.${extension}`, extension };
    } catch {
      // Continue to the next extension.
    }
  }
  return null;
}

async function writePhoto(slug, downloaded) {
  const filename = `${slug}.${downloaded.extension}`;
  const absolutePath = path.join(outputDir, filename);
  const tempPath = `${absolutePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, downloaded.buffer);
  assertPhotoBuffer(await readFile(tempPath), filename);
  await unlink(absolutePath).catch(() => {});
  await rename(tempPath, absolutePath);
  return { absolutePath, publicPath: `/images/menu/dishes/${filename}`, extension: downloaded.extension };
}

async function resolveRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID).lean();
    if (!restaurant) fail(`missing restaurant ${DEMO_RESTAURANT_ID}`);
    return restaurant;
  }
  const restaurant = await Restaurant.findOne({ name: PRIMARY_RESTAURANT_NAME, status: "active" }).lean();
  if (!restaurant) fail(`missing restaurant ${PRIMARY_RESTAURANT_NAME}`);
  return restaurant;
}

export async function materializeDefenseMenuRealPhotosReliable() {
  await mkdir(outputDir, { recursive: true });
  const restaurant = await resolveRestaurant();
  const attribution = [];

  for (const dish of DISH_DEFS) {
    const slug = slugify(`${dish.code}-${dish.name}`);
    let stored = !REFRESH ? await findCachedPhoto(slug) : null;
    let sourceUrl = "existing-cache";

    if (!stored) {
      const group = photoGroupForDish(dish);
      sourceUrl = PEXELS_BY_GROUP[group] || PEXELS_BY_GROUP.vietnamese;
      const downloaded = await fetchWithRetry(sourceUrl);
      stored = await writePhoto(slug, downloaded);
    }

    const update = await MenuItem.updateOne(
      { restaurantId: restaurant._id, code: dish.code, notes: SEED_KEY, deletedAt: null },
      { $set: { thumbImage: stored.publicPath } }
    );
    const matchedCount = Number(update.matchedCount ?? update.n ?? 0);
    if (matchedCount !== 1) fail(`${dish.code} did not match exactly one seeded menu item`);

    attribution.push({
      code: dish.code,
      cachedPath: stored.publicPath,
      sourceImage: sourceUrl,
      sourcePage: sourceUrl === "existing-cache" ? null : "https://www.pexels.com/",
      sourceType: sourceUrl === "existing-cache" ? "existing-cache" : "pexels-direct",
      downloadedAt: sourceUrl === "existing-cache" ? null : new Date().toISOString()
    });
    console.log(`  ✓ ${dish.name}: ${stored.publicPath}`);
  }

  await writeFile(
    attributionPath,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      purpose: "Local graduation-defense dataset photographs",
      note: "Cached stock/reference photographs. Replace with restaurant-owned photography before commercial deployment.",
      items: attribution
    }, null, 2)}\n`,
    "utf8"
  );

  return { restaurantId: String(restaurant._id), materialized: attribution.length, directory: outputDir };
}

async function main() {
  assertDemoScriptAllowed("materializeDefenseMenuRealPhotosReliable.js");
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/RestaurantDB?replicaSet=rs0";
  const dbName = process.env.MONGO_DB || "RestaurantDB";
  console.log("Materializing reliable real menu photographs:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });
  try {
    const summary = await materializeDefenseMenuRealPhotosReliable();
    console.table([summary]);
    console.log(`✅ Reliable real menu photographs materialized: ${summary.materialized}/${DISH_DEFS.length}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (path.resolve(process.argv[1] || "") === scriptPath) {
  main().catch(async (error) => {
    console.error(error?.stack || error?.message || error);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
  });
}
