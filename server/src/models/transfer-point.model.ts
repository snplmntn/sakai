import { getSupabaseAdminClient } from "../config/supabase.js";
import { HttpError } from "../types/http-error.js";
import { mapTransferPoint, type TransferPoint } from "../types/route-network.js";
import type { Database } from "../types/database.js";

type TransferPointRow = Database["public"]["Tables"]["transfer_points"]["Row"];

export const listTransferPointsByStopIds = async (
  stopIds: string[]
): Promise<TransferPoint[]> => {
  if (stopIds.length === 0) {
    return [];
  }

  const uniqueStopIds = [...new Set(stopIds)];
  const client = getSupabaseAdminClient();
  const { data, error } = await client
    .from("transfer_points")
    .select("*")
    .or(
      `from_stop_id.in.(${uniqueStopIds.join(",")}),to_stop_id.in.(${uniqueStopIds.join(",")})`
    );

  if (error) {
    throw new HttpError(500, `Failed to fetch transfer points: ${error.message}`);
  }

  return ((data ?? []) as TransferPointRow[])
    .map(mapTransferPoint)
    .sort(
      (left, right) =>
        left.walkingDurationMinutes - right.walkingDurationMinutes ||
        left.walkingDistanceM - right.walkingDistanceM ||
        left.id.localeCompare(right.id)
    );
};
