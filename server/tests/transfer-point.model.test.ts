import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/supabase.js", () => ({
  getSupabaseAdminClient: vi.fn()
}));

import { getSupabaseAdminClient } from "../src/config/supabase.js";
import { listTransferPointsByStopIds } from "../src/models/transfer-point.model.js";

const mockedGetSupabaseAdminClient = vi.mocked(getSupabaseAdminClient);

describe("transfer point model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists transfer points for a stop set in deterministic order", async () => {
    const or = vi.fn().mockResolvedValue({
      data: [
        {
          id: "transfer-2",
          from_stop_id: "stop-1",
          to_stop_id: "stop-3",
          walking_distance_m: 300,
          walking_duration_minutes: 5,
          is_accessible: true,
          created_at: "2026-03-19T10:05:00.000Z"
        },
        {
          id: "transfer-1",
          from_stop_id: "stop-1",
          to_stop_id: "stop-2",
          walking_distance_m: 150,
          walking_duration_minutes: 3,
          is_accessible: true,
          created_at: "2026-03-19T10:05:00.000Z"
        }
      ],
      error: null
    });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or
        })
      })
    };

    mockedGetSupabaseAdminClient.mockReturnValue(client as never);

    const transfers = await listTransferPointsByStopIds(["stop-1", "stop-2"]);

    expect(or).toHaveBeenCalledWith("from_stop_id.in.(stop-1,stop-2),to_stop_id.in.(stop-1,stop-2)");
    expect(transfers.map((transfer) => transfer.id)).toEqual(["transfer-1", "transfer-2"]);
  });
});
