import { Router } from "express";

import * as userPreferenceController from "../controllers/user-preference.controller.js";
import { authenticateRequest } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { upsertUserPreferenceSchema } from "../schemas/user-preference.schema.js";

const router = Router();

router.use(authenticateRequest);

router.get("/preferences", userPreferenceController.getUserPreferences);
router.put(
  "/preferences",
  validate(upsertUserPreferenceSchema),
  userPreferenceController.upsertUserPreferences
);

export default router;
