import { Router } from "express";

import * as routeQueryController from "../controllers/route-query.controller.js";
import { authenticateOptionalRequest } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { routeQuerySchema } from "../schemas/route-query.schema.js";

const router = Router();

router.post("/query", authenticateOptionalRequest, validate(routeQuerySchema), routeQueryController.queryRoutes);

export default router;
