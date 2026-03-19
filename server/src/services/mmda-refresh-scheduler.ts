import { getEnv } from "../config/env.js";
import { syncMmdaAlerts } from "./mmda-alert.service.js";

const MIN_REFRESH_INTERVAL_MINUTES = 1;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let isRefreshRunning = false;

const runMmdaRefresh = async () => {
  if (isRefreshRunning) {
    console.info("Skipping MMDA refresh because a previous run is still in progress");
    return;
  }

  isRefreshRunning = true;

  try {
    const { scrapedAlerts, savedAlerts } = await syncMmdaAlerts();

    if (scrapedAlerts.length === 0) {
      console.warn("MMDA refresh finished without any alerts");
      return;
    }

    if (scrapedAlerts.length !== savedAlerts.length) {
      console.warn("MMDA refresh saved fewer alerts than scraped", {
        operation: "auto_mmda_refresh",
        alertsFound: scrapedAlerts.length,
        alertsSaved: savedAlerts.length
      });
    }

    console.info("MMDA refresh completed", {
      alertsFound: scrapedAlerts.length,
      alertsSaved: savedAlerts.length
    });
  } catch (error) {
    console.warn("MMDA refresh failed", {
      operation: "auto_mmda_refresh",
      reason: error instanceof Error ? error.message : "unknown error"
    });
  } finally {
    isRefreshRunning = false;
  }
};

export const startMmdaRefreshScheduler = () => {
  const { MMDA_REFRESH_ENABLED, MMDA_REFRESH_INTERVAL_MINUTES, NODE_ENV } = getEnv();

  if (!MMDA_REFRESH_ENABLED || schedulerTimer) {
    return;
  }

  const intervalMinutes = Math.max(
    MMDA_REFRESH_INTERVAL_MINUTES,
    MIN_REFRESH_INTERVAL_MINUTES
  );
  const intervalMs = intervalMinutes * 60_000;

  schedulerTimer = setInterval(() => {
    void runMmdaRefresh();
  }, intervalMs);

  console.info("MMDA refresh scheduler started", {
    intervalMinutes,
    environment: NODE_ENV
  });

  void runMmdaRefresh();
};

export const stopMmdaRefreshScheduler = () => {
  if (!schedulerTimer) {
    return;
  }

  clearInterval(schedulerTimer);
  schedulerTimer = null;
};
