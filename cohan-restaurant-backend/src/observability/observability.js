import crypto from "node:crypto";
import mongoose from "mongoose";

const MAX_LATENCY_SAMPLES = Number(process.env.METRICS_MAX_SAMPLES || 2000);

const metricsState = {
  totalRequests: 0,
  totalErrors: 0,
  latenciesMs: [],
};

function pushLatency(ms) {
  metricsState.latenciesMs.push(ms);
  if (metricsState.latenciesMs.length > MAX_LATENCY_SAMPLES) {
    metricsState.latenciesMs.shift();
  }
}

function percentile(values, target) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(target * sorted.length) - 1;
  return Number(sorted[Math.max(rank, 0)].toFixed(2));
}

export async function checkDatabaseReadiness() {
  if (mongoose.connection.readyState !== 1) {
    return {
      ok: false,
      status: "disconnected",
      detail: "MongoDB connection is not in connected state",
    };
  }

  try {
    await mongoose.connection.db.admin().ping();
    return { ok: true, status: "connected" };
  } catch (error) {
    return { ok: false, status: "degraded", detail: error.message };
  }
}

export function registerObservability(app, { sentry } = {}) {
  app.addHook("onRequest", async (request, reply) => {
    const requestId =
      request.headers["x-request-id"] || request.id || crypto.randomUUID();
    const userIdHeader = request.headers["x-user-id"];

    request.requestId = String(requestId);
    request.userId = userIdHeader ? String(userIdHeader) : null;
    reply.header("x-request-id", request.requestId);

    request.log = request.log.child({
      requestId: request.requestId,
      userId: request.userId,
    });
  });

  app.addHook("onResponse", async (request, reply) => {
    const latencyMs = Number(reply.elapsedTime.toFixed(2));

    metricsState.totalRequests += 1;
    pushLatency(latencyMs);

    if (reply.statusCode >= 400) {
      metricsState.totalErrors += 1;
    }

    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        latencyMs,
      },
      "request_completed"
    );
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = error.statusCode || 500;
    const errorCode = error.code || (statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");

    if (sentry) {
      sentry.withScope((scope) => {
        scope.setTag("request_id", request.requestId || request.id);
        scope.setTag("error_code", errorCode);
        if (request.userId) {
          scope.setUser({ id: request.userId });
        }
        scope.setContext("http", {
          method: request.method,
          url: request.url,
          statusCode,
        });
        sentry.captureException(error);
      });
    }

    request.log.error(
      {
        err: error,
        errorCode,
        statusCode,
      },
      "request_failed"
    );

    reply.code(statusCode).send({
      ok: false,
      errorCode,
      message: statusCode >= 500 ? "Internal server error" : error.message,
    });
  });

  app.get("/health/live", async () => ({ ok: true, status: "live", ts: Date.now() }));

  app.get("/health/ready", async (_request, reply) => {
    const dbStatus = await checkDatabaseReadiness();

    if (!dbStatus.ok) {
      return reply.code(503).send({
        ok: false,
        status: "not_ready",
        dependencies: { db: dbStatus },
        ts: Date.now(),
      });
    }

    return reply.send({
      ok: true,
      status: "ready",
      dependencies: { db: dbStatus },
      ts: Date.now(),
    });
  });

  app.get("/metrics", async () => {
    const p95LatencyMs = percentile(metricsState.latenciesMs, 0.95);
    const errorRate =
      metricsState.totalRequests === 0
        ? 0
        : Number((metricsState.totalErrors / metricsState.totalRequests).toFixed(4));

    return {
      ok: true,
      requests: {
        total: metricsState.totalRequests,
        errors: metricsState.totalErrors,
        errorRate,
      },
      latency: {
        p95Ms: p95LatencyMs,
        samples: metricsState.latenciesMs.length,
      },
      db: {
        connected: mongoose.connection.readyState === 1,
        state: mongoose.connection.readyState,
      },
      ts: Date.now(),
    };
  });
}
