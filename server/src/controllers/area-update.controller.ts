import type { RequestHandler } from "express";

import * as areaUpdateModel from "../models/area-update.model.js";
import { HttpError } from "../types/http-error.js";
import { syncMmdaAlerts } from "../services/mmda-alert.service.js";
import { listRelevantAreaUpdates } from "../services/route-incident.service.js";

export const listAreaUpdates: RequestHandler = async (req, res) => {
  const limit = Number(req.query.limit);
  const area = typeof req.query.area === "string" ? req.query.area : undefined;
  const updates = await areaUpdateModel.listAreaUpdates({
    area,
    limit
  });

  res.status(200).json({
    success: true,
    data: updates
  });
};

export const refreshAreaUpdates: RequestHandler = async (req, res) => {
  const sourceUrls = Array.isArray(req.body?.sourceUrls)
    ? req.body.sourceUrls
    : undefined;
  const { scrapedAlerts, savedAlerts } = await syncMmdaAlerts({
    sourceUrls
  });

  if (scrapedAlerts.length === 0) {
    throw new HttpError(
      502,
      "No MMDA alerts were found from the configured sources"
    );
  }
  res.status(200).json({
    success: true,
    data: savedAlerts
  });
};

export const listRelevantRouteAreaUpdates: RequestHandler = async (req, res) => {
  const data = await listRelevantAreaUpdates({
    corridorTags: Array.isArray(req.body?.corridorTags)
      ? req.body.corridorTags.filter((value: unknown): value is string => typeof value === "string")
      : [],
    originLabel: typeof req.body?.originLabel === "string" ? req.body.originLabel : "",
    destinationLabel:
      typeof req.body?.destinationLabel === "string" ? req.body.destinationLabel : "",
    limit: typeof req.body?.limit === "number" ? req.body.limit : undefined
  });

  res.status(200).json({
    success: true,
    data
  });
};
