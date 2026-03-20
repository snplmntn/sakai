import type { RequestHandler } from "express";

import * as speechService from "../services/speech.service.js";

export const transcribeSpeech: RequestHandler = async (req, res) => {
  const result = await speechService.transcribeSpeech(req.body);

  res.status(200).json({
    success: true,
    data: result
  });
};

