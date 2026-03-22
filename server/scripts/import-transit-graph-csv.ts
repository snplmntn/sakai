import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Database } from "../src/types/database.js";

interface ImportOptions {
  nodesPath: string;
  edgesPath: string;
  chunkSize: number;
}

type TransitStopInsert = Database["public"]["Tables"]["transit_stops"]["Insert"];
type TransitEdgeInsert = Database["public"]["Tables"]["transit_stop_edges"]["Insert"];

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({
  path: path.resolve(serverDir, ".env")
});

const DEFAULT_NODES_PATH = path.resolve(serverDir, "..", "simulator", "nodes_supabase.csv");
const DEFAULT_EDGES_PATH = path.resolve(serverDir, "..", "simulator", "edges_supabase.csv");
const DEFAULT_CHUNK_SIZE = 500;

const usage = `Usage:
  npm run import:transit-graph -- --nodes ..\\simulator\\nodes_supabase.csv --edges ..\\simulator\\edges_supabase.csv

Options:
  --nodes <path>      CSV path for transit_stops rows.
  --edges <path>      CSV path for transit_stop_edges rows.
  --chunk <number>    Upsert chunk size (default: 500).
`;

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

  const chunkSizeValue = Number.parseInt(values.get("chunk") ?? `${DEFAULT_CHUNK_SIZE}`, 10);

  if (!Number.isFinite(chunkSizeValue) || chunkSizeValue <= 0) {
    throw new Error(`Invalid --chunk value: ${values.get("chunk") ?? "undefined"}`);
  }

  return {
    nodesPath: path.resolve(serverDir, values.get("nodes")?.trim() || DEFAULT_NODES_PATH),
    edgesPath: path.resolve(serverDir, values.get("edges")?.trim() || DEFAULT_EDGES_PATH),
    chunkSize: chunkSizeValue
  };
};

const assertEnv = (name: "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY") => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name} in server/.env`);
  }

  return value;
};

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = "";
  let index = 0;
  let inQuotes = false;

  while (index < line.length) {
    const char = line[index];

    if (char === "\"") {
      const nextChar = line[index + 1];

      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 2;
        continue;
      }

      inQuotes = !inQuotes;
      index += 1;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  values.push(current);
  return values.map((value) => value.trim());
};

const parseCsv = async (filePath: string) => {
  const raw = await readFile(filePath, "utf8");
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new Error(`CSV at ${filePath} must include a header and at least one row`);
  }

  const header = parseCsvLine(lines[0] ?? "").map((column) => column.toLowerCase());
  const rows = lines.slice(1).map(parseCsvLine);

  return {
    header,
    rows
  };
};

const toRowObject = (header: string[], values: string[]) => {
  const row: Record<string, string> = {};

  for (let index = 0; index < header.length; index += 1) {
    const key = header[index];

    if (!key) {
      continue;
    }

    row[key] = values[index] ?? "";
  }

  return row;
};

const parseNumber = (value: string, field: string) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric value for ${field}: ${value}`);
  }

  return parsed;
};

const parseBoolean = (value: string, field: string) => {
  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new Error(`Invalid boolean value for ${field}: ${value}`);
};

const toNullableString = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const ensureHeaders = (input: {
  header: string[];
  required: string[];
  filePath: string;
}) => {
  const missing = input.required.filter((column) => !input.header.includes(column));

  if (missing.length > 0) {
    throw new Error(
      `CSV ${input.filePath} is missing required columns: ${missing.join(", ")}`
    );
  }
};

