import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Database } from "../src/types/database.js";

type RideMode = Database["public"]["Tables"]["routes"]["Row"]["primary_mode"];
type RouteTrustLevel = Database["public"]["Tables"]["routes"]["Row"]["trust_level"];
type PlaceKind = Database["public"]["Tables"]["places"]["Row"]["kind"];

interface CsvStopRow {
  externalStopCode: string;
  stopName: string;
  latitude: number;
  longitude: number;
  sequence: number;
}

interface ImportOptions {
  filePath: string;
  routeCode: string;
  routeName: string;
  variantCode: string;
  variantName: string;
  directionLabel: string;
  importBatch: string;
  sourceName: string;
  sourceUrl: string | null;
  operatorName: string | null;
  defaultCity: string;
  corridorTag: string;
  mode: RideMode;
  fareProductCode: string | null;
  trustLevel: RouteTrustLevel;
}

interface PlaceRecord {
  id: string;
  canonical_name: string;
  city: string;
}

interface StopRecord {
  id: string;
  external_stop_code: string | null;
}

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({
  path: path.resolve(serverDir, ".env")
});

const DEFAULT_FILE_PATH = path.resolve(serverDir, "..", "Ruta.csv");
const DEFAULT_ROUTE_CODE = "JEEP-ALABANG-PASAY";
const DEFAULT_DIRECTION_LABEL = "Alabang to Pasay";
const DEFAULT_IMPORT_BATCH = "ruta-csv-default";
const DEFAULT_ROUTE_NAME = "Alabang - Pasay";
const DEFAULT_VARIANT_CODE = `${DEFAULT_ROUTE_CODE}:OUTBOUND`;
const DEFAULT_VARIANT_NAME = "Alabang to Pasay via SLEX";
const DEFAULT_SOURCE_NAME = "csv_import";
const DEFAULT_CITY = "Metro Manila";
const DEFAULT_CORRIDOR_TAG = "alabang-pasay";
const DEFAULT_MODE: RideMode = "jeepney";
const DEFAULT_FARE_PRODUCT_CODE = "puj_traditional";
const DEFAULT_TRUST_LEVEL: RouteTrustLevel = "trusted_seed";
const EARTH_RADIUS_KM = 6371;
const DEFAULT_SPEED_KPH = 18;
const MIN_LEG_DURATION_MINUTES = 2;

