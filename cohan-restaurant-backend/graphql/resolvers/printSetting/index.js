import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { PrintSetting, Restaurant } from "../../../models/index.js";
import { requireRole } from "../../../utils/authz.js";

const DEFAULT_TEMPLATES = [
  {
    key: "kitchen",
    name: "Phiếu bếp",
    enabled: true,
    content: "[KITCHEN] {{orderCode}} - {{table}}",
  },
  {
    key: "bar",
    name: "Phiếu bar",
    enabled: true,
    content: "[BAR] {{orderCode}} - {{table}}",
  },
  {
    key: "receipt",
    name: "Hóa đơn",
    enabled: true,
    content: "[RECEIPT] {{orderCode}} - {{total}}",
  },
];

function badInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

function notFound(message = "Resource not found") {
  return new GraphQLError(message, { extensions: { code: "NOT_FOUND" } });
}

function toIsoNow() {
  return new Date().toISOString();
}

function normalizeTemplates(inputTemplates) {
  const safeInput = Array.isArray(inputTemplates) ? inputTemplates : [];
  const byKey = new Map();

  for (const row of safeInput) {
    if (!row?.key) continue;
    byKey.set(String(row.key), {
      key: String(row.key),
      name: String(row.name || row.key),
      enabled: Boolean(row.enabled),
      content: row.content != null ? String(row.content) : "",
      updatedAt: row.updatedAt || toIsoNow(),
    });
  }

  for (const t of DEFAULT_TEMPLATES) {
    if (!byKey.has(t.key)) {
      byKey.set(t.key, { ...t, updatedAt: toIsoNow() });
    }
  }

  return Array.from(byKey.values());
}

function normalizePrinters(printers) {
  const list = Array.isArray(printers) ? printers : [];
  return list
    .filter((p) => p?.id && p?.name)
    .map((p) => ({
      id: String(p.id),
      name: String(p.name),
      ip: p.ip ? String(p.ip) : "",
      type: p.type ? String(p.type) : "thermal",
      location: p.location ? String(p.location) : "kitchen",
      status: p.status ? String(p.status) : "offline",
      lastError: p.lastError ? String(p.lastError) : "",
      updatedAt: p.updatedAt || toIsoNow(),
    }));
}

