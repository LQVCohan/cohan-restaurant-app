import { restoreExpiredMenuPriceEvents } from "../services/menuPriceEvent.service.js";

export const startMenuPriceEventJob = ({ logger = console, intervalMs = 60_000 } = {}) => {
  let running = false;

  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await restoreExpiredMenuPriceEvents({ logger });
      if (result.processedCount || result.failedCount) {
        logger?.info?.(
          {
            processed: result.processedCount,
            restoredVariants: result.restoredVariantCount,
            skippedVariants: result.skippedVariantCount,
            failed: result.failedCount,
          },
          "menu price restore sweep completed",
        );
      }
    } catch (error) {
      logger?.error?.({ error }, "menu price restore sweep failed");
    } finally {
      running = false;
    }
  };

  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  void run();

  return () => clearInterval(timer);
};
