import { randomUUID } from "node:crypto";

import { getSupabaseAdminClient } from "../config/supabase.js";
import { HttpError } from "../types/http-error.js";
import * as authModel from "./auth.model.js";

export type SavedPlaceLabelKind = "preset" | "custom";
export type SavedPlaceLabelPreset = "home" | "office" | "school";

export interface UserSavedPlace {
  id: string;
  userId: string;
  address: string;
  labelKind: SavedPlaceLabelKind;
  presetLabel: SavedPlaceLabelPreset | null;
  customLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserSavedPlaceInput {
  userId: string;
  address: string;
  labelKind: SavedPlaceLabelKind;
  presetLabel: SavedPlaceLabelPreset | null;
  customLabel: string | null;
}

export interface UpdateUserSavedPlaceInput extends CreateUserSavedPlaceInput {
  savedPlaceId: string;
}

export interface DeleteUserSavedPlaceInput {
  userId: string;
  savedPlaceId: string;
}

interface SavedPlaceMetadataEntry {
  id: string;
  address: string;
  labelKind: SavedPlaceLabelKind;
  presetLabel: SavedPlaceLabelPreset | null;
  customLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

const SAVED_PLACES_METADATA_KEY = "saved_places";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSavedPlaceLabelKind = (value: unknown): value is SavedPlaceLabelKind =>
  value === "preset" || value === "custom";

const isSavedPlaceLabelPreset = (value: unknown): value is SavedPlaceLabelPreset =>
  value === "home" || value === "office" || value === "school";

const readSavedPlaceEntry = (value: unknown): SavedPlaceMetadataEntry | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.address !== "string" ||
    !isSavedPlaceLabelKind(value.labelKind) ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }

  const presetLabel =
    value.presetLabel === null || value.presetLabel === undefined
      ? null
      : isSavedPlaceLabelPreset(value.presetLabel)
        ? value.presetLabel
        : null;
  const customLabel =
    value.customLabel === null || value.customLabel === undefined
      ? null
      : typeof value.customLabel === "string"
        ? value.customLabel
        : null;

  return {
    id: value.id,
    address: value.address,
    labelKind: value.labelKind,
    presetLabel,
    customLabel,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
};

const readSavedPlacesFromMetadata = (
  userId: string,
  metadata: unknown
): UserSavedPlace[] => {
  if (!isRecord(metadata)) {
    return [];
  }

  const rawSavedPlaces = metadata[SAVED_PLACES_METADATA_KEY];

  if (!Array.isArray(rawSavedPlaces)) {
    return [];
  }

  return rawSavedPlaces
    .map(readSavedPlaceEntry)
    .flatMap((entry) =>
      entry
        ? [
            {
              id: entry.id,
              userId,
              address: entry.address,
              labelKind: entry.labelKind,
              presetLabel: entry.presetLabel,
              customLabel: entry.customLabel,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt
            }
          ]
        : []
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
};

const toMetadataEntries = (savedPlaces: UserSavedPlace[]): SavedPlaceMetadataEntry[] =>
  savedPlaces.map((savedPlace) => ({
    id: savedPlace.id,
    address: savedPlace.address,
    labelKind: savedPlace.labelKind,
    presetLabel: savedPlace.presetLabel,
    customLabel: savedPlace.customLabel,
    createdAt: savedPlace.createdAt,
    updatedAt: savedPlace.updatedAt
  }));

const assertPresetLabelAvailability = (
  savedPlaces: UserSavedPlace[],
  nextSavedPlace: Pick<UserSavedPlace, "id" | "labelKind" | "presetLabel">
) => {
  if (nextSavedPlace.labelKind !== "preset" || !nextSavedPlace.presetLabel) {
    return;
  }

  const hasDuplicatePreset = savedPlaces.some(
    (savedPlace) =>
      savedPlace.id !== nextSavedPlace.id &&
      savedPlace.labelKind === "preset" &&
      savedPlace.presetLabel === nextSavedPlace.presetLabel
  );

  if (hasDuplicatePreset) {
    throw new HttpError(409, "You can only keep one saved place for each preset label.");
  }
};

const persistSavedPlaces = async (
  userId: string,
  metadata: unknown,
  savedPlaces: UserSavedPlace[]
): Promise<void> => {
  const adminClient = getSupabaseAdminClient();
  const nextMetadata = {
    ...(isRecord(metadata) ? metadata : {}),
    [SAVED_PLACES_METADATA_KEY]: toMetadataEntries(savedPlaces)
  };
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    user_metadata: nextMetadata
  });

