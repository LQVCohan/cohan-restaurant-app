import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { PrintSetting, Restaurant } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

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

const PRINT_JOB_LIMIT = 300;
const SUPPORTED_JOB_STATUSES = new Set([
  "pending",
  "printing",
  "completed",
  "failed",
  "cancelled",
]);
const SUPPORTED_PRINTER_STATUSES = new Set(["offline", "configured", "online"]);

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
    const key = String(row?.key || "").trim();
    if (!key) continue;
    byKey.set(key, {
      key,
      name: String(row.name || key).trim() || key,
      enabled: Boolean(row.enabled),
      content: row.content != null ? String(row.content) : "",
      updatedAt: row.updatedAt || toIsoNow(),
    });
  }

  for (const template of DEFAULT_TEMPLATES) {
    if (!byKey.has(template.key)) {
      byKey.set(template.key, { ...template, updatedAt: toIsoNow() });
    }
  }

  return Array.from(byKey.values());
}

function normalizePrinters(printers) {
  const list = Array.isArray(printers) ? printers : [];
  const byId = new Map();

  for (const printer of list) {
    const id = String(printer?.id || "").trim();
    const name = String(printer?.name || "").trim();
    if (!id || !name) continue;
    const candidateStatus = String(printer?.status || "offline").toLowerCase();
    byId.set(id, {
      id,
      name,
      ip: printer.ip ? String(printer.ip).trim() : "",
      type: printer.type ? String(printer.type) : "thermal",
      location: printer.location ? String(printer.location) : "kitchen",
      status: SUPPORTED_PRINTER_STATUSES.has(candidateStatus)
        ? candidateStatus
        : "offline",
      lastError: printer.lastError ? String(printer.lastError) : "",
      updatedAt: printer.updatedAt || toIsoNow(),
    });
  }

  return Array.from(byId.values());
}

