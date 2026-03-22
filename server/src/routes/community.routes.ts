import { Router } from "express";
import * as communityQuestionController from "../controllers/community-question.controller.js";
import * as communityReviewController from "../controllers/community-review.controller.js";
import * as communitySubmissionController from "../controllers/community-submission.controller.js";
import { authenticateRequest, requireReviewerRole } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  createCommunityAnswerSchema,
  createCommunityQuestionSchema
} from "../schemas/community-question.schema.js";
import {
  approveCommunityProposalSchema,
  promoteCommunityAnswerSchema,
  rejectCommunityProposalSchema
} from "../schemas/community-review.schema.js";
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
router.get("/review/queue", requireReviewerRole, communityReviewController.handleGetReviewQueue);
router.get("/review/proposals/:id", requireReviewerRole, communityReviewController.handleGetProposalDetail);
router.post(
  "/review/proposals/:id/ai-draft",
  requireReviewerRole,
  communityReviewController.handleGenerateProposalAiDraft
);
router.post(
  "/questions/:questionId/answers/:answerId/ai-draft",
  requireReviewerRole,
  communityReviewController.handleGenerateAnswerAiDraft
);
router.post(
  "/questions/:questionId/answers/:answerId/promote",
  requireReviewerRole,
  validate(promoteCommunityAnswerSchema),
  communityReviewController.handlePromoteAnswer
);
router.post(
  "/review/proposals/:id/approve",
  requireReviewerRole,
  validate(approveCommunityProposalSchema),
  communityReviewController.handleApproveProposal
);
router.post(
  "/review/proposals/:id/reject",
  requireReviewerRole,
  validate(rejectCommunityProposalSchema),
  communityReviewController.handleRejectProposal
);

export default router;