  if (error) {
    throw new HttpError(500, `Failed to save saved places: ${error.message}`);
  }
};

const toConstraintError = (error: unknown, fallbackMessage: string): HttpError => {
  if (error instanceof HttpError) {
    return error;
  }

  return new HttpError(
    500,
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallbackMessage
  );
};

export const listUserSavedPlaces = async (
  userId: string,
  accessToken: string
): Promise<UserSavedPlace[]> => {
  const user = await authModel.getCurrentUser(accessToken);

  return readSavedPlacesFromMetadata(userId, user.userMetadata);
};

export const createUserSavedPlace = async (
  payload: CreateUserSavedPlaceInput,
  accessToken: string
): Promise<UserSavedPlace> => {
  try {
    const user = await authModel.getCurrentUser(accessToken);
    const savedPlaces = readSavedPlacesFromMetadata(payload.userId, user.userMetadata);
    const timestamp = new Date().toISOString();
    const savedPlace: UserSavedPlace = {
      id: randomUUID(),
      userId: payload.userId,
      address: payload.address,
      labelKind: payload.labelKind,
      presetLabel: payload.presetLabel,
      customLabel: payload.customLabel,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    assertPresetLabelAvailability(savedPlaces, savedPlace);

    const nextSavedPlaces = [savedPlace, ...savedPlaces];

    await persistSavedPlaces(payload.userId, user.userMetadata, nextSavedPlaces);

    return savedPlace;
  } catch (error) {
    throw toConstraintError(error, "Failed to create saved place");
  }
};

export const updateUserSavedPlace = async (
  payload: UpdateUserSavedPlaceInput,
  accessToken: string
): Promise<UserSavedPlace> => {
  try {
    const user = await authModel.getCurrentUser(accessToken);
    const savedPlaces = readSavedPlacesFromMetadata(payload.userId, user.userMetadata);
    const existingSavedPlace = savedPlaces.find(
      (savedPlace) => savedPlace.id === payload.savedPlaceId
    );

    if (!existingSavedPlace) {
      throw new HttpError(404, "Saved place not found");
    }

    const nextSavedPlace: UserSavedPlace = {
      ...existingSavedPlace,
      address: payload.address,
      labelKind: payload.labelKind,
      presetLabel: payload.presetLabel,
      customLabel: payload.customLabel,
      updatedAt: new Date().toISOString()
    };

    assertPresetLabelAvailability(savedPlaces, nextSavedPlace);

    const nextSavedPlaces = savedPlaces.map((savedPlace) =>
      savedPlace.id === payload.savedPlaceId ? nextSavedPlace : savedPlace
    );

    await persistSavedPlaces(payload.userId, user.userMetadata, nextSavedPlaces);

    return nextSavedPlace;
  } catch (error) {
    throw toConstraintError(error, "Failed to update saved place");
  }
};

export const deleteUserSavedPlace = async (
  payload: DeleteUserSavedPlaceInput,
  accessToken: string
): Promise<void> => {
  const user = await authModel.getCurrentUser(accessToken);
  const savedPlaces = readSavedPlacesFromMetadata(payload.userId, user.userMetadata);
  const nextSavedPlaces = savedPlaces.filter(
    (savedPlace) => savedPlace.id !== payload.savedPlaceId
  );

  if (nextSavedPlaces.length === savedPlaces.length) {
    throw new HttpError(404, "Saved place not found");
  }

  await persistSavedPlaces(payload.userId, user.userMetadata, nextSavedPlaces);
};