const usage = `Usage:
  npm run import:route-csv -- --file ..\\Ruta.csv --route-code JEEP-ALABANG-PASAY

Options:
  --file <path>                CSV path. Defaults to Ruta.csv at the repo root.
  --route-code <code>          Logical route family code.
  --route-name <name>          Route display name.
  --variant-code <code>        Directional variant code.
  --variant-name <name>        Directional variant display name.
  --direction-label <label>    Rider-facing direction label.
  --import-batch <batch>       Raw import batch key for route_stop_import_rows.
  --source-name <name>         Import source label.
  --source-url <url>           Optional source URL.
  --operator-name <name>       Optional operator name.
  --city <city>                Default city/area for imported stops.
  --corridor-tag <tag>         Corridor tag stored on route legs.
  --mode <mode>                jeepney | uv | mrt3 | lrt1 | lrt2.
  --fare-product-code <code>   Fare product code for ride legs. Use "none" to store null.
  --trust-level <level>        trusted_seed | community_reviewed | demo_fallback.
`;

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseArgs = (argv: string[]): ImportOptions => {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];

    if (!part?.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = part.slice(2).split("=", 2);
    const nextValue = inlineValue ?? argv[index + 1];

    if (!rawKey) {
      continue;
    }

    if (inlineValue !== undefined) {
      values.set(rawKey, inlineValue);
      continue;
    }

    if (!nextValue || nextValue.startsWith("--")) {
      if (rawKey === "help") {
        values.set(rawKey, "true");
        continue;
      }

      throw new Error(`Missing value for --${rawKey}`);
    }

    values.set(rawKey, nextValue);
    index += 1;
  }

  if (values.has("help")) {
    console.log(usage);
    process.exit(0);
  }

  const routeCode = values.get("route-code")?.trim() || DEFAULT_ROUTE_CODE;
  const directionLabel =
    values.get("direction-label")?.trim() || DEFAULT_DIRECTION_LABEL;
  const routeName = values.get("route-name")?.trim() || DEFAULT_ROUTE_NAME;
  const variantCode =
    values.get("variant-code")?.trim() || `${routeCode}:OUTBOUND`;
  const mode = (values.get("mode")?.trim() || DEFAULT_MODE) as RideMode;
  const trustLevel = (values.get("trust-level")?.trim() ||
    DEFAULT_TRUST_LEVEL) as RouteTrustLevel;
  const fareProductCodeValue =
    values.get("fare-product-code")?.trim() ?? DEFAULT_FARE_PRODUCT_CODE;

  return {
    filePath: path.resolve(serverDir, values.get("file")?.trim() || DEFAULT_FILE_PATH),
    routeCode,
    routeName,
    variantCode,
    variantName:
      values.get("variant-name")?.trim() || directionLabel || DEFAULT_VARIANT_NAME,
    directionLabel,
    importBatch:
      values.get("import-batch")?.trim() ||
      `${toSlug(variantCode) || "route-import"}-${DEFAULT_IMPORT_BATCH}`,
    sourceName: values.get("source-name")?.trim() || DEFAULT_SOURCE_NAME,
    sourceUrl: values.get("source-url")?.trim() || null,
    operatorName: values.get("operator-name")?.trim() || null,
    defaultCity: values.get("city")?.trim() || DEFAULT_CITY,
    corridorTag:
      values.get("corridor-tag")?.trim() || toSlug(routeCode) || DEFAULT_CORRIDOR_TAG,
    mode,
    fareProductCode:
      fareProductCodeValue.toLowerCase() === "none" ? null : fareProductCodeValue,
    trustLevel
  };
};

