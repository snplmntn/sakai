import { getSupabaseAdminClient } from "../config/supabase.js";
import { HttpError } from "../types/http-error.js";
import type { Database } from "../types/database.js";

type AreaUpdateRow = Database["public"]["Tables"]["area_updates"]["Row"];
type AreaUpdateInsert = Database["public"]["Tables"]["area_updates"]["Insert"];

export interface AreaUpdate {
  id: string;
  externalId: string;
  source: string;
  sourceUrl: string;
  alertType: string;
  location: string;
  direction: string | null;
  involved: string | null;
  reportedTimeText: string | null;
  laneStatus: string | null;
  trafficStatus: string | null;
  rawText: string;
  scrapedAt: string;
  createdAt: string;
}

export interface ListAreaUpdatesOptions {
  area?: string;
  limit: number;
}

export interface UpsertAreaUpdateInput {
  externalId: string;
  source: string;
  sourceUrl: string;
  alertType: string;
  location: string;
  direction?: string | null;
  involved?: string | null;
  reportedTimeText?: string | null;
  laneStatus?: string | null;
  trafficStatus?: string | null;
  rawText: string;
  scrapedAt: string;
}

const mapAreaUpdate = (row: AreaUpdateRow): AreaUpdate => ({
  id: row.id,
  externalId: row.external_id,
  source: row.source,
  sourceUrl: row.source_url,
  alertType: row.alert_type,
  location: row.location,
  direction: row.direction,
  involved: row.involved,
  reportedTimeText: row.reported_time_text,
  laneStatus: row.lane_status,
  trafficStatus: row.traffic_status,
  rawText: row.raw_text,
  scrapedAt: row.scraped_at,
  createdAt: row.created_at
});

export const listAreaUpdates = async (
  options: ListAreaUpdatesOptions
): Promise<AreaUpdate[]> => {
  const client = getSupabaseAdminClient();
  let query = client.from("area_updates").select("*");

  if (options.area) {
    query = query.ilike("location", `%${options.area}%`);
  }

  const { data, error } = await query
    .order("scraped_at", { ascending: false })
    .limit(options.limit);

  if (error) {
    throw new HttpError(500, `Failed to fetch area updates: ${error.message}`);
  }

  return ((data ?? []) as AreaUpdateRow[]).map(mapAreaUpdate);
};

export const upsertAreaUpdates = async (
  payloads: UpsertAreaUpdateInput[]
): Promise<AreaUpdate[]> => {
  if (payloads.length === 0) {
    return [];
  }

  const client = getSupabaseAdminClient();
  const records: AreaUpdateInsert[] = payloads.map((payload) => ({
    external_id: payload.externalId,
    source: payload.source,
    source_url: payload.sourceUrl,
    alert_type: payload.alertType,
    location: payload.location,
    direction: payload.direction ?? null,
    involved: payload.involved ?? null,
    reported_time_text: payload.reportedTimeText ?? null,
    lane_status: payload.laneStatus ?? null,
    traffic_status: payload.trafficStatus ?? null,
    raw_text: payload.rawText,
    scraped_at: payload.scrapedAt
  }));

  const { data, error } = await client
    .from("area_updates")
    .upsert(records, {
      onConflict: "external_id"
    })
    .select("*");

  if (error) {
    throw new HttpError(500, `Failed to upsert area updates: ${error.message}`);
  }

  return ((data ?? []) as AreaUpdateRow[]).map(mapAreaUpdate);
};
