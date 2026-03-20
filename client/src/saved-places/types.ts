import { isRecord } from '../api/base';

export type SavedPlaceLabelPreset = 'home' | 'office' | 'school';
export type SavedPlaceLabelKind = 'preset' | 'custom';

export interface SavedPlace {
  id: string;
  userId: string;
  address: string;
  labelKind: SavedPlaceLabelKind;
  presetLabel: SavedPlaceLabelPreset | null;
  customLabel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavedPlaceUpsertInput {
  address: string;
  labelKind: SavedPlaceLabelKind;
  presetLabel?: SavedPlaceLabelPreset;
  customLabel?: string;
}

export const SAVED_PLACE_PRESET_OPTIONS: Array<{
  value: SavedPlaceLabelPreset;
  label: string;
}> = [
  { value: 'home', label: 'Home' },
  { value: 'office', label: 'Office' },
  { value: 'school', label: 'School' },
];

const parseString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected ${fieldName} to be a non-empty string`);
  }

  return value;
};

const parseNullableString = (value: unknown, fieldName: string): string | null => {
  if (value === null) {
    return null;
  }

  return parseString(value, fieldName);
};

export const isSavedPlaceLabelPreset = (
  value: unknown
): value is SavedPlaceLabelPreset =>
  value === 'home' || value === 'office' || value === 'school';

export const isSavedPlaceLabelKind = (value: unknown): value is SavedPlaceLabelKind =>
  value === 'preset' || value === 'custom';

export const parseSavedPlace = (value: unknown): SavedPlace => {
  if (!isRecord(value)) {
    throw new Error('Expected saved place to be an object');
  }

  if (!isSavedPlaceLabelKind(value.labelKind)) {
    throw new Error('Expected labelKind to be a valid saved place label kind');
  }

  const presetLabel = value.presetLabel ?? null;
  const customLabel = value.customLabel ?? null;

  if (presetLabel !== null && !isSavedPlaceLabelPreset(presetLabel)) {
    throw new Error('Expected presetLabel to be a valid saved place preset');
  }

  return {
    id: parseString(value.id, 'id'),
    userId: parseString(value.userId, 'userId'),
    address: parseString(value.address, 'address'),
    labelKind: value.labelKind,
    presetLabel,
    customLabel: parseNullableString(customLabel, 'customLabel'),
    createdAt: parseString(value.createdAt, 'createdAt'),
    updatedAt: parseString(value.updatedAt, 'updatedAt'),
  };
};

export const parseSavedPlaces = (value: unknown): SavedPlace[] => {
  if (!Array.isArray(value)) {
    throw new Error('Expected saved places to be an array');
  }

  return value.map(parseSavedPlace);
};

export const getSavedPlaceLabel = (savedPlace: SavedPlace): string => {
  if (savedPlace.labelKind === 'custom') {
    return savedPlace.customLabel ?? 'Saved place';
  }

  const matchingPreset = SAVED_PLACE_PRESET_OPTIONS.find(
    (option) => option.value === savedPlace.presetLabel
  );

  return matchingPreset?.label ?? 'Saved place';
};