function normalizeJobs(jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  return list
    .filter((job) => job?.id && job?.printType)
    .map((job) => ({
      id: String(job.id),
      orderId: job.orderId ? String(job.orderId) : null,
      printerId: job.printerId ? String(job.printerId) : null,
      printerName: job.printerName ? String(job.printerName) : null,
      stationId: job.stationId ? String(job.stationId) : null,
      stationType: job.stationType ? String(job.stationType) : null,
      printType: String(job.printType),
      templateKey: job.templateKey ? String(job.templateKey) : null,
      status: job.status ? String(job.status).toLowerCase() : "pending",
      error: job.error ? String(job.error) : null,
      retryCount: Number(job.retryCount || 0),
      items: Array.isArray(job.items) ? job.items : [],
      payload: job.payload || null,
      printedAt: job.printedAt || null,
      createdAt: job.createdAt || toIsoNow(),
      updatedAt: job.updatedAt || toIsoNow(),
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function normalizeStations(stations, printers = []) {
  if (!stations || typeof stations !== "object" || Array.isArray(stations)) return {};
  const printerIds = new Set(normalizePrinters(printers).map((printer) => printer.id));
  return Object.entries(stations).reduce((acc, [stationId, value]) => {
    const ids = Array.isArray(value) ? value : [];
    acc[String(stationId)] = Array.from(
      new Set(ids.map((id) => String(id)).filter((id) => printerIds.has(id))),
    );
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

async function assertRestaurantPermission(ctx, restaurantId, permissionCode) {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw badInput("Invalid restaurantId");
  }
  await requireRestaurantPermission(ctx, restaurantId, permissionCode);
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

function findJob(doc, jobId) {
  const id = String(jobId || "");
  return (Array.isArray(doc?.jobs) ? doc.jobs : []).find(
    (job) => String(job?.id || "") === id,
  ) || null;
}

function getNormalizedJob(doc, jobId) {
  return normalizeJobs(doc?.jobs).find((job) => job.id === String(jobId)) || null;
}

async function appendJob(printSettingId, job) {
  await PrintSetting.updateOne(
    { _id: printSettingId },
    {
      $push: {
        jobs: {
          $each: [job],
          $position: 0,
          $slice: PRINT_JOB_LIMIT,
        },
      },
      $set: { updatedAt: new Date() },
    },
  );
}

export const Query = {
  async printSettings(_, { restaurantId }, ctx) {
    await assertRestaurantPermission(ctx, restaurantId, PERMISSIONS.PRINT_READ);
    const doc = await findOrCreatePrintSetting(restaurantId);
    return toPrintSettingView(doc);
  },
};

export const Mutation = {
  async upsertPrintSettings(_, { input }, ctx) {
    const { restaurantId } = input || {};
    await assertRestaurantPermission(ctx, restaurantId, PERMISSIONS.PRINT_WRITE);
    const doc = await findOrCreatePrintSetting(restaurantId);
    const hasPrinters = Object.prototype.hasOwnProperty.call(input || {}, "printers");
    const hasStations = Object.prototype.hasOwnProperty.call(input || {}, "stations");
    const hasTemplates = Object.prototype.hasOwnProperty.call(input || {}, "templates");

    const normalizedPrinters = hasPrinters
      ? normalizePrinters(input?.printers)
      : normalizePrinters(doc.printers);
    const normalizedStations = hasStations
      ? normalizeStations(input?.stations, normalizedPrinters)
      : normalizeStations(doc.stations, normalizedPrinters);
    const normalizedTemplates = hasTemplates
      ? normalizeTemplates(input?.templates)
      : normalizeTemplates(doc.templates);

    const now = new Date();
    const updated = await PrintSetting.findOneAndUpdate(
      { restaurantId },
      {
        $set: {
          restaurantId,
          printers: normalizedPrinters,
          stations: normalizedStations,
          templates: normalizedTemplates,
          updatedAt: now,
        },
        $setOnInsert: {
          jobs: [],
          createdAt: now,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return toPrintSettingView(updated);
  },

  async enqueuePrintJob(_, { input }, ctx) {
    const {
      restaurantId,
      printerId,
      stationId,
      printType,
      templateKey,
      payload,
    } = input || {};
    const normalizedPrintType = String(printType || "").trim();
    if (!normalizedPrintType) throw badInput("printType is required");
    await assertRestaurantPermission(ctx, restaurantId, PERMISSIONS.PRINT_WRITE);

    const doc = await findOrCreatePrintSetting(restaurantId);
    const printers = normalizePrinters(doc.printers);
    const stations = normalizeStations(doc.stations, printers);
    const requestedStationId = stationId ? String(stationId) : null;
    const requestedPrinterId = printerId
      ? String(printerId)
      : requestedStationId
        ? stations[requestedStationId]?.[0]
        : null;
    const targetPrinter = printers.find((printer) => printer.id === requestedPrinterId);
    if (!targetPrinter) throw badInput("Configured printer not found");

    const normalizedTemplateKey = templateKey ? String(templateKey) : null;
    if (normalizedTemplateKey) {
      const template = normalizeTemplates(doc.templates).find(
        (item) => item.key === normalizedTemplateKey,
      );
      if (!template) throw badInput("Print template not found");
      if (!template.enabled) throw badInput("Print template is disabled");
    }

    if (
      requestedStationId
      && normalizedPrintType !== "manual_test"
      && !(stations[requestedStationId] || []).includes(targetPrinter.id)
    ) {
      throw badInput("Printer is not assigned to this station");
    }

    const createdAt = toIsoNow();
    const unavailable = targetPrinter.status === "offline";
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      printerId: targetPrinter.id,
      printerName: targetPrinter.name,
      stationId: requestedStationId || targetPrinter.location || null,
      printType: normalizedPrintType,
      templateKey: normalizedTemplateKey,
      status: unavailable ? "failed" : "pending",
      error: unavailable ? "Printer is not configured or available" : null,
      retryCount: 0,
      payload: payload || null,
      createdAt,
      updatedAt: createdAt,
    };

    await appendJob(doc._id, job);
    return job;
  },

  async retryPrintJob(_, { input }, ctx) {
    const { restaurantId, jobId } = input || {};
    await assertRestaurantPermission(ctx, restaurantId, PERMISSIONS.PRINT_WRITE);
    const doc = await findOrCreatePrintSetting(restaurantId);
    const current = findJob(doc, jobId);
    if (!current) throw notFound("Print job not found");
    if (String(current.status || "").toLowerCase() !== "failed") {
      throw badInput("Only failed print jobs can be retried");
    }

    const updatedAt = toIsoNow();
    const updatedDoc = await PrintSetting.findOneAndUpdate(
      {
        _id: doc._id,
        jobs: { $elemMatch: { id: String(jobId), status: "failed" } },
      },
      {
        $set: {
          "jobs.$.status": "pending",
          "jobs.$.error": null,
          "jobs.$.printedAt": null,
          "jobs.$.updatedAt": updatedAt,
          updatedAt: new Date(),
        },
        $inc: { "jobs.$.retryCount": 1 },
      },
      { new: true },
    ).lean();
    if (!updatedDoc) throw badInput("Print job is no longer failed");

    return getNormalizedJob(updatedDoc, jobId);
  },

  async updatePrintJobStatus(_, { input }, ctx) {
    const { restaurantId, jobId, status, error } = input || {};
    await assertRestaurantPermission(ctx, restaurantId, PERMISSIONS.PRINT_WRITE);
    const normalizedStatus = String(status || "").trim().toLowerCase();
    if (!SUPPORTED_JOB_STATUSES.has(normalizedStatus)) {
      throw badInput("Unsupported print job status");
    }

    const doc = await findOrCreatePrintSetting(restaurantId);
    if (!findJob(doc, jobId)) throw notFound("Print job not found");
    const updatedAt = toIsoNow();
    const setPayload = {
      "jobs.$.status": normalizedStatus,
      "jobs.$.error": normalizedStatus === "failed" && error ? String(error) : null,
      "jobs.$.updatedAt": updatedAt,
      updatedAt: new Date(),
    };
    if (normalizedStatus === "completed") setPayload["jobs.$.printedAt"] = updatedAt;
    if (["pending", "printing"].includes(normalizedStatus)) {
      setPayload["jobs.$.printedAt"] = null;
    }

    const updatedDoc = await PrintSetting.findOneAndUpdate(
      { _id: doc._id, "jobs.id": String(jobId) },
      { $set: setPayload },
      { new: true },
    ).lean();
    if (!updatedDoc) throw notFound("Print job not found");

    return getNormalizedJob(updatedDoc, jobId);
  },

  async testPrint(_, { input }, ctx) {
    const {
      restaurantId,
      printerId,
      draftName,
      draftIp,
      draftType,
      draftLocation,
    } = input || {};
    await assertRestaurantPermission(ctx, restaurantId, PERMISSIONS.PRINT_WRITE);

    const doc = await findOrCreatePrintSetting(restaurantId);
    const printers = normalizePrinters(doc.printers);
    const target = printers.find((printer) => printer.id === String(printerId));
    if (!target) throw notFound("Printer not found");

    const effectivePrinter = {
      ...target,
      name: draftName != null ? String(draftName).trim() : target.name,
      ip: draftIp != null ? String(draftIp).trim() : target.ip,
      type: draftType != null ? String(draftType) : target.type,
      location: draftLocation != null ? String(draftLocation) : target.location,
    };
    const configured = Boolean(effectivePrinter.name && effectivePrinter.ip);
    const createdAt = toIsoNow();
    const job = {
      id: `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
      printerId: effectivePrinter.id,
      printerName: effectivePrinter.name,
      stationId: effectivePrinter.location || null,
      printType: "test",
      templateKey: "receipt",
      status: configured ? "completed" : "failed",
      error: configured ? null : "Simulated configuration check failed: missing name or IP",
      retryCount: 0,
      payload: {
        label: "Configuration check",
        simulated: true,
        checkMode: "required_fields_only_draft_aware",
        source: draftIp != null || draftName != null || draftType != null || draftLocation != null
          ? "draft_payload"
          : "persisted_printer",
        hardwareHandshake: false,
      },
      createdAt,
      updatedAt: createdAt,
    };

    const updated = await PrintSetting.findOneAndUpdate(
      { _id: doc._id, "printers.id": effectivePrinter.id },
      {
        $set: {
          "printers.$.status": configured ? "configured" : "offline",
          "printers.$.lastError": configured ? "" : "Missing printer name or IP",
          "printers.$.updatedAt": createdAt,
          updatedAt: new Date(),
        },
        $push: {
          jobs: {
            $each: [job],
            $position: 0,
            $slice: PRINT_JOB_LIMIT,
          },
        },
      },
      { new: true },
    ).lean();
    if (!updated) throw notFound("Printer not found");

    return job;
  },
};

export const __testables = {
  normalizeJobs,
  normalizePrinters,
  normalizeStations,
};