const toTransitStopRows = (header: string[], rows: string[][]): TransitStopInsert[] =>
  rows.map((values, index) => {
    const row = toRowObject(header, values);
    const stopId = (row.stop_id ?? "").trim();

    if (!stopId) {
      throw new Error(`Missing stop_id at nodes row ${index + 2}`);
    }

    return {
      stop_id: stopId,
      stop_name: row.stop_name ?? "",
      normalized_name: row.normalized_name ?? "",
      lat: parseNumber(row.lat ?? "", `nodes[${index + 2}].lat`),
      lon: parseNumber(row.lon ?? "", `nodes[${index + 2}].lon`),
      mode: row.mode ?? "",
      line: row.line ?? "",
      all_modes: row.all_modes ?? "",
      all_lines: row.all_lines ?? "",
      is_multimodal: parseBoolean(row.is_multimodal ?? "", `nodes[${index + 2}].is_multimodal`),
      line_count: Math.trunc(parseNumber(row.line_count ?? "", `nodes[${index + 2}].line_count`))
    };
  });

const toTransitEdgeRows = (header: string[], rows: string[][]): TransitEdgeInsert[] =>
  rows.map((values, index) => {
    const row = toRowObject(header, values);
    const sourceStopId = (row.source_stop_id ?? "").trim();
    const targetStopId = (row.target_stop_id ?? "").trim();

    if (!sourceStopId) {
      throw new Error(`Missing source_stop_id at edges row ${index + 2}`);
    }

    if (!targetStopId) {
      throw new Error(`Missing target_stop_id at edges row ${index + 2}`);
    }

    return {
      source_stop_id: sourceStopId,
      target_stop_id: targetStopId,
      weight: parseNumber(row.weight ?? "", `edges[${index + 2}].weight`),
      mode: row.mode ?? "",
      line: row.line ?? "",
      route_short_name: toNullableString(row.route_short_name ?? ""),
      route_long_name: toNullableString(row.route_long_name ?? ""),
      transfer: parseBoolean(row.transfer ?? "", `edges[${index + 2}].transfer`),
      distance_meters: parseNumber(row.distance_meters ?? "", `edges[${index + 2}].distance_meters`),
      estimated_time_min: parseNumber(row.estimated_time_min ?? "", `edges[${index + 2}].estimated_time_min`),
      data_source: row.data_source ?? "unknown"
    };
  });

const chunkArray = <TValue>(values: TValue[], size: number) => {
  const chunks: TValue[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
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
  const nodesCsv = await parseCsv(options.nodesPath);
  const edgesCsv = await parseCsv(options.edgesPath);

  ensureHeaders({
    header: nodesCsv.header,
    required: [
      "stop_id",
      "stop_name",
      "normalized_name",
      "lat",
      "lon",
      "mode",
      "line",
      "all_modes",
      "all_lines",
      "is_multimodal",
      "line_count"
    ],
    filePath: options.nodesPath
  });
  ensureHeaders({
    header: edgesCsv.header,
    required: [
      "source_stop_id",
      "target_stop_id",
      "weight",
      "mode",
      "line",
      "route_short_name",
      "route_long_name",
      "transfer",
      "distance_meters",
      "estimated_time_min",
      "data_source"
    ],
    filePath: options.edgesPath
  });

  const stopRows = toTransitStopRows(nodesCsv.header, nodesCsv.rows);
  const edgeRows = toTransitEdgeRows(edgesCsv.header, edgesCsv.rows);

  for (const chunk of chunkArray(stopRows, options.chunkSize)) {
    const { error } = await supabase.from("transit_stops").upsert(chunk, {
      onConflict: "stop_id"
    });

    if (error) {
      throw new Error(`Failed to upsert transit stops: ${error.message}`);
    }
  }

  for (const chunk of chunkArray(edgeRows, options.chunkSize)) {
    const { error } = await supabase.from("transit_stop_edges").upsert(chunk, {
      onConflict: "source_stop_id,target_stop_id,line,mode,transfer"
    });

    if (error) {
      throw new Error(`Failed to upsert transit stop edges: ${error.message}`);
    }
  }

  console.log("Transit graph import complete", {
    nodesPath: options.nodesPath,
    edgesPath: options.edgesPath,
    importedStops: stopRows.length,
    importedEdges: edgeRows.length,
    chunkSize: options.chunkSize
  });
};

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Transit graph import failed unexpectedly"
  );
  process.exit(1);
});