function normalizeJobs(jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  return list
    .filter((j) => j?.id && j?.printType)
    .map((j) => ({
      id: String(j.id),
      printerId: j.printerId ? String(j.printerId) : null,
      printerName: j.printerName ? String(j.printerName) : null,
      stationId: j.stationId ? String(j.stationId) : null,
      printType: String(j.printType),
      templateKey: j.templateKey ? String(j.templateKey) : null,
      status: j.status ? String(j.status) : "pending",
      error: j.error ? String(j.error) : null,
      retryCount: Number(j.retryCount || 0),
      payload: j.payload || null,
      createdAt: j.createdAt || toIsoNow(),
      updatedAt: j.updatedAt || toIsoNow(),
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function normalizeStations(stations, printers = []) {
  if (!stations || typeof stations !== "object" || Array.isArray(stations)) return {};
  const printerIds = new Set(normalizePrinters(printers).map((p) => p.id));
  return Object.entries(stations).reduce((acc, [stationId, value]) => {
    const ids = Array.isArray(value) ? value : [];
    acc[String(stationId)] = Array.from(new Set(ids.map((id) => String(id)).filter((id) => printerIds.has(id))));
    return acc;
  }, {});
}

function toPrintSettingView(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    restaurantId: String(doc.restaurantId),
    printers: normalizePrinters(doc.printers),
    stations: normalizeStations(doc.stations, doc.printers),
    templates: normalizeTemplates(doc.templates),
    jobs: normalizeJobs(doc.jobs),
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

async function assertRestaurantAccess(user, restaurantId) {
  requireRole(user, ["admin", "manager"]);
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw badInput("Invalid restaurantId");
  }
  const restaurant = await Restaurant.findById(restaurantId).lean();
  if (!restaurant) throw notFound("Restaurant not found");
  return restaurant;
}

async function findOrCreatePrintSetting(restaurantId) {
  let doc = await PrintSetting.findOne({ restaurantId }).lean();
  if (!doc) {
    doc = await PrintSetting.create({
      restaurantId,
      printers: [],
      stations: {},
      templates: DEFAULT_TEMPLATES,
      jobs: [],
    });
    return doc.toObject();
  }
  return doc;
}

export const Query = {
  async printSettings(_, { restaurantId }, { user }) {
    await assertRestaurantAccess(user, restaurantId);
    const doc = await findOrCreatePrintSetting(restaurantId);
    return toPrintSettingView(doc);
  },
};

export const Mutation = {
  async upsertPrintSettings(_, { input }, { user }) {
    const {
      restaurantId,
      printers = [],
      stations = {},
      templates = DEFAULT_TEMPLATES,
    } = input || {};
    await assertRestaurantAccess(user, restaurantId);

    const now = new Date();
    const doc = await PrintSetting.findOneAndUpdate(
      { restaurantId },
      {
        $set: {
          restaurantId,
          printers: normalizePrinters(printers),
          stations: normalizeStations(stations, printers),
          templates: normalizeTemplates(templates),
          updatedAt: now,
        },
        $setOnInsert: {
          jobs: [],
          createdAt: now,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return toPrintSettingView(doc);
  },

  async enqueuePrintJob(_, { input }, { user }) {
    const { restaurantId, printerId, stationId, printType, templateKey, payload } = input || {};
    if (!printType) throw badInput("printType is required");
    await assertRestaurantAccess(user, restaurantId);

    const doc = await findOrCreatePrintSetting(restaurantId);
    const printers = normalizePrinters(doc.printers);
    const targetPrinter = printers.find((p) => p.id === printerId) || null;

    const id = `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const createdAt = toIsoNow();
    const isOffline = targetPrinter && targetPrinter.status === "offline";

    const job = {
      id,
      printerId: targetPrinter?.id || printerId || null,
      printerName: targetPrinter?.name || null,
      stationId: stationId || null,
      printType: String(printType),
      templateKey: templateKey || null,
      status: isOffline ? "failed" : "pending",
      error: isOffline ? "Printer offline" : null,
      retryCount: 0,
      payload: payload || null,
      createdAt,
      updatedAt: createdAt,
    };

    const nextJobs = [job, ...normalizeJobs(doc.jobs)].slice(0, 200);

    await PrintSetting.updateOne(
      { _id: doc._id },
      {
        $set: {
          jobs: nextJobs,
          updatedAt: new Date(),
        },
      }
    );

    return job;
  },

  async retryPrintJob(_, { input }, { user }) {
    const { restaurantId, jobId } = input || {};
    await assertRestaurantAccess(user, restaurantId);
    const doc = await findOrCreatePrintSetting(restaurantId);
    const jobs = normalizeJobs(doc.jobs);
    const index = jobs.findIndex((j) => j.id === String(jobId));
    if (index < 0) throw notFound("Print job not found");

    const current = jobs[index];
    const updated = {
      ...current,
      status: "pending",
      error: null,
      retryCount: Number(current.retryCount || 0) + 1,
      updatedAt: toIsoNow(),
    };

    jobs[index] = updated;
    await PrintSetting.updateOne(
      { _id: doc._id },
      {
        $set: {
          jobs,
          updatedAt: new Date(),
        },
      }
    );

    return updated;
  },

  async updatePrintJobStatus(_, { input }, { user }) {
    const { restaurantId, jobId, status, error } = input || {};
    await assertRestaurantAccess(user, restaurantId);
    if (!status) throw badInput("status is required");

    const doc = await findOrCreatePrintSetting(restaurantId);
    const jobs = normalizeJobs(doc.jobs);
    const index = jobs.findIndex((j) => j.id === String(jobId));
    if (index < 0) throw notFound("Print job not found");

    const updated = {
      ...jobs[index],
      status: String(status),
      error: error ? String(error) : null,
      updatedAt: toIsoNow(),
    };
    jobs[index] = updated;

    await PrintSetting.updateOne(
      { _id: doc._id },
      {
        $set: {
          jobs,
          updatedAt: new Date(),
        },
      }
    );

    return updated;
  },

  async testPrint(_, { input }, { user }) {
    const { restaurantId, printerId } = input || {};
    await assertRestaurantAccess(user, restaurantId);

    const doc = await findOrCreatePrintSetting(restaurantId);
    const printers = normalizePrinters(doc.printers);
    const targetIndex = printers.findIndex((p) => p.id === String(printerId));
    if (targetIndex < 0) throw notFound("Printer not found");

    const target = printers[targetIndex];
    const online = Boolean(target.ip);
    printers[targetIndex] = {
      ...target,
      status: online ? "online" : "offline",
      lastError: online ? "" : "Missing printer IP",
      updatedAt: toIsoNow(),
    };

    const createdAt = toIsoNow();
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      printerId: target.id,
      printerName: target.name,
      stationId: target.location || null,
      printType: "test",
      templateKey: "receipt",
      status: online ? "completed" : "failed",
      error: online ? null : "Simulated check failed: missing printer IP",
      retryCount: 0,
      payload: {
        label: "Test print",
        simulated: true,
        checkMode: "ip_presence_only",
        hardwareHandshake: false,
      },
      createdAt,
      updatedAt: createdAt,
    };

    const jobs = [job, ...normalizeJobs(doc.jobs)].slice(0, 200);

    await PrintSetting.updateOne(
      { _id: doc._id },
      {
        $set: {
          printers,
          jobs,
          updatedAt: new Date(),
        },
      }
    );

    return job;
  },
};
