export async function initFrontendErrorTracking() {
  if (typeof window === "undefined") return;

  const dsn = import.meta.env.VITE_SENTRY_DSN_FRONTEND;

  if (dsn) {
    try {
      const sentryPackage = "@sentry/react";
      const Sentry = await import(/* @vite-ignore */ sentryPackage);
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: Number(
          import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.2
        ),
      });
      return;
    } catch (_error) {
      // fallback to browser-level handlers below
    }
  }

  window.addEventListener("error", (event) => {
    console.error("frontend_runtime_error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("frontend_unhandled_rejection", {
      reason: String(event.reason?.message || event.reason || "unknown"),
      stack: event.reason?.stack,
    });
  });
}
