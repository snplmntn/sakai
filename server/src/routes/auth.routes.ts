import { Router } from "express";

import * as authController from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { emailPasswordAuthSchema, refreshSessionSchema } from "../schemas/auth.schema.js";

const router = Router();

router.post("/sign-up", validate(emailPasswordAuthSchema), authController.signUp);
router.post("/sign-in", validate(emailPasswordAuthSchema), authController.signIn);
router.post("/refresh", validate(refreshSessionSchema), authController.refreshSession);
router.post("/sign-out", authController.signOut);
router.get("/me", authController.getMe);
router.get("/google/start", authController.startGoogleSignIn);
router.get("/google/callback", authController.handleGoogleCallback);

export default router;
