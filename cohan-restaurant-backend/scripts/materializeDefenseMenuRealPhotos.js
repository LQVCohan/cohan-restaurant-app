import "dotenv/config.js";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";

import { MenuItem, Restaurant } from "../models/index.js";
import { DISH_DEFS, SEED_KEY } from "./seedDefenseMenuCatalog.js";
import {
  DEFENSE_MENU_REAL_PHOTOS,
  REAL_MENU_PHOTO_DIRECTORY,
  getDefenseMenuPhotoSource,
  isManagedRealMenuPhotoPath,
  validateDefenseMenuPhotoCatalog,
} from "./data/defenseMenuRealPhotos.js";
import { assertDemoScriptAllowed, safeDbInfo } from "./lib/scriptSafety.js";

const scriptPath = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptsDir, "../..");
const outputDir = path.join(repoRoot, "public", "images", "menu", "dishes");
const attributionPath = path.join(outputDir, "attribution.json");
const PRIMARY_RESTAURANT_NAME = "Nhà hàng COHAN Thủ Đức";
const DEMO_RESTAURANT_ID = process.env.DEMO_RESTAURANT_ID?.trim() || "";
const REFRESH = String(process.env.DEFENSE_MENU_PHOTO_REFRESH || "").toLowerCase() === "true";
const MIN_IMAGE_BYTES = 8_000;
const MAX_IMAGE_BYTES = 18 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const SUPPORTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const USER_AGENT =
  "COHAN-Restaurant-Defense-Seed/2.0 (menu photo materializer; local development dataset)";

const idString = (value) => String(value?._id || value?.id || value || "");

function fail(message) {
  throw new Error(`DEFENSE_MENU_PHOTO_FAILED: ${message}`);
}

