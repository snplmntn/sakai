import type { Request, Response } from "express";
import { z } from "zod";

import * as communityReviewModel from "../models/community-review.model.js";
import { getAuthenticatedLocals } from "../middlewares/auth.middleware.js";
import {
  approveCommunityProposalSchema,
  generateCommunityAiDraftSchema,
  promoteCommunityAnswerSchema,
  rejectCommunityProposalSchema,
  reviewQueueFilterSchema
} from "../schemas/community-review.schema.js";
import { HttpError } from "../types/http-error.js";

const messageFromError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const getStringParam = (value: string | string[] | undefined): string =>
  typeof value === "string" ? value : "";

export const handleGetReviewQueue = async (req: Request, res: Response) => {
  try {
    const filters = reviewQueueFilterSchema.parse(req.query);
    const queue = await communityReviewModel.listReviewQueue(filters);

    res.status(200).json({ success: true, data: queue });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid review queue filters", errors: error.issues });
    }

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to fetch community review queue")
    });
  }
};

export const handleGetProposalDetail = async (req: Request, res: Response) => {
  try {
    const detail = await communityReviewModel.getProposalDetail(getStringParam(req.params.id));

    res.status(200).json({ success: true, data: detail });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to fetch community proposal detail")
    });
  }
};

export const handlePromoteAnswer = async (req: Request, res: Response) => {
  try {
    const { user } = getAuthenticatedLocals(res);
    const body = promoteCommunityAnswerSchema.parse(req.body);
    const proposal = await communityReviewModel.promoteAnswerToProposal({
      questionId: getStringParam(req.params.questionId),
      answerId: getStringParam(req.params.answerId),
      reviewerUserId: user.id,
      body
    });

    res.status(201).json({ success: true, data: proposal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid answer promotion payload", errors: error.issues });
    }

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to promote answer into route learning")
    });
  }
};

export const handleGenerateProposalAiDraft = async (req: Request, res: Response) => {
  try {
    const suggestion = await communityReviewModel.generateProposalAiDraft(getStringParam(req.params.id));

    res.status(200).json({ success: true, data: suggestion });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to generate proposal AI draft")
    });
  }
};

export const handleGenerateAnswerAiDraft = async (req: Request, res: Response) => {
  try {
    const body = generateCommunityAiDraftSchema.parse(req.body ?? {});
    const suggestion = await communityReviewModel.generateAnswerAiDraft({
      questionId: getStringParam(req.params.questionId),
      answerId: getStringParam(req.params.answerId),
      proposalTypeHint: body.proposalTypeHint,
      title: body.title,
      summary: body.summary
    });

    res.status(200).json({ success: true, data: suggestion });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid AI draft payload", errors: error.issues });
    }

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to generate answer AI draft")
    });
  }
};

export const handleApproveProposal = async (req: Request, res: Response) => {
  try {
    const { user } = getAuthenticatedLocals(res);
    const body = approveCommunityProposalSchema.parse(req.body);
    const detail = await communityReviewModel.approveProposal({
      proposalId: getStringParam(req.params.id),
      reviewerUserId: user.id,
      body
    });

    res.status(200).json({ success: true, data: detail });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid proposal approval payload", errors: error.issues });
    }

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to approve community proposal")
    });
  }
};

export const handleRejectProposal = async (req: Request, res: Response) => {
  try {
    const { user } = getAuthenticatedLocals(res);
    const body = rejectCommunityProposalSchema.parse(req.body);
    const detail = await communityReviewModel.rejectProposal({
      proposalId: getStringParam(req.params.id),
      reviewerUserId: user.id,
      body
    });

    res.status(200).json({ success: true, data: detail });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid proposal rejection payload", errors: error.issues });
    }

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to reject community proposal")
    });
  }
};
