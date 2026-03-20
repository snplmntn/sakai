import { Router } from "express";

import * as userPreferenceController from "../controllers/user-preference.controller.js";
import * as userSavedPlaceController from "../controllers/user-saved-place.controller.js";
import { authenticateRequest } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  savedPlaceParamsSchema,
  upsertSavedPlaceSchema
} from "../schemas/saved-place.schema.js";
import { upsertUserPreferenceSchema } from "../schemas/user-preference.schema.js";

const router = Router();

router.use(authenticateRequest);

router.get("/preferences", userPreferenceController.getUserPreferences);
router.put(
  "/preferences",
  validate(upsertUserPreferenceSchema),
  userPreferenceController.upsertUserPreferences
);
router.get("/saved-places", userSavedPlaceController.listUserSavedPlaces);
router.post(
  "/saved-places",
  validate(upsertSavedPlaceSchema),
  userSavedPlaceController.createUserSavedPlace
);
router.put(
  "/saved-places/:savedPlaceId",
  validate(savedPlaceParamsSchema, "params"),
  validate(upsertSavedPlaceSchema),
  userSavedPlaceController.updateUserSavedPlace
);
router.delete(
  "/saved-places/:savedPlaceId",
  validate(savedPlaceParamsSchema, "params"),
  userSavedPlaceController.deleteUserSavedPlace
);

export default router;