function extensionFromBuffer(buffer) {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function assertPhotoBuffer(buffer, label) {
  if (!Buffer.isBuffer(buffer)) fail(`${label} did not return binary image data`);
  if (buffer.length < MIN_IMAGE_BYTES) {
    fail(`${label} is too small (${buffer.length} bytes)`);
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    fail(`${label} is too large (${buffer.length} bytes)`);
  }
  const extension = extensionFromBuffer(buffer);
  if (!extension) fail(`${label} is not a supported raster photograph`);
  return extension;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "image/avif,image/webp,image/jpeg,image/png,application/json;q=0.9,*/*;q=0.5",
        ...(options.headers || {}),
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveWikipediaCandidate(candidate) {
  const lang = String(candidate.lang || "en").trim().toLowerCase();
  const title = String(candidate.title || "").trim();
  if (!title) throw new Error("Wikipedia title is empty");

  const api = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  api.searchParams.set("action", "query");
  api.searchParams.set("format", "json");
  api.searchParams.set("formatversion", "2");
  api.searchParams.set("prop", "pageimages");
  api.searchParams.set("piprop", "thumbnail|original");
  api.searchParams.set("pithumbsize", "1400");
  api.searchParams.set("titles", title);
  api.searchParams.set("origin", "*");

  const response = await fetchWithTimeout(api, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Wikipedia API ${response.status}`);
  }
  const payload = await response.json();
  const page = payload?.query?.pages?.[0];
  const imageUrl = page?.thumbnail?.source || page?.original?.source;
  if (page?.missing || !imageUrl) {
    throw new Error(`Wikipedia page has no raster lead image: ${lang}:${title}`);
  }

  return {
    imageUrl,
    sourcePage: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(
      title.replaceAll(" ", "_"),
    )}`,
    sourceLabel: `Wikipedia ${lang}:${title}`,
  };
}

async function resolveSource(source) {
  if (source?.type === "wikipedia") return resolveWikipediaCandidate(source);
  if (source?.type === "url" && source.url) {
    return {
      imageUrl: source.url,
      sourcePage: source.sourcePage || source.url,
      sourceLabel: source.sourcePage || source.url,
    };
  }
  throw new Error("Unsupported menu photo source");
}

async function downloadRasterPhoto(source) {
  const resolved = await resolveSource(source);
  const response = await fetchWithTimeout(resolved.imageUrl);
  if (!response.ok) {
    throw new Error(`${resolved.sourceLabel} returned HTTP ${response.status}`);
  }
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/") || contentType.includes("svg")) {
    throw new Error(`${resolved.sourceLabel} returned ${contentType || "unknown content"}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = assertPhotoBuffer(buffer, resolved.sourceLabel);
  return { ...resolved, buffer, extension };
}

async function findCachedPhoto(slug) {
  for (const extension of SUPPORTED_EXTENSIONS) {
    const absolutePath = path.join(outputDir, `${slug}.${extension}`);
    try {
      const details = await stat(absolutePath);
      if (!details.isFile() || details.size < MIN_IMAGE_BYTES) continue;
      const buffer = await readFile(absolutePath);
      if (!extensionFromBuffer(buffer)) continue;
      return {
        absolutePath,
        publicPath: `${REAL_MENU_PHOTO_DIRECTORY}${slug}.${extension}`,
        extension,
      };
    } catch {
      // Try the next supported extension.
    }
  }
  return null;
}

async function removeOtherSlugFiles(slug, keepPath) {
  const entries = await readdir(outputDir).catch(() => []);
  for (const filename of entries) {
    if (!filename.startsWith(`${slug}.`)) continue;
    const absolutePath = path.join(outputDir, filename);
    if (absolutePath === keepPath) continue;
    await unlink(absolutePath).catch(() => {});
  }
}

async function writePhotoAtomically(entry, downloaded) {
  const filename = `${entry.slug}.${downloaded.extension}`;
  const absolutePath = path.join(outputDir, filename);
  const tempPath = `${absolutePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, downloaded.buffer);
  const written = await readFile(tempPath);
  assertPhotoBuffer(written, `${entry.code} cached photo`);
  await rename(tempPath, absolutePath);
  await removeOtherSlugFiles(entry.slug, absolutePath);
  return {
    absolutePath,
    publicPath: `${REAL_MENU_PHOTO_DIRECTORY}${filename}`,
    extension: downloaded.extension,
  };
}

async function materializeOne(entry, previousAttribution) {
  if (!REFRESH) {
    const cached = await findCachedPhoto(entry.slug);
    if (cached) {
      return {
        ...cached,
        attribution: previousAttribution || {
          code: entry.code,
          cachedPath: cached.publicPath,
          sourcePage: null,
          sourceImage: null,
          sourceType: "existing-cache",
        },
      };
    }
  }

  const attempts = [...entry.candidates, entry.fallback];
  const errors = [];
  for (const source of attempts) {
    try {
      const downloaded = await downloadRasterPhoto(source);
      const stored = await writePhotoAtomically(entry, downloaded);
      return {
        ...stored,
        attribution: {
          code: entry.code,
          cachedPath: stored.publicPath,
          sourcePage: downloaded.sourcePage,
          sourceImage: downloaded.imageUrl,
          sourceType: source.type,
          downloadedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  fail(`${entry.code} could not obtain a real photograph: ${errors.join(" | ")}`);
}

async function loadAttribution() {
  try {
    const parsed = JSON.parse(await readFile(attributionPath, "utf8"));
    return new Map((parsed?.items || []).map((item) => [item.code, item]));
  } catch {
    return new Map();
  }
}

async function resolveRestaurant() {
  if (DEMO_RESTAURANT_ID) {
    const restaurant = await Restaurant.findById(DEMO_RESTAURANT_ID).lean();
    if (!restaurant) fail(`missing restaurant ${DEMO_RESTAURANT_ID}`);
    return restaurant;
  }
  const restaurant = await Restaurant.findOne({
    name: PRIMARY_RESTAURANT_NAME,
    status: "active",
  }).lean();
  if (!restaurant) fail(`missing restaurant ${PRIMARY_RESTAURANT_NAME}`);
  return restaurant;
}

export async function materializeDefenseMenuRealPhotos() {
  const expectedCodes = DISH_DEFS.map((dish) => dish.code);
  const catalogSummary = validateDefenseMenuPhotoCatalog(expectedCodes);
  await mkdir(outputDir, { recursive: true });
  const previousAttribution = await loadAttribution();
  const materialized = [];

  for (const dish of DISH_DEFS) {
    const entry = getDefenseMenuPhotoSource(dish.code);
    if (!entry) fail(`missing photo source for ${dish.code}`);
    const result = await materializeOne(entry, previousAttribution.get(dish.code));
    if (!isManagedRealMenuPhotoPath(result.publicPath)) {
      fail(`${dish.code} produced an unmanaged photo path`);
    }
    materialized.push({ entry, ...result });
    console.log(`  ✓ ${dish.name}: ${result.publicPath}`);
  }

  const restaurant = await resolveRestaurant();
  for (const result of materialized) {
    const update = await MenuItem.updateOne(
      {
        restaurantId: restaurant._id,
        code: result.entry.code,
        notes: SEED_KEY,
        deletedAt: null,
      },
      { $set: { thumbImage: result.publicPath } },
    );
    if (Number(update.matchedCount || 0) !== 1) {
      fail(`${result.entry.code} did not match exactly one seeded menu item`);
    }
  }

  const attribution = {
    generatedAt: new Date().toISOString(),
    purpose: "Local graduation-defense dataset photographs",
    note:
      "These cached stock/reference photographs are for local demonstration. Replace them with restaurant-owned photography before commercial deployment.",
    items: materialized.map((result) => result.attribution),
  };
  await writeFile(attributionPath, `${JSON.stringify(attribution, null, 2)}\n`, "utf8");

  return {
    ...catalogSummary,
    restaurantId: idString(restaurant._id),
    materialized: materialized.length,
    directory: outputDir,
  };
}

async function main() {
  assertDemoScriptAllowed("materializeDefenseMenuRealPhotos.js");
  const mongoUri =
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/RestaurantDB?replicaSet=rs0";
  const dbName = process.env.MONGO_DB || "RestaurantDB";

  console.log("Materializing real menu photographs:", safeDbInfo());
  await mongoose.connect(mongoUri, { dbName });
  try {
    const summary = await materializeDefenseMenuRealPhotos();
    console.table([summary]);
    console.log(`✅ Real menu photographs materialized: ${summary.materialized}/${summary.photos}`);
  } finally {
    await mongoose.disconnect();
  }
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(scriptPath).href;

if (isMain) {
  main().catch(async (error) => {
    console.error(error?.stack || error?.message || error);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    process.exitCode = 1;
  });
}
