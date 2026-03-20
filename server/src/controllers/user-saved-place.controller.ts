import type { RequestHandler } from "express";

import { getAuthenticatedLocals } from "../middlewares/auth.middleware.js";
import * as userSavedPlaceModel from "../models/user-saved-place.model.js";

const readSavedPlaceId = (value: string | string[]): string =>
  Array.isArray(value) ? value[0] ?? "" : value;

export const listUserSavedPlaces: RequestHandler = async (_req, res) => {
  const { accessToken, user } = getAuthenticatedLocals(res);
  const savedPlaces = await userSavedPlaceModel.listUserSavedPlaces(user.id, accessToken);

  res.status(200).json({
    success: true,
    data: savedPlaces
  });
};

export const createUserSavedPlace: RequestHandler = async (req, res) => {
  const { accessToken, user } = getAuthenticatedLocals(res);
  const savedPlace = await userSavedPlaceModel.createUserSavedPlace(
    {
      userId: user.id,
      address: req.body.address,
      labelKind: req.body.labelKind,
      presetLabel: req.body.presetLabel ?? null,
      customLabel: req.body.customLabel ?? null
    },
    accessToken
  );

  res.status(201).json({
    success: true,
    data: savedPlace
  });
};

export const updateUserSavedPlace: RequestHandler = async (req, res) => {
  const { accessToken, user } = getAuthenticatedLocals(res);
  const savedPlace = await userSavedPlaceModel.updateUserSavedPlace(
    {
      userId: user.id,
      savedPlaceId: readSavedPlaceId(req.params.savedPlaceId),
      address: req.body.address,
      labelKind: req.body.labelKind,
      presetLabel: req.body.presetLabel ?? null,
      customLabel: req.body.customLabel ?? null
    },
    accessToken
  );

  res.status(200).json({
    success: true,
    data: savedPlace
  });
};

export const deleteUserSavedPlace: RequestHandler = async (req, res) => {
  const { accessToken, user } = getAuthenticatedLocals(res);
  await userSavedPlaceModel.deleteUserSavedPlace(
    {
      userId: user.id,
      savedPlaceId: readSavedPlaceId(req.params.savedPlaceId)
    },
    accessToken
  );

  res.status(204).send();
};
