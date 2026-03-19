import "dotenv/config";

import app from "./app.js";
import { getEnv } from "./config/env.js";
import {
  startMmdaRefreshScheduler,
  stopMmdaRefreshScheduler
} from "./services/mmda-refresh-scheduler.js";

const { PORT } = getEnv();

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  startMmdaRefreshScheduler();
});

const shutdown = () => {
  stopMmdaRefreshScheduler();
  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
