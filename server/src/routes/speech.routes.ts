import { Router } from "express";

import * as speechController from "../controllers/speech.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { speechTranscriptionSchema } from "../schemas/speech.schema.js";

const router = Router();

router.post("/transcribe", validate(speechTranscriptionSchema), speechController.transcribeSpeech);

export default router;

