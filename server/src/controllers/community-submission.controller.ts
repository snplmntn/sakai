import type { Request, Response } from "express";
import { z } from "zod";

import { getAuthenticatedLocals } from "../middlewares/auth.middleware.js";
import * as communitySubmissionModel from "../models/community-submission.model.js";
import { createCommunitySubmissionSchema } from "../schemas/community-submission.schema.js";
import { HttpError } from "../types/http-error.js";

export const handleCreateSubmission = async (req: Request, res: Response) => {
  try {
    const { accessToken, user } = getAuthenticatedLocals(res);
    const submissionData = createCommunitySubmissionSchema.parse(req.body);

    const newSubmission = await communitySubmissionModel.createSubmission(
      { ...submissionData, userId: user.id },
      accessToken
    );

    res.status(201).json({ success: true, data: newSubmission });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid submission data", errors: error.issues });
    }
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create submission",
      error: error instanceof Error ? error.message : "unknown error"
    });
  }
};

const submissionStatusSchema = z.enum(["pending", "reviewed", "approved", "rejected"]);

export const handleGetMySubmissions = async (req: Request, res: Response) => {
  try {
    const { accessToken, user } = getAuthenticatedLocals(res);

    const statusQuery = req.query.status;
    let status: z.infer<typeof submissionStatusSchema> | undefined;
    if (typeof statusQuery === "string") {
      status = submissionStatusSchema.parse(statusQuery);
    } else if (Array.isArray(statusQuery)) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["status"],
          message: "Status must be a single string value"
        }
      ]);
    }

    const submissions = await communitySubmissionModel.findSubmissionsByUserId(
      user.id,
      accessToken,
      status
    );

    res.status(200).json({ success: true, data: submissions });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status query parameter", errors: error.issues });
    }
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({
      success: false,
      message: "Failed to get submissions",
      error: error instanceof Error ? error.message : "unknown error"
    });
  }
};
