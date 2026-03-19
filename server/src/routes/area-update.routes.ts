import { Router } from "express";

import * as areaUpdateController from "../controllers/area-update.controller.js";
import { authenticateRequest } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  areaUpdatesQuerySchema,
  refreshAreaUpdatesSchema
} from "../schemas/area-update.schema.js";

const router = Router();

router.get("/", validate(areaUpdatesQuerySchema, "query"), areaUpdateController.listAreaUpdates);
router.post(
  "/refresh",
  authenticateRequest,
  validate(refreshAreaUpdatesSchema),
  areaUpdateController.refreshAreaUpdates
);

export default router;
