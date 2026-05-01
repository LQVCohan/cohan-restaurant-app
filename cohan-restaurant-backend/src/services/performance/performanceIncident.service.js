import { PerformanceIncident } from "../../../models/index.js";

export function buildIncidentUniqueKey(sourceType, sourceId, eventType) {
  return `${String(sourceType || "")}:${String(sourceId || "")}:${String(eventType || "")}`;
}

export async function createPerformanceIncident(input) {
  return PerformanceIncident.create({
    ...input,
    uniqueKey:
      input.uniqueKey ||
      buildIncidentUniqueKey(input.sourceType, input.sourceId, input.eventType),
    scoreDelta: Number(input.scoreDelta || 0),
  });
}

export async function createPerformanceIncidentOnce(input, uniqueKeyParts) {
  const uniqueKey = Array.isArray(uniqueKeyParts)
    ? uniqueKeyParts.join(":")
    : buildIncidentUniqueKey(input.sourceType, input.sourceId, input.eventType);
  return PerformanceIncident.findOneAndUpdate(
    { uniqueKey },
    {
      $setOnInsert: {
        ...input,
        uniqueKey,
        scoreDelta: Number(input.scoreDelta || 0),
      },
    },
    { new: true, upsert: true },
  );
}

export async function listPerformanceIncidents(filter = {}) {
  const query = {};
  const keys = ["restaurantId", "employeeId", "sourceType", "eventType", "responsibilityStatus", "scoreImpactStatus"];
  keys.forEach((k) => {
    if (filter[k]) query[k] = filter[k];
  });
  if (filter.fromDate || filter.toDate) {
    query.occurredAt = {};
    if (filter.fromDate) query.occurredAt.$gte = new Date(filter.fromDate);
    if (filter.toDate) query.occurredAt.$lte = new Date(filter.toDate);
  }
  return PerformanceIncident.find(query).sort({ occurredAt: -1 });
}
