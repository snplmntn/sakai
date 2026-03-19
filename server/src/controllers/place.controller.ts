import type { RequestHandler } from "express";

import * as placeModel from "../models/place.model.js";

export const searchPlaces: RequestHandler = async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const limit =
    typeof req.query.limit === "number"
      ? req.query.limit
      : typeof req.query.limit === "string"
        ? Number(req.query.limit)
        : undefined;
  const results = await placeModel.searchPlaces(query, {
    limit
  });

  res.status(200).json({
    success: true,
    data: results
  });
};
