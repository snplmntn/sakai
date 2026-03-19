import { Router } from "express";
import * as communityQuestionController from "../controllers/community-question.controller.js";
import * as communitySubmissionController from "../controllers/community-submission.controller.js";
import { authenticateRequest } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createCommunityAnswerSchema,
  createCommunityQuestionSchema
} from "../schemas/community-question.schema.js";
import { createCommunitySubmissionSchema } from "../schemas/community-submission.schema.js";

const router = Router();

// All routes in this file require authentication
router.use(authenticateRequest);

router.post(
  "/submissions",
  validate(createCommunitySubmissionSchema),
  communitySubmissionController.handleCreateSubmission
);

router.get("/submissions/mine", communitySubmissionController.handleGetMySubmissions);
router.post(
  "/questions",
  validate(createCommunityQuestionSchema),
  communityQuestionController.handleCreateQuestion
);
router.get("/questions/mine", communityQuestionController.handleGetMyQuestions);
router.get("/questions/recent", communityQuestionController.handleGetRecentQuestions);
router.get("/questions/:id", communityQuestionController.handleGetQuestionDetail);
router.post(
  "/questions/:id/answers",
  validate(createCommunityAnswerSchema),
  communityQuestionController.handleCreateAnswer
);

export default router;