const assertEnv = (name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} in server/.env`);
  }

  return value;
};

const parseCsv = async (filePath: string): Promise<CsvStopRow[]> => {
  const raw = await readFile(filePath, "utf8");
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one stop row");
  }

  const header = lines[0]?.split(",").map((part) => part.trim().toLowerCase()) ?? [];
  const expectedHeader = ["id", "name", "lat", "lng"];

  if (header.join(",") !== expectedHeader.join(",")) {
    throw new Error(`Expected CSV header ${expectedHeader.join(",")} but received ${header.join(",")}`);
  }

  return lines.slice(1).map((line, index) => {
    const [externalStopCode, stopName, latitudeText, longitudeText] = line
      .split(",")
      .map((part) => part.trim());
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);

    if (!externalStopCode || !stopName) {
      throw new Error(`Row ${index + 2} is missing id or name`);
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error(`Row ${index + 2} has invalid lat/lng values`);
    }

    return {
      externalStopCode,
      stopName,
      latitude,
      longitude,
      sequence: index + 1
    };
  });
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (from: CsvStopRow, to: CsvStopRow) => {
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const cosine =
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.cos(deltaLongitude) +
    Math.sin(fromLatitude) * Math.sin(toLatitude);
  const boundedCosine = Math.min(1, Math.max(-1, cosine));

  return Number((EARTH_RADIUS_KM * Math.acos(boundedCosine)).toFixed(2));
};

const calculateDurationMinutes = (distanceKm: number) =>
  Math.max(MIN_LEG_DURATION_MINUTES, Math.ceil((distanceKm / DEFAULT_SPEED_KPH) * 60));

const getPlaceKind = (
  sequence: number,
  totalStops: number
): PlaceKind => (sequence === 1 || sequence === totalStops ? "terminal" : "area");

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const rows = await parseCsv(options.filePath);
  const supabase = createClient<Database>(
    assertEnv("SUPABASE_URL"),
    assertEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const importRows: Database["public"]["Tables"]["route_stop_import_rows"]["Insert"][] = rows.map(
    (row) => ({
      import_batch: options.importBatch,
      route_code: options.routeCode,
      variant_code: options.variantCode,
      direction_label: options.directionLabel,
      sequence: row.sequence,
      external_stop_code: row.externalStopCode,
      stop_name: row.stopName,
      latitude: row.latitude,
      longitude: row.longitude,
      source_name: options.sourceName,
      source_url: options.sourceUrl
    })
  );

  const { error: importError } = await supabase
    .from("route_stop_import_rows")
    .upsert(importRows, {
      onConflict: "import_batch,variant_code,sequence"
    });

  if (importError) {
    throw new Error(`Failed to save route_stop_import_rows: ${importError.message}`);
  }

  const placeNames = [...new Set(rows.map((row) => row.stopName))];
  const { data: existingPlaces, error: existingPlacesError } = await supabase
    .from("places")
    .select("id, canonical_name, city")
    .in("canonical_name", placeNames);

  if (existingPlacesError) {
    throw new Error(`Failed to read places: ${existingPlacesError.message}`);
  }

  const placeKey = (canonicalName: string, city: string) =>
    `${canonicalName.toLowerCase()}::${city.toLowerCase()}`;
  const placeMap = new Map<string, PlaceRecord>();

  for (const place of existingPlaces ?? []) {
    placeMap.set(placeKey(place.canonical_name, place.city), place);
  }

  const missingPlaces = rows
    .filter((row) => !placeMap.has(placeKey(row.stopName, options.defaultCity)))
    .map((row, index, allRows) => ({
      canonical_name: row.stopName,
      city: options.defaultCity,
      kind: getPlaceKind(row.sequence, rows.length),
      latitude: row.latitude,
      longitude: row.longitude,
      google_place_id: null
    }));

  if (missingPlaces.length > 0) {
    const { data: insertedPlaces, error: insertPlacesError } = await supabase
      .from("places")
      .insert(missingPlaces)
      .select("id, canonical_name, city");

    if (insertPlacesError) {
      throw new Error(`Failed to insert places: ${insertPlacesError.message}`);
    }

    for (const place of insertedPlaces ?? []) {
      placeMap.set(placeKey(place.canonical_name, place.city), place);
    }
  }

  const stopCodes = rows.map((row) => row.externalStopCode);
  const { data: existingStops, error: existingStopsError } = await supabase
    .from("stops")
    .select("id, external_stop_code")
    .in("external_stop_code", stopCodes);

  if (existingStopsError) {
    throw new Error(`Failed to read stops: ${existingStopsError.message}`);
  }

  const existingStopMap = new Map<string, StopRecord>();

  for (const stop of existingStops ?? []) {
    if (stop.external_stop_code) {
      existingStopMap.set(stop.external_stop_code, stop);
    }
  }

  for (const row of rows) {
    const place = placeMap.get(placeKey(row.stopName, options.defaultCity));

    if (!place) {
      throw new Error(`Imported place not found for ${row.stopName}`);
    }

    const stopPayload: Database["public"]["Tables"]["stops"]["Insert"] = {
      place_id: place.id,
      external_stop_code: row.externalStopCode,
      stop_name: row.stopName,
      mode: options.mode,
      area: options.defaultCity,
      latitude: row.latitude,
      longitude: row.longitude,
      is_active: true
    };
    const existingStop = existingStopMap.get(row.externalStopCode);

    if (existingStop) {
      const { error: updateStopError } = await supabase
        .from("stops")
        .update(stopPayload)
        .eq("id", existingStop.id);

      if (updateStopError) {
        throw new Error(`Failed to update stop ${row.externalStopCode}: ${updateStopError.message}`);
      }

      continue;
    }

    const { data: insertedStops, error: insertStopError } = await supabase
      .from("stops")
      .insert(stopPayload)
      .select("id, external_stop_code");

    if (insertStopError) {
      throw new Error(`Failed to insert stop ${row.externalStopCode}: ${insertStopError.message}`);
    }

    const insertedStop = insertedStops?.[0];

    if (!insertedStop?.external_stop_code) {
      throw new Error(`Stop insert did not return an external_stop_code for ${row.externalStopCode}`);
    }

    existingStopMap.set(insertedStop.external_stop_code, insertedStop);
  }

  const { data: routeRows, error: routeError } = await supabase
    .from("routes")
    .upsert(
      {
        code: options.routeCode,
        display_name: options.routeName,
        primary_mode: options.mode,
        operator_name: options.operatorName,
        source_name: options.sourceName,
        source_url: options.sourceUrl,
        trust_level: options.trustLevel,
        is_active: true
      },
      {
        onConflict: "code"
      }
    )
    .select("id");

  if (routeError) {
    throw new Error(`Failed to upsert route: ${routeError.message}`);
  }

  const routeId = routeRows?.[0]?.id;

  if (!routeId) {
    throw new Error("Route upsert did not return an id");
  }

  const originPlace = placeMap.get(placeKey(rows[0]!.stopName, options.defaultCity));
  const destinationPlace = placeMap.get(
    placeKey(rows[rows.length - 1]!.stopName, options.defaultCity)
  );

  const { data: variantRows, error: variantError } = await supabase
    .from("route_variants")
    .upsert(
      {
        route_id: routeId,
        code: options.variantCode,
        display_name: options.variantName,
        direction_label: options.directionLabel,
        origin_place_id: originPlace?.id ?? null,
        destination_place_id: destinationPlace?.id ?? null,
        is_active: true
      },
      {
        onConflict: "code"
      }
    )
    .select("id");

  if (variantError) {
    throw new Error(`Failed to upsert route variant: ${variantError.message}`);
  }

  const routeVariantId = variantRows?.[0]?.id;

  if (!routeVariantId) {
    throw new Error("Route variant upsert did not return an id");
  }

  const { error: deleteLegsError } = await supabase
    .from("route_legs")
    .delete()
    .eq("route_variant_id", routeVariantId);

  if (deleteLegsError) {
    throw new Error(`Failed to clear old route legs: ${deleteLegsError.message}`);
  }

  const legRows: Database["public"]["Tables"]["route_legs"]["Insert"][] = rows
    .slice(1)
    .map((row, index) => {
      const previous = rows[index]!;
      const fromStop = existingStopMap.get(previous.externalStopCode);
      const toStop = existingStopMap.get(row.externalStopCode);

      if (!fromStop?.id || !toStop?.id) {
        throw new Error(
          `Missing normalized stops for leg ${previous.externalStopCode} -> ${row.externalStopCode}`
        );
      }

      const distanceKm = calculateDistanceKm(previous, row);

      return {
        route_variant_id: routeVariantId,
        sequence: index + 1,
        mode: options.mode,
        from_stop_id: fromStop.id,
        to_stop_id: toStop.id,
        route_label: `${previous.stopName} - ${row.stopName}`,
        distance_km: distanceKm,
        duration_minutes: calculateDurationMinutes(distanceKm),
        fare_product_code: options.fareProductCode,
        corridor_tag: options.corridorTag
      };
    });

  if (legRows.length > 0) {
    const { error: insertLegsError } = await supabase.from("route_legs").insert(legRows);

    if (insertLegsError) {
      throw new Error(`Failed to insert route legs: ${insertLegsError.message}`);
    }
  }

  console.log("Route CSV import complete", {
    filePath: options.filePath,
    routeCode: options.routeCode,
    variantCode: options.variantCode,
    importBatch: options.importBatch,
    stopCount: rows.length,
    legCount: legRows.length
  });
};

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Route CSV import failed unexpectedly"
  );
  process.exit(1);
});
