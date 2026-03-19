import { Router } from "express";

import * as placeController from "../controllers/place.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { placeSearchQuerySchema } from "../schemas/place.schema.js";

const router = Router();

router.get("/search", validate(placeSearchQuerySchema, "query"), placeController.searchPlaces);

export default router;
