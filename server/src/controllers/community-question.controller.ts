import type { Request, Response } from "express";
import { z } from "zod";

import { getAuthenticatedLocals } from "../middlewares/auth.middleware.js";
import * as communityQuestionModel from "../models/community-question.model.js";
import {
  createCommunityAnswerSchema,
  createCommunityQuestionSchema
} from "../schemas/community-question.schema.js";
import { HttpError } from "../types/http-error.js";

const messageFromError = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const getStringParam = (value: string | string[] | undefined): string =>
  typeof value === "string" ? value : "";

export const handleCreateQuestion = async (req: Request, res: Response) => {
  try {
    const { accessToken, user } = getAuthenticatedLocals(res);
    const body = createCommunityQuestionSchema.parse(req.body);
    const question = await communityQuestionModel.createQuestion(
      { ...body, userId: user.id },
      accessToken
    );

    res.status(201).json({ success: true, data: question });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid question data", errors: error.issues });
    }

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to create question")
    });
  }
};

export const handleGetMyQuestions = async (_req: Request, res: Response) => {
  try {
    const { accessToken, user } = getAuthenticatedLocals(res);
    const questions = await communityQuestionModel.listQuestionsByUserId(user.id, accessToken);

    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to fetch questions")
    });
  }
};

export const handleGetRecentQuestions = async (_req: Request, res: Response) => {
  try {
    const { accessToken } = getAuthenticatedLocals(res);
    const questions = await communityQuestionModel.listRecentQuestions(accessToken);

    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to fetch recent questions")
    });
  }
};

export const handleGetQuestionDetail = async (req: Request, res: Response) => {
  try {
    const { accessToken } = getAuthenticatedLocals(res);
    const detail = await communityQuestionModel.getQuestionDetail(
      getStringParam(req.params.id),
      accessToken
    );

    res.status(200).json({ success: true, data: detail });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to fetch question detail")
    });
  }
};

export const handleCreateAnswer = async (req: Request, res: Response) => {
  try {
    const { accessToken, user } = getAuthenticatedLocals(res);
    const body = createCommunityAnswerSchema.parse(req.body);
    const answer = await communityQuestionModel.createAnswer(
      getStringParam(req.params.id),
      { ...body, userId: user.id },
      accessToken
    );

    res.status(201).json({ success: true, data: answer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid answer data", errors: error.issues });
    }

    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    res.status(500).json({
      success: false,
      message: messageFromError(error, "Failed to create answer")
    });
  }
};
