import type { RequestHandler } from "express";

import { getAuthenticatedLocals } from "../middlewares/auth.middleware.js";
import * as userPreferenceModel from "../models/user-preference.model.js";

const DEFAULT_ROUTE_PREFERENCE: userPreferenceModel.RoutePreference = "balanced";
const DEFAULT_PASSENGER_TYPE: userPreferenceModel.PassengerType = "regular";

const buildDefaultUserPreference = (userId: string) => ({
  userId,
  defaultPreference: DEFAULT_ROUTE_PREFERENCE,
  passengerType: DEFAULT_PASSENGER_TYPE,
  isPersisted: false,
  createdAt: null,
  updatedAt: null
});

export const getUserPreferences: RequestHandler = async (_req, res) => {
  const { user } = getAuthenticatedLocals(res);
  const preferences = await userPreferenceModel.getUserPreferenceByUserId(user.id);

  res.status(200).json({
    success: true,
    data: preferences
      ? {
          ...preferences,
          isPersisted: true
        }
      : buildDefaultUserPreference(user.id)
  });
};

export const upsertUserPreferences: RequestHandler = async (req, res) => {
  const { user } = getAuthenticatedLocals(res);
  const preferences = await userPreferenceModel.upsertUserPreference({
    userId: user.id,
    defaultPreference: req.body.defaultPreference,
    passengerType: req.body.passengerType
  });

  res.status(200).json({
    success: true,
    data: {
      ...preferences,
      isPersisted: true
    }
  });
};
