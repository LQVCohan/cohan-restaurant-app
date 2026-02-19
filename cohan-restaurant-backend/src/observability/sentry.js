let sentryInstance = null;

export async function initBackendSentry(logger) {
  if (sentryInstance || !process.env.SENTRY_DSN_BACKEND) return sentryInstance;

  try {
    const sentryModule = await import("@sentry/node");
    sentryModule.init({
      dsn: process.env.SENTRY_DSN_BACKEND,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.2),
    });

    sentryInstance = sentryModule;
  } catch (error) {
    logger?.warn(
      { err: error },
      "Sentry SDK not installed, fallback to application logs"
    );
  }

  return sentryInstance;
}
