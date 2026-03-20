import { getEnv } from "../config/env.js";

export interface GeometryCoordinate {
  latitude: number;
  longitude: number;
}

type ORSProfile = "driving-car" | "foot-walking";

const geometryCache = new Map<string, GeometryCoordinate[] | null>();

const toCoordinateKey = (coordinate: GeometryCoordinate) =>
  `${coordinate.latitude.toFixed(6)},${coordinate.longitude.toFixed(6)}`;

const buildCacheKey = (profile: ORSProfile, coordinates: GeometryCoordinate[]) =>
  `${profile}:${coordinates.map(toCoordinateKey).join("|")}`;

const dedupeCoordinates = (coordinates: GeometryCoordinate[]) => {
  const deduped: GeometryCoordinate[] = [];

  for (const coordinate of coordinates) {
    const previousCoordinate = deduped.at(-1);

    if (
      previousCoordinate &&
      previousCoordinate.latitude === coordinate.latitude &&
      previousCoordinate.longitude === coordinate.longitude
    ) {
      continue;
    }

    deduped.push(coordinate);
  }

  return deduped;
};

const getApiKey = () => getEnv().ORS_API_KEY?.trim() ?? "";

export const buildFallbackGeometry = (
  coordinates: GeometryCoordinate[]
): GeometryCoordinate[] | undefined => {
  const dedupedCoordinates = dedupeCoordinates(coordinates);

  return dedupedCoordinates.length >= 2 ? dedupedCoordinates : undefined;
};

export const fetchORSGeometry = async (input: {
  profile: ORSProfile;
  coordinates: GeometryCoordinate[];
}): Promise<GeometryCoordinate[] | null> => {
  const apiKey = getApiKey();
  const fallbackGeometry = buildFallbackGeometry(input.coordinates);

  if (!apiKey || !fallbackGeometry) {
    return null;
  }

  const cacheKey = buildCacheKey(input.profile, fallbackGeometry);

  if (geometryCache.has(cacheKey)) {
    return geometryCache.get(cacheKey) ?? null;
  }

  try {
    const response = await fetch(
      `https://api.openrouteservice.org/v2/directions/${input.profile}/geojson`,
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          coordinates: fallbackGeometry.map((coordinate) => [
            coordinate.longitude,
            coordinate.latitude
          ])
        })
      }
    );

    if (!response.ok) {
      geometryCache.set(cacheKey, null);
      return null;
    }

    const payload = (await response.json()) as {
      features?: Array<{
        geometry?: {
          type?: string;
          coordinates?: unknown;
        };
      }>;
    };
    const coordinates = payload.features?.[0]?.geometry?.coordinates;

    if (
      payload.features?.[0]?.geometry?.type !== "LineString" ||
      !Array.isArray(coordinates)
    ) {
      geometryCache.set(cacheKey, null);
      return null;
    }

    const normalizedCoordinates = coordinates.flatMap((coordinate) => {
      if (
        !Array.isArray(coordinate) ||
        typeof coordinate[0] !== "number" ||
        typeof coordinate[1] !== "number"
      ) {
        return [];
      }

      return [
        {
          latitude: coordinate[1],
          longitude: coordinate[0]
        }
      ];
    });

    const geometry =
      normalizedCoordinates.length >= 2 ? dedupeCoordinates(normalizedCoordinates) : null;

    geometryCache.set(cacheKey, geometry);
    return geometry;
  } catch {
    geometryCache.set(cacheKey, null);
    return null;
  }
};
