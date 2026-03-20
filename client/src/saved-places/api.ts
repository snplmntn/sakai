import { requestData, requestWithoutData } from '../api/base';
import {
  parseSavedPlace,
  parseSavedPlaces,
  type SavedPlace,
  type SavedPlaceUpsertInput,
} from './types';

export const getMySavedPlaces = async (accessToken: string): Promise<SavedPlace[]> =>
  requestData(
    {
      method: 'GET',
      path: '/api/me/saved-places',
      accessToken,
    },
    parseSavedPlaces
  );

export const createMySavedPlace = async (
  accessToken: string,
  input: SavedPlaceUpsertInput
): Promise<SavedPlace> =>
  requestData(
    {
      method: 'POST',
      path: '/api/me/saved-places',
      accessToken,
      body: input,
    },
    parseSavedPlace
  );

export const updateMySavedPlace = async (
  accessToken: string,
  savedPlaceId: string,
  input: SavedPlaceUpsertInput
): Promise<SavedPlace> =>
  requestData(
    {
      method: 'PUT',
      path: `/api/me/saved-places/${savedPlaceId}`,
      accessToken,
      body: input,
    },
    parseSavedPlace
  );

export const deleteMySavedPlace = async (
  accessToken: string,
  savedPlaceId: string
): Promise<void> =>
  requestWithoutData({
    method: 'DELETE',
    path: `/api/me/saved-places/${savedPlaceId}`,
    accessToken,
  });
