import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { errorHandler } from "./middlewares/error.middleware.js";
import { notFoundHandler } from "./middlewares/not-found.middleware.js";
import apiRouter from "./routes/index.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[Incoming Request] ${req.method} ${req.url}`);
  next();
});

app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
