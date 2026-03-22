import "dotenv/config";

import app from "./app.js";
import { getEnv } from "./config/env.js";
import * as transitGraphModel from "./models/transit-graph.model.js";
import {
  startMmdaRefreshScheduler,
  stopMmdaRefreshScheduler
} from "./services/mmda-refresh-scheduler.js";

const { PORT } = getEnv();

const logTransitCoverageOnStartup = async () => {
  try {
    const coverage = await transitGraphModel.getTransitGraphCoverage();

    if (coverage.stopCount === 0 || coverage.edgeCount === 0) {
      console.warn("Transit graph coverage is incomplete on startup", {
        operation: "transit_graph_coverage_startup",
        stopCount: coverage.stopCount,
        edgeCount: coverage.edgeCount
      });
    }
  } catch (error) {
    console.warn("Unable to verify transit graph coverage on startup", {
      operation: "transit_graph_coverage_startup",
      reason: error instanceof Error ? error.message : "unknown error"
    });
  }
};

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
  startMmdaRefreshScheduler();
  void logTransitCoverageOnStartup();
});

const shutdown = () => {
  stopMmdaRefreshScheduler();
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
