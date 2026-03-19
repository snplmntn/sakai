import { getSupabaseAdminClient } from "../config/supabase.js";
import { HttpError } from "../types/http-error.js";
import {
  mapStop,
  type Coordinates,
  type NearbyStop,
  type Stop,
  type StopMode
} from "../types/route-network.js";
import type { Database } from "../types/database.js";

type StopRow = Database["public"]["Tables"]["stops"]["Row"];

export interface FindNearestStopsOptions {
  coordinates: Coordinates;
  limit: number;
  modes?: StopMode[];
}

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceMeters = (origin: Coordinates, destination: Coordinates) => {
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
};

const sortNearbyStops = (stops: NearbyStop[]) =>
  [...stops].sort(
    (left, right) =>
      left.distanceMeters - right.distanceMeters ||
      left.stopName.localeCompare(right.stopName) ||
      left.id.localeCompare(right.id)
  );

export const listStopsByPlaceId = async (placeId: string): Promise<Stop[]> => {
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("stops")
    .select("*")
    .eq("place_id", placeId)
    .eq("is_active", true);

  if (error) {
    throw new HttpError(500, `Failed to fetch stops: ${error.message}`);
  }

  return ((data ?? []) as StopRow[])
    .map(mapStop)
    .sort((left, right) => left.stopName.localeCompare(right.stopName) || left.id.localeCompare(right.id));
};

export const getStopsByIds = async (stopIds: string[]): Promise<Stop[]> => {
  if (stopIds.length === 0) {
    return [];
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client.from("stops").select("*").in("id", [...new Set(stopIds)]);

  if (error) {
    throw new HttpError(500, `Failed to fetch stops by id: ${error.message}`);
  }

  return ((data ?? []) as StopRow[])
    .map(mapStop)
    .sort((left, right) => left.stopName.localeCompare(right.stopName) || left.id.localeCompare(right.id));
};

export const findNearestStops = async (
  options: FindNearestStopsOptions
): Promise<NearbyStop[]> => {
  const client = getSupabaseAdminClient();
  let query = client.from("stops").select("*").eq("is_active", true);

  if (options.modes && options.modes.length > 0) {
    query = query.in("mode", [...new Set(options.modes)]);
  }

  const { data, error } = await query;

  if (error) {
    throw new HttpError(500, `Failed to search stops: ${error.message}`);
  }

  const nearbyStops = ((data ?? []) as StopRow[]).map((row) => {
    const stop = mapStop(row);

    return {
      ...stop,
      distanceMeters: calculateDistanceMeters(options.coordinates, {
        latitude: stop.latitude,
        longitude: stop.longitude
      })
    };
  });

  return sortNearbyStops(nearbyStops).slice(0, options.limit);
};
